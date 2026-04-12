// @client-only — never import in API routes or server components
//
// Vault crypto. PBKDF2-SHA256 (310k iterations) → HKDF-SHA256 → three
// AES-256-GCM sub-keys (fileKey / noteKey / metaKey). Every encrypt uses a
// fresh 12-byte IV and 128-bit auth tag. IV is prepended to the buffer
// variant; the string variant returns enc + iv separately.

export type VaultKeys = {
  fileKey: CryptoKey;
  noteKey: CryptoKey;
  metaKey: CryptoKey;
};

const PBKDF2_ITERATIONS = 310000;

export async function deriveKeys(
  passphrase: string,
  saltHex: string
): Promise<VaultKeys> {
  // 1. passphrase → PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  // 2. PBKDF2 → 256 bits master
  // Copy into a fresh ArrayBuffer so the BufferSource type narrows cleanly.
  const saltSource = hexToUint8Array(saltHex);
  const saltBuf = new ArrayBuffer(saltSource.byteLength);
  new Uint8Array(saltBuf).set(saltSource);
  const masterBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  // 3. master bits → HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    masterBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );
  // 4. three sub-keys with versioned info strings
  const fileKey = await deriveSubKey(hkdfKey, "interligens-vault-files-v1");
  const noteKey = await deriveSubKey(hkdfKey, "interligens-vault-notes-v1");
  const metaKey = await deriveSubKey(hkdfKey, "interligens-vault-meta-v1");
  return { fileKey, noteKey, metaKey };
}

async function deriveSubKey(
  hkdfKey: CryptoKey,
  info: string
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable — required for JWK export into sessionStorage
    ["encrypt", "decrypt"]
  );
}

// encryptBuffer: returns [IV(12) || ciphertext+tag]
export async function encryptBuffer(
  buffer: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    buffer
  );
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result.buffer;
}

export async function decryptBuffer(
  encryptedBuffer: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(encryptedBuffer.slice(0, 12));
  const ciphertext = encryptedBuffer.slice(12);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    ciphertext
  );
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey
): Promise<{ enc: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    enc: arrayBufferToBase64(ct),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

export async function decryptString(
  enc: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ivBytes = new Uint8Array(base64ToArrayBuffer(iv));
  const ctBytes = base64ToArrayBuffer(enc);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    key,
    ctBytes
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptTags(
  tags: string[],
  key: CryptoKey
): Promise<{ enc: string; iv: string }> {
  return encryptString(JSON.stringify(tags), key);
}

export async function decryptTags(
  enc: string,
  iv: string,
  key: CryptoKey
): Promise<string[]> {
  const json = await decryptString(enc, iv, key);
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// NDA hash — standalone, before keys are derived
export async function hashNdaDocument(ndaText: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ndaText)
  );
  return arrayBufferToHex(buf);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToHex(bytes.buffer);
}
