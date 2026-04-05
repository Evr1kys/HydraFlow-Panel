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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 201, description: 'JWT token returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto, @Request() req: AuthenticatedRequest) {
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.authService.login(dto, userAgent, ip);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('change-password')
  @ApiOperation({ summary: 'Change admin password' })
  @ApiResponse({ status: 201, description: 'Password changed' })
  changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('2fa/setup')
  @ApiOperation({ summary: 'Setup 2FA (generate TOTP secret)' })
  @ApiResponse({ status: 201, description: 'TOTP secret and QR URL' })
  setup2fa(@Request() req: AuthenticatedRequest) {
    return this.authService.setup2fa(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify and enable 2FA' })
  @ApiResponse({ status: 201, description: '2FA enabled' })
  verify2fa(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Verify2faDto,
  ) {
    return this.authService.verify2fa(req.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 201, description: '2FA disabled' })
  disable2fa(
    @Request() req: AuthenticatedRequest,
    @Body() dto: Disable2faDto,
  ) {
    return this.authService.disable2fa(req.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions' })
  @ApiResponse({ status: 200, description: 'Array of active sessions' })
  getSessions() {
    return this.sessionsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('default')
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a session by ID' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  revokeSession(@Param('id') id: string) {
    return this.sessionsService.revoke(id);
  }
}
