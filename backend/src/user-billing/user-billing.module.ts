import { Module } from '@nestjs/common';
import { UserBillingController } from './user-billing.controller';
import { UserBillingService } from './user-billing.service';
import { AuthModule } from '../auth/auth.module';
import { YooKassaProvider } from './providers/yookassa.provider';
import { StripeProvider } from './providers/stripe.provider';
import { CryptoProvider } from './providers/crypto.provider';

@Module({
  imports: [AuthModule],
  controllers: [UserBillingController],
  providers: [
    UserBillingService,
    YooKassaProvider,
    StripeProvider,
    CryptoProvider,
  ],
  exports: [UserBillingService],
})
export class UserBillingModule {}
