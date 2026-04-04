import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
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
  controllers: [OAuthController],
  providers: [OAuthService, SessionsService],
})
export class OAuthModule {}
