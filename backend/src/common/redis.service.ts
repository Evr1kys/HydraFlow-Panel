import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });

    try {
      await this.client.connect();
      this.logger.log(`Connected to Redis at ${url}`);
    } catch (err) {
      this.logger.error(
        `Failed to connect to Redis at ${url}: ${String(err)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string): Promise<'OK'> {
    return this.getClient().set(key, value);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    return this.getClient().setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }
}
