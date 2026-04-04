import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser {
  user: { id: string; email: string };
  headers: Record<string, string | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Controller('api/auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns which providers are enabled (no auth required) */
  @Get('providers')
  getProviders() {
    return this.oauthService.getEnabledProviders();
  }

  // --- Telegram ---

  @Post('telegram/callback')
  telegramCallback(
    @Body()
    data: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.oauthService.telegramCallback(data, userAgent, ip);
  }

  // --- GitHub ---

  @Get('github')
  async githubRedirect(@Query('state') state: string, @Res() res: Response) {
    const { url } = await this.oauthService.getGitHubAuthUrl(state || 'default');
    res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      const { token } = await this.oauthService.githubCallback(code, userAgent, ip);
      // Redirect to frontend with token
      res.redirect(`/login?token=${token}`);
    } catch {
      res.redirect('/login?error=oauth_failed');
    }
  }

  // --- Yandex ---

  @Get('yandex')
  async yandexRedirect(@Query('state') state: string, @Res() res: Response) {
    const { url } = await this.oauthService.getYandexAuthUrl(state || 'default');
    res.redirect(url);
  }

  @Get('yandex/callback')
  async yandexCallback(
    @Query('code') code: string,
    @Request() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      const { token } = await this.oauthService.yandexCallback(code, userAgent, ip);
      res.redirect(`/login?token=${token}`);
    } catch {
      res.redirect('/login?error=oauth_failed');
    }
  }

  // --- Link / Unlink (authenticated) ---

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async getLinkedAccounts(@Request() req: RequestWithUser) {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { adminId: req.user.id },
      select: { id: true, provider: true, providerId: true, email: true, createdAt: true },
    });
    return accounts;
  }

  @UseGuards(JwtAuthGuard)
  @Post('unlink')
  async unlinkAccount(
    @Request() req: RequestWithUser,
    @Body() body: { accountId: string },
  ) {
    await this.prisma.oAuthAccount.deleteMany({
      where: { id: body.accountId, adminId: req.user.id },
    });
    return { message: 'Account unlinked' };
  }
}
