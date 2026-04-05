import {
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulkAllFiltersDto } from './bulk-all-filters.dto';

export class BulkAllExtendExpirationDto {
  @ApiProperty({ description: 'Number of days to add', example: 30 })
  @IsInt()
  @IsPositive()
  days!: number;

  @ApiPropertyOptional({ description: 'Optional filters', type: BulkAllFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkAllFiltersDto)
  filters?: BulkAllFiltersDto;
}
