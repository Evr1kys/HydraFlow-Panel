import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HwidCheckResult {
  allowed: boolean;
  deviceId: string | null;
  currentDevices: number;
  maxDevices: number;
}

export interface DeviceInfo {
  id: string;
  hwid: string;
  platform: string | null;
  lastSeen: Date;
  createdAt: Date;
}

@Injectable()
export class HwidService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDevice(
    userId: string,
    hwid: string,
    platform?: string,
  ): Promise<HwidCheckResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this device is already registered for this user
    const existingDevice = await this.prisma.hwidDevice.findUnique({
      where: { userId_hwid: { userId, hwid } },
    });

    if (existingDevice) {
      // Update last seen
      await this.prisma.hwidDevice.update({
        where: { id: existingDevice.id },
        data: { lastSeen: new Date(), platform: platform ?? existingDevice.platform },
      });

      const deviceCount = await this.prisma.hwidDevice.count({ where: { userId } });

      return {
        allowed: true,
        deviceId: existingDevice.id,
        currentDevices: deviceCount,
        maxDevices: user.maxDevices,
      };
    }

    // Check device limit
    const deviceCount = await this.prisma.hwidDevice.count({ where: { userId } });
    if (deviceCount >= user.maxDevices) {
      return {
        allowed: false,
        deviceId: null,
        currentDevices: deviceCount,
        maxDevices: user.maxDevices,
      };
    }

    // Register new device
    const device = await this.prisma.hwidDevice.create({
      data: {
        userId,
        hwid,
        platform: platform ?? null,
      },
    });

    return {
      allowed: true,
      deviceId: device.id,
      currentDevices: deviceCount + 1,
      maxDevices: user.maxDevices,
    };
  }

  async checkDeviceBySubToken(
    subToken: string,
    hwid: string,
    platform?: string,
  ): Promise<HwidCheckResult> {
    const user = await this.prisma.user.findUnique({
      where: { subToken },
    });
    if (!user) {
      throw new NotFoundException('Invalid subscription token');
    }
    return this.checkDevice(user.id, hwid, platform);
  }

  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const devices = await this.prisma.hwidDevice.findMany({
      where: { userId },
      orderBy: { lastSeen: 'desc' },
    });

    return devices.map((d) => ({
      id: d.id,
      hwid: d.hwid,
      platform: d.platform,
      lastSeen: d.lastSeen,
      createdAt: d.createdAt,
    }));
  }

  async removeDevice(userId: string, deviceId: string): Promise<{ message: string }> {
    const device = await this.prisma.hwidDevice.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.hwidDevice.delete({ where: { id: deviceId } });
    return { message: 'Device removed' };
  }

  async isDeviceAllowed(subToken: string, hwid: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { subToken },
    });
    if (!user) return false;

    const existingDevice = await this.prisma.hwidDevice.findUnique({
      where: { userId_hwid: { userId: user.id, hwid } },
    });

    if (existingDevice) return true;

    const deviceCount = await this.prisma.hwidDevice.count({
      where: { userId: user.id },
    });

    return deviceCount < user.maxDevices;
  }
}
