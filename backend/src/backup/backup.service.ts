import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn, type ChildProcess } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';

const BACKUP_DIR = path.resolve(
  process.env.BACKUP_DIR ?? '/var/backups/hydraflow',
);
const MAX_PROCESS_ERROR = 64 * 1024;

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

function processEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return { ...process.env, PGDATABASE: databaseUrl };
}

function waitForChild(child: ChildProcess, label: string): Promise<void> {
  let stderr = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string | Buffer) => {
    if (stderr.length < MAX_PROCESS_ERROR) {
      stderr += String(chunk).slice(0, MAX_PROCESS_ERROR - stderr.length);
    }
  });
  return new Promise((resolve, reject) => {
    child.once('error', (error) => {
      reject(new Error(`${label} could not start: ${error.message}`));
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = stderr.trim() ? `: ${stderr.trim()}` : '';
      reject(
        new Error(
          `${label} exited with ${signal ? `signal ${signal}` : `code ${String(code)}`}${suffix}`,
        ),
      );
    });
  });
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
      await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
      await fs.chmod(BACKUP_DIR, 0o700);
    } catch (err) {
      this.logger.warn(
        `Could not secure backup dir ${BACKUP_DIR}: ${err instanceof Error ? err.message : String(err)}`,
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
      throw new BadRequestException('DATABASE_URL env var not set, cannot run pg_dump');
    }

    const job = await this.prisma.backupJob.create({
      data: { type, status: 'running' },
    });

    let filePath: string | undefined;
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
      filePath = path.join(BACKUP_DIR, `${timestamp}-${job.id}.sql.gz`);

      const dump = spawn(
        'pg_dump',
        ['--format=plain', '--no-owner', '--no-privileges'],
        {
          env: processEnv(databaseUrl),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      if (!dump.stdout) throw new Error('pg_dump stdout is unavailable');

      const childDone = waitForChild(dump, 'pg_dump');
      const pipeDone = pipeline(
        dump.stdout,
        createGzip({ level: 9 }),
        createWriteStream(filePath, { flags: 'wx', mode: 0o600 }),
      );

      try {
        await Promise.all([childDone, pipeDone]);
      } catch (error) {
        if (!dump.killed) dump.kill('SIGKILL');
        await Promise.allSettled([childDone, pipeDone]);
        throw error;
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw new Error('Backup output is not a regular file');

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
      if (filePath) {
        await fs.rm(filePath, { force: true }).catch(() => undefined);
      }
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
      throw new BadRequestException('DATABASE_URL env var not set, cannot run psql');
    }
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (!job.filePath || job.status !== 'completed') {
      throw new BadRequestException('Backup is not in a restorable state');
    }

    const filePath = await this.assertRegularBackupFile(job.filePath);
    const psql = spawn(
      'psql',
      ['--set', 'ON_ERROR_STOP=1', '--single-transaction'],
      {
        env: processEnv(databaseUrl),
        stdio: ['pipe', 'ignore', 'pipe'],
      },
    );
    if (!psql.stdin) {
      throw new BadRequestException('psql stdin is unavailable');
    }

    const childDone = waitForChild(psql, 'psql');
    const pipeDone = pipeline(createReadStream(filePath), createGunzip(), psql.stdin);

    try {
      await Promise.all([childDone, pipeDone]);
      return { message: 'Restore completed' };
    } catch (err) {
      if (!psql.killed) psql.kill('SIGKILL');
      await Promise.allSettled([childDone, pipeDone]);
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Restore failed: ${msg}`);
      throw new BadRequestException(`Restore failed: ${msg}`);
    }
  }

  async download(jobId: string): Promise<{ filePath: string; filename: string }> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (!job.filePath || job.status !== 'completed') {
      throw new BadRequestException('No completed backup file for this job');
    }
    const filePath = await this.assertRegularBackupFile(job.filePath);
    return { filePath, filename: path.basename(filePath) };
  }

  async remove(jobId: string): Promise<{ message: string }> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Backup job not found');
    if (job.filePath) {
      try {
        const filePath = this.confineBackupPath(job.filePath);
        await fs.unlink(filePath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          this.logger.warn(
            `Failed to delete backup file for job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
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

  private confineBackupPath(storedPath: string): string {
    const resolved = path.resolve(storedPath);
    const prefix = `${BACKUP_DIR}${path.sep}`;
    if (!resolved.startsWith(prefix)) {
      throw new BadRequestException('Backup path is outside BACKUP_DIR');
    }
    return resolved;
  }

  private async assertRegularBackupFile(storedPath: string): Promise<string> {
    const filePath = this.confineBackupPath(storedPath);
    try {
      const stat = await fs.lstat(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new BadRequestException('Backup path is not a regular file');
      }
      return filePath;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Backup file is missing on disk');
    }
  }
}
