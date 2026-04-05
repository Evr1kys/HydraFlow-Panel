import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Heleket provider — STUB. To be fleshed out when API credentials are available.
 * Returns a fake URL for now; do not use in production.
 */
@Injectable()
export class HeleketProvider implements PaymentProvider {
  readonly name = 'heleket';
  private readonly logger = new Logger(HeleketProvider.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('HELEKET_API_KEY');
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    this.logger.warn('Heleket provider is a stub — no real payment created');
    return {
      providerPaymentId: `heleket_stub_${params.transactionId}`,
      paymentUrl: 'https://example.com/heleket-stub',
    };
  }
}
