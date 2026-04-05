import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  protocol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  security?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flow?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fingerprint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alpn?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  network?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
