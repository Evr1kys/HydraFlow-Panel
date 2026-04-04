import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  trafficLimit?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
