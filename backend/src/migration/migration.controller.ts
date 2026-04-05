import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MigrationService } from './migration.service';

@ApiTags('Migration')
@ApiBearerAuth()
@Controller('api/migrate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('3xui')
  @ApiOperation({ summary: 'Import users from 3x-ui database' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '3x-ui SQLite database or JSON export' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Migration progress with imported/skipped counts' })
  @UseInterceptors(FileInterceptor('file'))
  async importFrom3xui(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.migrationService.importFrom3xui(file.buffer);
  }

  @Post('marzban')
  @ApiOperation({ summary: 'Import users from Marzban database' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Marzban SQLite database or JSON export' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Migration progress with imported/skipped counts' })
  @UseInterceptors(FileInterceptor('file'))
  async importFromMarzban(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.migrationService.importFromMarzban(file.buffer);
  }
}
