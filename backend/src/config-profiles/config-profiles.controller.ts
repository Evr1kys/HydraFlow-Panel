import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfigProfilesService } from './config-profiles.service';
import { CreateConfigProfileDto } from './dto/create-config-profile.dto';
import { UpdateConfigProfileDto } from './dto/update-config-profile.dto';

@Controller('api/config-profiles')
@UseGuards(JwtAuthGuard)
export class ConfigProfilesController {
  constructor(
    private readonly configProfilesService: ConfigProfilesService,
  ) {}

  @Get()
  findAll() {
    return this.configProfilesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.configProfilesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateConfigProfileDto) {
    return this.configProfilesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConfigProfileDto) {
    return this.configProfilesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.configProfilesService.remove(id);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.configProfilesService.setDefault(id);
  }
}
