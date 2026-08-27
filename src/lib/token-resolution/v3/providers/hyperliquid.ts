// ─── Adapter Hyperliquid ───────────────────────────────────────────────────
// Absorbe le cas de bord que /api/resolve/hyper-token traitait seul, sans
// partager la moindre primitive avec le reste du produit (recensé R0).
//
// Un tokenId Hyperliquid (0x + 32 hex) n'EST PAS une adresse EVM (0x + 40 hex) :
// il faut un aller-retour spotMeta pour obtenir le contrat EVM correspondant.
// La réponse spotMeta est un catalogue complet — un seul appel sert donc tous
// les identifiants d'une exécution, d'où un cache long et une clé unique.

import { normalizeAddress } from "../address";
import { cleanTicker } from "../symbol";
import { instrumentedCall } from "./instrument";
import type { ProviderContext } from "./types";

const SPOT_META_URL = "https://api.hyperliquid.xyz/info";
const TTL_MS = 30 * 60 * 1000;

interface SpotToken {
  tokenId?: string;
  evmContract?: string | { address?: string } | null;
  name?: string;
}

export interface HyperToken {
  tokenId: string;
  evmAddress: string;
  name: string | null;
}

function contractAddress(t: SpotToken): string | null {
  const c = t.evmContract;
  if (!c) return null;
  if (typeof c === "string") return c;
  return c.address ?? null;
}

/** Catalogue spotMeta complet, en cache. Un appel par exécution au maximum. */
async function spotMeta(ctx: ProviderContext): Promise<SpotToken[]> {
  return instrumentedCall<SpotToken[]>(ctx, "hyperliquid", "hyperliquid:spotMeta", TTL_MS, [], async () => {
    const res = await ctx.http.postJson(SPOT_META_URL, { type: "spotMeta" });
    if (!res.ok) return [];
    return ((res.json as { tokens?: SpotToken[] } | null)?.tokens ?? []) as SpotToken[];
  });
}

/** tokenId Hyperliquid → contrat EVM. null quand le catalogue ne le porte pas. */
export async function hyperliquidResolveTokenId(
  ctx: ProviderContext,
  tokenId: string,
): Promise<HyperToken | null> {
  const id = (tokenId ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{32}$/.test(id)) return null;
  const tokens = await spotMeta(ctx);
  const match = tokens.find((t) => (t.tokenId ?? "").toLowerCase() === id);
  if (!match) return null;
  const raw = contractAddress(match);
  if (!raw) return null;
  const norm = normalizeAddress(raw, "HYPER");
  if (!norm.valid || !norm.address) return null;
  return { tokenId: id, evmAddress: norm.address, name: cleanTicker(match.name) || null };
}
