import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number = 0;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  size?: number = 25;

  @ApiPropertyOptional({ description: 'field name to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'search term' })
  @IsOptional()
  @IsString()
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  start: number;
  size: number;
}
