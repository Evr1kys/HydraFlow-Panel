import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkHostDto {
  @ApiProperty({ description: 'Array of host IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
