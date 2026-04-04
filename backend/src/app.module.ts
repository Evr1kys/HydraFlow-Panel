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
import { NodesModule } from './nodes/nodes.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BillingModule } from './billing/billing.module';
import { PluginsModule } from './plugins/plugins.module';
import { SessionsExplorerModule } from './sessions-explorer/sessions-explorer.module';
import { TelegramModule } from './telegram/telegram.module';
import { TrafficModule } from './traffic/traffic.module';
import { HwidModule } from './hwid/hwid.module';
import { ConfigProfilesModule } from './config-profiles/config-profiles.module';
import { MetricsModule } from './metrics/metrics.module';
import { MigrationModule } from './migration/migration.module';

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
    NodesModule,
    WebhooksModule,
    BillingModule,
    PluginsModule,
    SessionsExplorerModule,
    TelegramModule,
    TrafficModule,
    HwidModule,
    ConfigProfilesModule,
    MetricsModule,
    MigrationModule,
  ],
})
export class AppModule {}
