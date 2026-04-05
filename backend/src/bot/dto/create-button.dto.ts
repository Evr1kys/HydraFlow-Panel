import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateButtonDto {
  @ApiProperty({ example: 'main_menu' })
  @IsString()
  menuType!: string;

  @ApiProperty({ example: 'buy_sub' })
  @IsString()
  buttonId!: string;

  @ApiProperty({ example: 'Buy subscription' })
  @IsString()
  text!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  callbackData?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  url?: string | null;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  rowPosition?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  columnPosition?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  buttonWidth?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
