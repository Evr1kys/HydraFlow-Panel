import { Module } from '@nestjs/common';
import { SessionsExplorerService } from './sessions-explorer.service';
import { SessionsExplorerController } from './sessions-explorer.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SessionsExplorerController],
  providers: [SessionsExplorerService],
  exports: [SessionsExplorerService],
})
export class SessionsExplorerModule {}
