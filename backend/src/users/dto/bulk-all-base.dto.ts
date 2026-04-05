import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BulkAllFiltersDto } from './bulk-all-filters.dto';

export class BulkAllBaseDto {
  @ApiPropertyOptional({ description: 'Optional filters', type: BulkAllFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkAllFiltersDto)
  filters?: BulkAllFiltersDto;
}
