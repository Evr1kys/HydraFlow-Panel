import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
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
import { MetadataService } from './metadata.service';
import { SetMetadataDto } from './dto/set-metadata.dto';

@ApiTags('Metadata')
@ApiBearerAuth('default')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('users/:id/metadata')
  @ApiOperation({ summary: 'Get all metadata for a user' })
  @ApiResponse({ status: 200, description: 'Key-value map' })
  getUserMeta(@Param('id') id: string) {
    return this.metadataService.getUserMeta(id);
  }

  @Put('users/:id/metadata/:key')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Set a metadata key for a user' })
  @ApiResponse({ status: 200, description: 'Metadata written' })
  setUserMeta(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: SetMetadataDto,
  ) {
    return this.metadataService.setUserMeta(id, key, dto.value);
  }

  @Delete('users/:id/metadata/:key')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete a metadata key for a user' })
  @ApiResponse({ status: 200, description: 'Metadata deleted' })
  deleteUserMeta(@Param('id') id: string, @Param('key') key: string) {
    return this.metadataService.deleteUserMeta(id, key);
  }

  @Get('nodes/:id/metadata')
  @ApiOperation({ summary: 'Get all metadata for a node' })
  @ApiResponse({ status: 200, description: 'Key-value map' })
  getNodeMeta(@Param('id') id: string) {
    return this.metadataService.getNodeMeta(id);
  }

  @Put('nodes/:id/metadata/:key')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Set a metadata key for a node' })
  @ApiResponse({ status: 200, description: 'Metadata written' })
  setNodeMeta(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: SetMetadataDto,
  ) {
    return this.metadataService.setNodeMeta(id, key, dto.value);
  }

  @Delete('nodes/:id/metadata/:key')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete a metadata key for a node' })
  @ApiResponse({ status: 200, description: 'Metadata deleted' })
  deleteNodeMeta(@Param('id') id: string, @Param('key') key: string) {
    return this.metadataService.deleteNodeMeta(id, key);
  }
}
