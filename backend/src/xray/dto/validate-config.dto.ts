import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateConfigDto {
  @ApiProperty({
    description: 'Xray JSON config as a string',
    example: '{"log":{"loglevel":"warning"},"inbounds":[],"outbounds":[{"protocol":"freedom","tag":"direct"}]}',
  })
  @IsString()
  config!: string;
}
