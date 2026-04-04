import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2faDto, Disable2faDto } from './dto/setup-2fa.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string; email: string };
  headers: Record<string, string | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: AuthenticatedRequest) {
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.authService.login(dto, userAgent, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2fa(@Request() req: AuthenticatedRequest) {
    return this.authService.setup2fa(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  verify2fa(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Verify2faDto,
  ) {
    return this.authService.verify2fa(req.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2fa(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Disable2faDto,
  ) {
    return this.authService.disable2fa(req.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions() {
    return this.sessionsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string) {
    return this.sessionsService.revoke(id);
  }
}
