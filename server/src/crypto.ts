import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn(
    '[Crypto] WARNING: ENCRYPTION_KEY is not set. API keys will be read as plain text (degraded mode). ' +
      'Set ENCRYPTION_KEY (64 hex characters / 32 bytes) to enable encrypted storage.'
  );
} else if (ENCRYPTION_KEY.length !== 64) {
  console.error(
    `[Crypto] ERROR: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ` +
      `Got ${ENCRYPTION_KEY.length} characters. Encryption/decryption will fail.`
  );
}

// Format: iv:authTag:ciphertext  (all hex-encoded)
export function encrypt(plainText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('[Crypto] ENCRYPTION_KEY is not configured. Cannot encrypt API keys.');
  }
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error(
      `[Crypto] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes), got ${ENCRYPTION_KEY.length}.`
    );
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Backwards-compatible: if value is not in iv:authTag:ciphertext format, returns it as-is.
export function decrypt(cipherText: string): string {
  // Encrypted values have exactly 2 colon separators
  const colonCount = (cipherText.match(/:/g) ?? []).length;
  if (colonCount !== 2) {
    return cipherText; // Legacy plaintext — return unchanged
  }

  if (!ENCRYPTION_KEY) {
    console.warn('[Crypto] Encrypted value detected but ENCRYPTION_KEY is not set. Returning raw value.');
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]).toString('utf8');
}
