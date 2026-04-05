import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hourly scheduled task that looks for users whose subscription has expired
 * and have not been disabled yet. For each match it disables the user and
 * emits `user.expired` so listeners (Telegram / Email) can react.
 */
@Injectable()
export class ExpiryCheckerService {
  private readonly logger = new Logger(ExpiryCheckerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpired(): Promise<void> {
    try {
      const now = new Date();
      const users = await this.prisma.user.findMany({
        where: {
          enabled: true,
          expiryDate: { lt: now, not: null },
        },
      });

      for (const user of users) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { enabled: false },
        });
        this.eventEmitter.emit('user.expired', {
          id: user.id,
          email: user.email,
          expiryDate: user.expiryDate,
        });
      }

      if (users.length > 0) {
        this.logger.log(`Expired ${users.length} user(s)`);
      }
    } catch (err) {
      this.logger.error('Failed to run expiry checker', err);
    }
  }

  /**
   * Nightly task to notify users whose subscription expires within 3 days.
   * Emits `user.expiring_soon` for listeners.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async notifyExpiringSoon(): Promise<void> {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const users = await this.prisma.user.findMany({
        where: {
          enabled: true,
          expiryDate: { gte: now, lte: soon },
        },
      });
      for (const user of users) {
        this.eventEmitter.emit('user.expiring_soon', {
          id: user.id,
          email: user.email,
          expiryDate: user.expiryDate,
        });
      }
    } catch (err) {
      this.logger.error('Failed to run expiring-soon notifier', err);
    }
  }
}
