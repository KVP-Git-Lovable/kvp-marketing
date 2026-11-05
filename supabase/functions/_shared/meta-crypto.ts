// AES-GCM encrypt/decrypt for Meta OAuth tokens at rest, keyed by the
// META_TOKEN_ENC_KEY secret. Output is base64(iv):base64(ciphertext).

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encryptToken(plain: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptToken(encoded: string, secret: string): Promise<string> {
  const [ivB64, cipherB64] = encoded.split(':');
  const key = await deriveKey(secret);
  const iv = fromBase64(ivB64);
  const cipherBytes = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}
