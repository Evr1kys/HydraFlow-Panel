import { IsString } from 'class-validator';

export class Verify2faDto {
  @IsString()
  code!: string;
}

export class Disable2faDto {
  @IsString()
  code!: string;
}
