import { Module } from '@nestjs/common';
import { ConfigProfilesService } from './config-profiles.service';
import { ConfigProfilesController } from './config-profiles.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConfigProfilesController],
  providers: [ConfigProfilesService],
  exports: [ConfigProfilesService],
})
export class ConfigProfilesModule {}
