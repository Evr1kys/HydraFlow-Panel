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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateBillingNodeDto } from './dto/create-billing-node.dto';
import { CreateBillingHistoryDto } from './dto/create-billing-history.dto';

@Controller('api/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin', 'admin')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Summary
  @Get('summary')
  getSummary() {
    return this.billingService.getSummary();
  }

  // Providers
  @Get('providers')
  getProviders() {
    return this.billingService.getProviders();
  }

  @Post('providers')
  createProvider(@Body() dto: CreateProviderDto) {
    return this.billingService.createProvider(dto);
  }

  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.billingService.deleteProvider(id);
  }

  // Billing Nodes
  @Get('nodes')
  getBillingNodes() {
    return this.billingService.getBillingNodes();
  }

  @Post('nodes')
  createBillingNode(@Body() dto: CreateBillingNodeDto) {
    return this.billingService.createBillingNode(dto);
  }

  @Delete('nodes/:id')
  deleteBillingNode(@Param('id') id: string) {
    return this.billingService.deleteBillingNode(id);
  }

  // History
  @Get('history')
  getHistory(@Query('billingNodeId') billingNodeId?: string) {
    return this.billingService.getHistory(billingNodeId);
  }

  @Post('history')
  createHistory(@Body() dto: CreateBillingHistoryDto) {
    return this.billingService.createHistory(dto);
  }

  @Post('history/:id/paid')
  markPaid(@Param('id') id: string) {
    return this.billingService.markPaid(id);
  }
}
