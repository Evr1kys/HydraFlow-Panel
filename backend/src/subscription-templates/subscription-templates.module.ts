import { Module } from '@nestjs/common';
import { SubscriptionTemplatesService } from './subscription-templates.service';
import { SubscriptionTemplatesController } from './subscription-templates.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionTemplatesController],
  providers: [SubscriptionTemplatesService],
  exports: [SubscriptionTemplatesService],
})
export class SubscriptionTemplatesModule {}
