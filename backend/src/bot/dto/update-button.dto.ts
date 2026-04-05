import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateButtonDto } from './create-button.dto';

export class UpdateButtonDto extends PartialType(
  OmitType(CreateButtonDto, ['menuType', 'buttonId'] as const),
) {}
