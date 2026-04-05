import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
