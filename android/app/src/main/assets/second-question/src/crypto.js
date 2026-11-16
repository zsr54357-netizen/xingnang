// WebCrypto helpers. Works in the browser and in Node >= 20 (globalThis.crypto).

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 310000;
export const SALT_BYTES = 16;
export const DEK_BYTES = 32;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function toB64(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

export function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function deriveKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateDek() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportDek(dek) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', dek));
}

export async function importDek(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export async function decryptBytes(key, blob) {
  const iv = fromB64(blob.iv);
  const data = fromB64(blob.data);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new Uint8Array(pt);
}

export async function encryptJson(key, obj) {
  return encryptBytes(key, enc.encode(JSON.stringify(obj)));
}

export async function decryptJson(key, blob) {
  return JSON.parse(dec.decode(await decryptBytes(key, blob)));
}

export async function wrapDek(kek, dek) {
  return encryptBytes(kek, await exportDek(dek));
}

export async function unwrapDek(kek, blob) {
  return importDek(await decryptBytes(kek, blob));
}

export function encodeRecovery(raw) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g).join('-');
}

export function decodeRecovery(code) {
  const clean = String(code)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = CROCKFORD.indexOf(ch);
    if (idx < 0) throw new Error('恢复码含有无效字符');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (out.length !== DEK_BYTES) throw new Error('恢复码长度不对');
  return new Uint8Array(out);
}
