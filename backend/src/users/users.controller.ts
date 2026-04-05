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
import { BulkExtendExpirationDto } from './dto/bulk-extend-expiration.dto';
import { BulkUpdateSquadsDto } from './dto/bulk-update-squads.dto';
import { BulkDeleteByStatusDto } from './dto/bulk-delete-by-status.dto';
import { BulkAllExtendExpirationDto } from './dto/bulk-all-extend-expiration.dto';
import { BulkAllBaseDto } from './dto/bulk-all-base.dto';
import { ResolveUserDto } from './dto/resolve-user.dto';

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

  @Get('tags')
  @ApiOperation({ summary: 'Get distinct list of user tags' })
  @ApiResponse({ status: 200, description: 'Array of tag strings' })
  listTags() {
    return this.usersService.listTags();
  }

  @Get('by-short-uuid/:shortUuid')
  @ApiOperation({ summary: 'Find user by short UUID' })
  @ApiResponse({ status: 200, description: 'User details' })
  findByShortUuid(@Param('shortUuid') shortUuid: string) {
    return this.usersService.findByShortUuid(shortUuid);
  }

  @Get('by-email/:email')
  @ApiOperation({ summary: 'Find user by email' })
  @ApiResponse({ status: 200, description: 'User details' })
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Get('by-uuid/:uuid')
  @ApiOperation({ summary: 'Find user by UUID' })
  @ApiResponse({ status: 200, description: 'User details' })
  findByUuid(@Param('uuid') uuid: string) {
    return this.usersService.findByUuid(uuid);
  }

  @Get('by-sub-token/:token')
  @ApiOperation({ summary: 'Find user by subscription token' })
  @ApiResponse({ status: 200, description: 'User details' })
  findBySubToken(@Param('token') token: string) {
    return this.usersService.findBySubToken(token);
  }

  @Get('by-id/:id')
  @ApiOperation({ summary: 'Find user by ID (explicit route)' })
  @ApiResponse({ status: 200, description: 'User details' })
  findById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post('resolve')
  @ApiOperation({
    summary:
      'Resolve user by any identifier (email/uuid/subToken/shortUuid/id/telegramId/tag)',
  })
  @ApiResponse({ status: 200, description: 'User details' })
  resolve(@Body() dto: ResolveUserDto) {
    return this.usersService.resolveUser(dto.identifier);
  }

  @Get('by-tag/:tag')
  @ApiOperation({ summary: 'Find users by tag' })
  @ApiResponse({ status: 200, description: 'Array of users' })
  findByTag(@Param('tag') tag: string) {
    return this.usersService.findByTag(tag);
  }

  @Get('by-telegram-id/:tgId')
  @ApiOperation({ summary: 'Find user by Telegram ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  findByTelegramId(@Param('tgId') tgId: string) {
    return this.usersService.findByTelegramId(tgId);
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

  @Post('bulk/extend-expiration')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk extend expiry date by N days' })
  @ApiResponse({ status: 201, description: 'Expiration extended' })
  bulkExtendExpiration(@Body() dto: BulkExtendExpirationDto) {
    return this.usersService.bulkExtendExpiration(dto);
  }

  @Post('bulk/reset-traffic')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk reset traffic counters' })
  @ApiResponse({ status: 201, description: 'Traffic reset' })
  bulkResetTraffic(@Body() dto: BulkIdsDto) {
    return this.usersService.bulkResetTraffic(dto);
  }

  @Post('bulk/update-squads')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk update internal/external squad assignment' })
  @ApiResponse({ status: 201, description: 'Squads updated' })
  bulkUpdateSquads(@Body() dto: BulkUpdateSquadsDto) {
    return this.usersService.bulkUpdateSquads(dto);
  }

  @Post('bulk/revoke-subscription')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk regenerate subscription tokens' })
  @ApiResponse({ status: 201, description: 'Subscription tokens regenerated' })
  bulkRevokeSubscription(@Body() dto: BulkIdsDto) {
    return this.usersService.bulkRevokeSubscription(dto);
  }

  @Post('bulk/delete-by-status')
  @Roles('superadmin', 'admin')
  @ApiOperation({
    summary: 'Bulk delete users matching status (expired or disabled)',
  })
  @ApiResponse({ status: 201, description: 'Users deleted' })
  bulkDeleteByStatus(@Body() dto: BulkDeleteByStatusDto) {
    return this.usersService.bulkDeleteByStatus(dto);
  }

  @Post('bulk/all/extend-expiration')
  @Roles('superadmin', 'admin')
  @ApiOperation({
    summary: 'Extend expiration for ALL users matching filters',
  })
  @ApiResponse({ status: 201, description: 'Expiration extended' })
  bulkAllExtendExpiration(@Body() dto: BulkAllExtendExpirationDto) {
    return this.usersService.bulkAllExtendExpiration(dto);
  }

  @Post('bulk/all/reset-traffic')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Reset traffic for ALL users matching filters' })
  @ApiResponse({ status: 201, description: 'Traffic reset' })
  bulkAllResetTraffic(@Body() dto: BulkAllBaseDto) {
    return this.usersService.bulkAllResetTraffic(dto);
  }

  @Post('bulk/all/revoke-subscription')
  @Roles('superadmin', 'admin')
  @ApiOperation({
    summary: 'Regenerate subscription tokens for ALL users matching filters',
  })
  @ApiResponse({ status: 201, description: 'Subscription tokens regenerated' })
  bulkAllRevokeSubscription(@Body() dto: BulkAllBaseDto) {
    return this.usersService.bulkAllRevokeSubscription(dto);
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

  @Post(':id/revoke-subscription')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Regenerate user subscription token' })
  @ApiResponse({ status: 201, description: 'Subscription token regenerated' })
  revokeSubscription(@Param('id') id: string) {
    return this.usersService.revokeSubscription(id);
  }
}
