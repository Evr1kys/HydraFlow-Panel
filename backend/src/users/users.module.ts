import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { XrayModule } from '../xray/xray.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [AuthModule, XrayModule, NodesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
