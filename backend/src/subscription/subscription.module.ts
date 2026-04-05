import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { HwidModule } from '../hwid/hwid.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [HwidModule, MetricsModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}
