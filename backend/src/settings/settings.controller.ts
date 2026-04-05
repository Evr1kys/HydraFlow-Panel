import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';

@ApiTags('Settings')
@ApiBearerAuth('default')
@Controller('api/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get panel settings (secrets masked by default)' })
  @ApiResponse({ status: 200, description: 'Current settings' })
  get(@Query('reveal') reveal?: string) {
    // Only superadmin/admin see unmasked secrets, via explicit ?reveal=true
    return this.settingsService.get(reveal === 'true');
  }

  @Patch()
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Update settings and restart Xray' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }

  @Get('email')
  @ApiOperation({ summary: 'Get email settings' })
  getEmail() {
    return this.settingsService.getEmail();
  }

  @Patch('email')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Update email settings' })
  updateEmail(@Body() dto: UpdateEmailSettingsDto) {
    return this.settingsService.updateEmail(dto);
  }
}
