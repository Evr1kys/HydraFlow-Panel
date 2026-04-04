import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsExplorerService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSessions() {
    return this.prisma.activeSession.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            uuid: true,
            enabled: true,
            remark: true,
          },
        },
        node: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getSessionCount() {
    const count = await this.prisma.activeSession.count();
    const byProtocol = await this.prisma.activeSession.groupBy({
      by: ['protocol'],
      _count: { id: true },
    });
    return {
      total: count,
      byProtocol: byProtocol.map((p) => ({
        protocol: p.protocol,
        count: p._count.id,
      })),
    };
  }

  async dropUserSessions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const deleted = await this.prisma.activeSession.deleteMany({
      where: { userId },
    });

    return {
      message: `Dropped ${deleted.count} session(s) for user ${user.email}`,
      droppedCount: deleted.count,
    };
  }

  async dropSession(sessionId: string) {
    const session = await this.prisma.activeSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.activeSession.delete({ where: { id: sessionId } });
    return { message: 'Session dropped' };
  }
}
