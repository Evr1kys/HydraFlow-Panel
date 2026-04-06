import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../common/redis.service';
import { BotService } from './bot.service';

export interface BroadcastJobData {
  telegramId: string; // stored as string to avoid bigint serialisation issues
  text: string;
  broadcastId: string;
}

export interface BroadcastStatus {
  broadcastId: string;
  queued: number;
}

@Injectable()
export class BroadcastQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastQueueService.name);
  private queue: Queue<BroadcastJobData> | null = null;
  private worker: Worker<BroadcastJobData> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly botService: BotService,
  ) {}

  async onModuleInit() {
    try {
      const client = this.redis.getClient();
      const connection = {
        host: client.options?.host ?? 'localhost',
        port: client.options?.port ?? 6379,
        password: client.options?.password,
        db: client.options?.db ?? 0,
      };

      this.queue = new Queue<BroadcastJobData>('bot-broadcast', {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });

      this.worker = new Worker<BroadcastJobData>(
        'bot-broadcast',
        async (job: Job<BroadcastJobData>) => {
          const { telegramId, text } = job.data;
          const ok = await this.botService.sendMessage(
            BigInt(telegramId),
            text,
          );
          if (!ok) {
            this.logger.warn(
              `Broadcast to ${telegramId} failed (job ${job.id})`,
            );
          }
        },
        {
          connection,
          concurrency: 1,
          limiter: {
            max: 30,
            duration: 1000, // 30 messages per second — Telegram limit
          },
        },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.warn(
          `Broadcast job ${job?.id ?? '?'} failed: ${err.message}`,
        );
      });

      this.logger.log('Broadcast queue initialised');
    } catch (err) {
      this.logger.warn(
        `Failed to initialise broadcast queue (Redis unavailable?): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  /**
   * Enqueue broadcast messages for all given Telegram IDs.
   * Returns immediately with the count of queued jobs.
   */
  async enqueueBroadcast(
    telegramIds: bigint[],
    text: string,
  ): Promise<BroadcastStatus> {
    if (!this.queue) {
      throw new Error('Broadcast queue not available (Redis not connected)');
    }

    const broadcastId = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const jobs = telegramIds.map((tgId) => ({
      name: 'send',
      data: {
        telegramId: tgId.toString(),
        text,
        broadcastId,
      },
    }));

    // BullMQ addBulk for efficient batch insert
    await this.queue.addBulk(jobs);

    this.logger.log(
      `Broadcast ${broadcastId}: ${jobs.length} messages queued`,
    );

    return { broadcastId, queued: jobs.length };
  }
}
