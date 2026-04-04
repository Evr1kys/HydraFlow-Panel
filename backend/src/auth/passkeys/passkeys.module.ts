import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasskeysController } from './passkeys.controller';
import { PasskeysService } from './passkeys.service';
import { SessionsService } from '../sessions.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_this_secret'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [PasskeysController],
  providers: [PasskeysService, SessionsService],
})
export class PasskeysModule {}
