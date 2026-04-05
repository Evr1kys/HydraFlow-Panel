import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnlinkAccountDto {
  @ApiProperty({ description: 'OAuth account ID to unlink' })
  @IsString()
  accountId!: string;
}
