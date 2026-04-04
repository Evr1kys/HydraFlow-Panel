import { IsString, IsOptional } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  credentials?: string;
}
