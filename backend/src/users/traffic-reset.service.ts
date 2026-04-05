import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const ROLLING_WINDOW_MS = 30 * DAY_MS;

type TrafficStrategy = 'DAY' | 'WEEK' | 'MONTH' | 'MONTH_ROLLING';

/**
 * Daily scheduled task that enforces per-user trafficStrategy resets.
 * Runs at 00:00 (midnight) every day.
 *
 * Strategies:
 *  - NO_RESET       : never reset (skipped)
 *  - DAY            : reset when now - lastTrafficResetAt >= 24h
 *  - WEEK           : reset on Monday (every 7 days from last reset)
 *  - MONTH          : reset on the 1st day of each month
 *  - MONTH_ROLLING  : reset every 30 days from lastTrafficResetAt
 *                     (or createdAt if lastTrafficResetAt is null)
 */
@Injectable()
export class TrafficResetService {
  private readonly logger = new Logger(TrafficResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyResets(): Promise<void> {
    try {
      const now = new Date();
      const users = await this.prisma.user.findMany({
        where: { trafficStrategy: { not: 'NO_RESET' } },
      });

      let resetCount = 0;
      for (const user of users) {
        const strategy = user.trafficStrategy as TrafficStrategy;
        const reference = user.lastTrafficResetAt ?? user.createdAt;
        if (!this.shouldReset(strategy, reference, now)) continue;

        const accumulated =
          user.lifetimeTrafficUsed + user.trafficUp + user.trafficDown;

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            trafficUp: BigInt(0),
            trafficDown: BigInt(0),
            lifetimeTrafficUsed: accumulated,
            lastTrafficResetAt: now,
          },
        });

        this.eventEmitter.emit('user.traffic.reset.auto', {
          userId: user.id,
          email: user.email,
          strategy,
          resetAt: now,
        });

        resetCount += 1;
      }

      if (resetCount > 0) {
        this.logger.log(
          `Traffic strategy reset: ${resetCount} user(s) reset.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to run traffic strategy reset: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private shouldReset(
    strategy: TrafficStrategy,
    reference: Date,
    now: Date,
  ): boolean {
    switch (strategy) {
      case 'DAY':
        return now.getTime() - reference.getTime() >= DAY_MS;

      case 'WEEK': {
        // Reset every Monday (ISO weekday 1). Ensure at least a week since last reset.
        const isMonday = now.getDay() === 1;
        const elapsed = now.getTime() - reference.getTime();
        return isMonday && elapsed >= WEEK_MS;
      }

      case 'MONTH': {
        // First day of the month. Ensure the reference is in a prior month.
        if (now.getDate() !== 1) return false;
        const sameMonth =
          reference.getFullYear() === now.getFullYear() &&
          reference.getMonth() === now.getMonth();
        return !sameMonth;
      }

      case 'MONTH_ROLLING':
        return now.getTime() - reference.getTime() >= ROLLING_WINDOW_MS;

      default:
        return false;
    }
  }
}
