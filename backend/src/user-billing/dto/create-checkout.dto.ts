import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  userId!: string;

  @IsString()
  plan!: string; // monthly | yearly | custom

  @IsNumber()
  @Min(0)
  priceAmount!: number;

  @IsOptional()
  @IsString()
  priceCurrency?: string;

  @IsIn(['yookassa', 'stripe', 'crypto'])
  provider!: 'yookassa' | 'stripe' | 'crypto';

  @IsInt()
  @Min(1)
  daysDuration!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trafficGb?: number;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
