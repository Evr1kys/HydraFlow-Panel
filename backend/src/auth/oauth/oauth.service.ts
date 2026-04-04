import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../sessions.service';

interface OAuthProviderConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly configService: ConfigService,
  ) {}

  getEnabledProviders(): { provider: string; enabled: boolean }[] {
    return [
      {
        provider: 'telegram',
        enabled: !!this.configService.get<string>('TELEGRAM_BOT_TOKEN'),
      },
      {
        provider: 'github',
        enabled:
          !!this.configService.get<string>('GITHUB_CLIENT_ID') &&
          !!this.configService.get<string>('GITHUB_CLIENT_SECRET'),
      },
      {
        provider: 'yandex',
        enabled:
          !!this.configService.get<string>('YANDEX_CLIENT_ID') &&
          !!this.configService.get<string>('YANDEX_CLIENT_SECRET'),
      },
    ];
  }

  // --- Telegram Login Widget ---

  async telegramCallback(
    data: TelegramAuthData,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string }> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram login is not configured');
    }

    // Verify hash per Telegram Login Widget spec
    this.verifyTelegramAuth(data, botToken);

    const providerId = String(data.id);
    return this.findOrLinkOAuthUser('telegram', providerId, undefined, userAgent, ip);
  }

  private verifyTelegramAuth(data: TelegramAuthData, botToken: string): void {
    const { hash, ...rest } = data;
    const checkArr = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key as keyof typeof rest]}`);
    const checkString = checkArr.join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (hmac !== hash) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    // Check auth_date is not too old (allow 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 300) {
      throw new UnauthorizedException('Telegram auth data expired');
    }
  }

  // --- GitHub OAuth ---

  async getGitHubAuthUrl(state: string): Promise<{ url: string }> {
    const { GitHub } = await this.importArctic();
    const config = this.getGitHubConfig();
    const redirectUri = this.configService.get<string>(
      'GITHUB_REDIRECT_URI',
      this.getDefaultRedirectUri('github'),
    );

    const github = new GitHub(config.clientId!, config.clientSecret!, redirectUri);
    const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);
    return { url: url.toString() };
  }

  async githubCallback(
    code: string,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string }> {
    const { GitHub } = await this.importArctic();
    const config = this.getGitHubConfig();
    const redirectUri = this.configService.get<string>(
      'GITHUB_REDIRECT_URI',
      this.getDefaultRedirectUri('github'),
    );

    const github = new GitHub(config.clientId!, config.clientSecret!, redirectUri);
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();

    // Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = (await userResponse.json()) as { id: number; email?: string; login: string };

    // Try to get email if not public
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const emails = (await emailsResponse.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email;
    }

    const providerId = String(githubUser.id);
    return this.findOrLinkOAuthUser('github', providerId, email ?? undefined, userAgent, ip);
  }

  // --- Yandex OAuth ---

  async getYandexAuthUrl(state: string): Promise<{ url: string }> {
    const { Yandex } = await this.importArctic();
    const config = this.getYandexConfig();
    const redirectUri = this.configService.get<string>(
      'YANDEX_REDIRECT_URI',
      this.getDefaultRedirectUri('yandex'),
    );

    const yandex = new Yandex(config.clientId!, config.clientSecret!, redirectUri);
    const url = yandex.createAuthorizationURL(state, ['login:email', 'login:info']);
    return { url: url.toString() };
  }

  async yandexCallback(
    code: string,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string }> {
    const { Yandex } = await this.importArctic();
    const config = this.getYandexConfig();
    const redirectUri = this.configService.get<string>(
      'YANDEX_REDIRECT_URI',
      this.getDefaultRedirectUri('yandex'),
    );

    const yandex = new Yandex(config.clientId!, config.clientSecret!, redirectUri);
    const tokens = await yandex.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();

    const userResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    const yandexUser = (await userResponse.json()) as {
      id: string;
      default_email?: string;
      login: string;
    };

    return this.findOrLinkOAuthUser(
      'yandex',
      yandexUser.id,
      yandexUser.default_email,
      userAgent,
      ip,
    );
  }

  // --- Shared helpers ---

  private async findOrLinkOAuthUser(
    provider: string,
    providerId: string,
    email: string | undefined,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string }> {
    // 1. Check if OAuth account already linked
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { admin: true },
    });

    if (existing) {
      return this.issueToken(existing.admin.id, existing.admin.email, userAgent, ip);
    }

    // 2. If email matches an existing admin, auto-link
    if (email) {
      const admin = await this.prisma.admin.findUnique({ where: { email } });
      if (admin) {
        await this.prisma.oAuthAccount.create({
          data: { adminId: admin.id, provider, providerId, email },
        });
        return this.issueToken(admin.id, admin.email, userAgent, ip);
      }
    }

    throw new UnauthorizedException(
      'No admin account found for this OAuth identity. Link it from Settings first.',
    );
  }

  private issueToken(
    adminId: string,
    email: string,
    userAgent: string,
    ip: string,
  ): { token: string } {
    const payload = { sub: adminId, email };
    const token = this.jwtService.sign(payload);
    this.sessionsService.create(adminId, email, token, userAgent, ip);
    return { token };
  }

  private getGitHubConfig(): OAuthProviderConfig {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }
    return { enabled: true, clientId, clientSecret };
  }

  private getYandexConfig(): OAuthProviderConfig {
    const clientId = this.configService.get<string>('YANDEX_CLIENT_ID');
    const clientSecret = this.configService.get<string>('YANDEX_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Yandex OAuth is not configured');
    }
    return { enabled: true, clientId, clientSecret };
  }

  private getDefaultRedirectUri(provider: string): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    return `${baseUrl}/api/auth/oauth/${provider}/callback`;
  }

  private async importArctic(): Promise<typeof import('arctic')> {
    // arctic is ESM-only; use dynamic import in CommonJS context
    return await (Function('return import("arctic")')() as Promise<typeof import('arctic')>);
  }
}
