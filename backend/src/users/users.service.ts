import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { BulkExtendExpirationDto } from './dto/bulk-extend-expiration.dto';
import { BulkUpdateSquadsDto } from './dto/bulk-update-squads.dto';
import { BulkDeleteByStatusDto } from './dto/bulk-delete-by-status.dto';
import { BulkAllExtendExpirationDto } from './dto/bulk-all-extend-expiration.dto';
import { BulkAllBaseDto } from './dto/bulk-all-base.dto';
import { BulkAllFiltersDto } from './dto/bulk-all-filters.dto';

const SHORT_UUID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const shortId = customAlphabet(SHORT_UUID_ALPHABET, 8);

export interface SerializedUser {
  id: string;
  email: string;
  uuid: string;
  subToken: string;
  shortUuid: string | null;
  tag: string | null;
  tId: string;
  enabled: boolean;
  trafficUp: string;
  trafficDown: string;
  trafficLimit: string | null;
  lifetimeTrafficUsed: string;
  trafficStrategy: string;
  lastTrafficResetAt: Date | null;
  expiryDate: Date | null;
  maxDevices: number;
  hwidDeviceLimit: number | null;
  onlineAt: Date | null;
  remark: string | null;
  telegramId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  uuid: string;
  subToken: string;
  shortUuid: string | null;
  tag: string | null;
  tId: bigint;
  enabled: boolean;
  trafficUp: bigint;
  trafficDown: bigint;
  trafficLimit: bigint | null;
  lifetimeTrafficUsed: bigint;
  trafficStrategy: string;
  lastTrafficResetAt: Date | null;
  expiryDate: Date | null;
  maxDevices: number;
  hwidDeviceLimit: number | null;
  onlineAt: Date | null;
  remark: string | null;
  telegramId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeUser(user: UserRow): SerializedUser {
  return {
    id: user.id,
    email: user.email,
    uuid: user.uuid,
    subToken: user.subToken,
    shortUuid: user.shortUuid,
    tag: user.tag,
    tId: user.tId.toString(),
    enabled: user.enabled,
    trafficUp: user.trafficUp.toString(),
    trafficDown: user.trafficDown.toString(),
    trafficLimit: user.trafficLimit?.toString() ?? null,
    lifetimeTrafficUsed: user.lifetimeTrafficUsed.toString(),
    trafficStrategy: user.trafficStrategy,
    lastTrafficResetAt: user.lastTrafficResetAt,
    expiryDate: user.expiryDate,
    maxDevices: user.maxDevices,
    hwidDeviceLimit: user.hwidDeviceLimit,
    onlineAt: user.onlineAt,
    remark: user.remark,
    telegramId: user.telegramId?.toString() ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly xrayService: XrayService,
    private readonly nodesService: NodesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async syncXrayToNodes(): Promise<void> {
    try {
      const config = await this.xrayService.generateConfig();
      const results = await this.nodesService.pushConfigToAll(
        JSON.stringify(config, null, 2),
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        this.logger.warn(
          `User xray sync: ${results.length - failed.length}/${results.length} nodes updated. Failures: ${failed
            .map((f) => `${f.nodeId}:${f.error ?? 'unknown'}`)
            .join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to sync xray config after user change: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async generateUniqueShortUuid(): Promise<string> {
    // Attempt up to 5 times to produce a unique 8-char id
    for (let i = 0; i < 5; i += 1) {
      const candidate = shortId();
      const existing = await this.prisma.user.findUnique({
        where: { shortUuid: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    // Extremely unlikely fallback
    return shortId();
  }

  async findAll(): Promise<SerializedUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(serializeUser);
  }

  async findOne(id: string): Promise<SerializedUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async create(dto: CreateUserDto): Promise<SerializedUser> {
    try {
      const shortUuid = dto.shortUuid ?? (await this.generateUniqueShortUuid());
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          remark: dto.remark,
          trafficLimit: dto.trafficLimit
            ? BigInt(dto.trafficLimit)
            : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          shortUuid,
          tag: dto.tag,
          hwidDeviceLimit: dto.hwidDeviceLimit,
          trafficStrategy: dto.trafficStrategy ?? 'NO_RESET',
        },
      });
      const serialized = serializeUser(user);
      await this.webhooksService.fire('user.created', { user: serialized });
      this.eventEmitter.emit('user.created', serialized);
      await this.syncXrayToNodes();
      return serialized;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with email "${dto.email}" already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<SerializedUser> {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        enabled: dto.enabled,
        remark: dto.remark,
        trafficLimit:
          dto.trafficLimit !== undefined
            ? BigInt(dto.trafficLimit)
            : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        shortUuid: dto.shortUuid,
        tag: dto.tag,
        hwidDeviceLimit: dto.hwidDeviceLimit,
        trafficStrategy: dto.trafficStrategy,
      },
    });
    if (dto.enabled !== undefined) {
      await this.syncXrayToNodes();
    }
    return serializeUser(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    await this.webhooksService.fire('user.deleted', { user });
    this.eventEmitter.emit('user.deleted', user);
    await this.syncXrayToNodes();
    return { message: 'User deleted' };
  }

  async toggle(id: string): Promise<SerializedUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
    const serialized = serializeUser(user);
    await this.webhooksService.fire('user.toggled', { user: serialized });
    await this.syncXrayToNodes();
    return serialized;
  }

  async renew(id: string, days: number): Promise<SerializedUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const now = Date.now();
    const addMs = days * 86400000;
    const base =
      existing.expiryDate && existing.expiryDate.getTime() > now
        ? existing.expiryDate.getTime()
        : now;
    const newExpiry = new Date(base + addMs);

    const user = await this.prisma.user.update({
      where: { id },
      data: { expiryDate: newExpiry },
    });
    const serialized = serializeUser(user);
    await this.webhooksService.fire('user.renewed', {
      user: serialized,
      days,
    });
    this.eventEmitter.emit('user.renewed', serialized);
    return serialized;
  }

  async resetTraffic(id: string): Promise<SerializedUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userTraffic.deleteMany({ where: { userId: id } });

    const accumulated =
      existing.lifetimeTrafficUsed + existing.trafficUp + existing.trafficDown;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        trafficUp: BigInt(0),
        trafficDown: BigInt(0),
        lifetimeTrafficUsed: accumulated,
        lastTrafficResetAt: new Date(),
      },
    });
    const serialized = serializeUser(user);
    await this.webhooksService.fire('user.traffic.reset', {
      user: serialized,
    });
    return serialized;
  }

  async revokeSubscription(id: string): Promise<SerializedUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { subToken: randomUUID() },
    });
    const serialized = serializeUser(user);
    await this.webhooksService.fire('user.updated', { user: serialized });
    this.eventEmitter.emit('user.updated', serialized);
    return serialized;
  }

  async findBySubToken(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { subToken: token },
    });
    if (!user) {
      throw new NotFoundException('Invalid subscription token');
    }
    return serializeUser(user);
  }

  async findByShortUuid(shortUuid: string): Promise<SerializedUser> {
    const user = await this.prisma.user.findUnique({ where: { shortUuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async findByTag(tag: string): Promise<SerializedUser[]> {
    const users = await this.prisma.user.findMany({
      where: { tag },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(serializeUser);
  }

  async findByTelegramId(telegramId: string): Promise<SerializedUser> {
    let parsed: bigint;
    try {
      parsed = BigInt(telegramId);
    } catch {
      throw new NotFoundException('User not found');
    }
    const user = await this.prisma.user.findFirst({
      where: { telegramId: parsed },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async listTags(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { tag: { not: null } },
      distinct: ['tag'],
      select: { tag: true },
      orderBy: { tag: 'asc' },
    });
    return rows
      .map((r) => r.tag)
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
  }

  async bulkEnable(dto: BulkIdsDto): Promise<{ count: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: dto.ids } },
      data: { enabled: true },
    });
    if (result.count > 0) await this.syncXrayToNodes();
    return { count: result.count };
  }

  async bulkDisable(dto: BulkIdsDto): Promise<{ count: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: dto.ids } },
      data: { enabled: false },
    });
    if (result.count > 0) await this.syncXrayToNodes();
    return { count: result.count };
  }

  async bulkDelete(dto: BulkIdsDto): Promise<{ count: number }> {
    const result = await this.prisma.user.deleteMany({
      where: { id: { in: dto.ids } },
    });
    if (result.count > 0) await this.syncXrayToNodes();
    return { count: result.count };
  }

  private async fireBulkEvents(
    event:
      | 'user.renewed'
      | 'user.traffic.reset'
      | 'user.updated'
      | 'user.deleted',
    users: SerializedUser[],
    extra?: Record<string, unknown>,
  ): Promise<void> {
    for (const user of users) {
      try {
        await this.webhooksService.fire(event, { user, ...(extra ?? {}) });
        this.eventEmitter.emit(event, user);
      } catch (err) {
        this.logger.warn(
          `Failed to emit ${event} for user ${user.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  async bulkExtendExpiration(
    dto: BulkExtendExpirationDto,
  ): Promise<{ affected: number }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.ids } },
    });
    if (users.length === 0) return { affected: 0 };

    const now = Date.now();
    const addMs = dto.days * 86400000;

    const updated = await this.prisma.$transaction(
      users.map((existing) => {
        const base =
          existing.expiryDate && existing.expiryDate.getTime() > now
            ? existing.expiryDate.getTime()
            : now;
        const newExpiry = new Date(base + addMs);
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { expiryDate: newExpiry },
        });
      }),
    );

    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.renewed', serialized, { days: dto.days });
    return { affected: serialized.length };
  }

