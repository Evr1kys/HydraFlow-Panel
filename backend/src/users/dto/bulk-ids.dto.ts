import { IsArray, IsString } from 'class-validator';

export class BulkIdsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
