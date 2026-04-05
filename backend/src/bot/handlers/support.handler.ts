import { Injectable } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { BotUserService } from '../services/bot-user.service';
import { BotStateService } from '../services/bot-state.service';

@Injectable()
export class SupportHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botUsers: BotUserService,
    private readonly state: BotStateService,
  ) {}

  async showMenu(ctx: Context): Promise<void> {
    const kb = new InlineKeyboard()
      .text('New ticket', 'support_new')
      .row()
      .text('My tickets', 'support_my')
      .row()
      .text('Back', 'back_main');
    await this.safeEdit(ctx, 'Support — how can we help?', kb);
  }

  async startNewTicket(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    this.state.set(from.id, { kind: 'await_ticket_subject' });
    await ctx.reply('Briefly describe your issue (1 message, up to 500 chars):');
  }

  async handleSubjectInput(ctx: Context, text: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const s = this.state.get(from.id);
    if (s.kind !== 'await_ticket_subject') return;
    this.state.clear(from.id);

    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }

    const subject = text.slice(0, 200);
    const ticket = await this.prisma.supportTicket.create({
      data: {
        botUserId: botUser.id,
        subject,
        status: 'open',
      },
    });
    await this.prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        fromAdmin: false,
        text: text.slice(0, 4000),
      },
    });
    await ctx.reply(
      `Ticket #${ticket.id.slice(0, 8)} created. An operator will reply soon.`,
    );
  }

  async showMyTickets(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }
    const tickets = await this.prisma.supportTicket.findMany({
      where: { botUserId: botUser.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    if (tickets.length === 0) {
      await this.safeEdit(ctx, 'No tickets yet.', new InlineKeyboard().text('Back', 'support_menu'));
      return;
    }
    const kb = new InlineKeyboard();
    for (const t of tickets) {
      kb.text(
        `#${t.id.slice(0, 8)} - ${t.status} - ${t.subject.slice(0, 30)}`,
        `ticket_${t.id}`,
      ).row();
    }
    kb.text('Back', 'support_menu');
    await this.safeEdit(ctx, 'Your tickets:', kb);
  }

  async showTicket(ctx: Context, ticketId: string): Promise<void> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });
    if (!ticket) {
      await ctx.answerCallbackQuery('Ticket not found');
      return;
    }
    const lines: string[] = [
      `Ticket #${ticket.id.slice(0, 8)} (${ticket.status})`,
      `Subject: ${ticket.subject}`,
      '',
    ];
    for (const m of ticket.messages) {
      const who = m.fromAdmin ? 'Support' : 'You';
      lines.push(`[${who}] ${m.text}`);
    }
    const kb = new InlineKeyboard();
    if (ticket.status !== 'closed') {
      kb.text('Reply', `ticket_reply_${ticketId}`).row();
    }
    kb.text('Back', 'support_my');
    await this.safeEdit(ctx, lines.join('\n'), kb);
  }

  async promptReply(ctx: Context, ticketId: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    this.state.set(from.id, { kind: 'await_ticket_message', ticketId });
    await ctx.reply('Write your reply:');
  }

  async handleReplyInput(ctx: Context, text: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const s = this.state.get(from.id);
    if (s.kind !== 'await_ticket_message') return;
    this.state.clear(from.id);

    await this.prisma.supportMessage.create({
      data: {
        ticketId: s.ticketId,
        fromAdmin: false,
        text: text.slice(0, 4000),
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: s.ticketId },
      data: { updatedAt: new Date(), status: 'open' },
    });
    await ctx.reply('Reply sent.');
  }

  private async safeEdit(
    ctx: Context,
    text: string,
    kb?: InlineKeyboard,
  ): Promise<void> {
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
        return;
      } catch {
        /* fallthrough */
      }
    }
    await ctx.reply(text, { reply_markup: kb });
  }
}
