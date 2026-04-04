import { Controller, Get, Param, Res, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscription')
@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('sub/:token')
  @ApiOperation({ summary: 'Get subscription links (base64)' })
  @ApiParam({ name: 'token', description: 'User subscription token' })
  @ApiQuery({ name: 'hwid', required: false, description: 'Hardware ID for device binding' })
  @ApiQuery({ name: 'platform', required: false, description: 'Client platform' })
  @ApiResponse({ status: 200, description: 'Base64-encoded subscription links' })
  async getSubscription(
    @Param('token') token: string,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
    @Query('hwid') hwid?: string,
    @Query('platform') platform?: string,
  ) {
    const result = await this.subscriptionService.generateLinks(
      token,
      userAgent ?? '',
      hwid,
      platform,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      'inline; filename="subscription.txt"',
    );
    res.setHeader(
      'Subscription-Userinfo',
      `upload=${result.userInfo.upload}; download=${result.userInfo.download}; total=${result.userInfo.total ?? 0}${result.userInfo.expire ? `; expire=${Math.floor(result.userInfo.expire.getTime() / 1000)}` : ''}`,
    );
    res.setHeader('Profile-Update-Interval', '12');
    res.setHeader('Profile-Title', 'HydraFlow');
    res.send(result.content);
  }

  @Get('p/:token')
  @ApiOperation({ summary: 'Get subscription page (HTML)' })
  @ApiParam({ name: 'token', description: 'User subscription token' })
  @ApiResponse({ status: 200, description: 'HTML subscription page' })
  async getSubscriptionPage(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const html = await this.subscriptionService.generatePage(token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
