import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNodeDto {
  @ApiProperty({ description: 'Node name', example: 'DE-Frankfurt-01' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Node IP or hostname', example: '1.2.3.4' })
  @IsString()
  address!: string;

  @ApiProperty({ description: 'Node API port (1-65535)', example: 3000 })
  @IsInt()
  @Min(1)
  @Max(65535)
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
