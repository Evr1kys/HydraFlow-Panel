import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('default')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'User counts, traffic, protocol status' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recap')
  @ApiOperation({ summary: 'Get aggregated system-wide recap stats' })
  @ApiResponse({ status: 200, description: 'Users, traffic, nodes, countries, uptime' })
  getRecap() {
    return this.dashboardService.getRecap();
  }
}
