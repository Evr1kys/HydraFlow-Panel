import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination.dto';

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

export class UsersPaginatedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'filter by enabled flag' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'filter by tag (exact match)' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'filter by expired flag (expiryDate < now)',
  })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  expired?: boolean;

  @ApiPropertyOptional({ description: 'filter by internal squad id' })
  @IsOptional()
  @IsString()
  internalSquadId?: string;

  @ApiPropertyOptional({ description: 'filter by external squad id' })
  @IsOptional()
  @IsString()
  externalSquadId?: string;
}
