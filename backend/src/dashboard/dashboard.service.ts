import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { UsersService } from '../users/users.service';

const PANEL_STARTED_AT = new Date();

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
    private readonly usersService: UsersService,
  ) {}

  async getRecap() {
    const now = new Date();
    const [
      total,
      active,
      disabled,
      expired,
      users,
      nodes,
      enabledNodes,
      healthyNodes,
      countriesRows,
      activeSessions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { enabled: true } }),
      this.prisma.user.count({ where: { enabled: false } }),
      this.prisma.user.count({ where: { expiryDate: { lt: now } } }),
      this.prisma.user.findMany({
        select: { trafficUp: true, trafficDown: true },
      }),
      this.prisma.node.count(),
      this.prisma.node.count({ where: { enabled: true } }),
      this.prisma.node.count({ where: { status: 'online' } }),
      this.prisma.iSPReport.findMany({
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.activeSession.count(),
    ]);

    let totalUp = BigInt(0);
    let totalDown = BigInt(0);
    for (const u of users) {
      totalUp += u.trafficUp;
      totalDown += u.trafficDown;
    }

    const uptimeSeconds = Math.floor(
      (now.getTime() - PANEL_STARTED_AT.getTime()) / 1000,
    );

    const version =
      process.env.npm_package_version ??
      process.env.PANEL_VERSION ??
      '2.0.0';

    return {
      users: { total, active, expired, disabled },
      traffic: {
        totalUp: totalUp.toString(),
        totalDown: totalDown.toString(),
        total: (totalUp + totalDown).toString(),
      },
      nodes: {
        total: nodes,
        enabled: enabledNodes,
        healthy: healthyNodes,
      },
      countries: countriesRows.length,
      activeSessions,
      version,
      startedAt: PANEL_STARTED_AT,
      uptimeSeconds,
    };
  }

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
