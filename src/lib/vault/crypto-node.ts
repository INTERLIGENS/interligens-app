// Server-safe helpers. This file contains NO decryption logic for vault
// content. It only decodes base64 length so we can validate IV width (12
// bytes) before persisting a note. The server never, under any
// circumstance, decrypts note / file / title / tag ciphertext.

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    return new ArrayBuffer(0);
  }
}
