import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveUserDto {
  @ApiProperty({
    description:
      'Identifier to search by (email, uuid, subToken, shortUuid, id, telegramId, or tag)',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}
