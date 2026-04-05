import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditLogService } from './audit-log.service';
import { NoEnvelope } from '../common/decorators/no-envelope.decorator';

@ApiTags('AuditLog')
@ApiBearerAuth('default')
@Controller('api/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  @ApiQuery({ name: 'adminId', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  list(
    @Query('adminId') adminId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditLogService.list({
      adminId,
      resource,
      action,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('export')
  @NoEnvelope()
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async export(
    @Res() res: Response,
    @Query('adminId') adminId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.auditLogService.export({
      adminId,
      resource,
      action,
      from,
      to,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }
}
