// @client-only — never import in API routes or server components
//
// Derived keys live in sessionStorage as JWK so they survive client-side
// route transitions but never touch the network and die with the tab.

import type { VaultKeys } from "./crypto.client";

const SK = {
  file: "ivault_fk",
  note: "ivault_nk",
  meta: "ivault_mk",
} as const;

export async function setVaultSession(keys: VaultKeys): Promise<void> {
  const [fj, nj, mj] = await Promise.all([
    crypto.subtle.exportKey("jwk", keys.fileKey),
    crypto.subtle.exportKey("jwk", keys.noteKey),
    crypto.subtle.exportKey("jwk", keys.metaKey),
  ]);
  sessionStorage.setItem(SK.file, JSON.stringify(fj));
  sessionStorage.setItem(SK.note, JSON.stringify(nj));
  sessionStorage.setItem(SK.meta, JSON.stringify(mj));
}

export async function getVaultSession(): Promise<VaultKeys | null> {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const fj = sessionStorage.getItem(SK.file);
    const nj = sessionStorage.getItem(SK.note);
    const mj = sessionStorage.getItem(SK.meta);
    if (!fj || !nj || !mj) return null;
    const imp = (raw: string) =>
      crypto.subtle.importKey(
        "jwk",
        JSON.parse(raw),
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
    const [fileKey, noteKey, metaKey] = await Promise.all([
      imp(fj),
      imp(nj),
      imp(mj),
    ]);
    return { fileKey, noteKey, metaKey };
  } catch {
    return null;
  }
}

export function clearVaultSession(): void {
  if (typeof sessionStorage === "undefined") return;
  Object.values(SK).forEach((k) => sessionStorage.removeItem(k));
}
