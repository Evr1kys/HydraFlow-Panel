import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { XrayModule } from '../xray/xray.module';
import { NodesModule } from '../nodes/nodes.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, XrayModule, NodesModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
