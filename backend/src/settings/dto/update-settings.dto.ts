import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Server public IP' })
  @IsOptional()
  @IsString()
  serverIp?: string;

  @ApiPropertyOptional({ description: 'Enable VLESS+Reality' })
  @IsOptional()
  @IsBoolean()
  realityEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Reality port', example: 443 })
  @IsOptional()
  @IsInt()
  realityPort?: number;

  @ApiPropertyOptional({ description: 'Reality SNI domain' })
  @IsOptional()
  @IsString()
  realitySni?: string;

  @ApiPropertyOptional({ description: 'Reality public key' })
  @IsOptional()
  @IsString()
  realityPbk?: string;

  @ApiPropertyOptional({ description: 'Reality private key' })
  @IsOptional()
  @IsString()
  realityPvk?: string;

  @ApiPropertyOptional({ description: 'Reality short ID' })
  @IsOptional()
  @IsString()
  realitySid?: string;

  @ApiPropertyOptional({ description: 'Enable VLESS+WebSocket' })
  @IsOptional()
  @IsBoolean()
  wsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'WebSocket port', example: 8080 })
  @IsOptional()
  @IsInt()
  wsPort?: number;

  @ApiPropertyOptional({ description: 'WebSocket path', example: '/ws' })
  @IsOptional()
  @IsString()
  wsPath?: string;

  @ApiPropertyOptional({ description: 'WebSocket host header' })
  @IsOptional()
  @IsString()
  wsHost?: string;

  @ApiPropertyOptional({ description: 'Enable Shadowsocks' })
  @IsOptional()
  @IsBoolean()
  ssEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Shadowsocks port', example: 1080 })
  @IsOptional()
  @IsInt()
  ssPort?: number;

  @ApiPropertyOptional({ description: 'Shadowsocks encryption method' })
  @IsOptional()
  @IsString()
  ssMethod?: string;

  @ApiPropertyOptional({ description: 'Shadowsocks password' })
  @IsOptional()
  @IsString()
  ssPassword?: string;

  @ApiPropertyOptional({ description: 'CDN domain' })
  @IsOptional()
  @IsString()
  cdnDomain?: string;

  @ApiPropertyOptional({ description: 'Enable split tunneling' })
  @IsOptional()
  @IsBoolean()
  splitTunneling?: boolean;

  @ApiPropertyOptional({ description: 'Enable ad blocking' })
  @IsOptional()
  @IsBoolean()
  adBlocking?: boolean;
}
