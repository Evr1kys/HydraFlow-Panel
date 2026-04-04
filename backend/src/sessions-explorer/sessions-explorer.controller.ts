import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionsExplorerService } from './sessions-explorer.service';

@Controller('api/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsExplorerController {
  constructor(
    private readonly sessionsExplorerService: SessionsExplorerService,
  ) {}

  @Get('active')
  getActiveSessions() {
    return this.sessionsExplorerService.getActiveSessions();
  }

  @Get('count')
  getSessionCount() {
    return this.sessionsExplorerService.getSessionCount();
  }

  @Post('drop/:userId')
  dropUserSessions(@Param('userId') userId: string) {
    return this.sessionsExplorerService.dropUserSessions(userId);
  }

  @Delete(':id')
  dropSession(@Param('id') id: string) {
    return this.sessionsExplorerService.dropSession(id);
  }
}
