import { IsString, IsInt, IsOptional, IsBoolean } from 'class-validator';

export class CreateNodeDto {
  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsInt()
  port!: number;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
