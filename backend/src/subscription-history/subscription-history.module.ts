import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionHistoryService } from './subscription-history.service';
import { SubscriptionHistoryController } from './subscription-history.controller';

@Global()
@Module({
  imports: [AuthModule],
  providers: [SubscriptionHistoryService],
  controllers: [SubscriptionHistoryController],
  exports: [SubscriptionHistoryService],
})
export class SubscriptionHistoryModule {}
