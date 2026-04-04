import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateConfigProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  config?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
