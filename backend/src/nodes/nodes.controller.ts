import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NodesService } from './nodes.service';
import { CreateNodeDto } from './dto/create-node.dto';

@ApiTags('Nodes')
@ApiBearerAuth('default')
@Controller('api/nodes')
@UseGuards(JwtAuthGuard)
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'List all nodes' })
  @ApiResponse({ status: 200, description: 'Array of nodes' })
  findAll() {
    return this.nodesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new node' })
  @ApiResponse({ status: 201, description: 'Node created' })
  create(@Body() dto: CreateNodeDto) {
    return this.nodesService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete node by ID' })
  @ApiResponse({ status: 200, description: 'Node deleted' })
  remove(@Param('id') id: string) {
    return this.nodesService.remove(id);
  }

  @Post(':id/check')
  @ApiOperation({ summary: 'Check node health' })
  @ApiResponse({ status: 201, description: 'Node health status' })
  checkHealth(@Param('id') id: string) {
    return this.nodesService.checkHealth(id);
  }
}
