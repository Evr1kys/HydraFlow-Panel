import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
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

  private async loadPluginWithNode(nodeId: string, pluginId: string) {
    const plugin = await this.prisma.nodePlugin.findFirst({
      where: { id: pluginId, nodeId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found for this node');
    return plugin;
  }

  private async loadPluginById(pluginId: string) {
    const plugin = await this.prisma.nodePlugin.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    return plugin;
  }

  async executeById(pluginId: string) {
    const plugin = await this.loadPluginById(pluginId);
    return this.execute(plugin.nodeId, plugin.id);
  }

  async restartById(pluginId: string) {
    const plugin = await this.loadPluginById(pluginId);
    return this.restart(plugin.nodeId, plugin.id);
  }

  async statusById(pluginId: string) {
    const plugin = await this.loadPluginById(pluginId);
    return this.status(plugin.nodeId, plugin.id);
  }

  async execute(nodeId: string, pluginId: string): Promise<never> {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);
    return this.unsupported(plugin.type);
  }

  async restart(nodeId: string, pluginId: string): Promise<never> {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);
    return this.unsupported(plugin.type);
  }

  async status(nodeId: string, pluginId: string): Promise<never> {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);
    return this.unsupported(plugin.type);
  }

  private unsupported(type: string): never {
    throw new NotImplementedException({
      code: 'agent_plugin_api_unavailable',
      message:
        'Remote plugin execution is disabled because the signed Agent API does not expose an allowlisted plugin contract yet.',
      pluginType: type,
      migration:
        'Plugin metadata remains stored. Execution can be re-enabled only through a versioned, allowlisted Agent API implementation.',
    });
  }
}
