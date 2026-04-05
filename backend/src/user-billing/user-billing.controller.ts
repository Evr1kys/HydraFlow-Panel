import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserBillingService, ProviderName } from './user-billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ManualConfirmDto } from './dto/manual-confirm.dto';

@ApiTags('UserBilling')
@Controller('api/user-billing')
export class UserBillingController {
  constructor(private readonly service: UserBillingService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('checkout')
  @ApiOperation({ summary: 'Create a payment link for a user subscription' })
  @ApiResponse({ status: 201, description: 'Checkout created' })
  createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.service.createCheckout(dto);
  }

  @Post('webhook/:provider')
  @ApiExcludeEndpoint()
  async webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: unknown,
  ) {
    const providerName = provider as ProviderName;
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof body === 'string' ? body : JSON.stringify(body));
    return this.service.processWebhook(providerName, headers, rawBody, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Get('subscriptions')
  @ApiOperation({ summary: 'List recent subscriptions across all users' })
  listAll() {
    return this.service.getAllSubscriptions();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Get('my-subscription/:userId')
  @ApiOperation({ summary: 'Get a user\'s subscription history' })
  byUser(@Param('userId') userId: string) {
    return this.service.getUserSubscriptions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('manual-confirm')
  @ApiOperation({ summary: 'Admin manually marks a subscription as paid' })
  manualConfirm(@Body() dto: ManualConfirmDto) {
    return this.service.manualConfirm(dto.subscriptionId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  cancel(@Param('id') id: string) {
    return this.service.cancelSubscription(id);
  }
}
