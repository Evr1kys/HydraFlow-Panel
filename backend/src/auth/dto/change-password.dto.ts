import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current admin password', minLength: 4 })
  @IsString()
  @MinLength(4)
  currentPassword!: string;

  @ApiProperty({ description: 'New admin password', minLength: 4 })
  @IsString()
  @MinLength(4)
  newPassword!: string;
}
