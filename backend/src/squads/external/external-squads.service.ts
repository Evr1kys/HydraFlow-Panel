import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExternalSquadDto } from './dto/create-external-squad.dto';
import { UpdateExternalSquadDto } from './dto/update-external-squad.dto';
import { ExternalCreateUserDto } from './dto/external-create-user.dto';

@Injectable()
export class ExternalSquadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.externalSquad.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: { select: { id: true, email: true, remark: true, enabled: true } },
      },
    });
  }

  async findOne(id: string) {
    const squad = await this.prisma.externalSquad.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, remark: true, enabled: true } },
      },
    });
    if (!squad) {
      throw new NotFoundException('External squad not found');
    }
    return squad;
  }

  async create(dto: CreateExternalSquadDto) {
    const existing = await this.prisma.externalSquad.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('External squad with this name already exists');
    }
    return this.prisma.externalSquad.create({
      data: {
        name: dto.name,
        maxUsers: dto.maxUsers ?? 100,
        hostOverrides: dto.hostOverrides ?? undefined,
        enabled: dto.enabled ?? true,
        subPageTitle: dto.subPageTitle,
        subPageBrand: dto.subPageBrand,
      },
      include: {
        users: { select: { id: true, email: true, remark: true, enabled: true } },
      },
    });
  }

  async update(id: string, dto: UpdateExternalSquadDto) {
    await this.findOne(id);
    return this.prisma.externalSquad.update({
      where: { id },
      data: {
        name: dto.name,
        maxUsers: dto.maxUsers,
        hostOverrides: dto.hostOverrides ?? undefined,
        enabled: dto.enabled,
        subPageTitle: dto.subPageTitle,
        subPageBrand: dto.subPageBrand,
      },
      include: {
        users: { select: { id: true, email: true, remark: true, enabled: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.externalSquad.delete({ where: { id } });
    return { message: 'External squad deleted' };
  }

  async regenerateApiKey(id: string) {
    await this.findOne(id);
    const { randomUUID } = await import('crypto');
    return this.prisma.externalSquad.update({
      where: { id },
      data: { apiKey: randomUUID() },
      include: {
        users: { select: { id: true, email: true, remark: true, enabled: true } },
      },
    });
  }

  // --- External API (authenticated via squad API key) ---

  async findByApiKey(apiKey: string) {
    const squad = await this.prisma.externalSquad.findUnique({
      where: { apiKey },
    });
    if (!squad || !squad.enabled) {
      throw new NotFoundException('Invalid or disabled API key');
    }
    return squad;
  }

  async externalCreateUser(apiKey: string, dto: ExternalCreateUserDto) {
    const squad = await this.findByApiKey(apiKey);

    const currentCount = await this.prisma.user.count({
      where: { externalSquadId: squad.id },
    });
    if (currentCount >= squad.maxUsers) {
      throw new ForbiddenException(
        `User limit reached (${squad.maxUsers})`,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        remark: dto.remark,
        trafficLimit: dto.trafficLimit ? BigInt(dto.trafficLimit) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        externalSquadId: squad.id,
      },
    });

    return {
      id: user.id,
      email: user.email,
      uuid: user.uuid,
      subToken: user.subToken,
      enabled: user.enabled,
      trafficLimit: user.trafficLimit?.toString() ?? null,
      expiryDate: user.expiryDate,
      remark: user.remark,
    };
  }

  async externalListUsers(apiKey: string) {
    const squad = await this.findByApiKey(apiKey);
    const users = await this.prisma.user.findMany({
      where: { externalSquadId: squad.id },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      uuid: u.uuid,
      subToken: u.subToken,
      enabled: u.enabled,
      trafficUp: u.trafficUp.toString(),
      trafficDown: u.trafficDown.toString(),
      trafficLimit: u.trafficLimit?.toString() ?? null,
      expiryDate: u.expiryDate,
      remark: u.remark,
    }));
  }

  async externalDeleteUser(apiKey: string, userId: string) {
    const squad = await this.findByApiKey(apiKey);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.externalSquadId !== squad.id) {
      throw new NotFoundException('User not found in this squad');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted' };
  }
}
