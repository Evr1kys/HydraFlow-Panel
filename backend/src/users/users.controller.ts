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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { RenewUserDto } from './dto/renew-user.dto';

@ApiTags('Users')
@ApiBearerAuth('default')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Array of users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Post('bulk/enable')
  @ApiOperation({ summary: 'Bulk enable users' })
  @ApiResponse({ status: 201, description: 'Users enabled' })
  bulkEnable(@Body() dto: BulkIdsDto) {
    return this.usersService.bulkEnable(dto);
  }

  @Post('bulk/disable')
  @ApiOperation({ summary: 'Bulk disable users' })
  @ApiResponse({ status: 201, description: 'Users disabled' })
  bulkDisable(@Body() dto: BulkIdsDto) {
    return this.usersService.bulkDisable(dto);
  }

  @Delete('bulk')
  @Roles('superadmin', 'admin', 'operator')
  @ApiOperation({ summary: 'Bulk delete users' })
  @ApiResponse({ status: 200, description: 'Users deleted' })
  bulkDelete(@Body() dto: BulkIdsDto) {
    return this.usersService.bulkDelete(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin', 'operator')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle user enabled/disabled' })
  @ApiResponse({ status: 201, description: 'User toggled' })
  toggle(@Param('id') id: string) {
    return this.usersService.toggle(id);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renew user expiry by N days' })
  @ApiResponse({ status: 201, description: 'User renewed' })
  renew(@Param('id') id: string, @Body() dto: RenewUserDto) {
    return this.usersService.renew(id, dto.days);
  }

  @Post(':id/reset-traffic')
  @ApiOperation({ summary: 'Reset user traffic counters and history' })
  @ApiResponse({ status: 201, description: 'Traffic reset' })
  resetTraffic(@Param('id') id: string) {
    return this.usersService.resetTraffic(id);
  }
}
