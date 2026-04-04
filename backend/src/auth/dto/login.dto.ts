import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@hydraflow.dev', description: 'Admin email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password', description: 'Admin password', minLength: 4 })
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiPropertyOptional({ description: 'TOTP code for 2FA' })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
