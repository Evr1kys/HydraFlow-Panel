import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.serializeUser(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.serializeUser(user);
  }

  async create(dto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        trafficLimit: dto.trafficLimit ? BigInt(dto.trafficLimit) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });
    return this.serializeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.trafficLimit !== undefined && { trafficLimit: dto.trafficLimit ? BigInt(dto.trafficLimit) : null }),
        ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
    return this.serializeUser(user);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  async toggle(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { enabled: !user.enabled } });
    return this.serializeUser(updated);
  }

  async getSubscription(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return { subToken: user.subToken, subscriptionUrl: `/sub/${user.subToken}` };
  }

  async findBySubToken(token: string) {
    const user = await this.prisma.user.findUnique({ where: { subToken: token } });
    if (!user) return null;
    return this.serializeUser(user);
  }

  async count() { return this.prisma.user.count(); }
  async countEnabled() { return this.prisma.user.count({ where: { enabled: true } }); }

  async totalTraffic(): Promise<{ up: bigint; down: bigint }> {
    const result = await this.prisma.user.aggregate({ _sum: { trafficUp: true, trafficDown: true } });
    return { up: result._sum.trafficUp || BigInt(0), down: result._sum.trafficDown || BigInt(0) };
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
  }

  private serializeUser(user: any) {
    return {
      ...user,
      trafficUp: user.trafficUp.toString(),
      trafficDown: user.trafficDown.toString(),
      trafficLimit: user.trafficLimit?.toString() || null,
    };
  }
}
