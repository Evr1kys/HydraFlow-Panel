import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { email: dto.email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: admin.id, email: admin.email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      admin: { id: admin.id, email: admin.email },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
      if (!admin) throw new UnauthorizedException('Invalid token');
      const newPayload = { sub: admin.id, email: admin.email };
      return { accessToken: this.jwtService.sign(newPayload), refreshToken: this.jwtService.sign(newPayload, { expiresIn: '7d' }) };
    } catch { throw new UnauthorizedException('Invalid or expired refresh token'); }
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Admin not found');
    const isValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.admin.update({ where: { id: adminId }, data: { password: hashed } });
    return { message: 'Password changed successfully' };
  }
}
