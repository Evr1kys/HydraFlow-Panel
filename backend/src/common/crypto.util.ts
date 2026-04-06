import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encrypt(text: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string, secret: string): string {
  const key = deriveKey(secret);
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Check if a value looks like it was encrypted by our encrypt() function.
 * Encrypted format: 32 hex chars (IV) + ':' + hex chars (ciphertext).
 */
export function isEncrypted(value: string): boolean {
  if (!value.includes(':')) return false;
  const [ivHex, encrypted] = value.split(':');
  return (
    ivHex.length === 32 &&
    /^[0-9a-f]+$/i.test(ivHex) &&
    encrypted.length > 0 &&
    /^[0-9a-f]+$/i.test(encrypted)
  );
}
