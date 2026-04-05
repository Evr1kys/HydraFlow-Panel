import { Global, Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhookQueueService } from './webhook-queue.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookQueueService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
