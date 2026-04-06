import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Bot, Context } from 'grammy';
import { TelegramService } from '../telegram/telegram.service';
import { StartHandler } from './handlers/start.handler';
import { MenuHandler } from './handlers/menu.handler';
import { BuyHandler } from './handlers/buy.handler';
import { ProfileHandler } from './handlers/profile.handler';
import { TopupHandler } from './handlers/topup.handler';
import { SupportHandler } from './handlers/support.handler';
import { ReferralHandler } from './handlers/referral.handler';
import { HowtoHandler } from './handlers/howto.handler';
import { AdminHandler } from './handlers/admin.handler';
import { BotStateService } from './services/bot-state.service';
import { BotUserService } from './services/bot-user.service';
import { PaymentService } from './payments/payment.service';
import { PrismaService } from '../prisma/prisma.service';

type GrammyBot = Bot<Context>;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: GrammyBot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly botUsers: BotUserService,
    private readonly state: BotStateService,
    private readonly payments: PaymentService,
    private readonly startH: StartHandler,
    private readonly menuH: MenuHandler,
    private readonly buyH: BuyHandler,
    private readonly profileH: ProfileHandler,
    private readonly topupH: TopupHandler,
    private readonly supportH: SupportHandler,
    private readonly referralH: ReferralHandler,
    private readonly howtoH: HowtoHandler,
    private readonly adminH: AdminHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('BOT_SHOP_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('Shop bot disabled via BOT_SHOP_ENABLED=false');
      return;
    }

    // Get the shared bot instance from TelegramService
    const sharedBot = this.telegramService.getBotInstance();
    if (!sharedBot) {
      this.logger.warn(
        'TelegramService has no bot instance (token not set?). Shop bot disabled.',
      );
      return;
    }

    this.bot = sharedBot;
    this.registerHandlers(this.bot);
    this.logger.log('Shop bot handlers registered on shared bot instance');

    // Now that both admin + shop handlers are registered, start polling.
    this.telegramService.startPolling();
  }

  async onModuleDestroy(): Promise<void> {
    // Polling lifecycle is managed by TelegramService — nothing to stop here.
    this.bot = null;
  }

  private registerHandlers(bot: GrammyBot): void {
    // Commands
    bot.command('start', (ctx) => this.startH.handle(ctx));
    bot.command('menu', (ctx) => this.menuH.showMainMenu(ctx));
    bot.command('buy', (ctx) => this.buyH.showPlans(ctx));
    bot.command('my', (ctx) => this.profileH.showProfile(ctx));
    bot.command('profile', (ctx) => this.profileH.showProfile(ctx));
    bot.command('topup', (ctx) => this.topupH.showMenu(ctx));
    bot.command('support', (ctx) => this.supportH.showMenu(ctx));
    bot.command('referral', (ctx) => this.referralH.showMenu(ctx));
    bot.command('howto', (ctx) => this.howtoH.showMenu(ctx));
    bot.command('cancel', async (ctx) => {
      if (ctx.from) this.state.clear(ctx.from.id);
      await ctx.reply('Cancelled.');
    });

    // Admin commands
    bot.command('broadcast', (ctx) => this.adminH.handleBroadcastStart(ctx));
    bot.command('give_sub', (ctx) => {
      const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
      return this.adminH.handleGiveSub(ctx, parts);
    });
    bot.command('ban', (ctx) => {
      const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
      return this.adminH.handleBan(ctx, parts);
    });
    bot.command('promo', (ctx) => {
      const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
      return this.adminH.handlePromoCreate(ctx, parts);
    });
    bot.command('promo_list', (ctx) => this.adminH.handlePromoList(ctx, []));
    bot.command('promo_delete', (ctx) => {
      const parts = (ctx.message?.text ?? '').split(/\s+/).slice(1);
      return this.adminH.handlePromoDelete(ctx, parts);
    });

    // Callback queries
    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      try {
        await this.routeCallback(ctx, data);
      } catch (err) {
        this.logger.error(`callback_query error for data=${data}`, err);
      }
      try {
        await ctx.answerCallbackQuery();
      } catch {
        /* ignore */
      }
    });

    // Pre-checkout (Telegram Stars)
    bot.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
      } catch (err) {
        this.logger.error('answerPreCheckoutQuery failed', err);
      }
    });

    // Successful payment (Telegram Stars)
    bot.on('message:successful_payment', async (ctx) => {
      const sp = ctx.message.successful_payment;
      if (!sp) return;
      const transactionId = sp.invoice_payload;
      try {
        await this.payments.completeTransaction(transactionId);
        await ctx.reply('Payment received. Your subscription is active.');
      } catch (err) {
        this.logger.error('Stars payment completion failed', err);
        await ctx.reply('Payment received but activation failed. Contact support.');
      }
    });

    // Text messages (stateful)
    bot.on('message:text', async (ctx) => {
      if (!ctx.from) return;
      const s = this.state.get(ctx.from.id);
      const text = ctx.message.text;

      switch (s.kind) {
        case 'await_promo':
          await this.buyH.handlePromoInput(ctx, text);
          break;
        case 'await_topup_amount':
          await this.topupH.handleAmountInput(ctx, text);
          break;
        case 'await_ticket_subject':
          await this.supportH.handleSubjectInput(ctx, text);
          break;
        case 'await_ticket_message':
          await this.supportH.handleReplyInput(ctx, text);
          break;
        case 'await_broadcast_text':
          await this.adminH.handleBroadcastText(ctx, text);
          break;
        default:
          /* idle - ignore free text */
          break;
      }
    });
  }

  private async routeCallback(ctx: Context, data: string): Promise<void> {
    if (data === 'back_main') {
      await this.menuH.showMainMenu(ctx);
      return;
    }
    if (data === 'buy_menu') {
      await this.buyH.showPlans(ctx);
      return;
    }
    if (data === 'profile_menu') {
      await this.profileH.showProfile(ctx);
      return;
    }
    if (data === 'topup_menu') {
      await this.topupH.showMenu(ctx);
      return;
    }
    if (data === 'support_menu') {
      await this.supportH.showMenu(ctx);
      return;
    }
    if (data === 'referral_menu') {
      await this.referralH.showMenu(ctx);
      return;
    }
    if (data === 'howto_menu') {
      await this.howtoH.showMenu(ctx);
      return;
    }
    if (data.startsWith('plan_')) {
      await this.buyH.showPaymentMethods(ctx, data.slice(5));
      return;
    }
    if (data.startsWith('pay_')) {
      // pay_<provider>_<planId>
      const rest = data.slice(4);
      const idx = rest.indexOf('_');
      if (idx > 0) {
        const provider = rest.slice(0, idx) as
          | 'yookassa'
          | 'stars'
          | 'cryptobot'
          | 'balance';
        const planId = rest.slice(idx + 1);
        await this.buyH.startCheckout(ctx, planId, provider);
      }
      return;
    }
    if (data.startsWith('promo_')) {
      const planId = data.slice(6);
      await this.buyH.promptPromo(ctx, planId, 'yookassa');
      return;
    }
    if (data === 'topup_yookassa') {
      await this.topupH.promptAmount(ctx, 'yookassa');
      return;
    }
    if (data === 'topup_cryptobot') {
      await this.topupH.promptAmount(ctx, 'cryptobot');
      return;
    }
    if (data === 'support_new') {
      await this.supportH.startNewTicket(ctx);
      return;
    }
    if (data === 'support_my') {
      await this.supportH.showMyTickets(ctx);
      return;
    }
    if (data.startsWith('ticket_reply_')) {
      await this.supportH.promptReply(ctx, data.slice('ticket_reply_'.length));
      return;
    }
    if (data.startsWith('ticket_')) {
      await this.supportH.showTicket(ctx, data.slice(7));
      return;
    }
    if (data.startsWith('howto_')) {
      await this.howtoH.showPlatform(ctx, data.slice(6));
      return;
    }
  }

  /** Send a direct message to a user -- used by admin UI broadcast and notifications. */
  async sendMessage(telegramId: number | bigint, text: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.api.sendMessage(Number(telegramId), text);
      return true;
    } catch (err) {
      this.logger.warn(`sendMessage to ${telegramId} failed: ${String(err)}`);
      return false;
    }
  }

  getBot(): GrammyBot | null {
    return this.bot;
  }
}
