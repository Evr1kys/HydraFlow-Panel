import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpPass?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromEmail?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromName?: string;
}
