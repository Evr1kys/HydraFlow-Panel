import { Controller, Get, Param, Res, Req, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as QRCode from 'qrcode';
import { SubscriptionService } from './subscription.service';
import { MetricsService } from '../metrics/metrics.service';
import { SubscriptionHistoryService } from '../subscription-history/subscription-history.service';
import { PrismaService } from '../prisma/prisma.service';
import { NoEnvelope } from '../common/decorators/no-envelope.decorator';

type SubscriptionFormat = 'v2ray' | 'clash' | 'singbox' | 'outline';

function normalizeFormat(value?: string): SubscriptionFormat | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'outline') return 'outline';
  if (v === 'clash') return 'clash';
  if (v === 'singbox' || v === 'sing-box') return 'singbox';
  if (v === 'v2ray' || v === 'base64') return 'v2ray';
  return null;
}

function detectPlatform(userAgent: string | undefined, explicit: string | undefined): string {
  if (explicit) {
    const p = explicit.toLowerCase();
    if (p === 'ios' || p === 'android' || p === 'windows' || p === 'macos' || p === 'linux') {
      return p;
    }
  }
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'unknown';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macos') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return String(fwd[0]).split(',')[0]!.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function byteLength(content: string | Buffer): number {
  if (Buffer.isBuffer(content)) return content.length;
  return Buffer.byteLength(content, 'utf8');
}

@ApiTags('Subscription')
@NoEnvelope()
@Controller()
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly metricsService: MetricsService,
    private readonly subHistoryService: SubscriptionHistoryService,
    private readonly prisma: PrismaService,
  ) {}

  private logSubRequest(
    token: string,
    ip: string,
    userAgent: string | undefined,
    platform: string,
    format: string,
    status: number,
    size: number,
  ): void {
    // Fire-and-forget so we don't slow down the sub response.
    void (async () => {
      try {
        const user = await this.prisma.user.findUnique({
          where: { subToken: token },
          select: { id: true },
        });
        if (!user) return;
        await this.subHistoryService.log(
          user.id,
          ip,
          userAgent ?? null,
          platform,
          format,
          status,
          size,
        );
      } catch {
        // swallow - logging must never break the request
      }
    })();
  }

  @Get('sub/:token')
  @ApiOperation({ summary: 'Get subscription links (auto/format-aware)' })
  @ApiParam({ name: 'token', description: 'User subscription token' })
  @ApiQuery({ name: 'hwid', required: false, description: 'Hardware ID for device binding' })
  @ApiQuery({ name: 'platform', required: false, description: 'Client platform' })
  @ApiQuery({ name: 'format', required: false, description: 'Format override: v2ray|clash|singbox|outline' })
  @ApiResponse({ status: 200, description: 'Subscription content in requested format' })
  async getSubscription(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
    @Query('hwid') hwid?: string,
    @Query('platform') platform?: string,
    @Query('format') format?: string,
  ) {
    const normalized = normalizeFormat(format);
    const ip = getClientIp(req);
    const resolvedPlatform = detectPlatform(userAgent, platform);

    if (normalized === 'outline') {
      const result = await this.subscriptionService.generateOutlineConfig(token);
      this.metricsService.incSubscriptionRequest('outline');
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        'inline; filename="outline.json"',
      );
      res.setHeader(
        'Subscription-Userinfo',
        `upload=${result.userInfo.upload}; download=${result.userInfo.download}; total=${result.userInfo.total ?? 0}${result.userInfo.expire ? `; expire=${Math.floor(result.userInfo.expire.getTime() / 1000)}` : ''}`,
      );
      res.setHeader('Profile-Update-Interval', '12');
      res.setHeader('Profile-Title', 'HydraFlow');
      res.send(result.content);
      this.logSubRequest(token, ip, userAgent, resolvedPlatform, 'outline', 200, byteLength(result.content));
      return;
    }

    // Force user-agent based format selection when explicit format given
    let effectiveUa = userAgent ?? '';
    if (normalized === 'clash') effectiveUa = 'clash';
    else if (normalized === 'singbox') effectiveUa = 'sing-box';
    else if (normalized === 'v2ray') effectiveUa = 'v2rayng';

    const result = await this.subscriptionService.generateLinks(
      token,
      effectiveUa,
      hwid,
      platform,
    );

    // Record metric by content-type derived format
    const recordedFormat: 'v2ray' | 'clash' | 'singbox' =
      normalized === 'clash' || normalized === 'singbox' || normalized === 'v2ray'
        ? normalized
        : result.contentType.includes('yaml')
          ? 'clash'
          : result.contentType.includes('json')
            ? 'singbox'
            : 'v2ray';
    this.metricsService.incSubscriptionRequest(recordedFormat);

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
    this.logSubRequest(token, ip, userAgent, resolvedPlatform, recordedFormat, 200, byteLength(result.content));
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

  @Get('subscription/qr/:token')
  @ApiOperation({ summary: 'Get subscription QR code (PNG)' })
  @ApiParam({ name: 'token', description: 'User subscription token' })
  @ApiResponse({ status: 200, description: 'PNG image of subscription QR code' })
  async getSubscriptionQr(
    @Param('token') token: string,
    @Res() res: Response,
    @Headers('host') host?: string,
    @Headers('x-forwarded-proto') proto?: string,
  ) {
    const scheme = proto ?? 'http';
    const base = host ? `${scheme}://${host}` : undefined;
    const url = this.subscriptionService.getSubscriptionUrl(token, base);
    const png = await QRCode.toBuffer(url, { width: 300, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(png);
  }
}
