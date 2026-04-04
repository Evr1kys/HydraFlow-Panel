import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateConfigProfileDto {
  @IsString()
  name!: string;

  @IsString()
  config!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
