import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkUpdateSquadsDto {
  @ApiProperty({ description: 'Array of user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional({ description: 'Internal squad ID (nullable)' })
  @IsOptional()
  @IsString()
  internalSquadId?: string | null;

  @ApiPropertyOptional({ description: 'External squad ID (nullable)' })
  @IsOptional()
  @IsString()
  externalSquadId?: string | null;
}
