import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
    private readonly usersService: UsersService,
  ) {}

  async getStats() {
    const userStats = await this.usersService.getStats();
    const xrayStatus = await this.xrayService.getStatus();

    const users = await this.prisma.user.findMany({
      select: { trafficUp: true, trafficDown: true },
    });

    let totalTrafficUp = BigInt(0);
    let totalTrafficDown = BigInt(0);
    for (const user of users) {
      totalTrafficUp += user.trafficUp;
      totalTrafficDown += user.trafficDown;
    }

    const recentAlerts = await this.prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    return {
      users: userStats,
      xray: xrayStatus,
      traffic: {
        totalUp: totalTrafficUp.toString(),
        totalDown: totalTrafficDown.toString(),
        total: (totalTrafficUp + totalTrafficDown).toString(),
      },
      protocols: {
        reality: {
          enabled: settings?.realityEnabled ?? false,
          port: settings?.realityPort ?? 443,
        },
        websocket: {
          enabled: settings?.wsEnabled ?? false,
          port: settings?.wsPort ?? 2053,
        },
        shadowsocks: {
          enabled: settings?.ssEnabled ?? false,
          port: settings?.ssPort ?? 8388,
        },
      },
      recentAlerts,
    };
  }
}
