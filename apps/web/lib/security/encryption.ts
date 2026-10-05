const te = new TextEncoder();
const td = new TextDecoder();

function getSecret(): string {
  return process.env.AFYA_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'afyacommerce-dev-insecure-key-change-me';
}

async function deriveKey(secret: string, keyId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', te.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: te.encode(`afya-enc-${keyId}`), info: te.encode('afya-at-rest') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface Envelope {
  v: number;
  kid: string;
  iv: string;
  ct: string;
}

export async function encryptJson(value: unknown, keyId = 'v1'): Promise<string> {
  const key = await deriveKey(getSecret(), keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = te.encode(JSON.stringify(value)) as unknown as BufferSource;
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const envelope: Envelope = { v: 1, kid: keyId, iv: b64encode(iv), ct: b64encode(ciphertext) };
  return b64encode(te.encode(JSON.stringify(envelope)));
}

export async function decryptJson<T>(payload: string, keyId = 'v1'): Promise<T | null> {
  try {
    const envelope = JSON.parse(td.decode(b64decode(payload))) as Envelope;
    const key = await deriveKey(getSecret(), envelope.kid || keyId);
    const iv = b64decode(envelope.iv);
    const ciphertext = b64decode(envelope.ct);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(td.decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function isEncryptedPayload(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
