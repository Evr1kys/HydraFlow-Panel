import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateBillingNodeDto {
  @IsString()
  nodeId!: string;

  @IsString()
  providerId!: string;

  @IsNumber()
  monthlyRate!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  renewalDate?: string;
}
