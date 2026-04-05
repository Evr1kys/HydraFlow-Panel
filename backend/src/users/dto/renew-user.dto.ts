import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenewUserDto {
  @ApiProperty({ description: 'Number of days to extend expiry', example: 30 })
  @IsInt()
  @IsPositive()
  days!: number;
}
