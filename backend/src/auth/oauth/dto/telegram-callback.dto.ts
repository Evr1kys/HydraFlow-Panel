import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelegramCallbackDto {
  @ApiProperty({ description: 'Telegram user ID', example: 123456789 })
  @IsInt()
  id!: number;

  @ApiPropertyOptional({ description: 'Telegram user first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Telegram user last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Telegram username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Telegram profile photo URL' })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiProperty({ description: 'Authentication date (unix seconds)', example: 1700000000 })
  @IsInt()
  auth_date!: number;

  @ApiProperty({ description: 'HMAC-SHA256 hash from Telegram login widget' })
  @IsString()
  hash!: string;
}
