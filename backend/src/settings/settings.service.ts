import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    let settings = await this.prisma.settings.findUnique({ where: { id: 'main' } });
    if (!settings) settings = await this.prisma.settings.create({ data: { id: 'main' } });
    return settings;
  }

  async update(dto: UpdateSettingsDto) {
    return this.prisma.settings.upsert({ where: { id: 'main' }, create: { id: 'main', ...dto }, update: dto });
  }
}
