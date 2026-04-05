import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NodesService } from '../nodes/nodes.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nodesService: NodesService,
  ) {}

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
      include: { node: true },
    });
    if (!plugin) throw new NotFoundException('Plugin not found for this node');
    return plugin;
  }

  private async loadPluginById(pluginId: string) {
    const plugin = await this.prisma.nodePlugin.findUnique({
      where: { id: pluginId },
      include: { node: true },
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

  private parsePluginConfig(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return {};
    }
  }

  async execute(nodeId: string, pluginId: string) {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);
    const config = this.parsePluginConfig(plugin.config);

    try {
      const result = await this.nodesService.nodeRequest(plugin.node, {
        method: 'POST',
        path: '/api/plugins/execute',
        body: { type: plugin.type, config },
        timeoutMs: 30_000,
      });
      return {
        pluginId: plugin.id,
        nodeId: plugin.nodeId,
        type: plugin.type,
        executedAt: new Date().toISOString(),
        result,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Plugin ${plugin.type} execute failed on node ${plugin.node.name}: ${message}`,
      );
      throw new HttpException(
        `Plugin execution failed: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async restart(nodeId: string, pluginId: string) {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);
    const config = this.parsePluginConfig(plugin.config);

    try {
      const result = await this.nodesService.nodeRequest(plugin.node, {
        method: 'POST',
        path: '/api/plugins/restart',
        body: { type: plugin.type, config },
        timeoutMs: 30_000,
      });
      return {
        pluginId: plugin.id,
        nodeId: plugin.nodeId,
        type: plugin.type,
        restartedAt: new Date().toISOString(),
        result,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        `Plugin restart failed: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async status(nodeId: string, pluginId: string) {
    const plugin = await this.loadPluginWithNode(nodeId, pluginId);

    try {
      const result = await this.nodesService.nodeRequest(plugin.node, {
        method: 'GET',
        path: `/api/plugins/status?type=${encodeURIComponent(plugin.type)}`,
        timeoutMs: 30_000,
      });
      return {
        pluginId: plugin.id,
        nodeId: plugin.nodeId,
        type: plugin.type,
        checkedAt: new Date().toISOString(),
        status: result,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        `Plugin status check failed: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
