import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionHistoryService } from './subscription-history.service';

@ApiTags('Subscription History')
@ApiBearerAuth('default')
@Controller('api')
@UseGuards(JwtAuthGuard)
export class SubscriptionHistoryController {
  constructor(
    private readonly subHistoryService: SubscriptionHistoryService,
  ) {}

  @Get('users/:id/subscription-requests')
  @ApiOperation({ summary: 'Get the last 24 subscription requests for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Last 24 subscription requests' })
  async forUser(@Param('id') id: string) {
    return this.subHistoryService.getForUser(id);
  }

  @Get('subscription-requests')
  @ApiOperation({ summary: 'List subscription requests with filters' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'status', required: false, description: 'HTTP status code' })
  @ApiResponse({ status: 200, description: 'Subscription requests' })
  async list(
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ) {
    return this.subHistoryService.find({
      userId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      status: status ? Number(status) : undefined,
    });
  }
}
