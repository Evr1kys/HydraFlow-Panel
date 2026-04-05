import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionTemplateDto } from './dto/create-subscription-template.dto';
import { UpdateSubscriptionTemplateDto } from './dto/update-subscription-template.dto';

export interface TemplateUser {
  uuid: string;
  email: string;
  shortUuid?: string | null;
  remark?: string | null;
  subToken: string;
  expiryDate?: Date | null;
  trafficLimit?: bigint | null;
}

export interface TemplateSettings {
  serverIp: string | null;
  realitySni?: string | null;
  realityPbk?: string | null;
  realitySid?: string | null;
}

export interface TemplateHost {
  port?: number | null;
  sni?: string | null;
  publicKey?: string | null;
  shortId?: string | null;
  flow?: string | null;
  remark?: string | null;
}

@Injectable()
export class SubscriptionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clientType?: string) {
    return this.prisma.subscriptionTemplate.findMany({
      where: clientType ? { clientType } : undefined,
      orderBy: [
        { clientType: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.subscriptionTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Subscription template not found');
    }
    return template;
  }

  async getDefaultForClient(clientType: string) {
    return this.prisma.subscriptionTemplate.findFirst({
      where: { clientType, isDefault: true, enabled: true },
    });
  }

  async create(dto: CreateSubscriptionTemplateDto) {
    if (dto.isDefault) {
      await this.prisma.subscriptionTemplate.updateMany({
        where: { clientType: dto.clientType, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.subscriptionTemplate.create({
      data: {
        name: dto.name,
        clientType: dto.clientType,
        template: dto.template,
        isDefault: dto.isDefault ?? false,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateSubscriptionTemplateDto) {
    const existing = await this.findOne(id);
    const nextClientType = dto.clientType ?? existing.clientType;

    if (dto.isDefault) {
      await this.prisma.subscriptionTemplate.updateMany({
        where: {
          clientType: nextClientType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.subscriptionTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.clientType !== undefined ? { clientType: dto.clientType } : {}),
        ...(dto.template !== undefined ? { template: dto.template } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.subscriptionTemplate.delete({ where: { id } });
    return { message: 'Subscription template deleted' };
  }

  async setDefault(id: string) {
    const template = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.subscriptionTemplate.updateMany({
        where: {
          clientType: template.clientType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
      return tx.subscriptionTemplate.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  async preview(id: string, userId: string): Promise<string> {
    const template = await this.findOne(id);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });
    return this.renderTemplate(template.template, user, settings, null);
  }

  renderTemplate(
    templateStr: string,
    user: TemplateUser,
    settings: TemplateSettings | null,
    host: TemplateHost | null,
  ): string {
    const serverIp = settings?.serverIp ?? '';
    const sni = host?.sni ?? settings?.realitySni ?? '';
    const publicKey = host?.publicKey ?? settings?.realityPbk ?? '';
    const shortId = host?.shortId ?? settings?.realitySid ?? '';
    const port = host?.port != null ? String(host.port) : '';
    const flow = host?.flow ?? '';
    const remark = host?.remark ?? user.remark ?? user.email;
    const expiryDate = user.expiryDate
      ? user.expiryDate.toISOString().split('T')[0] ?? ''
      : '';
    const trafficLimit =
      user.trafficLimit != null ? String(user.trafficLimit) : '';
    const shortUuid = user.shortUuid ?? user.uuid.split('-')[0] ?? '';

    const placeholders: Record<string, string> = {
      server_ip: serverIp,
      port,
      uuid: user.uuid,
      email: user.email,
      short_uuid: shortUuid,
      sni,
      public_key: publicKey,
      short_id: shortId,
      remark,
      subtoken: user.subToken,
      expiry_date: expiryDate,
      traffic_limit: trafficLimit,
      flow,
    };

    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = placeholders[key as keyof typeof placeholders];
      return value !== undefined ? value : '';
    });
  }
}
