import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../sessions.service';
import { RedisService } from '../../common/redis.service';

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class PasskeysService {
  private readonly rpName: string;
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.rpName = this.configService.get<string>('WEBAUTHN_RP_NAME', 'HydraFlow Panel');
    this.rpID = this.configService.get<string>('WEBAUTHN_RP_ID', 'localhost');
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    this.origin = this.configService.get<string>('WEBAUTHN_ORIGIN', baseUrl);
  }

  // --- Challenge store (Redis) ---

  private challengeKey(id: string): string {
    return `passkey:challenge:${id}`;
  }

  private async storeChallenge(id: string, challenge: string): Promise<void> {
    await this.redis.setex(this.challengeKey(id), CHALLENGE_TTL_SECONDS, challenge);
  }

  private async getChallenge(id: string): Promise<string | null> {
    return this.redis.get(this.challengeKey(id));
  }

  private async deleteChallenge(id: string): Promise<void> {
    await this.redis.del(this.challengeKey(id));
  }

  // --- Registration (authenticated admin adds a passkey) ---

  async generateRegisterOptions(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: { passkeys: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    const excludeCredentials = admin.passkeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports as AuthenticatorTransportFuture[],
    }));

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: admin.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge in Redis with 5 min TTL
    await this.storeChallenge(`reg:${adminId}`, options.challenge);

    return options;
  }

  async verifyRegister(adminId: string, response: RegistrationResponseJSON) {
    const storedChallenge = await this.getChallenge(`reg:${adminId}`);
    if (!storedChallenge) {
      throw new BadRequestException('Challenge expired or not found');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: storedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    await this.deleteChallenge(`reg:${adminId}`);

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed');
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.passkey.create({
      data: {
        adminId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports ?? []) as string[],
      },
    });

    return { verified: true };
  }

  // --- Authentication (unauthenticated login via passkey) ---

  async generateLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'preferred',
    });

    // Store challenge keyed by the challenge itself (for stateless lookup)
    await this.storeChallenge(`auth:${options.challenge}`, options.challenge);

    return options;
  }

  async verifyLogin(
    response: AuthenticationResponseJSON,
    userAgent: string,
    ip: string,
  ): Promise<{ token: string }> {
    // Find the passkey by credential ID
    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: response.id },
      include: { admin: true },
    });

    if (!passkey) {
      throw new UnauthorizedException('Passkey not found');
    }

    // Pull challenge from Redis using clientDataJSON's challenge value.
    // The browser returns it in response.response.clientDataJSON base64url-encoded.
    const clientDataJSON = Buffer.from(
      response.response.clientDataJSON,
      'base64url',
    ).toString('utf8');
    let challengeFromClient: string | null = null;
    try {
      const parsed = JSON.parse(clientDataJSON) as { challenge?: string };
      challengeFromClient = parsed.challenge ?? null;
    } catch {
      challengeFromClient = null;
    }

    if (!challengeFromClient) {
      throw new BadRequestException('Could not parse client challenge');
    }

    const stored = await this.getChallenge(`auth:${challengeFromClient}`);
    if (!stored) {
      throw new BadRequestException('No valid challenge found');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    await this.deleteChallenge(`auth:${challengeFromClient}`);

    if (!verification.verified) {
      throw new UnauthorizedException('Authentication verification failed');
    }

    // Update counter
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Issue JWT
    const payload = {
      sub: passkey.admin.id,
      email: passkey.admin.email,
      role: passkey.admin.role,
      enabled: passkey.admin.enabled,
    };
    const token = this.jwtService.sign(payload);
    this.sessionsService.create(passkey.admin.id, passkey.admin.email, token, userAgent, ip);

    await this.prisma.admin.update({
      where: { id: passkey.admin.id },
      data: { lastLoginAt: new Date() },
    });

    return { token };
  }

  // --- Management ---

  async listPasskeys(adminId: string) {
    return this.prisma.passkey.findMany({
      where: { adminId },
      select: { id: true, credentialId: true, transports: true, createdAt: true },
    });
  }

  async deletePasskey(adminId: string, passkeyId: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, adminId },
    });
    if (!passkey) throw new NotFoundException('Passkey not found');

    await this.prisma.passkey.delete({ where: { id: passkeyId } });
    return { message: 'Passkey deleted' };
  }
}
