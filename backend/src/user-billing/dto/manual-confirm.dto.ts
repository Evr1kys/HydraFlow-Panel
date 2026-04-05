import { IsString } from 'class-validator';

export class ManualConfirmDto {
  @IsString()
  subscriptionId!: string;
}
