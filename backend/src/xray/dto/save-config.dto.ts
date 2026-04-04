import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveConfigDto {
  @ApiProperty({
    description: 'Xray JSON config to save and apply',
    example: '{"log":{"loglevel":"warning"},"inbounds":[],"outbounds":[{"protocol":"freedom","tag":"direct"}]}',
  })
  @IsString()
  config!: string;
}
