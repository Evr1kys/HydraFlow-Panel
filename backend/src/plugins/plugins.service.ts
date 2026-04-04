import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';

@Injectable()
export class PluginsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByNode(nodeId: string) {
    return this.prisma.nodePlugin.findMany({
      where: { nodeId },
      orderBy: { type: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.nodePlugin.findMany({
      include: { node: true },
      orderBy: { type: 'asc' },
    });
  }

  async create(dto: CreatePluginDto) {
    const node = await this.prisma.node.findUnique({ where: { id: dto.nodeId } });
    if (!node) throw new NotFoundException('Node not found');

    return this.prisma.nodePlugin.create({
      data: {
        nodeId: dto.nodeId,
        type: dto.type,
        config: dto.config ?? '{}',
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: string, dto: UpdatePluginDto) {
    const plugin = await this.prisma.nodePlugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');

    return this.prisma.nodePlugin.update({
      where: { id },
      data: {
        ...(dto.config !== undefined && { config: dto.config }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
  }

  async remove(id: string) {
    const plugin = await this.prisma.nodePlugin.findUnique({ where: { id } });
    if (!plugin) throw new NotFoundException('Plugin not found');
    await this.prisma.nodePlugin.delete({ where: { id } });
    return { message: 'Plugin deleted' };
  }

  async execute(nodeId: string, pluginId: string) {
    const plugin = await this.prisma.nodePlugin.findFirst({
      where: { id: pluginId, nodeId },
      include: { node: true },
    });
    if (!plugin) throw new NotFoundException('Plugin not found for this node');

    // In production this would send a command to the node agent.
    // For now return a success response indicating the plugin was triggered.
    return {
      message: `Plugin ${plugin.type} executed on node ${plugin.node.name}`,
      pluginId: plugin.id,
      nodeId: plugin.nodeId,
      type: plugin.type,
      executedAt: new Date().toISOString(),
    };
  }
}
