import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { YooKassaProvider } from './providers/yookassa.provider';
import { StripeProvider } from './providers/stripe.provider';
import { CryptoProvider } from './providers/crypto.provider';
import type {
  PaymentProvider,
  WebhookResult,
} from './providers/payment-provider.interface';

export type ProviderName = 'yookassa' | 'stripe' | 'crypto';

export interface CheckoutResult {
  subscriptionId: string;
  provider: ProviderName;
  externalId: string;
  confirmationUrl: string | null;
  status: string;
}

@Injectable()
export class UserBillingService {
  private readonly logger = new Logger(UserBillingService.name);
  private readonly providers: Record<ProviderName, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly yookassa: YooKassaProvider,
    private readonly stripe: StripeProvider,
    private readonly crypto: CryptoProvider,
  ) {
    this.providers = {
      yookassa: this.yookassa,
      stripe: this.stripe,
      crypto: this.crypto,
    };
  }

  getProvider(name: ProviderName): PaymentProvider {
    const p = this.providers[name];
    if (!p) {
      throw new BadRequestException(`Unknown provider: ${name}`);
    }
    return p;
  }

  /**
   * Create a pending subscription and launch a payment with the provider.
   * Returns the confirmation URL the user should be redirected to.
   */
  async createCheckout(dto: CreateCheckoutDto): Promise<CheckoutResult> {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.prisma.userSubscription.create({
      data: {
        userId: dto.userId,
        plan: dto.plan,
        priceAmount: dto.priceAmount,
        priceCurrency: dto.priceCurrency ?? 'USD',
        provider: dto.provider,
        status: 'pending',
        trafficGb: dto.trafficGb ?? null,
        daysDuration: dto.daysDuration,
      },
    });

    const provider = this.getProvider(dto.provider);

    try {
      const result = await provider.createPayment(
        dto.priceAmount,
        dto.priceCurrency ?? 'USD',
        {
          userId: dto.userId,
          plan: dto.plan,
          subscriptionId: subscription.id,
          returnUrl: dto.returnUrl,
          description: dto.description,
        },
      );

      await this.prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { externalId: result.externalId },
      });

      return {
        subscriptionId: subscription.id,
        provider: dto.provider,
        externalId: result.externalId,
        confirmationUrl: result.confirmationUrl,
        status: result.status,
      };
    } catch (err) {
      await this.prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
      throw err;
    }
  }

  /**
   * Process an incoming webhook from a payment provider.
   * Verifies signature, parses payload, and on success renews the user.
   */
  async processWebhook(
    providerName: ProviderName,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    body: unknown,
  ): Promise<{ ok: true }> {
    const provider = this.getProvider(providerName);
    if (!provider.verifyWebhook(headers, rawBody)) {
      this.logger.warn(`Webhook verification failed for provider ${providerName}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const result = provider.handleWebhook(body);
    await this.applyWebhookResult(providerName, result);
    return { ok: true };
  }

  private async applyWebhookResult(
    providerName: ProviderName,
    result: WebhookResult,
  ): Promise<void> {
    // Locate the subscription – prefer subscriptionId from metadata,
    // otherwise look up by externalId.
    let subscription = result.subscriptionId
      ? await this.prisma.userSubscription.findUnique({
          where: { id: result.subscriptionId },
        })
      : null;

    if (!subscription && result.externalId) {
      subscription = await this.prisma.userSubscription.findFirst({
        where: { externalId: result.externalId, provider: providerName },
      });
    }

    if (!subscription) {
      this.logger.warn(
        `Webhook for unknown subscription (provider=${providerName}, ext=${result.externalId})`,
      );
      return;
    }

    if (result.status === 'succeeded') {
      await this.activateSubscription(subscription.id);
    } else if (result.status === 'failed' || result.status === 'canceled') {
      await this.prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    }
  }

  /**
   * Mark a subscription active and extend the user's expiry + traffic.
   * Emits 'user.renewed' event.
   */
  async activateSubscription(subscriptionId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (subscription.status === 'active') {
      return subscription;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: subscription.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = Date.now();
    const addMs = subscription.daysDuration * 86400000;
    const base =
      user.expiryDate && user.expiryDate.getTime() > now
        ? user.expiryDate.getTime()
        : now;
    const newExpiry = new Date(base + addMs);

    const trafficLimitBytes =
      subscription.trafficGb !== null && subscription.trafficGb !== undefined
        ? BigInt(subscription.trafficGb) * BigInt(1024 * 1024 * 1024)
        : user.trafficLimit;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        expiryDate: newExpiry,
        trafficLimit: trafficLimitBytes,
      },
    });

    const updatedSub = await this.prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        startDate: new Date(),
        endDate: newExpiry,
      },
    });

    this.eventEmitter.emit('user.renewed', {
      userId: user.id,
      email: user.email,
      subscriptionId: subscription.id,
      days: subscription.daysDuration,
    });

    return updatedSub;
  }

  /**
   * Manually mark a pending subscription as paid (admin action).
   * Used for crypto/manual flows.
   */
  async manualConfirm(subscriptionId: string) {
    return this.activateSubscription(subscriptionId);
  }

  async getAllSubscriptions() {
    return this.prisma.userSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.userSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelSubscription(id: string) {
    const sub = await this.prisma.userSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return this.prisma.userSubscription.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }

  /**
   * Handle due renewals for subscriptions with autoRenew=true.
   * Intended to be called periodically by a cron.
   */
  async processRenewals(): Promise<{ renewed: number }> {
    const now = new Date();
    const dueSubs = await this.prisma.userSubscription.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        endDate: { lte: now },
      },
    });

    let renewed = 0;
    for (const sub of dueSubs) {
      try {
        // Re-create a pending sub using the same plan/provider. The actual
        // payment is the provider's job via stored payment method; for now
        // just mark the existing sub expired and the user's access lapses
        // until they pay again.
        await this.prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: 'expired' },
        });
        renewed++;
      } catch (err) {
        this.logger.warn(
          `Renewal failed for subscription ${sub.id}: ${String(err)}`,
        );
      }
    }

    return { renewed };
  }
}
