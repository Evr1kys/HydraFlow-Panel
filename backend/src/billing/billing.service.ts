import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateBillingNodeDto } from './dto/create-billing-node.dto';
import { CreateBillingHistoryDto } from './dto/create-billing-history.dto';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Providers ---
  async getProviders() {
    return this.prisma.billingProvider.findMany({
      orderBy: { createdAt: 'desc' },
      include: { nodes: true },
    });
  }

  async createProvider(dto: CreateProviderDto) {
    return this.prisma.billingProvider.create({
      data: {
        name: dto.name,
        apiUrl: dto.apiUrl ?? '',
        credentials: dto.credentials ?? '',
      },
    });
  }

  async deleteProvider(id: string) {
    const provider = await this.prisma.billingProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    await this.prisma.billingProvider.delete({ where: { id } });
    return { message: 'Provider deleted' };
  }

  // --- Billing Nodes ---
  async getBillingNodes() {
    return this.prisma.billingNode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        node: true,
        provider: true,
        history: { orderBy: { date: 'desc' }, take: 5 },
      },
    });
  }

  async createBillingNode(dto: CreateBillingNodeDto) {
    return this.prisma.billingNode.create({
      data: {
        nodeId: dto.nodeId,
        providerId: dto.providerId,
        monthlyRate: dto.monthlyRate,
        currency: dto.currency ?? 'USD',
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
      },
      include: { node: true, provider: true },
    });
  }

  async deleteBillingNode(id: string) {
    const bn = await this.prisma.billingNode.findUnique({ where: { id } });
    if (!bn) throw new NotFoundException('Billing node not found');
    await this.prisma.billingNode.delete({ where: { id } });
    return { message: 'Billing node deleted' };
  }

  // --- History ---
  async getHistory(billingNodeId?: string) {
    return this.prisma.billingHistory.findMany({
      where: billingNodeId ? { billingNodeId } : undefined,
      orderBy: { date: 'desc' },
      include: {
        billingNode: { include: { node: true, provider: true } },
      },
    });
  }

  async createHistory(dto: CreateBillingHistoryDto) {
    return this.prisma.billingHistory.create({
      data: {
        billingNodeId: dto.billingNodeId,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        date: dto.date ? new Date(dto.date) : new Date(),
        paid: dto.paid ?? false,
      },
    });
  }

  async markPaid(id: string) {
    const entry = await this.prisma.billingHistory.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('History entry not found');
    return this.prisma.billingHistory.update({
      where: { id },
      data: { paid: true },
    });
  }

  // --- Summary ---
  async getSummary() {
    const billingNodes = await this.prisma.billingNode.findMany({
      include: { node: true, provider: true },
    });

    const totalMonthly = billingNodes.reduce((sum, bn) => sum + bn.monthlyRate, 0);

    const unpaidHistory = await this.prisma.billingHistory.findMany({
      where: { paid: false },
    });
    const totalUnpaid = unpaidHistory.reduce((sum, h) => sum + h.amount, 0);

    const upcomingRenewals = billingNodes
      .filter((bn) => {
        if (!bn.renewalDate) return false;
        const diff = bn.renewalDate.getTime() - Date.now();
        return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
      })
      .map((bn) => ({
        id: bn.id,
        nodeName: bn.node.name,
        providerName: bn.provider.name,
        monthlyRate: bn.monthlyRate,
        currency: bn.currency,
        renewalDate: bn.renewalDate,
      }));

    return {
      totalMonthly,
      totalUnpaid,
      nodeCount: billingNodes.length,
      upcomingRenewals,
      currency: 'USD',
    };
  }
}
