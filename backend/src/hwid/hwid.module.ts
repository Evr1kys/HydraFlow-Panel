import { Module } from '@nestjs/common';
import { HwidService } from './hwid.service';
import { HwidController } from './hwid.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HwidController],
  providers: [HwidService],
  exports: [HwidService],
})
export class HwidModule {}
