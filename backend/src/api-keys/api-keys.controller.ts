import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthenticatedRequest {
  user: { id: string; email: string; role?: string };
}

@ApiTags('ApiKeys')
@ApiBearerAuth('default')
@Controller('api/api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key (plaintext shown ONCE)' })
  @ApiResponse({ status: 201, description: 'API key created' })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my API keys (prefix only)' })
  @ApiResponse({ status: 200, description: 'Array of API keys' })
  list(@Request() req: AuthenticatedRequest) {
    return this.apiKeysService.list(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  revoke(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.apiKeysService.revoke(req.user.id, id);
  }
}
