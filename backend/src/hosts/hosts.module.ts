import { Module } from '@nestjs/common';
import { HostsService } from './hosts.service';
import { HostsController } from './hosts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HostsController],
  providers: [HostsService],
  exports: [HostsService],
})
export class HostsModule {}
