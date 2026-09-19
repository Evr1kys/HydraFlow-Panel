import { Injectable, Logger } from '@nestjs/common';
import { createHmac, createHash, randomBytes, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { isIP } from 'net';
import { Agent, request } from 'undici';
import { decrypt } from '../common/crypto.util';
import {
  formatPinnedHost,
  normalizeAgentHost,
  resolveAgentAddress,
} from './network-security';

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const AGENT_API_VERSION = 'v1';

export interface AgentNodeCredentials {
  id: string;
  address: string;
  port: number;
  apiKey: string;
  agentKeyId: string;
  agentSecretEnc: string;
  agentCaCert: string | null;
  agentServerName: string | null;
}

export interface AgentHealth {
  status: 'ok' | 'degraded';
  api_version: string;
  version: string;
  build_time?: string;
  uptime?: string;
  xray?: {
    active: boolean;
    pid?: number;
    version?: string;
    checked_at?: string;
  };
  revision?: AgentRevision;
}

export interface AgentRevision {
  id: string;
  hash: string;
  size: number;
  created_at: string;
  reason?: string;
  actor_key_id?: string;
  state: string;
  rolled_back_from?: string;
  error?: string;
}

export interface AgentApplyResult {
  revision: AgentRevision;
}

export interface AgentStatus {
  xray: {
    active: boolean;
    pid?: number;
    version?: string;
    checked_at: string;
  };
  revision?: AgentRevision;
}

export interface AgentValidationResult {
  valid: boolean;
  hash: string;
  size: number;
}

export class AgentClientError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentClientError';
  }
}

interface AgentErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
}

@Injectable()
export class AgentClient {
  private readonly logger = new Logger(AgentClient.name);

  async health(node: AgentNodeCredentials): Promise<AgentHealth> {
    const health = await this.call<AgentHealth>(node, '/api/v1/health');
    this.assertCompatible(health.api_version);
    return health;
  }

  async version(
    node: AgentNodeCredentials,
  ): Promise<{ api_version: string; version: string; build_time?: string }> {
    const result = await this.call<{
      api_version: string;
      version: string;
      build_time?: string;
    }>(node, '/api/v1/version');
    this.assertCompatible(result.api_version);
    return result;
  }

  status(node: AgentNodeCredentials): Promise<AgentStatus> {
    return this.call<AgentStatus>(node, '/api/v1/status');
  }

  validate(
    node: AgentNodeCredentials,
    config: unknown,
  ): Promise<AgentValidationResult> {
    return this.call<AgentValidationResult>(node, '/api/v1/config/validate', {
      method: 'POST',
      body: { config },
    });
  }

  apply(
    node: AgentNodeCredentials,
    config: unknown,
    reason: string,
    idempotencyKey: string,
  ): Promise<AgentApplyResult> {
    return this.call<AgentApplyResult>(node, '/api/v1/config/apply', {
      method: 'POST',
      body: { config, reason },
      idempotencyKey,
      timeoutMs: 45_000,
    });
  }

  restart(
    node: AgentNodeCredentials,
    idempotencyKey: string,
  ): Promise<AgentStatus> {
    return this.call<AgentStatus>(node, '/api/v1/xray/restart', {
      method: 'POST',
      body: {},
      idempotencyKey,
      timeoutMs: 45_000,
    });
  }

