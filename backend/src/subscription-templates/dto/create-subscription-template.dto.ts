import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Default Clash' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Client type: clash | mihomo | stash | singbox | xray-json | v2ray',
    example: 'clash',
  })
  @IsString()
  clientType!: string;

  @ApiProperty({ description: 'Template content with placeholders' })
  @IsString()
  template!: string;

  @ApiPropertyOptional({ description: 'Whether this template is the default for its client type' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
