import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateInternalSquadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nodeIds?: string[];
}
