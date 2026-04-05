import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBotPlanDto {
  @ApiProperty({ example: '1 month' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  daysDuration!: number;

  @ApiProperty({ example: 100, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  trafficGb?: number | null;

  @ApiProperty({ example: 299.0 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 'RUB', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
