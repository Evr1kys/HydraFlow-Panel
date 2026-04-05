import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

export interface SerializedAdmin {
  id: string;
  email: string;
  role: string;
  enabled: boolean;
  lastLoginAt: Date | null;
  totpEnabled: boolean;
  createdAt: Date;
}

function serialize(a: {
  id: string;
  email: string;
  role: string;
  enabled: boolean;
  lastLoginAt: Date | null;
  totpEnabled: boolean;
  createdAt: Date;
}): SerializedAdmin {
  return {
    id: a.id,
    email: a.email,
    role: a.role,
    enabled: a.enabled,
    lastLoginAt: a.lastLoginAt,
    totpEnabled: a.totpEnabled,
    createdAt: a.createdAt,
  };
}

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SerializedAdmin[]> {
    const admins = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return admins.map(serialize);
  }

  async create(dto: CreateAdminDto): Promise<SerializedAdmin> {
    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }
    const hashed = await bcrypt.hash(dto.password, 12);
    const created = await this.prisma.admin.create({
      data: {
        email: dto.email,
        password: hashed,
        role: dto.role ?? 'admin',
      },
    });
    return serialize(created);
  }

  async update(id: string, dto: UpdateAdminDto): Promise<SerializedAdmin> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
    return serialize(updated);
  }

  async remove(id: string): Promise<{ id: string }> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    // Prevent deleting the last superadmin
    if (admin.role === 'superadmin') {
      const superadminCount = await this.prisma.admin.count({
        where: { role: 'superadmin' },
      });
      if (superadminCount <= 1) {
        throw new BadRequestException('Cannot delete the last superadmin');
      }
    }
    await this.prisma.admin.delete({ where: { id } });
    return { id };
  }

  async resetPassword(id: string, newPassword: string): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.admin.update({
      where: { id },
      data: { password: hashed },
    });
    return { message: 'Password reset successfully' };
  }
}
