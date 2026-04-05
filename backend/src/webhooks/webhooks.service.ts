import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhookQueueService } from './webhook-queue.service';

export type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.toggled'
  | 'user.renewed'
  | 'user.traffic.reset'
  | 'protocol.blocked'
  | 'protocol.recovered';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WebhookQueueService,
  ) {}

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
      try {
        const delivery = await this.prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: payload as Prisma.InputJsonValue,
            status: 'pending',
            attempts: 0,
          },
        });
        await this.queue.enqueue({
          deliveryId: delivery.id,
          webhookId: webhook.id,
          url: webhook.url,
          secret: webhook.secret,
          event,
          payload,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to enqueue webhook ${webhook.id}: ${String(err)}`,
        );
      }
    }
  }

  // --- Delivery management ---

  async listDeliveries(webhookId: string, limit = 50) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async retryDelivery(webhookId: string, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery || delivery.webhookId !== webhookId) {
      throw new NotFoundException('Delivery not found');
    }
    await this.queue.retry(deliveryId);
    return { message: 'Retry scheduled' };
  }

  async deliveryStats() {
    const grouped = await this.prisma.webhookDelivery.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const stats: Record<string, number> = {
      pending: 0,
      success: 0,
      failed: 0,
      dead: 0,
    };
    for (const row of grouped) {
      stats[row.status] = row._count._all;
    }
    return stats;
  }
}
