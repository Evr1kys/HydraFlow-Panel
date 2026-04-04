import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdatePluginDto {
  @IsOptional()
  @IsString()
  config?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
