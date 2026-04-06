import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';
import { BroadcastQueueService } from './broadcast-queue.service';
import { BotUserService, serializeBotUser } from './services/bot-user.service';
import { BotPlanService, serializeBotPlan } from './services/bot-plan.service';
import { BotButtonService } from './services/bot-button.service';
import { PromoService } from './services/promo.service';
import { SubscriptionGrantService } from './services/subscription-grant.service';
import { CreateBotPlanDto } from './dto/create-bot-plan.dto';
import { UpdateBotPlanDto } from './dto/update-bot-plan.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { CreateButtonDto } from './dto/create-button.dto';
import { UpdateButtonDto } from './dto/update-button.dto';

interface ReorderItem {
  id: string;
  rowPosition: number;
  columnPosition: number;
  sortOrder: number;
  buttonWidth?: number;
}

@ApiTags('Bot Admin')
@ApiBearerAuth('default')
@Controller('api/bot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin', 'admin')
export class BotAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly broadcastQueue: BroadcastQueueService,
    private readonly botUsers: BotUserService,
    private readonly botPlans: BotPlanService,
    private readonly botButtons: BotButtonService,
    private readonly promos: PromoService,
    private readonly grants: SubscriptionGrantService,
  ) {}

  // ───── Stats ─────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Overall bot stats' })
  async stats() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      bannedUsers,
      newUsersDay,
      newUsersWeek,
      txDay,
      txWeek,
      txMonth,
      revenueDay,
      revenueWeek,
      revenueMonth,
      openTickets,
    ] = await Promise.all([
      this.prisma.botUser.count(),
      this.prisma.botUser.count({ where: { banned: true } }),
      this.prisma.botUser.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.botUser.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.botTransaction.count({
        where: { createdAt: { gte: dayAgo }, status: 'completed' },
      }),
      this.prisma.botTransaction.count({
        where: { createdAt: { gte: weekAgo }, status: 'completed' },
      }),
      this.prisma.botTransaction.count({
        where: { createdAt: { gte: monthAgo }, status: 'completed' },
      }),
      this.prisma.botTransaction.aggregate({
        where: { completedAt: { gte: dayAgo }, status: 'completed', type: 'purchase' },
        _sum: { amount: true },
      }),
      this.prisma.botTransaction.aggregate({
        where: { completedAt: { gte: weekAgo }, status: 'completed', type: 'purchase' },
        _sum: { amount: true },
      }),
      this.prisma.botTransaction.aggregate({
        where: { completedAt: { gte: monthAgo }, status: 'completed', type: 'purchase' },
        _sum: { amount: true },
      }),
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
    ]);

    return {
      users: { total: totalUsers, banned: bannedUsers, newDay: newUsersDay, newWeek: newUsersWeek },
      transactions: { day: txDay, week: txWeek, month: txMonth },
      revenue: {
        day: Number(revenueDay._sum.amount ?? 0),
        week: Number(revenueWeek._sum.amount ?? 0),
        month: Number(revenueMonth._sum.amount ?? 0),
      },
      support: { openTickets },
    };
  }

  // ───── Bot Users ─────────────────────────────────────────────
  @Get('users')
  async listUsers(
    @Query('search') search?: string,
    @Query('start') start?: string,
    @Query('size') size?: string,
  ) {
    const skip = start ? parseInt(start, 10) : 0;
    const take = size ? Math.min(parseInt(size, 10), 200) : 50;
    const { items, total } = await this.botUsers.listAll({ search, skip, take });
    return { items: items.map(serializeBotUser), total };
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { banned?: boolean; balance?: number },
  ) {
    let user = await this.botUsers.findById(id);
    if (!user) throw new Error('BotUser not found');
    if (body.banned !== undefined) {
      user = await this.botUsers.setBanned(id, body.banned);
    }
    if (body.balance !== undefined) {
      user = await this.botUsers.setBalance(id, body.balance);
    }
    return serializeBotUser(user);
  }

  // ───── Plans ─────────────────────────────────────────────────
  @Get('plans')
  async listPlans() {
    const plans = await this.botPlans.list(false);
    return plans.map(serializeBotPlan);
  }

  @Post('plans')
  async createPlan(@Body() dto: CreateBotPlanDto) {
    const plan = await this.botPlans.create(dto);
    return serializeBotPlan(plan);
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: UpdateBotPlanDto) {
    const plan = await this.botPlans.update(id, dto);
    return serializeBotPlan(plan);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    await this.botPlans.remove(id);
    return { message: 'Plan deleted' };
  }

  // ───── Promos ────────────────────────────────────────────────
  @Get('promos')
  async listPromos() {
    const items = await this.promos.list();
    return items.map((p) => ({
      id: p.id,
      code: p.code,
      discountPercent: p.discountPercent,
      discountAmount: p.discountAmount?.toString() ?? null,
      maxUses: p.maxUses,
      usedCount: p.usedCount,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      enabled: p.enabled,
      createdAt: p.createdAt,
    }));
  }

  @Post('promos')
  async createPromo(@Body() dto: CreatePromoDto) {
    const promo = await this.promos.create(dto);
    return {
      id: promo.id,
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount: promo.discountAmount?.toString() ?? null,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      validFrom: promo.validFrom,
      validUntil: promo.validUntil,
      enabled: promo.enabled,
      createdAt: promo.createdAt,
    };
  }

  @Delete('promos/:id')
  async deletePromo(@Param('id') id: string) {
    await this.promos.remove(id);
    return { message: 'Promo deleted' };
  }

  // ───── Buttons ───────────────────────────────────────────────
  @Get('buttons')
  async listButtons(@Query('menu_type') menuType?: string) {
    const items = await this.botButtons.list(menuType);
    return items;
  }

  @Post('buttons')
  async createButton(@Body() dto: CreateButtonDto) {
    return this.botButtons.create(dto);
  }

  @Patch('buttons/:id')
  async updateButton(@Param('id') id: string, @Body() dto: UpdateButtonDto) {
    return this.botButtons.update(id, dto);
  }

  @Delete('buttons/:id')
  async deleteButton(@Param('id') id: string) {
    await this.botButtons.remove(id);
    return { message: 'Button deleted' };
  }

  @Post('buttons/reorder')
  async reorderButtons(@Body() body: { items: ReorderItem[] }) {
    await this.botButtons.reorder(body.items ?? []);
    return { message: 'Reordered' };
  }

  // ───── Menu Config (inline/reply toggle) ─────────────────────
  @Get('menus')
  async listMenus() {
    return this.botButtons.listMenus();
  }

  @Get('menus/:menuType')
  async getMenu(@Param('menuType') menuType: string) {
    return this.botButtons.getMenu(menuType);
  }

  @Patch('menus/:menuType')
  async updateMenu(
    @Param('menuType') menuType: string,
    @Body()
    body: {
      keyboardMode?: 'inline' | 'reply';
      resize?: boolean;
      oneTime?: boolean;
      title?: string;
    },
  ) {
    return this.botButtons.upsertMenu(menuType, body);
  }

  // ───── Broadcast ─────────────────────────────────────────────
  @Post('broadcast')
  async broadcast(@Body() body: { text: string; onlyActive?: boolean }) {
    if (!body.text || !body.text.trim()) {
      return { queued: 0, error: 'empty text' };
    }
    const ids = await this.botUsers.getAllTelegramIds();
    const result = await this.broadcastQueue.enqueueBroadcast(ids, body.text);
    return { queued: result.queued, broadcastId: result.broadcastId };
  }

  // ───── Transactions ──────────────────────────────────────────
  @Get('transactions')
  async listTransactions(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('start') start?: string,
    @Query('size') size?: string,
  ) {
    const skip = start ? parseInt(start, 10) : 0;
    const take = size ? Math.min(parseInt(size, 10), 200) : 50;
    const where: Record<string, unknown> = {};
    if (userId) where.botUserId = userId;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.botTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.botTransaction.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        botUserId: t.botUserId,
        type: t.type,
        amount: t.amount.toString(),
        currency: t.currency,
        provider: t.provider,
        providerPaymentId: t.providerPaymentId,
        status: t.status,
        planId: t.planId,
        promoCode: t.promoCode,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      total,
    };
  }

  // ───── Give subscription manually ────────────────────────────
  @Post('give-subscription')
  async giveSubscription(
    @Body() body: { telegramId: string | number; days: number; trafficGb?: number | null },
  ) {
    const result = await this.grants.manualGrant({
      telegramId: typeof body.telegramId === 'string' ? BigInt(body.telegramId) : body.telegramId,
      days: body.days,
      trafficGb: body.trafficGb ?? null,
    });
    try {
      await this.bot.sendMessage(
        Number(result.botUser.telegramId),
        `An admin granted you ${body.days} days of VPN access. Enjoy!`,
      );
    } catch {
      /* ignore */
    }
    return {
      userId: result.user.id,
      email: result.user.email,
      expiryDate: result.expiryDate,
      isNew: result.isNew,
    };
  }

  // ───── Tickets ──────────────────────────────────────────────
  @Get('tickets')
  async listTickets(@Query('status') status?: string) {
    const items = await this.prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { botUser: true },
    });
    return items.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      botUser: {
        telegramId: t.botUser.telegramId.toString(),
        username: t.botUser.username,
      },
    }));
  }

  @Get('tickets/:id')
  async getTicket(@Param('id') id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        botUser: true,
      },
    });
    if (!ticket) return null;
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      botUser: {
        telegramId: ticket.botUser.telegramId.toString(),
        username: ticket.botUser.username,
      },
      messages: ticket.messages.map((m) => ({
        id: m.id,
        fromAdmin: m.fromAdmin,
        text: m.text,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('tickets/:id/reply')
  async replyTicket(@Param('id') id: string, @Body() body: { text: string }) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { botUser: true },
    });
    if (!ticket) return { ok: false };
    await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        fromAdmin: true,
        text: body.text,
      },
    });
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'replied', updatedAt: new Date() },
    });
    try {
      await this.bot.sendMessage(
        Number(ticket.botUser.telegramId),
        `Support reply:\n\n${body.text}`,
      );
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  @Patch('tickets/:id')
  async updateTicket(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: body.status,
      },
    });
  }
}
