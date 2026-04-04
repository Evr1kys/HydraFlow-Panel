import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { XrayModule } from './xray/xray.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    XrayModule,
    SettingsModule,
    DashboardModule,
    IntelligenceModule,
    SubscriptionModule,
    HealthModule,
  ],
})
export class AppModule {}
