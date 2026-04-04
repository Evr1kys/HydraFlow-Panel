import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ExternalSquadsService } from './external-squads.service';
import { CreateExternalSquadDto } from './dto/create-external-squad.dto';
import { UpdateExternalSquadDto } from './dto/update-external-squad.dto';
import { ExternalCreateUserDto } from './dto/external-create-user.dto';

@Controller('api/squads/external')
export class ExternalSquadsController {
  constructor(private readonly service: ExternalSquadsService) {}

  // --- Admin endpoints (JWT protected) ---

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateExternalSquadDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateExternalSquadDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/regenerate-key')
  @UseGuards(JwtAuthGuard)
  regenerateApiKey(@Param('id') id: string) {
    return this.service.regenerateApiKey(id);
  }

  // --- External API endpoints (API key via header) ---

  @Get('partner/users')
  externalListUsers(@Headers('x-api-key') apiKey: string) {
    return this.service.externalListUsers(apiKey);
  }

  @Post('partner/users')
  externalCreateUser(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: ExternalCreateUserDto,
  ) {
    return this.service.externalCreateUser(apiKey, dto);
  }

  @Delete('partner/users/:userId')
  externalDeleteUser(
    @Headers('x-api-key') apiKey: string,
    @Param('userId') userId: string,
  ) {
    return this.service.externalDeleteUser(apiKey, userId);
  }
}
