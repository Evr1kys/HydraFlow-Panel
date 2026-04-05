import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailService } from './email.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@ApiTags('Email')
@ApiBearerAuth('default')
@Controller('api/email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test email using current SMTP config' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async test(@Body() dto: SendTestEmailDto) {
    const ok = await this.emailService.sendTest(dto.to);
    return { success: ok };
  }
}
