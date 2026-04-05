import { Injectable, NotFoundException } from '@nestjs/common';
import type { BotButton } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateButtonDto } from '../dto/create-button.dto';
import type { UpdateButtonDto } from '../dto/update-button.dto';

@Injectable()
export class BotButtonService {
  constructor(private readonly prisma: PrismaService) {}

  async list(menuType?: string): Promise<BotButton[]> {
    return this.prisma.botButton.findMany({
      where: menuType ? { menuType } : undefined,
      orderBy: [
        { rowPosition: 'asc' },
        { columnPosition: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  async findById(id: string): Promise<BotButton> {
    const btn = await this.prisma.botButton.findUnique({ where: { id } });
    if (!btn) throw new NotFoundException('Button not found');
    return btn;
  }

  async create(dto: CreateButtonDto): Promise<BotButton> {
    return this.prisma.botButton.create({
      data: {
        menuType: dto.menuType,
        buttonId: dto.buttonId,
        text: dto.text,
        callbackData: dto.callbackData ?? null,
        url: dto.url ?? null,
        rowPosition: dto.rowPosition ?? 0,
        columnPosition: dto.columnPosition ?? 0,
        buttonWidth: dto.buttonWidth ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateButtonDto): Promise<BotButton> {
    await this.findById(id);
    return this.prisma.botButton.update({
      where: { id },
      data: {
        text: dto.text,
        callbackData: dto.callbackData,
        url: dto.url,
        rowPosition: dto.rowPosition,
        columnPosition: dto.columnPosition,
        buttonWidth: dto.buttonWidth,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.botButton.delete({ where: { id } });
  }

  async reorder(
    items: Array<{
      id: string;
      rowPosition: number;
      columnPosition: number;
      sortOrder: number;
      buttonWidth?: number;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.botButton.update({
          where: { id: item.id },
          data: {
            rowPosition: item.rowPosition,
            columnPosition: item.columnPosition,
            sortOrder: item.sortOrder,
            ...(item.buttonWidth !== undefined && {
              buttonWidth: item.buttonWidth,
            }),
          },
        }),
      ),
    );
  }

  async listMenus() {
    return this.prisma.botMenuConfig.findMany({
      orderBy: { menuType: 'asc' },
    });
  }

  async getMenu(menuType: string) {
    const cfg = await this.prisma.botMenuConfig.findUnique({
      where: { menuType },
    });
    if (cfg) return cfg;
    // Return defaults for an unconfigured menu
    return {
      menuType,
      keyboardMode: 'inline',
      resize: true,
      oneTime: false,
      title: null,
      updatedAt: new Date(),
    };
  }

  async upsertMenu(
    menuType: string,
    data: {
      keyboardMode?: 'inline' | 'reply';
      resize?: boolean;
      oneTime?: boolean;
      title?: string;
    },
  ) {
    const mode = data.keyboardMode ?? 'inline';
    if (mode !== 'inline' && mode !== 'reply') {
      throw new NotFoundException(
        `Invalid keyboard mode "${mode}" — must be "inline" or "reply"`,
      );
    }
    return this.prisma.botMenuConfig.upsert({
      where: { menuType },
      create: {
        menuType,
        keyboardMode: mode,
        resize: data.resize ?? true,
        oneTime: data.oneTime ?? false,
        title: data.title ?? null,
      },
      update: {
        keyboardMode: mode,
        ...(data.resize !== undefined && { resize: data.resize }),
        ...(data.oneTime !== undefined && { oneTime: data.oneTime }),
        ...(data.title !== undefined && { title: data.title }),
      },
    });
  }
}
