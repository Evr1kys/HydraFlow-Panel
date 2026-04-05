import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const API_KEY_SCOPES = [
  'users:read',
  'users:write',
  'nodes:read',
  'nodes:write',
  'stats:read',
  'admin:all',
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI automation' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(API_KEY_SCOPES as unknown as string[], { each: true })
  scopes!: ApiKeyScope[];

  @ApiPropertyOptional({ description: 'ISO expiry date' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
