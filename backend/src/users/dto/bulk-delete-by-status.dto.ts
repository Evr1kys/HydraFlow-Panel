import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type BulkDeleteStatus = 'expired' | 'disabled';

export class BulkDeleteByStatusDto {
  @ApiProperty({
    description: 'User status to delete by',
    enum: ['expired', 'disabled'],
  })
  @IsString()
  @IsIn(['expired', 'disabled'])
  status!: BulkDeleteStatus;
}
