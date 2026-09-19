import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { XrayService } from './xray.service';
import { ValidateConfigDto } from './dto/validate-config.dto';
import { SaveConfigDto } from './dto/save-config.dto';

interface AuthenticatedRequest {
  user?: { id?: string };
}

@ApiTags('Xray')
@ApiBearerAuth('default')
@Controller('api/xray')
@UseGuards(JwtAuthGuard, RolesGuard)
export class XrayController {
  constructor(private readonly xrayService: XrayService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get aggregate Agent and Xray status' })
  @ApiResponse({ status: 200, description: 'Status of enabled Agent nodes' })
  getStatus() {
    return this.xrayService.getStatus();
  }

  @Post('restart')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Restart Xray through all enabled Agents' })
  restart() {
    return this.xrayService.restart();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get desired Xray JSON configuration' })
  getConfig() {
    return this.xrayService.getConfig();
  }

  @Post('config')
  @Roles('superadmin', 'admin')
  @ApiOperation({
    summary: 'Validate and atomically deploy config through Agent API v1',
  })
  saveConfig(
    @Body() dto: SaveConfigDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.xrayService.saveConfig(dto.config, request.user?.id);
  }

  @Get('config/default')
  @ApiOperation({ summary: 'Get generated config based on current data' })
  getDefaultConfig() {
    return this.xrayService.getDefaultConfig();
  }

  @Post('validate')
  @Roles('superadmin', 'admin', 'operator')
  @ApiOperation({ summary: 'Run structural validation before deployment' })
  validateConfig(@Body() dto: ValidateConfigDto) {
    return this.xrayService.validateConfig(dto.config);
  }
}
