import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntelligenceService } from './intelligence.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('Intelligence')
@ApiBearerAuth('default')
@Controller('api')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Get('intelligence')
  @ApiOperation({ summary: 'Get ISP intelligence map' })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by country' })
  @ApiResponse({ status: 200, description: 'ISP protocol status entries' })
  getMap(@Query('country') country?: string) {
    return this.intelligenceService.getMap(country);
  }

  @Post('intelligence/report')
  @ApiOperation({ summary: 'Submit a protocol status report' })
  @ApiResponse({ status: 201, description: 'Report created' })
  addReport(@Body() dto: CreateReportDto) {
    return this.intelligenceService.addReport(dto);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get recent protocol alerts' })
  @ApiResponse({ status: 200, description: 'Array of alerts' })
  getAlerts() {
    return this.intelligenceService.getAlerts();
  }
}
