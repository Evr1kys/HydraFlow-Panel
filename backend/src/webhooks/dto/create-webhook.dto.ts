import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook URL', example: 'https://example.com/webhook' })
  @IsString()
  url!: string;

  @ApiProperty({ description: 'Event types to subscribe', type: [String], example: ['user.created', 'user.expired'] })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiProperty({ description: 'Webhook signing secret' })
  @IsString()
  secret!: string;

  @ApiPropertyOptional({ description: 'Enable webhook', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
