import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const VERSION = 'v2';
const GCM_ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const IV_BYTES = 12;

function sourceKey(explicitKey?: string): string {
  const source =
    explicitKey ??
    process.env.CREDENTIALS_ENCRYPTION_KEY ??
    process.env.ENCRYPTION_KEY;
  if (!source || source.length < 32) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must contain at least 32 characters',
    );
  }
  return source;
}

function key(explicitKey?: string): Buffer {
  return createHash('sha256')
    .update(sourceKey(explicitKey), 'utf8')
    .digest();
}

/** Encrypt a secret using versioned AES-256-GCM authenticated encryption. */
export function encrypt(plaintext: string, explicitKey?: string): string {
  if (!plaintext) return '';
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(GCM_ALGORITHM, key(explicitKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

/**
 * Decrypt a current AES-GCM value or a legacy iv:ciphertext AES-CBC value.
 * Legacy support permits a controlled migration without exposing plaintext.
 */
export function decrypt(ciphertext: string, explicitKey?: string): string {
  if (!ciphertext) return '';
  if (ciphertext.startsWith(`${VERSION}:`)) {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted credential format');
    }
    const [, ivEncoded, tagEncoded, dataEncoded] = parts;
    const decipher = createDecipheriv(
      GCM_ALGORITHM,
      key(explicitKey),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  const [ivHex, encryptedHex, ...extra] = ciphertext.split(':');
  if (!ivHex || !encryptedHex || extra.length > 0) {
    throw new Error('Invalid encrypted credential format');
  }
  const decipher = createDecipheriv(
    LEGACY_ALGORITHM,
    key(explicitKey),
    Buffer.from(ivHex, 'hex'),
  );
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.startsWith(`${VERSION}:`)) {
    return value.split(':').length === 4;
  }
  const parts = value.split(':');
  return (
    parts.length === 2 &&
    /^[0-9a-f]{32}$/i.test(parts[0]) &&
    /^[0-9a-f]+$/i.test(parts[1])
  );
}
