import { IsArray, IsInt, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkExtendExpirationDto {
  @ApiProperty({ description: 'Array of user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({ description: 'Number of days to add', example: 30 })
  @IsInt()
  @IsPositive()
  days!: number;
}
