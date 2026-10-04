const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface ChatEnvelope {
  v: 1;
  iv: string;
  ct: string;
}

export interface ThreadKeyPair {
  privJwk: JsonWebKey;
  pubB64: string;
}

const KEY_PREFIX = 'afya:e2e:';
const memoryPairs = new Map<string, ThreadKeyPair>();

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(view.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function utf8(value: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(value);
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readPair(threadId: string): ThreadKeyPair | null {
  const store = browserStorage();
  if (store) {
    try {
      const raw = store.getItem(KEY_PREFIX + threadId);
      if (raw) {
        const parsed = JSON.parse(raw) as { privJwk?: JsonWebKey; pubB64?: string };
        if (parsed.privJwk && typeof parsed.pubB64 === 'string') return { privJwk: parsed.privJwk, pubB64: parsed.pubB64 };
      }
    } catch {
      return memoryPairs.get(threadId) ?? null;
    }
  }
  return memoryPairs.get(threadId) ?? null;
}

function writePair(threadId: string, pair: ThreadKeyPair): void {
  memoryPairs.set(threadId, pair);
  const store = browserStorage();
  if (!store) return;
  try {
    store.setItem(KEY_PREFIX + threadId, JSON.stringify(pair));
  } catch {
    return;
  }
}

export function hasStoredKey(threadId: string): boolean {
  return readPair(threadId) !== null;
}

function isKeyPair(value: CryptoKey | CryptoKeyPair): value is CryptoKeyPair {
  return typeof (value as CryptoKeyPair).privateKey !== 'undefined';
}

export async function getOrCreateThreadKeyPair(threadId: string): Promise<ThreadKeyPair> {
  const existing = readPair(threadId);
  if (existing) return existing;
  const generated = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  if (!isKeyPair(generated)) throw new Error('Could not create an encryption key pair on this device.');
  const privJwk = await crypto.subtle.exportKey('jwk', generated.privateKey);
  const raw = await crypto.subtle.exportKey('raw', generated.publicKey);
  const pair: ThreadKeyPair = { privJwk, pubB64: bytesToBase64(raw) };
  writePair(threadId, pair);
  return pair;
}

export async function deriveThreadKey(myPrivJwk: JsonWebKey, theirPubB64: string, threadId: string): Promise<CryptoKey> {
  const privateKey = await crypto.subtle.importKey('jwk', myPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
  const publicKey = await crypto.subtle.importKey('raw', base64ToBytes(theirPubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(threadId), info: utf8('afya-chat-v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function parseEnvelope(input: unknown): { iv: Uint8Array<ArrayBuffer>; ct: Uint8Array<ArrayBuffer> } | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const env = parsed as Partial<ChatEnvelope>;
  if (env.v !== 1 || typeof env.iv !== 'string' || typeof env.ct !== 'string') return null;
  try {
    const iv = base64ToBytes(env.iv);
    if (iv.length !== 12) return null;
    return { iv, ct: base64ToBytes(env.ct) };
  } catch {
    return null;
  }
}

export function isEnvelope(input: string): boolean {
  return parseEnvelope(input) !== null;
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plaintext));
  return JSON.stringify({ v: 1, iv: bytesToBase64(iv), ct: bytesToBase64(ct) } satisfies ChatEnvelope);
}

export async function decryptText(key: CryptoKey, input: string): Promise<string> {
  const env = parseEnvelope(input);
  if (!env) return input;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: env.iv }, key, env.ct);
  return textDecoder.decode(plain);
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, view);
  return JSON.stringify({ v: 1, iv: bytesToBase64(iv), ct: bytesToBase64(ct) } satisfies ChatEnvelope);
}

export async function decryptBytes(key: CryptoKey, envelope: string | ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const raw = typeof envelope === 'string' ? envelope : textDecoder.decode(envelope instanceof Uint8Array ? envelope : new Uint8Array(envelope));
  const env = parseEnvelope(raw);
  if (!env) throw new Error('Encrypted payload could not be read.');
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: env.iv }, key, env.ct);
}
