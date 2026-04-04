import { Module } from '@nestjs/common';
import { XrayController } from './xray.controller';
import { XrayService } from './xray.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [XrayController],
  providers: [XrayService],
  exports: [XrayService],
})
export class XrayModule {}
