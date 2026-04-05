import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HostsService } from './hosts.service';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';
import { BulkHostDto } from './dto/bulk-host.dto';

@ApiTags('Hosts')
@ApiBearerAuth('default')
@Controller('api/hosts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HostsController {
  constructor(private readonly hostsService: HostsService) {}

  @Get()
  @ApiOperation({ summary: 'List all hosts' })
  @ApiQuery({ name: 'protocol', required: false })
  @ApiQuery({ name: 'enabled', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Array of hosts' })
  findAll(
    @Query('protocol') protocol?: string,
    @Query('enabled') enabled?: string,
    @Query('search') search?: string,
  ) {
    return this.hostsService.findAll({
      protocol,
      enabled:
        enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      search,
    });
  }

  @Post()
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Create a host' })
  @ApiResponse({ status: 201, description: 'Host created' })
  create(@Body() dto: CreateHostDto) {
    return this.hostsService.create(dto);
  }

  @Post('bulk/enable')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk enable hosts' })
  @ApiResponse({ status: 201, description: 'Hosts enabled' })
  bulkEnable(@Body() dto: BulkHostDto) {
    return this.hostsService.bulkEnable(dto);
  }

  @Post('bulk/disable')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk disable hosts' })
  @ApiResponse({ status: 201, description: 'Hosts disabled' })
  bulkDisable(@Body() dto: BulkHostDto) {
    return this.hostsService.bulkDisable(dto);
  }

  @Post('bulk/delete')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Bulk delete hosts' })
  @ApiResponse({ status: 201, description: 'Hosts deleted' })
  bulkDelete(@Body() dto: BulkHostDto) {
    return this.hostsService.bulkDelete(dto);
  }

  @Get('by-node/:nodeId')
  @ApiOperation({ summary: 'List hosts linked to a node' })
  @ApiResponse({ status: 200, description: 'Array of hosts' })
  findByNode(@Param('nodeId') nodeId: string) {
    return this.hostsService.findByNode(nodeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single host' })
  @ApiResponse({ status: 200, description: 'Host details' })
  findOne(@Param('id') id: string) {
    return this.hostsService.findOne(id);
  }

  @Patch(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Update a host' })
  @ApiResponse({ status: 200, description: 'Host updated' })
  update(@Param('id') id: string, @Body() dto: UpdateHostDto) {
    return this.hostsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete a host' })
  @ApiResponse({ status: 200, description: 'Host deleted' })
  remove(@Param('id') id: string) {
    return this.hostsService.remove(id);
  }

  @Post(':id/link/:nodeId')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Link a host to a node' })
  @ApiResponse({ status: 201, description: 'Host linked' })
  linkToNode(@Param('id') id: string, @Param('nodeId') nodeId: string) {
    return this.hostsService.linkToNode(id, nodeId);
  }

  @Delete(':id/link/:nodeId')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Unlink a host from a node' })
  @ApiResponse({ status: 200, description: 'Host unlinked' })
  unlinkFromNode(@Param('id') id: string, @Param('nodeId') nodeId: string) {
    return this.hostsService.unlinkFromNode(id, nodeId);
  }
}
