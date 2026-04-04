import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(token: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { subToken: token } });
    if (!user || !user.enabled) throw new NotFoundException('Subscription not found');
    if (user.expiryDate && user.expiryDate < new Date()) throw new NotFoundException('Subscription expired');

    const settings = await this.prisma.settings.findUnique({ where: { id: 'main' } });
    const links: string[] = [];

    if (settings?.realityPrivateKey && settings?.serverIp) {
      links.push(
        `vless://${user.uuid}@${settings.serverIp}:${settings.realityPort}` +
        `?type=tcp&security=reality&sni=${settings.realitySni}` +
        `&fp=chrome&pbk=${settings.realityPublicKey}` +
        `&sid=${settings.realityShortId || ''}&flow=xtls-rprx-vision#HydraFlow-Reality`
      );
    }

    if (settings?.wsPath && settings?.serverIp) {
      links.push(
        `vless://${user.uuid}@${settings.serverIp}:${settings.wsPort}` +
        `?type=ws&security=none&path=${encodeURIComponent(settings.wsPath)}#HydraFlow-WS`
      );
    }

    if (settings?.ssPassword && settings?.serverIp) {
      const ssUserInfo = Buffer.from(`chacha20-ietf-poly1305:${settings.ssPassword}`).toString('base64');
      links.push(`ss://${ssUserInfo}@${settings.serverIp}:${settings.ssPort}#HydraFlow-SS`);
    }

    return Buffer.from(links.join('\n')).toString('base64');
  }
}
