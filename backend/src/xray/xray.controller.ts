import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { XrayService } from './xray.service';

@Controller('api/xray')
@UseGuards(JwtAuthGuard)
export class XrayController {
  constructor(private readonly xrayService: XrayService) {}

  @Get('status')
  getStatus() {
    return this.xrayService.getStatus();
  }

  @Post('restart')
  restart() {
    return this.xrayService.restart();
  }
}
