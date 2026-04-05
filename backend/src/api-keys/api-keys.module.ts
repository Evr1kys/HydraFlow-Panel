import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysGuard } from './api-keys.guard';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeysGuard],
  exports: [ApiKeysService, ApiKeysGuard],
})
export class ApiKeysModule {}
