import { IsString, IsInt, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNodeDto {
  @ApiProperty({ description: 'Node name', example: 'DE-Frankfurt-01' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Node IP or hostname', example: '1.2.3.4' })
  @IsString()
  address!: string;

  @ApiProperty({ description: 'Node API port', example: 3000 })
  @IsInt()
  port!: number;

  @ApiPropertyOptional({ description: 'Node API key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Enable node', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
