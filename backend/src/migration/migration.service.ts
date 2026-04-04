import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export interface MigrationProgress {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ThreeXUIClient {
  id?: number;
  email?: string;
  enable?: boolean | number;
  uuid?: string;
  up?: number;
  down?: number;
  expiryTime?: number;
  total?: number;
}

interface MarzbanUser {
  username?: string;
  uuid?: string;
  status?: string;
  used_traffic?: number;
  data_limit?: number;
  expire?: number;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importFrom3xui(dbBuffer: Buffer): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    let clients: ThreeXUIClient[];
    try {
      clients = this.parse3xuiDatabase(dbBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown parse error';
      progress.errors.push(`Failed to parse 3x-ui database: ${message}`);
      return progress;
    }

    progress.total = clients.length;

    for (const client of clients) {
      try {
        const email = client.email || `user_${client.id || uuidv4().slice(0, 8)}@migrated.local`;

        const existing = await this.prisma.user.findFirst({
          where: { email },
        });

        if (existing) {
          progress.skipped++;
          continue;
        }

        await this.prisma.user.create({
          data: {
            email,
            uuid: client.uuid || uuidv4(),
            subToken: randomBytes(16).toString('hex'),
            enabled: client.enable === true || client.enable === 1,
            trafficUp: BigInt(client.up || 0),
            trafficDown: BigInt(client.down || 0),
            trafficLimit: client.total ? BigInt(client.total) : null,
            expiryDate: client.expiryTime && client.expiryTime > 0
              ? new Date(client.expiryTime)
              : null,
            remark: `Migrated from 3x-ui`,
          },
        });

        progress.imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        progress.errors.push(`Failed to import ${client.email || 'unknown'}: ${message}`);
      }
    }

    return progress;
  }

  async importFromMarzban(dbBuffer: Buffer): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    let users: MarzbanUser[];
    try {
      users = this.parseMarzbanDatabase(dbBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown parse error';
      progress.errors.push(`Failed to parse Marzban database: ${message}`);
      return progress;
    }

    progress.total = users.length;

    for (const user of users) {
      try {
        const email = user.username
          ? `${user.username}@migrated.local`
          : `user_${uuidv4().slice(0, 8)}@migrated.local`;

        const existing = await this.prisma.user.findFirst({
          where: { email },
        });

        if (existing) {
          progress.skipped++;
          continue;
        }

        await this.prisma.user.create({
          data: {
            email,
            uuid: user.uuid || uuidv4(),
            subToken: randomBytes(16).toString('hex'),
            enabled: user.status === 'active',
            trafficUp: BigInt(0),
            trafficDown: BigInt(user.used_traffic || 0),
            trafficLimit: user.data_limit ? BigInt(user.data_limit) : null,
            expiryDate: user.expire && user.expire > 0
              ? new Date(user.expire * 1000)
              : null,
            remark: `Migrated from Marzban`,
          },
        });

        progress.imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        progress.errors.push(`Failed to import ${user.username || 'unknown'}: ${message}`);
      }
    }

    return progress;
  }

  private parse3xuiDatabase(buffer: Buffer): ThreeXUIClient[] {
    // 3x-ui stores clients as JSON inside inbound settings in SQLite
    // We parse the SQLite file looking for JSON client arrays
    const content = buffer.toString('utf-8');
    const clients: ThreeXUIClient[] = [];

    // Look for JSON arrays containing client objects with uuid/email fields
    const jsonPattern = /\[[\s\S]*?"email"\s*:\s*"[^"]*"[\s\S]*?"id"\s*:\s*"[^"]*"[\s\S]*?\]/g;
    const matches = content.match(jsonPattern);

    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match) as Array<Record<string, unknown>>;
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              clients.push({
                email: item['email'] as string | undefined,
                uuid: (item['id'] as string) || (item['uuid'] as string) || undefined,
                enable: item['enable'] !== false && item['enable'] !== 0,
              });
            }
          }
        } catch {
          // Skip non-matching patterns
        }
      }
    }

    // Also try line-by-line JSON parsing for simpler formats
    if (clients.length === 0) {
      try {
        const parsed = JSON.parse(content) as ThreeXUIClient[] | { clients?: ThreeXUIClient[] };
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === 'object' && 'clients' in parsed && Array.isArray(parsed.clients)) {
          return parsed.clients;
        }
      } catch {
        // Not a JSON file
      }
    }

    return clients;
  }

  private parseMarzbanDatabase(buffer: Buffer): MarzbanUser[] {
    const content = buffer.toString('utf-8');
    const users: MarzbanUser[] = [];

    // Try JSON format first (Marzban API export)
    try {
      const parsed = JSON.parse(content) as MarzbanUser[] | { users?: MarzbanUser[] };
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object' && 'users' in parsed && Array.isArray(parsed.users)) {
        return parsed.users;
      }
    } catch {
      // Not a JSON file
    }

    // Look for user data patterns in SQLite binary
    const usernamePattern = /([a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+|[a-zA-Z0-9_]{3,30})/g;
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

    const uuids = content.match(uuidPattern) || [];
    const usernames = content.match(usernamePattern) || [];

    // Pair unique UUIDs with usernames as best effort
    const uniqueUuids = [...new Set(uuids)];
    for (let i = 0; i < uniqueUuids.length; i++) {
      users.push({
        username: usernames[i] || undefined,
        uuid: uniqueUuids[i],
        status: 'active',
      });
    }

    return users;
  }
}
