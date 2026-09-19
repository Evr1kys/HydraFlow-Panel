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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NodesService } from './nodes.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { NodesPaginatedQueryDto } from './dto/nodes-paginated-query.dto';
import { RollbackNodeDto } from './dto/rollback-node.dto';

@ApiTags('Nodes')
@ApiBearerAuth('default')
@Controller('api/nodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'List all nodes without credentials' })
  @ApiResponse({ status: 200, description: 'Sanitized array of nodes' })
  findAll() {
    return this.nodesService.findAll();
  }

  @Get('paginated')
  @ApiOperation({ summary: 'List nodes with pagination, sorting, filtering' })
  @ApiResponse({ status: 200, description: 'Paginated sanitized nodes' })
  findPaginated(@Query() query: NodesPaginatedQueryDto) {
    return this.nodesService.findPaginated(query);
  }

  @Post()
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Register and verify a HydraFlow Agent node' })
  @ApiResponse({ status: 201, description: 'Verified node created' })
  create(@Body() dto: CreateNodeDto) {
    return this.nodesService.create(dto);
  }

  @Post('check-all')
  @Roles('superadmin', 'admin', 'operator')
  @ApiOperation({ summary: 'Check health of all registered Agents' })
  checkAllHealth() {
    return this.nodesService.checkAllHealth();
  }

  @Get(':id/deployments')
  @ApiOperation({ summary: 'List recent configuration deployments' })
  listDeployments(@Param('id') id: string) {
    return this.nodesService.listDeployments(id);
  }

  @Post(':id/check')
  @Roles('superadmin', 'admin', 'operator')
  @ApiOperation({ summary: 'Check Agent and Xray health' })
  checkHealth(@Param('id') id: string) {
    return this.nodesService.checkHealth(id);
  }

  @Post(':id/restart')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Restart Xray through the Agent API' })
  restart(@Param('id') id: string) {
    return this.nodesService.restart(id);
  }

  @Post(':id/rollback')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Roll back Xray to a stored Agent revision' })
  rollback(@Param('id') id: string, @Body() dto: RollbackNodeDto) {
    return this.nodesService.rollback(id, dto);
  }

  @Post(':id/rotate-key')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Rotate the Agent HMAC credential safely' })
  rotateKey(@Param('id') id: string) {
    return this.nodesService.rotateKey(id);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete node by ID' })
  @ApiResponse({ status: 200, description: 'Node deleted' })
  remove(@Param('id') id: string) {
    return this.nodesService.remove(id);
  }
}
