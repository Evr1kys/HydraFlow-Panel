import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.usersService.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.usersService.remove(id); }

  @Post(':id/toggle')
  toggle(@Param('id') id: string) { return this.usersService.toggle(id); }

  @Get(':id/subscription')
  getSubscription(@Param('id') id: string) { return this.usersService.getSubscription(id); }
}
