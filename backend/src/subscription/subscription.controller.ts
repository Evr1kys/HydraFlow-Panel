import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { SubscriptionService } from './subscription.service';

@Controller('sub')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':token')
  async getSubscription(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const base64Links = await this.subscriptionService.generateLinks(token);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="subscription.txt"',
    );
    res.setHeader('Subscription-Userinfo', 'upload=0; download=0; total=0');
    res.send(base64Links);
  }
}
