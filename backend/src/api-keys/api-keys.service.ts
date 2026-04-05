import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export interface SerializedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revoked: boolean;
  createdAt: Date;
}

function serialize(k: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revoked: boolean;
  createdAt: Date;
}): SerializedApiKey {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revoked: k.revoked,
    createdAt: k.createdAt,
  };
}

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    adminId: string,
    dto: CreateApiKeyDto,
  ): Promise<SerializedApiKey & { key: string }> {
    const randomHex = crypto.randomBytes(20).toString('hex'); // 40 chars
    const plaintext = `hf_${randomHex}`;
    const keyHash = hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 11); // "hf_" + first 8 chars

    const created = await this.prisma.apiKey.create({
      data: {
        adminId,
        name: dto.name,
        keyHash,
        keyPrefix,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return { ...serialize(created), key: plaintext };
  }

  async list(adminId: string): Promise<SerializedApiKey[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(serialize);
  }

  async revoke(adminId: string, id: string): Promise<{ id: string }> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, adminId },
    });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
    });
    return { id };
  }

  async findByPlaintext(plaintext: string) {
    const keyHash = hashKey(plaintext);
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        admin: { select: { id: true, email: true, role: true, enabled: true } },
      },
    });
    return key;
  }

  async touchLastUsed(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // ignore
    }
  }
}
