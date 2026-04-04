import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { XrayService } from './xray.service';
import { ValidateConfigDto } from './dto/validate-config.dto';
import { SaveConfigDto } from './dto/save-config.dto';

@ApiTags('Xray')
@ApiBearerAuth('default')
@Controller('api/xray')
@UseGuards(JwtAuthGuard)
export class XrayController {
  constructor(private readonly xrayService: XrayService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Xray process status' })
  @ApiResponse({ status: 200, description: 'Xray status with version and uptime' })
  getStatus() {
    return this.xrayService.getStatus();
  }

  @Post('restart')
  @ApiOperation({ summary: 'Restart Xray process' })
  @ApiResponse({ status: 201, description: 'Xray restarted successfully' })
  restart() {
    return this.xrayService.restart();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get current Xray JSON config' })
  @ApiResponse({ status: 200, description: 'Current config as JSON string' })
  getConfig() {
    return this.xrayService.getConfig();
  }

  @Post('config')
  @ApiOperation({ summary: 'Save config and restart Xray' })
  @ApiResponse({ status: 201, description: 'Config saved and Xray restarted' })
  saveConfig(@Body() dto: SaveConfigDto) {
    return this.xrayService.saveConfig(dto.config);
  }

  @Get('config/default')
  @ApiOperation({ summary: 'Get auto-generated default config' })
  @ApiResponse({ status: 200, description: 'Default config based on current settings' })
  getDefaultConfig() {
    return this.xrayService.getDefaultConfig();
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate Xray JSON config without applying' })
  @ApiResponse({ status: 201, description: 'Validation result with errors/warnings' })
  validateConfig(@Body() dto: ValidateConfigDto) {
    return this.xrayService.validateConfig(dto.config);
  }
}
