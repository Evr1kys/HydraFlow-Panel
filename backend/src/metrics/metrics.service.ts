import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  readonly usersTotal: client.Gauge;
  readonly usersActive: client.Gauge;
  readonly trafficBytes: client.Gauge;
  readonly protocolsStatus: client.Gauge;
  readonly nodesOnline: client.Gauge;
  readonly alertsTotal: client.Gauge;
  readonly apiResponseTime: client.Histogram;

  constructor(private readonly prisma: PrismaService) {
    this.registry = new client.Registry();

    this.registry.setDefaultLabels({
      app: 'hydraflow',
    });

    this.usersTotal = new client.Gauge({
      name: 'hydraflow_users_total',
      help: 'Total number of users',
      registers: [this.registry],
    });

    this.usersActive = new client.Gauge({
      name: 'hydraflow_users_active',
      help: 'Number of active (enabled) users',
      registers: [this.registry],
    });

    this.trafficBytes = new client.Gauge({
      name: 'hydraflow_traffic_bytes',
      help: 'Total traffic in bytes',
      labelNames: ['direction'] as const,
      registers: [this.registry],
    });

    this.protocolsStatus = new client.Gauge({
      name: 'hydraflow_protocols_status',
      help: 'Protocol enabled status (1=enabled, 0=disabled)',
      labelNames: ['protocol'] as const,
      registers: [this.registry],
    });

    this.nodesOnline = new client.Gauge({
      name: 'hydraflow_nodes_online',
      help: 'Number of online nodes',
      registers: [this.registry],
    });

    this.alertsTotal = new client.Gauge({
      name: 'hydraflow_alerts_total',
      help: 'Total number of alerts',
      registers: [this.registry],
    });

    this.apiResponseTime = new client.Histogram({
      name: 'hydraflow_api_response_time_seconds',
      help: 'API response time in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect metrics every 15 seconds
    setInterval(() => {
      this.collectMetrics().catch(() => {
        // Silently ignore metric collection errors
      });
    }, 15_000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const totalUsers = await this.prisma.user.count();
      const activeUsers = await this.prisma.user.count({ where: { enabled: true } });
      this.usersTotal.set(totalUsers);
      this.usersActive.set(activeUsers);

      const users = await this.prisma.user.findMany({
        select: { trafficUp: true, trafficDown: true },
      });
      let totalUp = BigInt(0);
      let totalDown = BigInt(0);
      for (const u of users) {
        totalUp += u.trafficUp;
        totalDown += u.trafficDown;
      }
      this.trafficBytes.labels('upload').set(Number(totalUp));
      this.trafficBytes.labels('download').set(Number(totalDown));

      const settings = await this.prisma.settings.findUnique({
        where: { id: 'main' },
      });
      if (settings) {
        this.protocolsStatus.labels('reality').set(settings.realityEnabled ? 1 : 0);
        this.protocolsStatus.labels('websocket').set(settings.wsEnabled ? 1 : 0);
        this.protocolsStatus.labels('shadowsocks').set(settings.ssEnabled ? 1 : 0);
      }

      const onlineNodes = await this.prisma.node.count({
        where: { status: 'online', enabled: true },
      });
      this.nodesOnline.set(onlineNodes);

      const totalAlerts = await this.prisma.alert.count();
      this.alertsTotal.set(totalAlerts);
    } catch {
      // Ignore collection errors
    }
  }

  async getMetrics(): Promise<string> {
    // Force collect before returning
    await this.collectMetrics();
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  observeRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    this.apiResponseTime.labels(method, route, String(statusCode)).observe(durationSeconds);
  }
}
