import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
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

export const NODE_STATUS_VALUES = ['healthy', 'error', 'unknown'] as const;
export type NodeStatusFilter = (typeof NODE_STATUS_VALUES)[number];

export class NodesPaginatedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'filter by enabled flag' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: NODE_STATUS_VALUES,
    description: 'filter by node status',
  })
  @IsOptional()
  @IsEnum(NODE_STATUS_VALUES)
  status?: NodeStatusFilter;
}
