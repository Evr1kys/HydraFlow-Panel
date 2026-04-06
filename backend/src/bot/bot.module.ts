import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BotService } from './bot.service';
import { BotAdminController } from './bot-admin.controller';
import { BotWebhookController } from './payments/webhook.controller';
import { KeyboardBuilder } from './keyboards/keyboard.builder';
import { PaymentService } from './payments/payment.service';
import { YooKassaProvider } from './payments/providers/yookassa.provider';
import { TelegramStarsProvider } from './payments/providers/telegram-stars.provider';
import { CryptoBotProvider } from './payments/providers/cryptobot.provider';
import { HeleketProvider } from './payments/providers/heleket.provider';
import { BotUserService } from './services/bot-user.service';
import { BotPlanService } from './services/bot-plan.service';
import { BotButtonService } from './services/bot-button.service';
import { PromoService } from './services/promo.service';
import { SubscriptionGrantService } from './services/subscription-grant.service';
import { BotStateService } from './services/bot-state.service';
import { BroadcastQueueService } from './broadcast-queue.service';
import { StartHandler } from './handlers/start.handler';
import { MenuHandler } from './handlers/menu.handler';
import { BuyHandler } from './handlers/buy.handler';
import { ProfileHandler } from './handlers/profile.handler';
import { TopupHandler } from './handlers/topup.handler';
import { SupportHandler } from './handlers/support.handler';
import { ReferralHandler } from './handlers/referral.handler';
import { HowtoHandler } from './handlers/howto.handler';
import { AdminHandler } from './handlers/admin.handler';

@Module({
  imports: [ConfigModule, AuthModule, TelegramModule],
  controllers: [BotAdminController, BotWebhookController],
  providers: [
    BotService,
    BroadcastQueueService,
    KeyboardBuilder,
    BotStateService,
    BotUserService,
    BotPlanService,
    BotButtonService,
    PromoService,
    SubscriptionGrantService,
    PaymentService,
    YooKassaProvider,
    TelegramStarsProvider,
    CryptoBotProvider,
    HeleketProvider,
    StartHandler,
    MenuHandler,
    BuyHandler,
    ProfileHandler,
    TopupHandler,
    SupportHandler,
    ReferralHandler,
    HowtoHandler,
    AdminHandler,
  ],
  exports: [BotService, BotUserService, PaymentService, BroadcastQueueService],
})
export class BotModule {}
