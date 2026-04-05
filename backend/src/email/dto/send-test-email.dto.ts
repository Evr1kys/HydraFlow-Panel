import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTestEmailDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  to!: string;
}
