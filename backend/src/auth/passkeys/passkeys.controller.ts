import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { PasskeysService } from './passkeys.service';
import { JwtAuthGuard } from '../jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string; email: string };
  headers: Record<string, string | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Controller('api/auth/passkeys')
export class PasskeysController {
  constructor(private readonly passkeysService: PasskeysService) {}

  // --- Registration (requires auth) ---

  @UseGuards(JwtAuthGuard)
  @Post('register-options')
  registerOptions(@Request() req: AuthenticatedRequest) {
    return this.passkeysService.generateRegisterOptions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register-verify')
  registerVerify(
    @Request() req: AuthenticatedRequest,
    @Body() body: RegistrationResponseJSON,
  ) {
    return this.passkeysService.verifyRegister(req.user.id, body);
  }

  // --- Authentication (no auth required) ---

  @Post('login-options')
  loginOptions() {
    return this.passkeysService.generateLoginOptions();
  }

  @Post('login-verify')
  loginVerify(
    @Body() body: AuthenticationResponseJSON,
    @Request() req: AuthenticatedRequest,
  ) {
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.passkeysService.verifyLogin(body, userAgent, ip);
  }

  // --- Management (requires auth) ---

  @UseGuards(JwtAuthGuard)
  @Get()
  listPasskeys(@Request() req: AuthenticatedRequest) {
    return this.passkeysService.listPasskeys(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deletePasskey(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.passkeysService.deletePasskey(req.user.id, id);
  }
}
