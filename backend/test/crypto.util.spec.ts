import { decrypt, encrypt, isEncrypted } from '../src/common/crypto.util';

describe('credential encryption', () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'test-only-encryption-key-0123456789abcdef0123456789';
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
    }
  });

  it('round-trips secrets with AES-GCM', () => {
    const encrypted = encrypt('sensitive-agent-secret');
    expect(encrypted).not.toContain('sensitive-agent-secret');
    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decrypt(encrypted)).toBe('sensitive-agent-secret');
  });

  it('uses a fresh nonce for every encryption', () => {
    expect(encrypt('same-value')).not.toBe(encrypt('same-value'));
  });

  it('rejects modified ciphertext', () => {
    const encrypted = encrypt('sensitive-agent-secret');
    const parts = encrypted.split(':');
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith('A') ? 'B' : 'A'}`;
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('requires a strong configured key', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'short';
    expect(() => encrypt('secret')).toThrow(
      'CREDENTIALS_ENCRYPTION_KEY must contain at least 32 characters',
    );
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'test-only-encryption-key-0123456789abcdef0123456789';
  });
});
