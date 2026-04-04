import { Controller, Get, Param, Header } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Controller('sub')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':token')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="HydraFlow"')
  async getSubscription(@Param('token') token: string) {
    return this.subscriptionService.getSubscription(token);
  }
}
