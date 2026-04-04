import { IsEmail, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'User remark/note' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Traffic limit in bytes', example: 10737418240 })
  @IsOptional()
  @IsNumber()
  trafficLimit?: number;

  @ApiPropertyOptional({ description: 'Expiry date (ISO string)', example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}
