import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MetadataMap = Record<string, string>;

@Injectable()
export class MetadataService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensureNodeExists(nodeId: string): Promise<void> {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true },
    });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
  }

  async getUserMeta(userId: string): Promise<MetadataMap> {
    await this.ensureUserExists(userId);
    const rows = await this.prisma.userMeta.findMany({
      where: { userId },
      select: { key: true, value: true },
    });
    const result: MetadataMap = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async setUserMeta(
    userId: string,
    key: string,
    value: string,
  ): Promise<{ key: string; value: string }> {
    await this.ensureUserExists(userId);
    const row = await this.prisma.userMeta.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
    });
    return { key: row.key, value: row.value };
  }

  async deleteUserMeta(
    userId: string,
    key: string,
  ): Promise<{ message: string }> {
    await this.ensureUserExists(userId);
    const result = await this.prisma.userMeta.deleteMany({
      where: { userId, key },
    });
    if (result.count === 0) {
      throw new NotFoundException('Metadata key not found');
    }
    return { message: 'Metadata deleted' };
  }

  async getNodeMeta(nodeId: string): Promise<MetadataMap> {
    await this.ensureNodeExists(nodeId);
    const rows = await this.prisma.nodeMeta.findMany({
      where: { nodeId },
      select: { key: true, value: true },
    });
    const result: MetadataMap = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async setNodeMeta(
    nodeId: string,
    key: string,
    value: string,
  ): Promise<{ key: string; value: string }> {
    await this.ensureNodeExists(nodeId);
    const row = await this.prisma.nodeMeta.upsert({
      where: { nodeId_key: { nodeId, key } },
      create: { nodeId, key, value },
      update: { value },
    });
    return { key: row.key, value: row.value };
  }

  async deleteNodeMeta(
    nodeId: string,
    key: string,
  ): Promise<{ message: string }> {
    await this.ensureNodeExists(nodeId);
    const result = await this.prisma.nodeMeta.deleteMany({
      where: { nodeId, key },
    });
    if (result.count === 0) {
      throw new NotFoundException('Metadata key not found');
    }
    return { message: 'Metadata deleted' };
  }
}
