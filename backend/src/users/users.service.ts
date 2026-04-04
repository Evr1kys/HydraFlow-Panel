import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
    return serializeUser(user);
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
    return serializeUser(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
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
    return serializeUser(user);
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
