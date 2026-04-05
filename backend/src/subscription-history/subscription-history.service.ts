import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ROWS_PER_USER = 24;

export interface SubscriptionHistoryFilters {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: number;
}

@Injectable()
export class SubscriptionHistoryService {
  private readonly logger = new Logger(SubscriptionHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    ip: string,
    userAgent: string | null | undefined,
    platform: string | null | undefined,
    format: string | null | undefined,
    status: number,
    size: number | null | undefined,
  ): Promise<void> {
    try {
      await this.prisma.subscriptionRequest.create({
        data: {
          userId,
          ip,
          userAgent: userAgent ?? null,
          platform: platform ?? null,
          format: format ?? null,
          status,
          responseSize: size ?? null,
        },
      });

      // Trim rows beyond the last MAX_ROWS_PER_USER for this user.
      // Find the id of the Nth most recent row and delete anything older.
      const keep = await this.prisma.subscriptionRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: MAX_ROWS_PER_USER,
        take: 1,
        select: { createdAt: true },
      });

      if (keep.length > 0) {
        await this.prisma.subscriptionRequest.deleteMany({
          where: {
            userId,
            createdAt: { lte: keep[0]!.createdAt },
          },
        });
      }
    } catch (err) {
      this.logger.error('Failed to log subscription request', err as Error);
    }
  }

  async getForUser(userId: string, limit = MAX_ROWS_PER_USER) {
    return this.prisma.subscriptionRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async find(filters: SubscriptionHistoryFilters) {
    const where: {
      userId?: string;
      status?: number;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (filters.userId) where.userId = filters.userId;
    if (typeof filters.status === 'number') where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    return this.prisma.subscriptionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
