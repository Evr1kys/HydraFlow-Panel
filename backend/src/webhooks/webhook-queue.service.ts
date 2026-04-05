import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

export const WEBHOOK_QUEUE_NAME = 'webhook-delivery';

export interface WebhookJobData {
  deliveryId: string;
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * BullMQ-backed webhook delivery queue.
 *
 * - 5 attempts with exponential backoff: 10s, 30s, 2m, 10m, 1h.
 * - Signs body with HMAC-SHA256 using the webhook's secret.
 * - On success: WebhookDelivery.status = 'success', deliveredAt = now.
 * - On final failure: status = 'dead' and a 'webhook.dead' event is emitted
 *   (TelegramService or similar can subscribe for alerting).
 */
@Injectable()
export class WebhookQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);
  private queue: Queue<WebhookJobData> | null = null;
  private worker: Worker<WebhookJobData> | null = null;
  private events: QueueEvents | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const connection = { url };

    this.queue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'custom',
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });

    // Exponential backoff: 10s, 30s, 2m, 10m, 1h
    const delays = [10_000, 30_000, 120_000, 600_000, 3_600_000];

    this.worker = new Worker<WebhookJobData>(
      WEBHOOK_QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            const idx = Math.min(attemptsMade, delays.length - 1);
            return delays[idx];
          },
        },
      },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 5;

      await this.prisma.webhookDelivery
        .update({
          where: { id: job.data.deliveryId },
          data: {
            attempts: attemptsMade,
            lastError: err.message.slice(0, 500),
            nextRetryAt:
              attemptsMade < maxAttempts
                ? new Date(
                    Date.now() + delays[Math.min(attemptsMade, delays.length - 1)],
                  )
                : null,
          },
        })
        .catch(() => {
          /* ignore */
        });

      if (attemptsMade >= maxAttempts) {
        await this.markDead(job.data.deliveryId, err.message);
      }
      this.metrics.incWebhookDelivery('failed');
    });

    this.worker.on('completed', () => {
      this.metrics.incWebhookDelivery('success');
    });

    this.events = new QueueEvents(WEBHOOK_QUEUE_NAME, { connection });

    this.logger.log('Webhook delivery queue started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.events?.close();
    await this.queue?.close();
  }

  async enqueue(data: WebhookJobData): Promise<void> {
    if (!this.queue) {
      this.logger.warn('Queue not initialized, skipping webhook delivery');
      return;
    }
    await this.queue.add('deliver', data, {
      jobId: data.deliveryId,
    });
  }

  /**
   * Re-enqueue an existing delivery (manual retry). Resets attempts.
   */
  async retry(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new Error('Delivery not found');
    }
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: delivery.webhookId },
    });
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextRetryAt: null,
      },
    });

    // New jobId so BullMQ doesn't dedupe with the old completed/failed job.
    if (!this.queue) return;
    await this.queue.add(
      'deliver',
      {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        event: delivery.event,
        payload: delivery.payload as Record<string, unknown>,
      },
      {
        jobId: `${delivery.id}:retry:${Date.now()}`,
      },
    );
  }

  private async processJob(job: Job<WebhookJobData>): Promise<void> {
    const { deliveryId, url, secret, event, payload } = job.data;
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({ event, payload, timestamp });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: job.attemptsMade + 1 },
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': timestamp,
      },
      body,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Non-2xx response: ${response.status}`);
    }

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'success',
        deliveredAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
    });
  }

  private async markDead(deliveryId: string, errMessage: string) {
    try {
      const delivery = await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'dead', lastError: errMessage.slice(0, 500) },
      });

      this.eventEmitter.emit('webhook.dead', {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        event: delivery.event,
        lastError: errMessage,
      });
      this.logger.warn(
        `Webhook delivery ${deliveryId} marked DEAD after max retries: ${errMessage}`,
      );
    } catch (err) {
      this.logger.error(`Failed to mark delivery dead: ${String(err)}`);
    }
  }
}