  rollback(
    node: AgentNodeCredentials,
    revision: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<AgentApplyResult> {
    return this.call<AgentApplyResult>(node, '/api/v1/config/rollback', {
      method: 'POST',
      body: { revision, reason },
      idempotencyKey,
      timeoutMs: 45_000,
    });
  }

  rotateKey(
    node: AgentNodeCredentials,
    keyId: string,
    secret: string,
    graceSeconds: number,
    idempotencyKey: string,
  ): Promise<{ active_key_id: string }> {
    return this.call<{ active_key_id: string }>(
      node,
      '/api/v1/auth/rotate',
      {
        method: 'POST',
        body: {
          key_id: keyId,
          secret,
          grace_seconds: graceSeconds,
        },
        idempotencyKey,
      },
    );
  }

  async userStats(
    node: AgentNodeCredentials,
  ): Promise<{
    users: Record<string, { uplink: number; downlink: number; total: number }>;
    collected_at: string;
  }> {
    return this.call(node, '/api/v1/stats/users');
  }

  private async call<T>(
    node: AgentNodeCredentials,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const parsedPath = new URL(path, 'https://agent.invalid');
    if (
      parsedPath.origin !== 'https://agent.invalid' ||
      !parsedPath.pathname.startsWith('/api/v1/')
    ) {
      throw new AgentClientError(
        'Invalid Agent API path',
        500,
        'invalid_agent_path',
      );
    }

    const resolved = await resolveAgentAddress(node.address);
    const serverName = this.serverName(node, resolved.normalizedHost);
    const ca = await this.loadCA(node.agentCaCert);
    const clientCertificate = await this.loadOptionalFile(
      process.env.NODE_CLIENT_CERT_PATH,
    );
    const clientKey = await this.loadOptionalFile(
      process.env.NODE_CLIENT_KEY_PATH,
    );
    if ((clientCertificate && !clientKey) || (!clientCertificate && clientKey)) {
      throw new AgentClientError(
        'Both NODE_CLIENT_CERT_PATH and NODE_CLIENT_KEY_PATH are required for mTLS',
        500,
        'invalid_mtls_configuration',
      );
    }

    const dispatcher = new Agent({
      connect: {
        rejectUnauthorized: true,
        ...(ca ? { ca } : {}),
        ...(clientCertificate && clientKey
          ? { cert: clientCertificate, key: clientKey }
          : {}),
        ...(serverName ? { servername: serverName } : {}),
      },
      bodyTimeout: options.timeoutMs ?? 30_000,
      headersTimeout: options.timeoutMs ?? 30_000,
      connectTimeout: Math.min(options.timeoutMs ?? 30_000, 10_000),
    });

    const body = options.body === undefined
      ? Buffer.alloc(0)
      : Buffer.from(JSON.stringify(options.body), 'utf8');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(18).toString('base64url');
    const requestId = randomUUID();
    const secret = this.decodeSecret(node);
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const canonical = [
      method,
      parsedPath.pathname,
      parsedPath.search.slice(1),
      timestamp,
      nonce,
      bodyHash,
    ].join('\n');
    const signature = createHmac('sha256', secret)
      .update(canonical)
      .digest('hex');

    const pinnedUrl = new URL(
      `https://${formatPinnedHost(resolved.address)}:${node.port}${parsedPath.pathname}${parsedPath.search}`,
    );

    try {
      const response = await request(pinnedUrl, {
        dispatcher,
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-hydra-key-id': node.agentKeyId,
          'x-hydra-timestamp': timestamp,
          'x-hydra-nonce': nonce,
          'x-hydra-signature': `v1=${signature}`,
          'x-request-id': requestId,
          ...(options.idempotencyKey
            ? { 'idempotency-key': options.idempotencyKey }
            : {}),
        },
        body: body.length > 0 ? body : undefined,
        maxRedirections: 0,
        headersTimeout: options.timeoutMs ?? 30_000,
        bodyTimeout: options.timeoutMs ?? 30_000,
      });

      const raw = await this.readBounded(response.body);
      const parsed = raw.length > 0 ? this.parseJSON(raw, response.statusCode) : {};
      if (response.statusCode < 200 || response.statusCode >= 300) {
        const envelope = parsed as AgentErrorEnvelope;
        throw new AgentClientError(
          envelope.error?.message ??
            `Agent request failed with status ${response.statusCode}`,
          response.statusCode,
          envelope.error?.code ?? 'agent_request_failed',
          envelope.error?.request_id,
          envelope.error?.details,
        );
      }
      return parsed as T;
    } catch (error) {
      if (error instanceof AgentClientError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Agent request failed for node ${node.id}: ${message}`,
      );
      throw new AgentClientError(
        'Agent connection failed',
        502,
        'agent_connection_failed',
        requestId,
        undefined,
        error,
      );
    } finally {
      await dispatcher.close().catch(() => undefined);
    }
  }

  private decodeSecret(node: AgentNodeCredentials): Buffer {
    const plaintext = node.agentSecretEnc
      ? decrypt(node.agentSecretEnc)
      : node.apiKey;
    if (!node.agentKeyId || !plaintext) {
      throw new AgentClientError(
        'Node Agent credentials are not configured',
        409,
        'agent_credentials_missing',
      );
    }
    const decoded = Buffer.from(plaintext, 'base64');
    if (decoded.length < 32) {
      throw new AgentClientError(
        'Node Agent secret is invalid',
        500,
        'invalid_agent_secret',
      );
    }
    return decoded;
  }

  private serverName(
    node: AgentNodeCredentials,
    normalizedHost: string,
  ): string | undefined {
    const explicit = node.agentServerName?.trim();
    if (explicit) return normalizeAgentHost(explicit);
    return isIP(normalizedHost) ? undefined : normalizedHost;
  }

  private async loadCA(inline: string | null): Promise<string | undefined> {
    if (inline?.trim()) return inline;
    return this.loadOptionalFile(process.env.NODE_AGENT_CA_CERT_PATH);
  }

  private async loadOptionalFile(
    path: string | undefined,
  ): Promise<string | undefined> {
    if (!path?.trim()) return undefined;
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      throw new AgentClientError(
        `Could not read TLS credential file ${path}`,
        500,
        'tls_credential_unavailable',
        undefined,
        undefined,
        error,
      );
    }
  }

  private async readBounded(
    stream: AsyncIterable<Uint8Array> & { destroy?: (error?: Error) => void },
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_RESPONSE_BYTES) {
        stream.destroy?.(new Error('Agent response exceeded size limit'));
        throw new AgentClientError(
          'Agent response exceeded size limit',
          502,
          'agent_response_too_large',
        );
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, total);
  }

  private parseJSON(buffer: Buffer, statusCode: number): unknown {
    try {
      return JSON.parse(buffer.toString('utf8')) as unknown;
    } catch (error) {
      throw new AgentClientError(
        'Agent returned invalid JSON',
        statusCode >= 400 ? statusCode : 502,
        'invalid_agent_response',
        undefined,
        undefined,
        error,
      );
    }
  }

  private assertCompatible(apiVersion: string): void {
    if (apiVersion !== AGENT_API_VERSION) {
      throw new AgentClientError(
        `Unsupported Agent API version: ${apiVersion || 'missing'}`,
        409,
        'agent_version_incompatible',
        undefined,
        { expected: AGENT_API_VERSION, received: apiVersion },
      );
    }
  }
}
