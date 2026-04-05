import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePromoDto {
  @ApiProperty({ example: 'NEW10' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 10, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number | null;

  @ApiProperty({ example: 50.0, required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;

  @ApiProperty({ example: 100, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @ApiProperty({ example: '2026-01-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
