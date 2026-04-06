import {
  IsOptional,
  IsEmail,
  IsString,
  IsBoolean,
  IsNumber,
  IsInt,
  IsEnum,
  Matches,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TRAFFIC_STRATEGIES, TrafficStrategy } from './create-user.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Enable or disable user' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'User remark' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Traffic limit in bytes (0 or positive)' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Traffic limit cannot be negative' })
  trafficLimit?: number;

  @ApiPropertyOptional({ description: 'Expiry date (ISO string)' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Short URL-safe identifier (8 chars).',
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
