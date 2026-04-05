import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
