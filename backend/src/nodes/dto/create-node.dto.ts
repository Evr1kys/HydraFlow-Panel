import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNodeDto {
  @ApiProperty({ description: 'Node name', example: 'DE-Frankfurt-01' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    description: 'Agent DNS name or IP address, without scheme or path',
    example: 'node-01.example.com',
  })
  @IsString()
  @Length(1, 253)
  address!: string;

  @ApiProperty({ description: 'HydraFlow Agent HTTPS port', example: 8443 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiProperty({
    description: 'Agent HMAC key identifier returned by hydraflow-agent init',
    example: 'agent-0123456789abcdef',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,64}$/)
  keyId!: string;

  @ApiProperty({
    description: 'Agent registration secret returned once during initialization',
    writeOnly: true,
  })
  @IsString()
  @Length(40, 256)
  apiKey!: string;

  @ApiPropertyOptional({
    description:
      'PEM CA certificate used to verify the Agent. Omit only when the certificate chains to the system trust store.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32_768)
  @Matches(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/)
  caCertificate?: string;

  @ApiPropertyOptional({
    description: 'Explicit TLS server name for certificate validation',
    example: 'node-01.example.com',
  })
  @IsOptional()
  @IsString()
  @Length(1, 253)
  serverName?: string;

  @ApiPropertyOptional({ description: 'Enable node', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
