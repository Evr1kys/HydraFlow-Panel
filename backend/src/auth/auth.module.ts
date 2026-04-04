import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SessionsService } from './sessions.service';
import { OAuthModule } from './oauth/oauth.module';
import { PasskeysModule } from './passkeys/passkeys.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_this_secret'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    OAuthModule,
    PasskeysModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessionsService],
  exports: [JwtModule, PassportModule, SessionsService],
})
export class AuthModule {}
