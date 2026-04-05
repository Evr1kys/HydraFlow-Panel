import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PreviewTemplateDto {
  @ApiProperty({ description: 'User ID to source placeholder values from' })
  @IsString()
  userId!: string;
}