  async bulkResetTraffic(dto: BulkIdsDto): Promise<{ affected: number }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.ids } },
    });
    if (users.length === 0) return { affected: 0 };

    const now = new Date();
    await this.prisma.userTraffic.deleteMany({
      where: { userId: { in: dto.ids } },
    });
    const updated = await this.prisma.$transaction(
      users.map((existing) =>
        this.prisma.user.update({
          where: { id: existing.id },
          data: {
            trafficUp: BigInt(0),
            trafficDown: BigInt(0),
            lifetimeTrafficUsed:
              existing.lifetimeTrafficUsed +
              existing.trafficUp +
              existing.trafficDown,
            lastTrafficResetAt: now,
          },
        }),
      ),
    );

    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.traffic.reset', serialized);
    return { affected: serialized.length };
  }

  async bulkUpdateSquads(
    dto: BulkUpdateSquadsDto,
  ): Promise<{ affected: number }> {
    const data: Prisma.UserUncheckedUpdateManyInput = {};
    if (dto.internalSquadId !== undefined) {
      data.internalSquadId = dto.internalSquadId;
    }
    if (dto.externalSquadId !== undefined) {
      data.externalSquadId = dto.externalSquadId;
    }
    if (Object.keys(data).length === 0) return { affected: 0 };

    const result = await this.prisma.user.updateMany({
      where: { id: { in: dto.ids } },
      data,
    });

    if (result.count > 0) {
      const updated = await this.prisma.user.findMany({
        where: { id: { in: dto.ids } },
      });
      const serialized = updated.map(serializeUser);
      await this.fireBulkEvents('user.updated', serialized);
      await this.syncXrayToNodes();
    }
    return { affected: result.count };
  }

  async bulkRevokeSubscription(
    dto: BulkIdsDto,
  ): Promise<{ affected: number }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.ids } },
    });
    if (users.length === 0) return { affected: 0 };

    const updated = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.user.update({
          where: { id: u.id },
          data: { subToken: randomUUID() },
        }),
      ),
    );

    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.updated', serialized, {
      action: 'subscription.revoked',
    });
    return { affected: serialized.length };
  }

  async bulkDeleteByStatus(
    dto: BulkDeleteByStatusDto,
  ): Promise<{ affected: number }> {
    let where: Prisma.UserWhereInput;
    if (dto.status === 'expired') {
      where = {
        expiryDate: { not: null, lt: new Date() },
      };
    } else {
      where = { enabled: false };
    }

    const users = await this.prisma.user.findMany({ where });
    if (users.length === 0) return { affected: 0 };

    const ids = users.map((u) => u.id);
    const serialized = users.map(serializeUser);
    const result = await this.prisma.user.deleteMany({
      where: { id: { in: ids } },
    });

    await this.fireBulkEvents('user.deleted', serialized, {
      reason: `status:${dto.status}`,
    });
    if (result.count > 0) await this.syncXrayToNodes();
    return { affected: result.count };
  }

  private buildAllFiltersWhere(
    filters: BulkAllFiltersDto | undefined,
    defaults?: Prisma.UserWhereInput,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { ...(defaults ?? {}) };
    if (!filters) return where;
    if (filters.enabled !== undefined) where.enabled = filters.enabled;
    if (filters.tag !== undefined) where.tag = filters.tag;
    if (filters.internalSquadId !== undefined) {
      where.internalSquadId = filters.internalSquadId;
    }
    if (filters.externalSquadId !== undefined) {
      where.externalSquadId = filters.externalSquadId;
    }
    return where;
  }

  async bulkAllExtendExpiration(
    dto: BulkAllExtendExpirationDto,
  ): Promise<{ affected: number }> {
    // Default: only active users
    const where = this.buildAllFiltersWhere(dto.filters, { enabled: true });
    const users = await this.prisma.user.findMany({ where });
    if (users.length === 0) return { affected: 0 };

    const now = Date.now();
    const addMs = dto.days * 86400000;
    const updated = await this.prisma.$transaction(
      users.map((existing) => {
        const base =
          existing.expiryDate && existing.expiryDate.getTime() > now
            ? existing.expiryDate.getTime()
            : now;
        const newExpiry = new Date(base + addMs);
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { expiryDate: newExpiry },
        });
      }),
    );

    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.renewed', serialized, { days: dto.days });
    return { affected: serialized.length };
  }

  async bulkAllResetTraffic(
    dto: BulkAllBaseDto,
  ): Promise<{ affected: number }> {
    const where = this.buildAllFiltersWhere(dto.filters);
    const users = await this.prisma.user.findMany({ where });
    if (users.length === 0) return { affected: 0 };

    const ids = users.map((u) => u.id);
    const now = new Date();
    await this.prisma.userTraffic.deleteMany({
      where: { userId: { in: ids } },
    });
    const updated = await this.prisma.$transaction(
      users.map((existing) =>
        this.prisma.user.update({
          where: { id: existing.id },
          data: {
            trafficUp: BigInt(0),
            trafficDown: BigInt(0),
            lifetimeTrafficUsed:
              existing.lifetimeTrafficUsed +
              existing.trafficUp +
              existing.trafficDown,
            lastTrafficResetAt: now,
          },
        }),
      ),
    );
    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.traffic.reset', serialized);
    return { affected: serialized.length };
  }

  async bulkAllRevokeSubscription(
    dto: BulkAllBaseDto,
  ): Promise<{ affected: number }> {
    const where = this.buildAllFiltersWhere(dto.filters);
    const users = await this.prisma.user.findMany({ where });
    if (users.length === 0) return { affected: 0 };

    const updated = await this.prisma.$transaction(
      users.map((u) =>
        this.prisma.user.update({
          where: { id: u.id },
          data: { subToken: randomUUID() },
        }),
      ),
    );
    const serialized = updated.map(serializeUser);
    await this.fireBulkEvents('user.updated', serialized, {
      action: 'subscription.revoked',
    });
    return { affected: serialized.length };
  }

  async resolveUser(identifier: string): Promise<SerializedUser> {
    const trimmed = identifier.trim();
    if (!trimmed) {
      throw new NotFoundException('User not found');
    }

    const orConditions: Prisma.UserWhereInput[] = [
      { id: trimmed },
      { email: trimmed },
      { uuid: trimmed },
      { subToken: trimmed },
      { shortUuid: trimmed },
      { tag: trimmed },
    ];

    // Try to parse as BigInt for telegramId
    try {
      const tg = BigInt(trimmed);
      orConditions.push({ telegramId: tg });
    } catch {
      // not a valid bigint — skip
    }

    const user = await this.prisma.user.findFirst({
      where: { OR: orConditions },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async findByEmail(email: string): Promise<SerializedUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async findByUuid(uuid: string): Promise<SerializedUser> {
    const user = await this.prisma.user.findUnique({ where: { uuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return serializeUser(user);
  }

  async getStats() {
    const total = await this.prisma.user.count();
    const active = await this.prisma.user.count({
      where: { enabled: true },
    });
    const disabled = await this.prisma.user.count({
      where: { enabled: false },
    });
    const expiring = await this.prisma.user.count({
      where: {
        enabled: true,
        expiryDate: {
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });

    return { total, active, disabled, expiring };
  }
}
