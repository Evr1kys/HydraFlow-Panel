import { Module } from '@nestjs/common';
import { XrayService } from './xray.service';
import { XrayController } from './xray.controller';
import { AuthModule } from '../auth/auth.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [AuthModule, NodesModule],
  controllers: [XrayController],
  providers: [XrayService],
  exports: [XrayService],
})
export class XrayModule {}
