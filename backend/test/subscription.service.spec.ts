import { NotFoundException } from '@nestjs/common';
import { SubscriptionService } from '../src/subscription/subscription.service';

// --- Mocks ---

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  settings: {
    findUnique: jest.fn(),
  },
  externalSquad: {
    findUnique: jest.fn(),
  },
  hwidDevice: {
    count: jest.fn(),
  },
};

const mockHwidService = {
  checkDevice: jest.fn(),
};

const mockSubscriptionTemplatesService = {
  getDefaultForClient: jest.fn().mockResolvedValue(null),
  renderTemplate: jest.fn(),
};

function createService(): SubscriptionService {
  return new SubscriptionService(
    mockPrisma as any,
    mockHwidService as any,
    mockSubscriptionTemplatesService as any,
  );
}

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  describe('generateLinks', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.generateLinks('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user is disabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        enabled: false,
        expiryDate: null,
      });

      await expect(service.generateLinks('tok')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when settings are not configured', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        enabled: true,
        expiryDate: null,
        uuid: 'uuid-1',
        email: 'test@test.com',
        remark: null,
        trafficUp: BigInt(0),
        trafficDown: BigInt(0),
        trafficLimit: null,
        externalSquadId: null,
        internalSquadId: null,
      });
      mockPrisma.settings.findUnique.mockResolvedValue(null);

      await expect(service.generateLinks('tok', 'v2rayNG')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when serverIp is not configured', async () => {
      // Remove env var so resolveServerIp has no fallback
      const origEnv = process.env['SERVER_PUBLIC_IP'];
      delete process.env['SERVER_PUBLIC_IP'];

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        enabled: true,
        expiryDate: null,
        uuid: 'uuid-1',
        email: 'test@test.com',
        remark: null,
        trafficUp: BigInt(0),
        trafficDown: BigInt(0),
        trafficLimit: null,
        externalSquadId: null,
        internalSquadId: null,
      });
      mockPrisma.settings.findUnique.mockResolvedValue({
        id: 'main',
        serverIp: null, // not configured
        realityEnabled: true,
        realityPort: 443,
        realityPbk: 'pk',
        realitySni: 'sni',
        realitySid: 'sid',
        wsEnabled: false,
        ssEnabled: false,
      });

      await expect(service.generateLinks('tok', 'v2rayNG')).rejects.toThrow(
        NotFoundException,
      );

      // Restore
      if (origEnv !== undefined) {
        process.env['SERVER_PUBLIC_IP'] = origEnv;
      }
    });
  });
});
