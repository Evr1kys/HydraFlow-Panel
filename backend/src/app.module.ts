import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
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
import { SquadsModule } from './squads/squads.module';
import { RedisModule } from './common/redis.module';
import { UserBillingModule } from './user-billing/user-billing.module';
import { ThrottlerConfig } from './common/throttler.config';
import { ThrottlerBehindAuthGuard } from './common/throttler-behind-auth.guard';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditLogInterceptor } from './audit-log/audit-log.interceptor';
import { AdminsModule } from './admins/admins.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { EmailModule } from './email/email.module';
import { BackupModule } from './backup/backup.module';
import { BotModule } from './bot/bot.module';
import { MetadataModule } from './metadata/metadata.module';
import { SubscriptionHistoryModule } from './subscription-history/subscription-history.module';
import { HostsModule } from './hosts/hosts.module';
import { SubscriptionTemplatesModule } from './subscription-templates/subscription-templates.module';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerConfig,
    RedisModule,
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
    SquadsModule,
    UserBillingModule,
    AuditLogModule,
    AdminsModule,
    ApiKeysModule,
    EmailModule,
    BackupModule,
    BotModule,
    MetadataModule,
    SubscriptionHistoryModule,
    HostsModule,
    SubscriptionTemplatesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerBehindAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
