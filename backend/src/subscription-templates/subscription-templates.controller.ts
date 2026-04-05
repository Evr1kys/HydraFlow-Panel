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
import { SubscriptionTemplatesService } from './subscription-templates.service';
import { CreateSubscriptionTemplateDto } from './dto/create-subscription-template.dto';
import { UpdateSubscriptionTemplateDto } from './dto/update-subscription-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';

@ApiTags('Subscription Templates')
@ApiBearerAuth('default')
@Controller('api/subscription-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionTemplatesController {
  constructor(
    private readonly subscriptionTemplatesService: SubscriptionTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List subscription templates' })
  @ApiQuery({ name: 'clientType', required: false })
  @ApiResponse({ status: 200, description: 'Array of templates' })
  findAll(@Query('clientType') clientType?: string) {
    return this.subscriptionTemplatesService.findAll(clientType);
  }

  @Post()
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Create a subscription template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  create(@Body() dto: CreateSubscriptionTemplateDto) {
    return this.subscriptionTemplatesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template' })
  @ApiResponse({ status: 200, description: 'Template details' })
  findOne(@Param('id') id: string) {
    return this.subscriptionTemplatesService.findOne(id);
  }

  @Patch(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Update a template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionTemplateDto,
  ) {
    return this.subscriptionTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  remove(@Param('id') id: string) {
    return this.subscriptionTemplatesService.remove(id);
  }

  @Post(':id/default')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Make template default for its clientType' })
  @ApiResponse({ status: 201, description: 'Template set as default' })
  setDefault(@Param('id') id: string) {
    return this.subscriptionTemplatesService.setDefault(id);
  }

  @Post(':id/preview')
  @Roles('superadmin', 'admin')
  @ApiOperation({ summary: 'Render template for preview with real user data' })
  @ApiResponse({ status: 201, description: 'Rendered template content' })
  async preview(
    @Param('id') id: string,
    @Body() dto: PreviewTemplateDto,
  ): Promise<{ content: string }> {
    const content = await this.subscriptionTemplatesService.preview(
      id,
      dto.userId,
    );
    return { content };
  }
}
