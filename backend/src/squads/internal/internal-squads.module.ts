import { Module } from '@nestjs/common';
import { InternalSquadsService } from './internal-squads.service';
import { InternalSquadsController } from './internal-squads.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InternalSquadsController],
  providers: [InternalSquadsService],
  exports: [InternalSquadsService],
})
export class InternalSquadsModule {}
