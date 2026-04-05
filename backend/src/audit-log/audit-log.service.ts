import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogFilters {
  adminId?: string;
  resource?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface LogInput {
  adminId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  payload?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
  success?: boolean;
  errorMsg?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          adminId: input.adminId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          payload:
            input.payload === null || input.payload === undefined
              ? Prisma.DbNull
              : input.payload,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          success: input.success ?? true,
          errorMsg: input.errorMsg ?? null,
        },
      });
    } catch {
      // Never throw from audit logging - it must not break the main flow
    }
  }

  async list(filters: AuditLogFilters) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const take = Math.min(Math.max(filters.limit ?? 100, 1), 1000);
    const skip = Math.max(filters.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          admin: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit: take, offset: skip };
  }

  async export(filters: AuditLogFilters): Promise<string> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        admin: { select: { id: true, email: true } },
      },
    });

    const escape = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'timestamp',
      'adminEmail',
      'action',
      'resource',
      'resourceId',
      'ip',
      'userAgent',
      'success',
      'errorMsg',
      'payload',
    ];

    const lines = [headers.join(',')];
    for (const it of items) {
      lines.push(
        [
          it.createdAt.toISOString(),
          it.admin?.email ?? '',
          it.action,
          it.resource,
          it.resourceId ?? '',
          it.ip ?? '',
          it.userAgent ?? '',
          it.success ? 'true' : 'false',
          it.errorMsg ?? '',
          it.payload === null ? '' : JSON.stringify(it.payload),
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
