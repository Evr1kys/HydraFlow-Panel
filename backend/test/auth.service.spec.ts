import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';

// --- Mocks ---

const mockPrisma = {
  admin: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed-jwt-token'),
};

const mockSessionsService = {
  create: jest.fn(),
};

const mockMetrics = {
  incAuthAttempt: jest.fn(),
};

// bcrypt mock
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import * as bcrypt from 'bcrypt';

function createService(): AuthService {
  return new AuthService(
    mockPrisma as any,
    mockJwtService as any,
    mockSessionsService as any,
    mockMetrics as any,
  );
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  describe('login', () => {
    const dto = { email: 'admin@test.com', password: 'correct' };

    it('should return a token for valid credentials', async () => {
      const admin = {
        id: '1',
        email: 'admin@test.com',
        password: 'hashed',
        enabled: true,
        role: 'superadmin',
        totpEnabled: false,
        totpSecret: null,
      };
      mockPrisma.admin.findUnique.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.admin.update.mockResolvedValue(admin);

      const result = await service.login(dto, 'ua', '127.0.0.1');

      expect(result).toEqual({ token: 'signed-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: '1', email: 'admin@test.com' }),
      );
      expect(mockMetrics.incAuthAttempt).toHaveBeenCalledWith('success');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const admin = {
        id: '1',
        email: 'admin@test.com',
        password: 'hashed',
        enabled: true,
        role: 'superadmin',
        totpEnabled: false,
        totpSecret: null,
      };
      mockPrisma.admin.findUnique.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto, 'ua', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockMetrics.incAuthAttempt).toHaveBeenCalledWith('failed');
    });

    it('should throw UnauthorizedException for non-existent admin', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);

      await expect(service.login(dto, 'ua', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject disabled admin after valid password', async () => {
      const admin = {
        id: '1',
        email: 'admin@test.com',
        password: 'hashed',
        enabled: false,
        role: 'superadmin',
        totpEnabled: false,
        totpSecret: null,
      };
      mockPrisma.admin.findUnique.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto, 'ua', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockMetrics.incAuthAttempt).toHaveBeenCalledWith('failed');
    });
  });
});
