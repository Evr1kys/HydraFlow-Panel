import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsString()
  secret!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
