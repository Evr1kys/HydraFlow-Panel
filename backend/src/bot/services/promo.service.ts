import { Injectable, NotFoundException } from '@nestjs/common';
import type { BotPromoCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePromoDto } from '../dto/create-promo.dto';

export interface ApplyPromoResult {
  valid: boolean;
  reason?: string;
  discountedAmount: number;
  discountValue: number;
  promoId?: string;
}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BotPromoCode[]> {
    return this.prisma.botPromoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePromoDto): Promise<BotPromoCode> {
    return this.prisma.botPromoCode.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountPercent: dto.discountPercent ?? null,
        discountAmount:
          dto.discountAmount != null ? dto.discountAmount.toFixed(2) : null,
        maxUses: dto.maxUses ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const promo = await this.prisma.botPromoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    await this.prisma.botPromoCode.delete({ where: { id } });
  }

  async findByCode(code: string): Promise<BotPromoCode | null> {
    return this.prisma.botPromoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
  }

  async apply(code: string, amount: number): Promise<ApplyPromoResult> {
    const promo = await this.findByCode(code);
    if (!promo) {
      return { valid: false, reason: 'Code not found', discountedAmount: amount, discountValue: 0 };
    }
    if (!promo.enabled) {
      return { valid: false, reason: 'Code disabled', discountedAmount: amount, discountValue: 0 };
    }
    const now = new Date();
    if (promo.validFrom > now) {
      return { valid: false, reason: 'Not yet active', discountedAmount: amount, discountValue: 0 };
    }
    if (promo.validUntil && promo.validUntil < now) {
      return { valid: false, reason: 'Expired', discountedAmount: amount, discountValue: 0 };
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, reason: 'Usage limit reached', discountedAmount: amount, discountValue: 0 };
    }

    let discountValue = 0;
    if (promo.discountPercent) {
      discountValue = (amount * promo.discountPercent) / 100;
    } else if (promo.discountAmount) {
      discountValue = Number(promo.discountAmount);
    }
    const discounted = Math.max(0, amount - discountValue);
    return {
      valid: true,
      discountedAmount: Math.round(discounted * 100) / 100,
      discountValue: Math.round(discountValue * 100) / 100,
      promoId: promo.id,
    };
  }

  async incrementUsage(code: string): Promise<void> {
    await this.prisma.botPromoCode.update({
      where: { code: code.trim().toUpperCase() },
      data: { usedCount: { increment: 1 } },
    });
  }
}
