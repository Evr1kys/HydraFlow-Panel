import { Controller, Get, Param, Res, Headers } from '@nestjs/common';
import { Response } from 'express';
import { SubscriptionService } from './subscription.service';

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('sub/:token')
  async getSubscription(
    @Param('token') token: string,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const base64Links = await this.subscriptionService.generateLinks(token);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="subscription.txt"',
    );
    res.setHeader('Subscription-Userinfo', 'upload=0; download=0; total=0');
    void userAgent;
    res.send(base64Links);
  }

  @Get('p/:token')
  async getSubscriptionPage(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const html = await this.subscriptionService.generatePage(token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
