import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
