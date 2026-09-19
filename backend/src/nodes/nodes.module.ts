import { Module } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { NodesController } from './nodes.controller';
import { AuthModule } from '../auth/auth.module';
import { AgentClient } from './agent-client';

@Module({
  imports: [AuthModule],
  controllers: [NodesController],
  providers: [NodesService, AgentClient],
  exports: [NodesService, AgentClient],
})
export class NodesModule {}
