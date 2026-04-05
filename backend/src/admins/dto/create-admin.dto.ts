import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ADMIN_ROLES = ['superadmin', 'admin', 'operator', 'readonly'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: ADMIN_ROLES, default: 'admin' })
  @IsOptional()
  @IsIn(ADMIN_ROLES as unknown as string[])
  role?: AdminRole;
}
