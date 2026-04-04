import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { XrayModule } from './xray/xray.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, UsersModule, XrayModule, SubscriptionModule, DashboardModule, SettingsModule],
})
export class AppModule {}
