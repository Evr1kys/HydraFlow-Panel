import { IsArray, IsString } from 'class-validator';

export class AssignUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}
