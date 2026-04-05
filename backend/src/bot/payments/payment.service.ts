import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { BotTransaction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BotPlanService } from '../services/bot-plan.service';
import { BotUserService } from '../services/bot-user.service';
import { PromoService } from '../services/promo.service';
import { SubscriptionGrantService } from '../services/subscription-grant.service';
import { YooKassaProvider } from './providers/yookassa.provider';
import { TelegramStarsProvider } from './providers/telegram-stars.provider';
import { CryptoBotProvider } from './providers/cryptobot.provider';
import { HeleketProvider } from './providers/heleket.provider';
import type {
  CreatePaymentResult,
  PaymentProvider,
} from './providers/payment-provider.interface';

export interface CreateCheckoutParams {
  botUserId: string;
  planId: string;
  provider: 'yookassa' | 'stars' | 'cryptobot' | 'heleket' | 'balance';
  promoCode?: string;
}

export interface CheckoutResult {
  transaction: BotTransaction;
  payment: CreatePaymentResult | null;
  finalAmount: number;
  usedBalance: boolean;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botUsers: BotUserService,
    private readonly botPlans: BotPlanService,
    private readonly promos: PromoService,
    private readonly grants: SubscriptionGrantService,
    private readonly yookassa: YooKassaProvider,
    private readonly stars: TelegramStarsProvider,
    private readonly cryptobot: CryptoBotProvider,
    private readonly heleket: HeleketProvider,
  ) {}

  private getProvider(name: string): PaymentProvider | null {
    switch (name) {
      case 'yookassa':
        return this.yookassa;
      case 'stars':
        return this.stars;
      case 'cryptobot':
        return this.cryptobot;
      case 'heleket':
        return this.heleket;
      default:
        return null;
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const botUser = await this.botUsers.findById(params.botUserId);
    if (!botUser) throw new NotFoundException('BotUser not found');
    if (botUser.banned) throw new Error('User is banned');
    const plan = await this.botPlans.findById(params.planId);
    if (!plan.enabled) throw new Error('Plan is disabled');

    let amount = Number(plan.price);
    let appliedPromo: string | null = null;
    if (params.promoCode) {
      const result = await this.promos.apply(params.promoCode, amount);
      if (result.valid) {
        amount = result.discountedAmount;
        appliedPromo = params.promoCode.trim().toUpperCase();
      }
    }

    // Balance-only checkout
    if (params.provider === 'balance') {
      const balance = Number(botUser.balance);
      if (balance < amount) {
        throw new Error('Insufficient balance');
      }
      // Deduct balance and grant immediately
      await this.botUsers.adjustBalance(botUser.id, -amount);
      const tx = await this.prisma.botTransaction.create({
        data: {
          botUserId: botUser.id,
          type: 'purchase',
          amount: amount.toFixed(2),
          currency: plan.currency,
          provider: 'balance',
          status: 'completed',
          planId: plan.id,
          promoCode: appliedPromo,
          completedAt: new Date(),
        },
      });
      if (appliedPromo) {
        await this.promos.incrementUsage(appliedPromo);
      }
      await this.grants.grant({ botUser, plan, paidAmount: amount });
      return {
        transaction: tx,
        payment: null,
        finalAmount: amount,
        usedBalance: true,
      };
    }

    const provider = this.getProvider(params.provider);
    if (!provider) throw new Error(`Unknown provider: ${params.provider}`);
    if (!provider.isEnabled()) {
      throw new Error(`Provider ${params.provider} not configured`);
    }

    // Create transaction
    const tx = await this.prisma.botTransaction.create({
      data: {
        botUserId: botUser.id,
        type: 'purchase',
        amount: amount.toFixed(2),
        currency: plan.currency,
        provider: params.provider,
        status: 'pending',
        planId: plan.id,
        promoCode: appliedPromo,
      },
    });

    try {
      const payment = await provider.createPayment({
        transactionId: tx.id,
        amount,
        currency: plan.currency,
        description: `${plan.name} — ${plan.daysDuration} days`,
        telegramId: Number(botUser.telegramId),
      });
      await this.prisma.botTransaction.update({
        where: { id: tx.id },
        data: { providerPaymentId: payment.providerPaymentId },
      });
      const updatedTx = await this.prisma.botTransaction.findUniqueOrThrow({
        where: { id: tx.id },
      });
      return { transaction: updatedTx, payment, finalAmount: amount, usedBalance: false };
    } catch (err) {
      await this.prisma.botTransaction.update({
        where: { id: tx.id },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Create a topup transaction (no subscription grant).
   */
  async createTopup(params: {
    botUserId: string;
    amount: number;
    currency: string;
    provider: 'yookassa' | 'cryptobot' | 'heleket' | 'stars';
  }): Promise<{ transaction: BotTransaction; payment: CreatePaymentResult }> {
    const botUser = await this.botUsers.findById(params.botUserId);
    if (!botUser) throw new NotFoundException('BotUser not found');
    if (botUser.banned) throw new Error('User is banned');

    const provider = this.getProvider(params.provider);
    if (!provider) throw new Error(`Unknown provider: ${params.provider}`);
    if (!provider.isEnabled()) {
      throw new Error(`Provider ${params.provider} not configured`);
    }

    const tx = await this.prisma.botTransaction.create({
      data: {
        botUserId: botUser.id,
        type: 'topup',
        amount: params.amount.toFixed(2),
        currency: params.currency,
        provider: params.provider,
        status: 'pending',
      },
    });

    try {
      const payment = await provider.createPayment({
        transactionId: tx.id,
        amount: params.amount,
        currency: params.currency,
        description: `Top-up ${params.amount} ${params.currency}`,
        telegramId: Number(botUser.telegramId),
      });
      await this.prisma.botTransaction.update({
        where: { id: tx.id },
        data: { providerPaymentId: payment.providerPaymentId },
      });
      const updatedTx = await this.prisma.botTransaction.findUniqueOrThrow({
        where: { id: tx.id },
      });
      return { transaction: updatedTx, payment };
    } catch (err) {
      await this.prisma.botTransaction.update({
        where: { id: tx.id },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Mark a transaction completed (called by webhooks).
   * If it's a purchase, grant the subscription. If it's a topup, credit balance.
   */
  async completeTransaction(transactionId: string): Promise<void> {
    const tx = await this.prisma.botTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) {
      this.logger.warn(`completeTransaction: tx ${transactionId} not found`);
      return;
    }
    if (tx.status === 'completed') {
      this.logger.log(`Transaction ${transactionId} already completed, skipping`);
      return;
    }

    await this.prisma.botTransaction.update({
      where: { id: tx.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    if (tx.type === 'purchase' && tx.planId) {
      const botUser = await this.prisma.botUser.findUnique({
        where: { id: tx.botUserId },
      });
      const plan = await this.prisma.botPlan.findUnique({
        where: { id: tx.planId },
      });
      if (botUser && plan) {
        await this.grants.grant({
          botUser,
          plan,
          paidAmount: Number(tx.amount),
        });
        if (tx.promoCode) {
          try {
            await this.promos.incrementUsage(tx.promoCode);
          } catch (err) {
            this.logger.error('Failed to increment promo usage', err);
          }
        }
      }
    } else if (tx.type === 'topup') {
      await this.botUsers.adjustBalance(tx.botUserId, Number(tx.amount));
    }
  }

  async failTransaction(transactionId: string, reason?: string): Promise<void> {
    this.logger.warn(`Transaction ${transactionId} failed: ${reason ?? ''}`);
    await this.prisma.botTransaction.update({
      where: { id: transactionId },
      data: { status: 'failed' },
    });
  }
}
