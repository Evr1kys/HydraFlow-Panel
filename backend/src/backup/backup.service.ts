import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/var/backups/hydraflow';

export interface SerializedBackup {
  id: string;
  type: string;
  status: string;
  filePath: string | null;
  fileSize: string | null;
  errorMsg: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

function serialize(job: {
  id: string;
  type: string;
  status: string;
  filePath: string | null;
  fileSize: bigint | null;
  errorMsg: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): SerializedBackup {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    filePath: job.filePath,
    fileSize: job.fileSize != null ? job.fileSize.toString() : null,
    errorMsg: job.errorMsg,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (err) {
      this.logger.warn(
        `Could not ensure backup dir ${BACKUP_DIR}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async list(): Promise<SerializedBackup[]> {
    const jobs = await this.prisma.backupJob.findMany({
      orderBy: { startedAt: 'desc' },
    });
    return jobs.map(serialize);
  }

  async findOne(id: string): Promise<SerializedBackup> {
    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Backup job not found');
    return serialize(job);
  }

  async create(type: 'manual' | 'scheduled'): Promise<SerializedBackup> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new BadRequestException(
        'DATABASE_URL env var not set, cannot run pg_dump',
      );
    }

    const job = await this.prisma.backupJob.create({
      data: { type, status: 'running' },
    });

    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
      const filePath = path.join(BACKUP_DIR, `${timestamp}.sql.gz`);

      const cmd = `pg_dump "${databaseUrl}" | gzip > "${filePath}"`;
      await execAsync(cmd, { shell: '/bin/bash', maxBuffer: 1024 * 1024 * 128 });

      const stat = await fs.stat(filePath);

      const updated = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          filePath,
          fileSize: BigInt(stat.size),
          finishedAt: new Date(),
        },
      });

      const serialized = serialize(updated);
      this.eventEmitter.emit('backup.completed', serialized);
      return serialized;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Backup failed: ${errorMsg}`);
      const updated = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMsg,
          finishedAt: new Date(),
        },
      });
      const serialized = serialize(updated);
      this.eventEmitter.emit('backup.failed', serialized);
      return serialized;
    }
  }

  async restore(jobId: string): Promise<{ message: string }> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new BadRequestException(
        'DATABASE_URL env var not set, cannot run psql',
      );
    }
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (!job.filePath || job.status !== 'completed') {
      throw new BadRequestException('Backup is not in a restorable state');
    }
    try {
      await fs.access(job.filePath);
    } catch {
      throw new BadRequestException('Backup file is missing on disk');
    }

    const cmd = `gunzip -c "${job.filePath}" | psql "${databaseUrl}"`;
    try {
      await execAsync(cmd, {
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 128,
      });
      return { message: 'Restore completed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Restore failed: ${msg}`);
      throw new BadRequestException(`Restore failed: ${msg}`);
    }
  }

  async download(jobId: string): Promise<{ filePath: string; filename: string }> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (!job.filePath) {
      throw new BadRequestException('No backup file associated with this job');
    }
    try {
      await fs.access(job.filePath);
    } catch {
      throw new BadRequestException('Backup file missing on disk');
    }
    return { filePath: job.filePath, filename: path.basename(job.filePath) };
  }

  async remove(jobId: string): Promise<{ message: string }> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (job.filePath) {
      try {
        await fs.unlink(job.filePath);
      } catch (err) {
        this.logger.warn(
          `Failed to delete backup file ${job.filePath}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    await this.prisma.backupJob.delete({ where: { id: jobId } });
    return { message: 'Backup deleted' };
  }

  @Cron('0 4 * * *')
  async cleanupOld(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const old = await this.prisma.backupJob.findMany({
      where: { startedAt: { lt: cutoff } },
    });
    for (const job of old) {
      await this.remove(job.id).catch(() => undefined);
    }
    if (old.length > 0) {
      this.logger.log(`Cleaned up ${old.length} old backup(s)`);
    }
  }

  @Cron('0 3 * * *')
  async scheduled(): Promise<void> {
    this.logger.log('Running scheduled backup');
    await this.create('scheduled');
  }
}
