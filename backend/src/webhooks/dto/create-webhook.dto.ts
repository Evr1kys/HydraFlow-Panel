import { IsString, IsArray, IsOptional, IsBoolean, IsUrl, MinLength, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook URL (must be https://)', example: 'https://example.com/webhook' })
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] }, { message: 'url must be a valid URL starting with http:// or https://' })
  url!: string;

  @ApiProperty({ description: 'Event types to subscribe', type: [String], example: ['user.created', 'user.expired'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one event is required' })
  @IsString({ each: true })
  events!: string[];

  @ApiProperty({ description: 'Webhook signing secret (min 8 chars)' })
  @IsString()
  @MinLength(8, { message: 'Secret must be at least 8 characters' })
  secret!: string;

  @ApiPropertyOptional({ description: 'Enable webhook', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
