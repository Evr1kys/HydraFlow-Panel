import { PartialType } from '@nestjs/swagger';
import { CreateBotPlanDto } from './create-bot-plan.dto';

export class UpdateBotPlanDto extends PartialType(CreateBotPlanDto) {}
