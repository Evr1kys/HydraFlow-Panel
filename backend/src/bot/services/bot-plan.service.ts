import { Injectable, NotFoundException } from '@nestjs/common';
import type { BotPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBotPlanDto } from '../dto/create-bot-plan.dto';
import type { UpdateBotPlanDto } from '../dto/update-bot-plan.dto';

export interface SerializedBotPlan {
  id: string;
  name: string;
  daysDuration: number;
  trafficGb: number | null;
  price: string;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
}

export function serializeBotPlan(p: BotPlan): SerializedBotPlan {
  return {
    id: p.id,
    name: p.name,
    daysDuration: p.daysDuration,
    trafficGb: p.trafficGb,
    price: p.price.toString(),
    currency: p.currency,
    enabled: p.enabled,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt,
  };
}

@Injectable()
export class BotPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async list(enabledOnly = false): Promise<BotPlan[]> {
    return this.prisma.botPlan.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
  }

  async findById(id: string): Promise<BotPlan> {
    const plan = await this.prisma.botPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreateBotPlanDto): Promise<BotPlan> {
    return this.prisma.botPlan.create({
      data: {
        name: dto.name,
        daysDuration: dto.daysDuration,
        trafficGb: dto.trafficGb ?? null,
        price: dto.price.toFixed(2),
        currency: dto.currency ?? 'RUB',
        enabled: dto.enabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateBotPlanDto): Promise<BotPlan> {
    await this.findById(id);
    return this.prisma.botPlan.update({
      where: { id },
      data: {
        name: dto.name,
        daysDuration: dto.daysDuration,
        trafficGb: dto.trafficGb,
        price: dto.price !== undefined ? dto.price.toFixed(2) : undefined,
        currency: dto.currency,
        enabled: dto.enabled,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.botPlan.delete({ where: { id } });
  }
}
