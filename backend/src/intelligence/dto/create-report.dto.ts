import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ description: 'Country code', example: 'RU' })
  @IsString()
  country!: string;

  @ApiProperty({ description: 'ISP name', example: 'Rostelecom' })
  @IsString()
  isp!: string;

  @ApiPropertyOptional({ description: 'Autonomous System Number' })
  @IsOptional()
  @IsInt()
  asn?: number;

  @ApiProperty({ description: 'Protocol name', example: 'reality' })
  @IsString()
  protocol!: string;

  @ApiProperty({ description: 'Status', example: 'blocked' })
  @IsString()
  status!: string;
}
