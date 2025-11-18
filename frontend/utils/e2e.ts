// Simple E2E encryption placeholder used by chats.tsx
// In production, replace with a proper E2E scheme (e.g., X3DH/Double Ratchet).

function isWebCryptoAvailable(): boolean {
  try { return typeof window !== 'undefined' && !!(window.crypto && (window.crypto as any).subtle); } catch { return false; }
}

function toUint8(str: string): Uint8Array {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null as any;
  return enc ? enc.encode(str) : new Uint8Array([]);
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function deriveAesKey(sender_type: string | number, sender_id: string | number, receiver_type: string | number, receiver_id: string | number) {
  const ids = [String(sender_type), String(sender_id), String(receiver_type), String(receiver_id)].sort().join('|');
  const salt = 'chat-key-v1';
  const data = toUint8(ids + '|' + salt);
  const digest = await (window.crypto as any).subtle.digest('SHA-256', data);
  const raw = new Uint8Array(digest as ArrayBuffer);
  return (window.crypto as any).subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptMessage(
  plaintext: string,
  sender_type: string | number,
  sender_id: string | number,
  receiver_type: string | number,
  receiver_id: string | number,
): Promise<string> {
  if (!isWebCryptoAvailable()) return plaintext;
  const iv = new Uint8Array(12);
  (window.crypto as any).getRandomValues(iv);
  const key = await deriveAesKey(sender_type, sender_id, receiver_type, receiver_id);
  const data = toUint8(plaintext);
  const buf = await (window.crypto as any).subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const ct = new Uint8Array(buf as ArrayBuffer);
  const payload = JSON.stringify({ iv: hexEncode(iv), ct: hexEncode(ct) });
  return payload;
}

export async function decryptMessage(
  ciphertext: string,
  sender_type: string | number,
  sender_id: string | number,
  receiver_type: string | number,
  receiver_id: string | number,
): Promise<string> {
  if (!isWebCryptoAvailable()) return ciphertext;
  let ivHex = '', ctHex = '';
  try {
    const obj = JSON.parse(ciphertext);
    ivHex = String(obj.iv || '');
    ctHex = String(obj.ct || '');
  } catch {
    return ciphertext;
  }
  if (!ivHex || !ctHex) return ciphertext;
  const key = await deriveAesKey(sender_type, sender_id, receiver_type, receiver_id);
  const iv = hexDecode(ivHex);
  const ct = hexDecode(ctHex);
  const buf = await (window.crypto as any).subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const dec = new TextDecoder().decode(buf as ArrayBuffer);
  return dec;
}

// Basic serialization helpers (optional)
export function serialize<T>(obj: T): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
}

export function deserialize<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}