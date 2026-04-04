import { Module } from '@nestjs/common';
import { XrayService } from './xray.service';
import { XrayController } from './xray.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [XrayController],
  providers: [XrayService],
  exports: [XrayService],
})
export class XrayModule {}
