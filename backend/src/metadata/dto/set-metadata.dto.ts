import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetMetadataDto {
  @ApiProperty({ description: 'Metadata value (string)', example: 'some value' })
  @IsString()
  value!: string;
}
