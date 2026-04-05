import { Injectable } from '@nestjs/common';
import type { BotUser } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SerializedBotUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  languageCode: string;
  balance: string;
  totalSpent: string;
  referredBy: string | null;
  banned: boolean;
  userId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

export function serializeBotUser(u: BotUser): SerializedBotUser {
  return {
    id: u.id,
    telegramId: u.telegramId.toString(),
    username: u.username,
    firstName: u.firstName,
    languageCode: u.languageCode,
    balance: u.balance.toString(),
    totalSpent: u.totalSpent.toString(),
    referredBy: u.referredBy,
    banned: u.banned,
    userId: u.userId,
    createdAt: u.createdAt,
    lastSeenAt: u.lastSeenAt,
  };
}

@Injectable()
export class BotUserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTelegramId(telegramId: number | bigint): Promise<BotUser | null> {
    return this.prisma.botUser.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  async findById(id: string): Promise<BotUser | null> {
    return this.prisma.botUser.findUnique({ where: { id } });
  }

  async getOrCreate(params: {
    telegramId: number | bigint;
    username?: string;
    firstName?: string;
    languageCode?: string;
    referredBy?: string;
  }): Promise<BotUser> {
    const tgId = BigInt(params.telegramId);
    const existing = await this.prisma.botUser.findUnique({
      where: { telegramId: tgId },
    });
    if (existing) {
      // Update profile fields if changed + touch lastSeen.
      return this.prisma.botUser.update({
        where: { id: existing.id },
        data: {
          username: params.username ?? existing.username,
          firstName: params.firstName ?? existing.firstName,
          languageCode: params.languageCode ?? existing.languageCode,
          lastSeenAt: new Date(),
        },
      });
    }
    return this.prisma.botUser.create({
      data: {
        telegramId: tgId,
        username: params.username ?? null,
        firstName: params.firstName ?? null,
        languageCode: params.languageCode ?? 'ru',
        referredBy: params.referredBy ?? null,
      },
    });
  }

  async listAll(params?: {
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: BotUser[]; total: number }> {
    const where = params?.search
      ? {
          OR: [
            { username: { contains: params.search, mode: 'insensitive' as const } },
            { firstName: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.prisma.botUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
      }),
      this.prisma.botUser.count({ where }),
    ]);
    return { items, total };
  }

  async setBanned(id: string, banned: boolean): Promise<BotUser> {
    return this.prisma.botUser.update({
      where: { id },
      data: { banned },
    });
  }

  async adjustBalance(id: string, delta: number): Promise<BotUser> {
    const user = await this.prisma.botUser.findUnique({ where: { id } });
    if (!user) throw new Error('BotUser not found');
    const current = Number(user.balance);
    const next = Math.max(0, current + delta);
    return this.prisma.botUser.update({
      where: { id },
      data: { balance: next.toFixed(2) },
    });
  }

  async setBalance(id: string, amount: number): Promise<BotUser> {
    return this.prisma.botUser.update({
      where: { id },
      data: { balance: amount.toFixed(2) },
    });
  }

  async linkPanelUser(id: string, panelUserId: string): Promise<BotUser> {
    return this.prisma.botUser.update({
      where: { id },
      data: { userId: panelUserId },
    });
  }

  async getAllTelegramIds(): Promise<bigint[]> {
    const users = await this.prisma.botUser.findMany({
      where: { banned: false },
      select: { telegramId: true },
    });
    return users.map((u) => u.telegramId);
  }
}
