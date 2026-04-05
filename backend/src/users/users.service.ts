import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';

export interface SerializedUser {
  id: string;
  email: string;
  uuid: string;
  subToken: string;
  enabled: boolean;
  trafficUp: string;
  trafficDown: string;
  trafficLimit: string | null;
  expiryDate: Date | null;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeUser(user: {
  id: string;
  email: string;
  uuid: string;
  subToken: string;
  enabled: boolean;
  trafficUp: bigint;
  trafficDown: bigint;
  trafficLimit: bigint | null;
  expiryDate: Date | null;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedUser {
  return {
    ...user,
    trafficUp: user.trafficUp.toString(),
    trafficDown: user.trafficDown.toString(),
    trafficLimit: user.trafficLimit?.toString() ?? null,
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
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          remark: dto.remark,
          trafficLimit: dto.trafficLimit
            ? BigInt(dto.trafficLimit)
            : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
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

    const user = await this.prisma.user.update({
      where: { id },
      data: { trafficUp: BigInt(0), trafficDown: BigInt(0) },
    });
    const serialized = serializeUser(user);
    await this.webhooksService.fire('user.traffic.reset', {
      user: serialized,
    });
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
