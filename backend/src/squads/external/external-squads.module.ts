import { Module } from '@nestjs/common';
import { ExternalSquadsService } from './external-squads.service';
import { ExternalSquadsController } from './external-squads.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ExternalSquadsController],
  providers: [ExternalSquadsService],
  exports: [ExternalSquadsService],
})
export class ExternalSquadsModule {}
