import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntelligenceService } from './intelligence.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Get('intelligence')
  getMap(@Query('country') country?: string) {
    return this.intelligenceService.getMap(country);
  }

  @Post('intelligence/report')
  addReport(@Body() dto: CreateReportDto) {
    return this.intelligenceService.addReport(dto);
  }

  @Get('alerts')
  getAlerts() {
    return this.intelligenceService.getAlerts();
  }
}
