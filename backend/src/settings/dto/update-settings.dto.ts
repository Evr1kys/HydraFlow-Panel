import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() serverIp?: string;
  @IsOptional() @IsInt() realityPort?: number;
  @IsOptional() @IsString() realitySni?: string;
  @IsOptional() @IsString() realityPublicKey?: string;
  @IsOptional() @IsString() realityPrivateKey?: string;
  @IsOptional() @IsString() realityShortId?: string;
  @IsOptional() @IsInt() wsPort?: number;
  @IsOptional() @IsString() wsPath?: string;
  @IsOptional() @IsInt() ssPort?: number;
  @IsOptional() @IsString() ssPassword?: string;
}
