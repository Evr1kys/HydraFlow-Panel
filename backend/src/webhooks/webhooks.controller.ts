import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@ApiTags('Webhooks')
@ApiBearerAuth('default')
@Controller('api/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhooks' })
  @ApiResponse({ status: 200, description: 'Array of webhooks' })
  findAll() {
    return this.webhooksService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }

  @Get('deliveries/stats')
  @ApiOperation({ summary: 'Get webhook delivery counts by status' })
  deliveryStats() {
    return this.webhooksService.deliveryStats();
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get recent deliveries for a webhook' })
  listDeliveries(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.webhooksService.listDeliveries(id, parsed);
  }

  @Post(':id/deliveries/:deliveryId/retry')
  @ApiOperation({ summary: 'Manually retry a failed delivery' })
  retryDelivery(
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooksService.retryDelivery(id, deliveryId);
  }
}
