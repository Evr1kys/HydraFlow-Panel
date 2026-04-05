import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAllFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by enabled status' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by internal squad ID' })
  @IsOptional()
  @IsString()
  internalSquadId?: string;

  @ApiPropertyOptional({ description: 'Filter by external squad ID' })
  @IsOptional()
  @IsString()
  externalSquadId?: string;
}
