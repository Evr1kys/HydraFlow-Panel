import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLinks(token: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { subToken: token },
    });

    if (!user || !user.enabled) {
      throw new NotFoundException('Invalid or disabled subscription');
    }

    if (user.expiryDate && user.expiryDate < new Date()) {
      throw new NotFoundException('Subscription expired');
    }

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    if (!settings) {
      throw new NotFoundException('Server not configured');
    }

    const links: string[] = [];
    const serverIp = settings.serverIp ?? '127.0.0.1';
    const remark = user.remark ?? user.email;

    if (settings.realityEnabled) {
      const params = new URLSearchParams({
        type: 'tcp',
        security: 'reality',
        pbk: settings.realityPbk ?? '',
        fp: 'chrome',
        sni: settings.realitySni,
        sid: settings.realitySid ?? '',
        flow: 'xtls-rprx-vision',
      });
      links.push(
        `vless://${user.uuid}@${serverIp}:${settings.realityPort}?${params.toString()}#${encodeURIComponent(`${remark}-reality`)}`,
      );
    }

    if (settings.wsEnabled) {
      const host = settings.cdnDomain ?? settings.wsHost ?? serverIp;
      const params = new URLSearchParams({
        type: 'ws',
        security: 'none',
        path: settings.wsPath ?? '/ws',
        host,
      });
      links.push(
        `vless://${user.uuid}@${host}:${settings.wsPort}?${params.toString()}#${encodeURIComponent(`${remark}-ws`)}`,
      );
    }

    if (settings.ssEnabled && settings.ssPassword) {
      const userInfo = Buffer.from(
        `${settings.ssMethod}:${settings.ssPassword}`,
      ).toString('base64');
      links.push(
        `ss://${userInfo}@${serverIp}:${settings.ssPort}#${encodeURIComponent(`${remark}-ss`)}`,
      );
    }

    return Buffer.from(links.join('\n')).toString('base64');
  }
}
