import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
  ) {}

  async get() {
    let settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) {
      settings = await this.prisma.settings.create({
        data: { id: 'main' },
      });
    }
    return settings;
  }

  async update(dto: UpdateSettingsDto) {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...dto },
      update: dto,
    });

    await this.xrayService.generateConfig();
    await this.xrayService.restart();

    return settings;
  }
}
