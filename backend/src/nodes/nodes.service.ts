import { Injectable, NotFoundException } from '@nestjs/common';
import * as net from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNodeDto } from './dto/create-node.dto';

@Injectable()
export class NodesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateNodeDto) {
    return this.prisma.node.create({
      data: {
        name: dto.name,
        address: dto.address,
        port: dto.port,
        apiKey: dto.apiKey ?? '',
        enabled: dto.enabled ?? true,
      },
    });
  }

  async remove(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    await this.prisma.node.delete({ where: { id } });
    return { message: 'Node deleted' };
  }

  async checkHealth(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }

    const reachable = await this.tcpCheck(node.address, node.port);
    const status = reachable ? 'online' : 'offline';

    const updated = await this.prisma.node.update({
      where: { id },
      data: {
        status,
        lastCheck: new Date(),
      },
    });

    return updated;
  }

  private tcpCheck(host: string, port: number, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }
}
