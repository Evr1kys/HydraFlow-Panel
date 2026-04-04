import { IsString, IsOptional, IsInt, IsBoolean, IsObject } from 'class-validator';

export class UpdateExternalSquadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  maxUsers?: number;

  @IsOptional()
  @IsObject()
  hostOverrides?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  subPageTitle?: string;

  @IsOptional()
  @IsString()
  subPageBrand?: string;
}
