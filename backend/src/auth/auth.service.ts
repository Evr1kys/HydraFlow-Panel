import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { SessionsService } from './sessions.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

async function getTotpUtils() {
  const {
    TOTP,
    NobleCryptoPlugin,
    ScureBase32Plugin,
    generate,
    verify,
    generateURI,
  } = await import('otplib');
  const crypto = new NobleCryptoPlugin();
  const base32 = new ScureBase32Plugin();
  const totp = new TOTP({ crypto, base32 });
  return {
    generateSecret: () => totp.generateSecret(),
    generate: (secret: string) => generate({ crypto, base32, secret }),
    verify: (token: string, secret: string) => verify({ crypto, base32, token, secret }),
    generateURI: (label: string, issuer: string, secret: string) =>
      generateURI({ issuer, label, secret }),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly metrics: MetricsService,
  ) {}

  async login(
    dto: LoginDto,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string } | { requires2fa: true }> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      this.metrics.incAuthAttempt('failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      this.metrics.incAuthAttempt('failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!admin.enabled) {
      this.metrics.incAuthAttempt('failed');
      throw new UnauthorizedException('Account disabled');
    }

    // Check if 2FA is enabled
    if (admin.totpEnabled && admin.totpSecret) {
      if (!dto.totpCode) {
        return { requires2fa: true };
      }

      const totp = await getTotpUtils();
      const result = await totp.verify(dto.totpCode, admin.totpSecret);
      if (!result.valid) {
        this.metrics.incAuthAttempt('failed');
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      enabled: admin.enabled,
    };
    const token = this.jwtService.sign(payload);

    this.sessionsService.create(admin.id, admin.email, token, userAgent, ip);

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    this.metrics.incAuthAttempt('success');
    return { token };
  }

  async setup2fa(adminId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (admin.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const totp = await getTotpUtils();
    const secret = totp.generateSecret();
    const otpauthUrl = totp.generateURI(admin.email, 'HydraFlow', secret);

    // Store the secret temporarily (not yet enabled)
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpSecret: secret },
    });

    // Generate QR code data URL
    let qrDataUrl = '';
    try {
      const qrcode = await import('qrcode');
      qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    } catch {
      // QR generation failed, client can use secret directly
    }

    return { secret, otpauthUrl, qrDataUrl };
  }

  async verify2fa(adminId: string, code: string): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.totpSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const totp = await getTotpUtils();
    const result = await totp.verify(code, admin.totpSecret);

    if (!result.valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpEnabled: true },
    });

    return { message: '2FA enabled successfully' };
  }

  async disable2fa(adminId: string, code: string): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const totp = await getTotpUtils();
    const result = await totp.verify(code, admin.totpSecret);

    if (!result.valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpEnabled: false, totpSecret: null },
    });

    return { message: '2FA disabled successfully' };
  }

  async changePassword(
    adminId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      admin.password,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}
