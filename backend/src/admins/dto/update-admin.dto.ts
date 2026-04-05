import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ADMIN_ROLES, AdminRole } from './create-admin.dto';

export class UpdateAdminDto {
  @ApiPropertyOptional({ enum: ADMIN_ROLES })
  @IsOptional()
  @IsIn(ADMIN_ROLES as unknown as string[])
  role?: AdminRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
