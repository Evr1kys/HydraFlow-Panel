import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreatePluginDto {
  @IsString()
  nodeId!: string;

  @IsString()
  @IsIn(['torrent_blocker', 'ingress_filter', 'egress_filter', 'connection_dropper'])
  type!: string;

  @IsOptional()
  @IsString()
  config?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
