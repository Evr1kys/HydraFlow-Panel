import { IsString, IsOptional } from 'class-validator';

export class CheckHwidDto {
  @IsString()
  subToken!: string;

  @IsString()
  hwid!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
