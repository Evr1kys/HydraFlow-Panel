import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  serverIp?: string;

  @IsOptional()
  @IsBoolean()
  realityEnabled?: boolean;

  @IsOptional()
  @IsInt()
  realityPort?: number;

  @IsOptional()
  @IsString()
  realitySni?: string;

  @IsOptional()
  @IsString()
  realityPbk?: string;

  @IsOptional()
  @IsString()
  realityPvk?: string;

  @IsOptional()
  @IsString()
  realitySid?: string;

  @IsOptional()
  @IsBoolean()
  wsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  wsPort?: number;

  @IsOptional()
  @IsString()
  wsPath?: string;

  @IsOptional()
  @IsString()
  wsHost?: string;

  @IsOptional()
  @IsBoolean()
  ssEnabled?: boolean;

  @IsOptional()
  @IsInt()
  ssPort?: number;

  @IsOptional()
  @IsString()
  ssMethod?: string;

  @IsOptional()
  @IsString()
  ssPassword?: string;

  @IsOptional()
  @IsString()
  cdnDomain?: string;

  @IsOptional()
  @IsBoolean()
  splitTunneling?: boolean;

  @IsOptional()
  @IsBoolean()
  adBlocking?: boolean;
}
