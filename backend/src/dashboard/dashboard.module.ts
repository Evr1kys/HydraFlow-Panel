import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UsersModule } from '../users/users.module';
import { XrayModule } from '../xray/xray.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, UsersModule, XrayModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
