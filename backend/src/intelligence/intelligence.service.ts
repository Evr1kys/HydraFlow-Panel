import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

export interface IntelligenceEntry {
  isp: string;
  country: string;
  protocols: Record<string, string>;
}

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getMap(country?: string): Promise<IntelligenceEntry[]> {
    const where = country ? { country } : {};

    const reports = await this.prisma.iSPReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const ispMap = new Map<string, IntelligenceEntry>();

    for (const report of reports) {
      const key = `${report.country}:${report.isp}`;
      if (!ispMap.has(key)) {
        ispMap.set(key, {
          isp: report.isp,
          country: report.country,
          protocols: {},
        });
      }
      const entry = ispMap.get(key)!;
      if (!entry.protocols[report.protocol]) {
        entry.protocols[report.protocol] = report.status;
      }
    }

    return Array.from(ispMap.values());
  }

  async addReport(dto: CreateReportDto) {
    const lastReport = await this.prisma.iSPReport.findFirst({
      where: {
        country: dto.country,
        isp: dto.isp,
        protocol: dto.protocol,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastReport && lastReport.status !== dto.status) {
      await this.prisma.alert.create({
        data: {
          isp: dto.isp,
          protocol: dto.protocol,
          oldStatus: lastReport.status,
          newStatus: dto.status,
          country: dto.country,
        },
      });
    }

    return this.prisma.iSPReport.create({ data: dto });
  }

  async getAlerts(limit = 50) {
    return this.prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
