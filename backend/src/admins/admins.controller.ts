import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Admins')
@ApiBearerAuth('default')
@Controller('api/admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  @ApiOperation({ summary: 'List all admins' })
  @ApiResponse({ status: 200, description: 'Array of admins' })
  list() {
    return this.adminsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create an admin' })
  @ApiResponse({ status: 201, description: 'Admin created' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin role or enabled state' })
  @ApiResponse({ status: 200, description: 'Admin updated' })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.update(id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset admin password' })
  @ApiResponse({ status: 201, description: 'Password reset' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.adminsService.resetPassword(id, dto.newPassword);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an admin' })
  @ApiResponse({ status: 200, description: 'Admin deleted' })
  remove(@Param('id') id: string) {
    return this.adminsService.remove(id);
  }
}
