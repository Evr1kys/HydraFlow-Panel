import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { InternalSquadsService } from './internal-squads.service';
import { CreateInternalSquadDto } from './dto/create-internal-squad.dto';
import { UpdateInternalSquadDto } from './dto/update-internal-squad.dto';
import { AssignUsersDto } from './dto/assign-users.dto';

@Controller('api/squads/internal')
@UseGuards(JwtAuthGuard)
export class InternalSquadsController {
  constructor(private readonly service: InternalSquadsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInternalSquadDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInternalSquadDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/users')
  assignUsers(@Param('id') id: string, @Body() dto: AssignUsersDto) {
    return this.service.assignUsers(id, dto.userIds);
  }

  @Delete(':id/users')
  removeUsers(@Param('id') id: string, @Body() dto: AssignUsersDto) {
    return this.service.removeUsers(id, dto.userIds);
  }
}
