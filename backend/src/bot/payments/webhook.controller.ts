import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from './payment.service';
import { HeleketProvider } from './providers/heleket.provider';

const YOOKASSA_IP_RANGES = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
];

function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    return ip === cidr;
  }
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  // Only IPv4 cidr check (ipv6 best-effort: exact match only).
  if (ip.includes(':') || range.includes(':')) {
    return false;
  }
  const ipToInt = (addr: string): number =>
    addr.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  try {
    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  } catch {
    return false;
  }
}

function isYooKassaIp(ip: string): boolean {
  const cleaned = ip.replace(/^::ffff:/, '');
  return YOOKASSA_IP_RANGES.some((cidr) => ipInCidr(cleaned, cidr));
}

@ApiTags('Bot Payment Webhooks')
@Controller('api/bot/webhook')
export class BotWebhookController {
  private readonly logger = new Logger(BotWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentService,
    private readonly heleket: HeleketProvider,
  ) {}

  @Post('yookassa')
  @HttpCode(200)
  async yookassa(
    @Req() req: Request,
    @Body() body: { event?: string; object?: { metadata?: Record<string, string>; id?: string } },
  ): Promise<{ ok: boolean }> {
    const skipIpCheck = this.config.get<string>('BOT_WEBHOOK_SKIP_IP_CHECK') === 'true';
    if (!skipIpCheck) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const clientIp =
        (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0].trim()) ||
        req.socket.remoteAddress ||
        '';
      if (!isYooKassaIp(clientIp)) {
        this.logger.warn(`YooKassa webhook: untrusted IP ${clientIp}`);
        throw new ForbiddenException('Untrusted IP');
      }
    }

    if (body.event !== 'payment.succeeded') {
      return { ok: true };
    }
    const transactionId = body.object?.metadata?.transactionId;
    if (!transactionId) {
      this.logger.warn('YooKassa webhook: missing transactionId in metadata');
      return { ok: true };
    }
    try {
      await this.payments.completeTransaction(transactionId);
    } catch (err) {
      this.logger.error('YooKassa webhook: completion failed', err);
    }
    return { ok: true };
  }

  @Post('cryptobot')
  @HttpCode(200)
  async cryptobot(
    @Req() req: Request,
    @Headers('crypto-pay-api-signature') signature: string | undefined,
    @Body() body: { update_type?: string; payload?: { payload?: string; invoice_id?: number } },
  ): Promise<{ ok: boolean }> {
    const token = this.config.get<string>('CRYPTOBOT_TOKEN');
    if (token && signature) {
      // Verify HMAC-SHA256 where secret = sha256(token)
      const rawBody =
        (req as unknown as { rawBody?: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(body));
      const secret = crypto.createHash('sha256').update(token).digest();
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      try {
        const a = Buffer.from(expected, 'hex');
        const b = Buffer.from(signature, 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          this.logger.warn('CryptoBot webhook: invalid HMAC signature');
          throw new ForbiddenException('Invalid signature');
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.warn('CryptoBot webhook: signature compare failed');
        throw new ForbiddenException('Invalid signature');
      }
    }

    if (body.update_type !== 'invoice_paid') {
      return { ok: true };
    }
    const transactionId = body.payload?.payload;
    if (!transactionId) {
      this.logger.warn('CryptoBot webhook: missing payload.payload');
      return { ok: true };
    }
    try {
      await this.payments.completeTransaction(transactionId);
    } catch (err) {
      this.logger.error('CryptoBot webhook: completion failed', err);
    }
    return { ok: true };
  }

  @Post('heleket')
  @HttpCode(200)
  async heleketWebhook(
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    // Extract and remove sign before verification
    const sign = body['sign'];
    if (!sign || typeof sign !== 'string') {
      this.logger.warn('Heleket webhook: missing sign');
      throw new ForbiddenException('Missing signature');
    }
    const bodyWithoutSign = { ...body };
    delete bodyWithoutSign['sign'];

    if (!this.heleket.verifyWebhook(bodyWithoutSign, sign)) {
      this.logger.warn('Heleket webhook: invalid signature');
      throw new ForbiddenException('Invalid signature');
    }

    const status = body['status'] as string | undefined;
    // Heleket returns: paid, paid_over, fail, cancel, process, check, etc.
    if (status !== 'paid' && status !== 'paid_over') {
      this.logger.log(`Heleket webhook: non-terminal status "${status}"`);
      return { ok: true };
    }

    // Extract transaction id from description (JSON-encoded metadata)
    const description = body['description'] as string | undefined;
    if (!description) {
      this.logger.warn('Heleket webhook: missing description/metadata');
      return { ok: true };
    }

    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(description);
    } catch {
      this.logger.warn('Heleket webhook: description is not JSON');
      return { ok: true };
    }

    const transactionId = metadata['transactionId'] as string | undefined;
    if (!transactionId) {
      this.logger.warn('Heleket webhook: no transactionId in metadata');
      return { ok: true };
    }

    try {
      await this.payments.completeTransaction(transactionId);
      this.logger.log(
        `Heleket webhook: completed transaction ${transactionId}`,
      );
    } catch (err) {
      this.logger.error('Heleket webhook: completion failed', err);
    }
    return { ok: true };
  }
}
