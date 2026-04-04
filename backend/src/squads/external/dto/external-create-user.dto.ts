import { IsEmail, IsOptional, IsString, IsNumber } from 'class-validator';

export class ExternalCreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsNumber()
  trafficLimit?: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
