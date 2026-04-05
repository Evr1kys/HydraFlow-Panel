import {
  IsEmail,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsEnum,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TRAFFIC_STRATEGIES = [
  'NO_RESET',
  'DAY',
  'WEEK',
  'MONTH',
  'MONTH_ROLLING',
] as const;
export type TrafficStrategy = (typeof TRAFFIC_STRATEGIES)[number];

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'User remark/note' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Traffic limit in bytes', example: 10737418240 })
  @IsOptional()
  @IsNumber()
  trafficLimit?: number;

  @ApiPropertyOptional({ description: 'Expiry date (ISO string)', example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Short URL-safe identifier (8 chars). Auto-generated if omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8}$/, {
    message: 'shortUuid must be exactly 8 URL-safe characters',
  })
  shortUuid?: string;

  @ApiPropertyOptional({ description: 'Free-form user tag for filtering' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Per-user override of maxDevices (when HWID_DEVICE_LIMIT_ENABLED=true)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  hwidDeviceLimit?: number;

  @ApiPropertyOptional({
    description: 'Traffic reset strategy',
    enum: TRAFFIC_STRATEGIES,
  })
  @IsOptional()
  @IsEnum(TRAFFIC_STRATEGIES)
  trafficStrategy?: TrafficStrategy;
}
