import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface XrayStatEntry {
  name: string;
  value: number;
}

export interface TrafficPoint {
  date: string;
  upload: string;
  download: string;
}

@Injectable()
export class TrafficService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficService.name);
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private previousStats: Map<string, { up: bigint; down: bigint }> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.snapshotInterval = setInterval(() => {
      this.recordSnapshot().catch((err) => {
        this.logger.error('Failed to record traffic snapshot', err);
      });
    }, 60_000);
    this.logger.log('Traffic recording started (60s interval)');
  }

  onModuleDestroy() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  async recordSnapshot(): Promise<void> {
    try {
      const stats = await this.queryXrayStats();
      if (stats.length === 0) return;

      const userTrafficMap = new Map<string, { up: bigint; down: bigint }>();

      for (const stat of stats) {
        // Format: "user>>>email>>>traffic>>>uplink" or "user>>>email>>>traffic>>>downlink"
        const parts = stat.name.split('>>>');
        if (parts.length < 4) continue;

        const email = parts[1];
        if (!email) continue;

        const direction = parts[3];
        if (!userTrafficMap.has(email)) {
          userTrafficMap.set(email, { up: BigInt(0), down: BigInt(0) });
        }

        const entry = userTrafficMap.get(email)!;
        if (direction === 'uplink') {
          entry.up = BigInt(stat.value);
        } else if (direction === 'downlink') {
          entry.down = BigInt(stat.value);
        }
      }

      const now = new Date();
      const hourDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

      for (const [email, traffic] of userTrafficMap) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) continue;

        const prev = this.previousStats.get(email) ?? { up: BigInt(0), down: BigInt(0) };
        const deltaUp = traffic.up > prev.up ? traffic.up - prev.up : traffic.up;
        const deltaDown = traffic.down > prev.down ? traffic.down - prev.down : traffic.down;

        if (deltaUp === BigInt(0) && deltaDown === BigInt(0)) continue;

        this.previousStats.set(email, traffic);

        // Upsert hourly record
        const existing = await this.prisma.userTraffic.findFirst({
          where: {
            userId: user.id,
            period: 'hourly',
            date: hourDate,
          },
        });

        if (existing) {
          await this.prisma.userTraffic.update({
            where: { id: existing.id },
            data: {
              upload: existing.upload + deltaUp,
              download: existing.download + deltaDown,
            },
          });
        } else {
          await this.prisma.userTraffic.create({
            data: {
              userId: user.id,
              upload: deltaUp,
              download: deltaDown,
              period: 'hourly',
              date: hourDate,
            },
          });
        }

        // Update user cumulative traffic
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            trafficUp: { increment: deltaUp },
            trafficDown: { increment: deltaDown },
          },
        });
      }
    } catch (err) {
      this.logger.debug(`Traffic snapshot skipped: ${String(err)}`);
    }
  }

  private async queryXrayStats(): Promise<XrayStatEntry[]> {
    try {
      const { stdout } = await execAsync(
        'xray api statsquery --server=127.0.0.1:10085 -pattern "" -reset',
      );
      const data = JSON.parse(stdout);
      if (data?.stat && Array.isArray(data.stat)) {
        return data.stat.map((s: { name: string; value: string }) => ({
          name: s.name,
          value: parseInt(s.value || '0', 10),
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async getHistory(
    period: string = 'daily',
    days: number = 7,
  ): Promise<TrafficPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await this.prisma.userTraffic.findMany({
      where: {
        period: period === 'daily' ? 'hourly' : period,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });

    if (period === 'daily') {
      // Aggregate hourly records into daily
      const dailyMap = new Map<string, { upload: bigint; download: bigint }>();
      for (const record of records) {
        const dateKey = record.date.toISOString().split('T')[0]!;
        const existing = dailyMap.get(dateKey) ?? { upload: BigInt(0), download: BigInt(0) };
        existing.upload += record.upload;
        existing.download += record.download;
        dailyMap.set(dateKey, existing);
      }

      return Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        upload: data.upload.toString(),
        download: data.download.toString(),
      }));
    }

    return records.map((r) => ({
      date: r.date.toISOString(),
      upload: r.upload.toString(),
      download: r.download.toString(),
    }));
  }

  async getUserHistory(
    userId: string,
    period: string = 'daily',
    days: number = 30,
  ): Promise<TrafficPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await this.prisma.userTraffic.findMany({
      where: {
        userId,
        period: period === 'daily' ? 'hourly' : period,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
    });

    if (period === 'daily') {
      const dailyMap = new Map<string, { upload: bigint; download: bigint }>();
      for (const record of records) {
        const dateKey = record.date.toISOString().split('T')[0]!;
        const existing = dailyMap.get(dateKey) ?? { upload: BigInt(0), download: BigInt(0) };
        existing.upload += record.upload;
        existing.download += record.download;
        dailyMap.set(dateKey, existing);
      }

      return Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        upload: data.upload.toString(),
        download: data.download.toString(),
      }));
    }

    return records.map((r) => ({
      date: r.date.toISOString(),
      upload: r.upload.toString(),
      download: r.download.toString(),
    }));
  }
}
