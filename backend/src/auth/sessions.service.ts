import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface Session {
  id: string;
  adminId: string;
  email: string;
  token: string;
  createdAt: string;
  userAgent: string;
  ip: string;
}

@Injectable()
export class SessionsService {
  private sessions: Map<string, Session> = new Map();

  create(adminId: string, email: string, token: string, userAgent: string, ip: string): Session {
    const session: Session = {
      id: randomUUID(),
      adminId,
      email,
      token,
      createdAt: new Date().toISOString(),
      userAgent,
      ip,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  findAll(): Session[] {
    return Array.from(this.sessions.values()).map((s) => ({
      ...s,
      token: s.token.slice(0, 12) + '...',
    }));
  }

  revoke(id: string): { message: string } {
    if (!this.sessions.has(id)) {
      throw new NotFoundException('Session not found');
    }
    this.sessions.delete(id);
    return { message: 'Session revoked' };
  }

  isTokenValid(token: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.token === token) {
        return true;
      }
    }
    return false;
  }
}
