import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { XrayModule } from '../xray/xray.module';
import { NodesModule } from '../nodes/nodes.module';
import { ExpiryCheckerService } from './expiry-checker.service';

@Module({
  imports: [ConfigModule, UsersModule, XrayModule, NodesModule],
  providers: [TelegramService, ExpiryCheckerService],
  exports: [TelegramService],
})
export class TelegramModule {}
