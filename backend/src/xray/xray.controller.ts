import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { XrayService } from './xray.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('xray')
@UseGuards(JwtAuthGuard)
export class XrayController {
  constructor(private readonly xrayService: XrayService) {}

  @Get('status')
  getStatus() { return this.xrayService.getStatus(); }

  @Post('restart')
  restart() { return this.xrayService.restart(); }

  @Get('config')
  getConfig() { return this.xrayService.getConfig(); }

  @Post('config')
  updateConfig(@Body() config: Record<string, any>) { return this.xrayService.updateConfig(config); }
}
