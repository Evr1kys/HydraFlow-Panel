import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHostDto {
  @ApiProperty({ description: 'Display name', example: 'Main Reality' })
  @IsString()
  remark!: string;

  @ApiProperty({ description: 'Protocol', example: 'vless' })
  @IsString()
  protocol!: string;

  @ApiProperty({ description: 'Port', example: 443 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiPropertyOptional({ description: 'Server name indication' })
  @IsOptional()
  @IsString()
  sni?: string;

  @ApiPropertyOptional({ description: 'WS/HTTP path' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: 'HTTP host header' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({
    description: 'Security: reality | tls | none',
    default: 'reality',
  })
  @IsOptional()
  @IsString()
  security?: string;

  @ApiPropertyOptional({ description: 'Flow (e.g. xtls-rprx-vision)' })
  @IsOptional()
  @IsString()
  flow?: string;

  @ApiPropertyOptional({ description: 'TLS fingerprint', default: 'chrome' })
  @IsOptional()
  @IsString()
  fingerprint?: string;

  @ApiPropertyOptional({ description: 'Reality public key' })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiPropertyOptional({ description: 'Reality short ID' })
  @IsOptional()
  @IsString()
  shortId?: string;

  @ApiPropertyOptional({ description: 'ALPN list', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alpn?: string[];

  @ApiPropertyOptional({
    description: 'Network: tcp | ws | grpc | xhttp',
    default: 'tcp',
  })
  @IsOptional()
  @IsString()
  network?: string;

  @ApiPropertyOptional({ description: 'gRPC service name' })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({ description: 'HTTP header obfuscation type' })
  @IsOptional()
  @IsString()
  headerType?: string;

  @ApiPropertyOptional({ description: 'Enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
