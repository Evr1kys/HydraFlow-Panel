import { Module } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PluginsController } from './plugins.controller';
import { AuthModule } from '../auth/auth.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [AuthModule, NodesModule],
  controllers: [PluginsController],
  providers: [PluginsService],
  exports: [PluginsService],
})
export class PluginsModule {}
