import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateInternalSquadDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nodeIds?: string[];
}
