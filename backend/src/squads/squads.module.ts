import { Module } from '@nestjs/common';
import { InternalSquadsModule } from './internal/internal-squads.module';
import { ExternalSquadsModule } from './external/external-squads.module';

@Module({
  imports: [InternalSquadsModule, ExternalSquadsModule],
})
export class SquadsModule {}
