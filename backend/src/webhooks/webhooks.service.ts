import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

export type WebhookEvent =
  | 'user.created'
  | 'user.deleted'
  | 'user.toggled'
  | 'protocol.blocked'
  | 'protocol.recovered';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async remove(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  async fire(event: WebhookEvent, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { enabled: true },
    });

    const matching = webhooks.filter((w) => w.events.includes(event));

    for (const webhook of matching) {
      this.sendWebhook(webhook.url, webhook.secret, event, payload).catch(
        (err) => {
          this.logger.warn(
            `Failed to fire webhook ${webhook.id} to ${webhook.url}: ${String(err)}`,
          );
        },
      );
    }
  }

  private async sendWebhook(
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      this.logger.warn(
        `Webhook to ${url} returned status ${response.status}`,
      );
    }
  }
}
