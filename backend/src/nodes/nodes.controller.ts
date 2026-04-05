import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NodesService } from './nodes.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { NodesPaginatedQueryDto } from './dto/nodes-paginated-query.dto';

@ApiTags('Nodes')
@ApiBearerAuth('default')
@Controller('api/nodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'List all nodes' })
  @ApiResponse({ status: 200, description: 'Array of nodes' })
  findAll() {
    return this.nodesService.findAll();
  }

  @Get('paginated')
  @ApiOperation({ summary: 'List nodes with pagination, sorting, filtering' })
  @ApiResponse({ status: 200, description: 'Paginated nodes result' })
  findPaginated(@Query() query: NodesPaginatedQueryDto) {
    return this.nodesService.findPaginated(query);
  }

  @Post()
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Create a new node' })
  @ApiResponse({ status: 201, description: 'Node created' })
  create(@Body() dto: CreateNodeDto) {
    return this.nodesService.create(dto);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin')
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

  @Post('check-all')
  @ApiOperation({ summary: 'Check health of all nodes' })
  @ApiResponse({ status: 201, description: 'Array of node health results' })
  checkAllHealth() {
    return this.nodesService.checkAllHealth();
  }
}
