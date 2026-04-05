import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConfigProfileDto } from './dto/create-config-profile.dto';
import { UpdateConfigProfileDto } from './dto/update-config-profile.dto';

@Injectable()
export class ConfigProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.configProfile.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.configProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Config profile not found');
    }
    return profile;
  }

  async findDefault() {
    return this.prisma.configProfile.findFirst({
      where: { isDefault: true },
    });
  }

  async create(dto: CreateConfigProfileDto) {
    // Validate that config is valid JSON
    try {
      JSON.parse(dto.config);
    } catch {
      throw new BadRequestException('Config must be valid JSON');
    }

    // If setting as default, unset existing defaults
    if (dto.isDefault) {
      await this.prisma.configProfile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.configProfile.create({
      data: {
        name: dto.name,
        config: dto.config,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateConfigProfileDto) {
    const existing = await this.findOne(id);

    if (dto.config) {
      try {
        JSON.parse(dto.config);
      } catch {
        throw new BadRequestException('Config must be valid JSON');
      }
    }

    // If setting as default, unset existing defaults
    if (dto.isDefault) {
      await this.prisma.configProfile.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.configProfile.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        config: dto.config ?? existing.config,
        isDefault: dto.isDefault ?? existing.isDefault,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (existing.isDefault) {
      throw new BadRequestException('Cannot delete the default config profile');
    }
    await this.prisma.configProfile.delete({ where: { id } });
    return { message: 'Config profile deleted' };
  }

  async setDefault(id: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.configProfile.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
      return tx.configProfile.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }
}
