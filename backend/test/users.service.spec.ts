import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { Prisma } from '@prisma/client';

// --- Mocks ---

function makeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    email: 'test@example.com',
    uuid: 'uuid-1',
    subToken: 'sub-tok-1',
    shortUuid: 'abcd1234',
    tag: null,
    tId: BigInt(1),
    enabled: true,
    trafficUp: BigInt(0),
    trafficDown: BigInt(0),
    trafficLimit: null,
    lifetimeTrafficUsed: BigInt(0),
    trafficStrategy: 'NO_RESET',
    lastTrafficResetAt: null,
    expiryDate: null,
    maxDevices: 3,
    hwidDeviceLimit: null,
    onlineAt: null,
    remark: null,
    telegramId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    internalSquadId: null,
    externalSquadId: null,
    ...overrides,
  };
}

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  },
  userTraffic: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockWebhooksService = {
  fire: jest.fn().mockResolvedValue(undefined),
};

const mockXrayService = {
  generateConfig: jest.fn().mockResolvedValue({}),
};

const mockNodesService = {
  pushConfigToAll: jest.fn().mockResolvedValue([]),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

function createService(): UsersService {
  return new UsersService(
    mockPrisma as any,
    mockWebhooksService as any,
    mockXrayService as any,
    mockNodesService as any,
    mockEventEmitter as any,
  );
}

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  describe('create', () => {
    it('should create a user and return serialised result', async () => {
      const row = makeUserRow();
      mockPrisma.user.create.mockResolvedValue(row);
      // generateUniqueShortUuid calls findUnique
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.create({ email: 'test@example.com' });

      expect(result.email).toBe('test@example.com');
      expect(result.tId).toBe('1');
      expect(mockWebhooksService.fire).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ user: expect.any(Object) }),
      );
    });

    it('should throw ConflictException on duplicate email', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.create.mockRejectedValue(err);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ email: 'dup@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('renew', () => {
    it('should extend expiry from now if user is already expired', async () => {
      const pastDate = new Date('2023-01-01');
      const row = makeUserRow({ expiryDate: pastDate });
      mockPrisma.user.findUnique.mockResolvedValue(row);

      const updatedRow = makeUserRow({ expiryDate: new Date(Date.now() + 30 * 86400000) });
      mockPrisma.user.update.mockResolvedValue(updatedRow);

      const result = await service.renew('u1', 30);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            expiryDate: expect.any(Date),
          }),
        }),
      );
      expect(result.expiryDate).toBeTruthy();
    });

    it('should extend expiry from current expiry if user is still active', async () => {
      const futureDate = new Date(Date.now() + 10 * 86400000);
      const row = makeUserRow({ expiryDate: futureDate });
      mockPrisma.user.findUnique.mockResolvedValue(row);

      const updatedRow = makeUserRow({
        expiryDate: new Date(futureDate.getTime() + 15 * 86400000),
      });
      mockPrisma.user.update.mockResolvedValue(updatedRow);

      await service.renew('u1', 15);

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      const newExpiry: Date = updateCall.data.expiryDate;
      // The new expiry should be at least 10+15=25 days from now
      expect(newExpiry.getTime()).toBeGreaterThan(
        Date.now() + 24 * 86400000,
      );
    });

    it('should throw NotFoundException for missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.renew('missing', 30)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
