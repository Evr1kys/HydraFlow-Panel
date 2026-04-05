import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { BotUser, BotPlan, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface GrantResult {
  user: User;
  botUser: BotUser;
  expiryDate: Date;
  isNew: boolean;
}

@Injectable()
export class SubscriptionGrantService {
  private readonly logger = new Logger(SubscriptionGrantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Grant a subscription (create new panel user or extend existing one) based on the plan.
   * Called after successful payment.
   */
  async grant(params: {
    botUser: BotUser;
    plan: BotPlan;
    paidAmount?: number;
  }): Promise<GrantResult> {
    const { botUser, plan } = params;
    const now = Date.now();
    const addMs = plan.daysDuration * 86400000;

    let user: User;
    let isNew = false;

    if (botUser.userId) {
      const existing = await this.prisma.user.findUnique({
        where: { id: botUser.userId },
      });
      if (existing) {
        const base =
          existing.expiryDate && existing.expiryDate.getTime() > now
            ? existing.expiryDate.getTime()
            : now;
        const newExpiry = new Date(base + addMs);
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            expiryDate: newExpiry,
            enabled: true,
            trafficUp: BigInt(0),
            trafficDown: BigInt(0),
            trafficLimit:
              plan.trafficGb !== null
                ? BigInt(plan.trafficGb) * BigInt(1024) * BigInt(1024) * BigInt(1024)
                : null,
          },
        });
      } else {
        this.logger.warn(
          `BotUser ${botUser.id} linked to non-existent User ${botUser.userId}, creating new`,
        );
        user = await this.createPanelUser(botUser, plan);
        isNew = true;
      }
    } else {
      user = await this.createPanelUser(botUser, plan);
      isNew = true;
    }

    // Update the linkage + totalSpent
    const paidAmount = params.paidAmount ?? Number(plan.price);
    const updatedBotUser = await this.prisma.botUser.update({
      where: { id: botUser.id },
      data: {
        userId: user.id,
        totalSpent: {
          increment: paidAmount.toFixed(2),
        },
      },
    });

    // Referral commission: give referrer 10% back on first buy
    if (botUser.referredBy && isNew) {
      try {
        const referrer = await this.prisma.botUser.findUnique({
          where: { telegramId: BigInt(botUser.referredBy) },
        });
        if (referrer) {
          const commission = paidAmount * 0.1;
          await this.prisma.botUser.update({
            where: { id: referrer.id },
            data: { balance: { increment: commission.toFixed(2) } },
          });
          this.logger.log(
            `Referral commission ${commission} credited to ${referrer.telegramId}`,
          );
        }
      } catch (err) {
        this.logger.error('Failed to credit referral commission', err);
      }
    }

    // Emit renewed event
    this.eventEmitter.emit('user.renewed', {
      id: user.id,
      email: user.email,
      expiryDate: user.expiryDate,
    });

    return {
      user,
      botUser: updatedBotUser,
      expiryDate: user.expiryDate!,
      isNew,
    };
  }

  private async createPanelUser(
    botUser: BotUser,
    plan: BotPlan,
  ): Promise<User> {
    const expiryDate = new Date(Date.now() + plan.daysDuration * 86400000);
    const email = `bot_${botUser.telegramId.toString()}@hydraflow.local`;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          expiryDate,
          enabled: true,
          telegramId: botUser.telegramId,
          botUserId: botUser.id,
          trafficLimit:
            plan.trafficGb !== null
              ? BigInt(plan.trafficGb) * BigInt(1024) * BigInt(1024) * BigInt(1024)
              : null,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        remark: `Bot user ${botUser.username ? '@' + botUser.username : botUser.telegramId.toString()}`,
        telegramId: botUser.telegramId,
        botUserId: botUser.id,
        expiryDate,
        trafficLimit:
          plan.trafficGb !== null
            ? BigInt(plan.trafficGb) * BigInt(1024) * BigInt(1024) * BigInt(1024)
            : null,
      },
    });
  }

  /** Manually grant subscription — for /give_sub admin command. */
  async manualGrant(params: {
    telegramId: number | bigint;
    days: number;
    trafficGb?: number | null;
  }): Promise<GrantResult> {
    const botUser = await this.prisma.botUser.findUnique({
      where: { telegramId: BigInt(params.telegramId) },
    });
    if (!botUser) {
      throw new Error(`BotUser with telegramId=${params.telegramId} not found`);
    }
    const plan: BotPlan = {
      id: 'manual',
      name: 'manual',
      daysDuration: params.days,
      trafficGb: params.trafficGb ?? null,
      price: 0 as unknown as BotPlan['price'],
      currency: 'RUB',
      enabled: true,
      sortOrder: 0,
      createdAt: new Date(),
    };
    return this.grant({ botUser, plan, paidAmount: 0 });
  }
}
