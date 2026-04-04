import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrafficService } from './traffic.service';

@Controller('api/traffic')
@UseGuards(JwtAuthGuard)
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get('history')
  getHistory(
    @Query('period') period?: string,
    @Query('days') days?: string,
  ) {
    return this.trafficService.getHistory(
      period ?? 'daily',
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('user/:id/history')
  getUserHistory(
    @Param('id') id: string,
    @Query('period') period?: string,
    @Query('days') days?: string,
  ) {
    return this.trafficService.getUserHistory(
      id,
      period ?? 'daily',
      days ? parseInt(days, 10) : 30,
    );
  }
}
