import { createHash } from 'crypto';
import { NodesService } from '../src/nodes/nodes.service';
import { encrypt } from '../src/common/crypto.util';

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-1',
    name: 'Node 1',
    address: '8.8.8.8',
    port: 8443,
    apiKey: '',
    agentKeyId: 'agent-key-001',
    agentSecretEnc: encrypt(Buffer.alloc(32, 1).toString('base64')),
    agentCaCert: null,
    agentServerName: null,
    agentApiVersion: 'v1',
    agentVersion: 'test',
    enabled: true,
    status: 'healthy',
    lastCheck: new Date('2026-01-01T00:00:00Z'),
    lastRevision: 'rev-1',
    lastSyncAt: null,
    lastSyncError: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const mockPrisma = {
  node: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  nodeDeployment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((values: Array<Promise<unknown>>) => Promise.all(values)),
};

const mockEvents = { emit: jest.fn() };
const mockAgent = {
  version: jest.fn(),
  health: jest.fn(),
  validate: jest.fn(),
  apply: jest.fn(),
  restart: jest.fn(),
  rollback: jest.fn(),
  rotateKey: jest.fn(),
};

function createService(): NodesService {
  return new NodesService(
    mockPrisma as never,
    mockEvents as never,
    mockAgent as never,
  );
}

describe('NodesService Agent integration', () => {
  const originalEncryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'test-only-encryption-key-0123456789abcdef0123456789';
  });

  afterAll(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies an Agent and stores only an encrypted secret', async () => {
    mockAgent.version.mockResolvedValue({ api_version: 'v1', version: '1.0.0' });
    mockAgent.health.mockResolvedValue({
      status: 'ok',
      api_version: 'v1',
      version: '1.0.0',
      xray: { active: true },
      revision: { id: 'rev-1' },
    });
    mockPrisma.node.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeNode({ ...data, id: 'node-created' })),
    );

    const secret = Buffer.alloc(32, 7).toString('base64');
    const result = await createService().create({
      name: 'Verified Agent',
      address: '8.8.8.8',
      port: 8443,
      keyId: 'agent-key-001',
      apiKey: secret,
      enabled: true,
    });

    const data = mockPrisma.node.create.mock.calls[0][0].data;
    expect(data.apiKey).toBe('');
    expect(data.agentSecretEnc).toMatch(/^v2:/);
    expect(data.agentSecretEnc).not.toContain(secret);
    expect(result.credentialsConfigured).toBe(true);
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('agentSecretEnc');
  });

  it('records a deterministic deployment and applies it once', async () => {
    const node = makeNode();
    mockPrisma.node.findMany.mockResolvedValue([node]);
    mockPrisma.nodeDeployment.findUnique.mockResolvedValue(null);
    mockPrisma.nodeDeployment.create.mockResolvedValue({
      id: 'deployment-1',
      nodeId: node.id,
      idempotencyKey: '',
      configHash: '',
      revision: null,
      status: 'pending',
      error: null,
      initiatedBy: 'admin-1',
      createdAt: new Date(),
      finishedAt: null,
    });
    mockPrisma.nodeDeployment.update.mockResolvedValue({});
    mockPrisma.node.update.mockResolvedValue(node);

    const config = { inbounds: [], outbounds: [{ protocol: 'freedom' }] };
    const canonical = JSON.stringify(config);
    const hash = createHash('sha256').update(canonical).digest('hex');
    mockAgent.validate.mockResolvedValue({ valid: true, hash, size: canonical.length });
    mockAgent.apply.mockResolvedValue({
      revision: { id: 'rev-new', hash, state: 'active' },
    });

    const results = await createService().pushConfigToAll(
      JSON.stringify(config, null, 2),
      'admin-1',
    );

    expect(results).toEqual([
      expect.objectContaining({
        nodeId: 'node-1',
        success: true,
        revision: 'rev-new',
        deploymentId: 'deployment-1',
      }),
    ]);
    expect(mockAgent.apply).toHaveBeenCalledWith(
      expect.any(Object),
      config,
      'Panel deployment deployment-1',
      `cfg:node-1:${hash}`,
    );
    expect(mockPrisma.nodeDeployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: `cfg:node-1:${hash}`,
        configHash: hash,
        initiatedBy: 'admin-1',
      }),
    });
  });

  it('reuses a successful deployment without calling the Agent', async () => {
    const node = makeNode();
    mockPrisma.node.findMany.mockResolvedValue([node]);
    mockPrisma.nodeDeployment.findUnique.mockResolvedValue({
      id: 'deployment-existing',
      status: 'succeeded',
      revision: 'rev-existing',
    });

    const results = await createService().pushConfigToAll(
      JSON.stringify({ inbounds: [], outbounds: [] }),
      'admin-1',
    );

    expect(results[0]).toEqual({
      nodeId: 'node-1',
      success: true,
      revision: 'rev-existing',
      deploymentId: 'deployment-existing',
    });
    expect(mockAgent.validate).not.toHaveBeenCalled();
    expect(mockAgent.apply).not.toHaveBeenCalled();
  });
});
