import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as net from 'net';

export interface ProtocolHealth {
  name: string;
  enabled: boolean;
  port: number;
  reachable: boolean;
  latency: number | null;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  private checkPort(host: string, port: number, timeout = 3000): Promise<{ reachable: boolean; latency: number | null }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latency });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, latency: null });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ reachable: false, latency: null });
      });

      socket.connect(port, host);
    });
  }

  async check(): Promise<ProtocolHealth[]> {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    if (!settings) {
      return [];
    }

    const host = settings.serverIp ?? '127.0.0.1';
    const results: ProtocolHealth[] = [];

    if (settings.realityEnabled) {
      const check = await this.checkPort(host, settings.realityPort);
      results.push({
        name: 'VLESS+Reality',
        enabled: true,
        port: settings.realityPort,
        ...check,
      });
    } else {
      results.push({
        name: 'VLESS+Reality',
        enabled: false,
        port: settings.realityPort,
        reachable: false,
        latency: null,
      });
    }

    if (settings.wsEnabled) {
      const check = await this.checkPort(host, settings.wsPort);
      results.push({
        name: 'VLESS+WebSocket',
        enabled: true,
        port: settings.wsPort,
        ...check,
      });
    } else {
      results.push({
        name: 'VLESS+WebSocket',
        enabled: false,
        port: settings.wsPort,
        reachable: false,
        latency: null,
      });
    }

    if (settings.ssEnabled) {
      const check = await this.checkPort(host, settings.ssPort);
      results.push({
        name: 'Shadowsocks',
        enabled: true,
        port: settings.ssPort,
        ...check,
      });
    } else {
      results.push({
        name: 'Shadowsocks',
        enabled: false,
        port: settings.ssPort,
        reachable: false,
        latency: null,
      });
    }

    return results;
  }
}
