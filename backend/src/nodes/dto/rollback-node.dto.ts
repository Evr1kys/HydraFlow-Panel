import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class RollbackNodeDto {
  @ApiProperty({ description: 'Agent configuration revision identifier' })
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._-]+$/)
  revision!: string;

  @ApiPropertyOptional({ description: 'Operator-visible rollback reason' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
