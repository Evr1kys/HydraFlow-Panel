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

// In-memory challenge store (keyed by adminId or sessionId)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

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
  ) {
    this.rpName = this.configService.get<string>('WEBAUTHN_RP_NAME', 'HydraFlow Panel');
    this.rpID = this.configService.get<string>('WEBAUTHN_RP_ID', 'localhost');
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    this.origin = this.configService.get<string>('WEBAUTHN_ORIGIN', baseUrl);
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

    // Store challenge
    challengeStore.set(`reg:${adminId}`, {
      challenge: options.challenge,
      expiresAt: Date.now() + 120_000,
    });

    return options;
  }

  async verifyRegister(adminId: string, response: RegistrationResponseJSON) {
    const stored = challengeStore.get(`reg:${adminId}`);
    if (!stored || stored.expiresAt < Date.now()) {
      challengeStore.delete(`reg:${adminId}`);
      throw new BadRequestException('Challenge expired or not found');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    challengeStore.delete(`reg:${adminId}`);

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
    challengeStore.set(`auth:${options.challenge}`, {
      challenge: options.challenge,
      expiresAt: Date.now() + 120_000,
    });

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

    // Find the challenge - iterate to find a valid one
    let foundChallengeKey: string | undefined;
    for (const [key, value] of challengeStore.entries()) {
      if (key.startsWith('auth:') && value.expiresAt > Date.now()) {
        foundChallengeKey = key;
        break;
      }
    }

    if (!foundChallengeKey) {
      throw new BadRequestException('No valid challenge found');
    }

    const stored = challengeStore.get(foundChallengeKey)!;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    challengeStore.delete(foundChallengeKey);

    if (!verification.verified) {
      throw new UnauthorizedException('Authentication verification failed');
    }

    // Update counter
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Issue JWT
    const payload = { sub: passkey.admin.id, email: passkey.admin.email };
    const token = this.jwtService.sign(payload);
    this.sessionsService.create(passkey.admin.id, passkey.admin.email, token, userAgent, ip);

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
