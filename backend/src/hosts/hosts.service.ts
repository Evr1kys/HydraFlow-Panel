import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';
import { BulkHostDto } from './dto/bulk-host.dto';

export interface HostFilters {
  protocol?: string;
  enabled?: boolean;
  search?: string;
}

@Injectable()
export class HostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: HostFilters = {}) {
    return this.prisma.host.findMany({
      where: {
        ...(filters.protocol ? { protocol: filters.protocol } : {}),
        ...(typeof filters.enabled === 'boolean'
          ? { enabled: filters.enabled }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { remark: { contains: filters.search, mode: 'insensitive' } },
                { sni: { contains: filters.search, mode: 'insensitive' } },
                { host: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        nodes: { include: { node: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const host = await this.prisma.host.findUnique({
      where: { id },
      include: {
        nodes: { include: { node: true } },
      },
    });
    if (!host) {
      throw new NotFoundException('Host not found');
    }
    return host;
  }

  async create(dto: CreateHostDto) {
    return this.prisma.host.create({
      data: {
        remark: dto.remark,
        protocol: dto.protocol,
        port: dto.port,
        sni: dto.sni ?? null,
        path: dto.path ?? null,
        host: dto.host ?? null,
        security: dto.security ?? 'reality',
        flow: dto.flow ?? null,
        fingerprint: dto.fingerprint ?? 'chrome',
        publicKey: dto.publicKey ?? null,
        shortId: dto.shortId ?? null,
        alpn: dto.alpn ?? [],
        network: dto.network ?? 'tcp',
        serviceName: dto.serviceName ?? null,
        headerType: dto.headerType ?? null,
        enabled: dto.enabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateHostDto) {
    await this.findOne(id);
    return this.prisma.host.update({
      where: { id },
      data: {
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
        ...(dto.protocol !== undefined ? { protocol: dto.protocol } : {}),
        ...(dto.port !== undefined ? { port: dto.port } : {}),
        ...(dto.sni !== undefined ? { sni: dto.sni } : {}),
        ...(dto.path !== undefined ? { path: dto.path } : {}),
        ...(dto.host !== undefined ? { host: dto.host } : {}),
        ...(dto.security !== undefined ? { security: dto.security } : {}),
        ...(dto.flow !== undefined ? { flow: dto.flow } : {}),
        ...(dto.fingerprint !== undefined
          ? { fingerprint: dto.fingerprint }
          : {}),
        ...(dto.publicKey !== undefined ? { publicKey: dto.publicKey } : {}),
        ...(dto.shortId !== undefined ? { shortId: dto.shortId } : {}),
        ...(dto.alpn !== undefined ? { alpn: dto.alpn } : {}),
        ...(dto.network !== undefined ? { network: dto.network } : {}),
        ...(dto.serviceName !== undefined
          ? { serviceName: dto.serviceName }
          : {}),
        ...(dto.headerType !== undefined
          ? { headerType: dto.headerType }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.host.delete({ where: { id } });
    return { message: 'Host deleted' };
  }

  async linkToNode(hostId: string, nodeId: string) {
    const host = await this.prisma.host.findUnique({ where: { id: hostId } });
    if (!host) throw new NotFoundException('Host not found');
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('Node not found');

    const existing = await this.prisma.hostsToNodes.findUnique({
      where: { hostId_nodeId: { hostId, nodeId } },
    });
    if (existing) {
      throw new BadRequestException('Host is already linked to this node');
    }
    await this.prisma.hostsToNodes.create({
      data: { hostId, nodeId },
    });
    return { message: 'Host linked to node' };
  }

  async unlinkFromNode(hostId: string, nodeId: string) {
    const existing = await this.prisma.hostsToNodes.findUnique({
      where: { hostId_nodeId: { hostId, nodeId } },
    });
    if (!existing) {
      throw new NotFoundException('Link not found');
    }
    await this.prisma.hostsToNodes.delete({
      where: { hostId_nodeId: { hostId, nodeId } },
    });
    return { message: 'Host unlinked from node' };
  }

  async findByNode(nodeId: string) {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('Node not found');
    const links = await this.prisma.hostsToNodes.findMany({
      where: { nodeId },
      include: { host: true },
    });
    return links
      .map((link) => link.host)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async bulkEnable(dto: BulkHostDto) {
    const result = await this.prisma.host.updateMany({
      where: { id: { in: dto.ids } },
      data: { enabled: true },
    });
    return { updated: result.count };
  }

  async bulkDisable(dto: BulkHostDto) {
    const result = await this.prisma.host.updateMany({
      where: { id: { in: dto.ids } },
      data: { enabled: false },
    });
    return { updated: result.count };
  }

  async bulkDelete(dto: BulkHostDto) {
    const result = await this.prisma.host.deleteMany({
      where: { id: { in: dto.ids } },
    });
    return { deleted: result.count };
  }
}
