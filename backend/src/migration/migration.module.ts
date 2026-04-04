import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    }),
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}
