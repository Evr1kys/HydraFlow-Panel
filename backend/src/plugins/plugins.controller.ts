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
import { PluginsService } from './plugins.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get('plugins')
  findAll() {
    return this.pluginsService.findAll();
  }

  @Get('nodes/:nodeId/plugins')
  findByNode(@Param('nodeId') nodeId: string) {
    return this.pluginsService.findByNode(nodeId);
  }

  @Post('nodes/:nodeId/plugins')
  create(@Param('nodeId') nodeId: string, @Body() dto: CreatePluginDto) {
    dto.nodeId = nodeId;
    return this.pluginsService.create(dto);
  }

  @Put('plugins/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePluginDto) {
    return this.pluginsService.update(id, dto);
  }

  @Delete('plugins/:id')
  remove(@Param('id') id: string) {
    return this.pluginsService.remove(id);
  }

  @Post('nodes/:nodeId/plugins/:pluginId/execute')
  executeOnNode(
    @Param('nodeId') nodeId: string,
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginsService.execute(nodeId, pluginId);
  }

  @Post('plugins/:id/execute')
  execute(@Param('id') id: string) {
    return this.pluginsService.executeById(id);
  }

  @Post('plugins/:id/restart')
  restart(@Param('id') id: string) {
    return this.pluginsService.restartById(id);
  }

  @Get('plugins/:id/status')
  status(@Param('id') id: string) {
    return this.pluginsService.statusById(id);
  }
}
