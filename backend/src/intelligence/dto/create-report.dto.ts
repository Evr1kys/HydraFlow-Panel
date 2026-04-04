import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateReportDto {
  @IsString()
  country!: string;

  @IsString()
  isp!: string;

  @IsOptional()
  @IsInt()
  asn?: number;

  @IsString()
  protocol!: string;

  @IsString()
  status!: string;
}
