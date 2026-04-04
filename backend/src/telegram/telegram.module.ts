import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { XrayModule } from '../xray/xray.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [ConfigModule, UsersModule, XrayModule, NodesModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
