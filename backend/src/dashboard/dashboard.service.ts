import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { XrayService } from '../xray/xray.service';

@Injectable()
export class DashboardService {
  constructor(private readonly usersService: UsersService, private readonly xrayService: XrayService) {}

  async getStats() {
    const [totalUsers, activeUsers, traffic, xrayStatus] = await Promise.all([
      this.usersService.count(), this.usersService.countEnabled(),
      this.usersService.totalTraffic(), this.xrayService.getStatus(),
    ]);
    return { totalUsers, activeUsers, totalTrafficUp: traffic.up.toString(), totalTrafficDown: traffic.down.toString(), xray: xrayStatus };
  }
}
