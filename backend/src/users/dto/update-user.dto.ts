import {
  IsOptional,
  IsEmail,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

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
