import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BackupService } from './backup.service';
import { NoEnvelope } from '../common/decorators/no-envelope.decorator';

@ApiTags('Backup')
@ApiBearerAuth('default')
@Controller('api/backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Create a new backup immediately' })
  @ApiResponse({ status: 201, description: 'Backup job created' })
  create() {
    return this.backupService.create('manual');
  }

  @Get('list')
  @ApiOperation({ summary: 'List backups' })
  list() {
    return this.backupService.list();
  }

  @Get(':id/download')
  @NoEnvelope()
  @ApiOperation({ summary: 'Download a backup file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const info = await this.backupService.download(id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${info.filename}"`,
    );
    const stream = createReadStream(info.filePath);
    stream.pipe(res);
  }

  @Post(':id/restore')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Restore database from a backup (DESTRUCTIVE)' })
  restore(@Param('id') id: string) {
    return this.backupService.restore(id);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete a backup' })
  remove(@Param('id') id: string) {
    return this.backupService.remove(id);
  }
}
