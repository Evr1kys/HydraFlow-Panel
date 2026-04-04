import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HwidService } from './hwid.service';
import { CheckHwidDto } from './dto/check-hwid.dto';

@Controller('api')
export class HwidController {
  constructor(private readonly hwidService: HwidService) {}

  @Post('hwid/check')
  checkHwid(@Body() dto: CheckHwidDto) {
    return this.hwidService.checkDeviceBySubToken(
      dto.subToken,
      dto.hwid,
      dto.platform,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id/devices')
  getUserDevices(@Param('id') id: string) {
    return this.hwidService.getUserDevices(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id/devices/:deviceId')
  removeDevice(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.hwidService.removeDevice(id, deviceId);
  }
}
