// ─── Adapter Helius (RPC Solana) ───────────────────────────────────────────
// Une seule question posée : « ce compte est-il un mint SPL ? »
// C'est le filet du cas le plus dangereux du produit — un token lancé il y a
// dix minutes, déjà poussé par un KOL, pas encore indexé par le moindre
// agrégateur de marché. DexScreener répond « inconnu » ; la chaîne, elle, sait.
//
// L'appel est CONDITIONNEL et mis en cache : il ne part que si DexScreener
// n'a rien, et une seule fois par mint et par exécution. Sans clé configurée,
// l'adapter répond « indéterminé » au lieu d'échouer — l'absence de clé n'est
// pas une preuve d'inexistence, et confondre les deux ferait disparaître des
// tokens réels.

import type { ProviderContext } from "./types";

const TTL_MS = 30 * 60 * 1000; // l'existence d'un mint ne se défait pas

export type MintExistence = "exists" | "absent" | "unknown";

function heliusUrl(apiKey: string): string {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

/**
 * "exists"  : le compte existe et son data parsé est de type "mint" (SPL ou Token-2022)
 * "absent"  : la chaîne a répondu, le compte n'existe pas ou n'est pas un mint
 * "unknown" : pas de clé, ou appel en échec — aucune conclusion possible
 */
export async function heliusMintExists(
  ctx: ProviderContext,
  mint: string,
): Promise<MintExistence> {
  const apiKey = ctx.env.heliusApiKey;
  if (!apiKey) return "unknown";
  const key = `helius:mint:${mint}`;
  return ctx.cache.wrap(key, TTL_MS, async () => {
    ctx.telemetry.heliusCalls++;
    const res = await ctx.http.postJson(heliusUrl(apiKey), {
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "jsonParsed" }],
    });
    if (!res.ok) return "unknown" as MintExistence;
    const parsed = (
      res.json as {
        result?: { value?: { data?: { parsed?: { type?: string } } } | null };
        error?: unknown;
      } | null
    );
    if (!parsed || parsed.error) return "unknown" as MintExistence;
    const value = parsed.result?.value;
    if (value === null) return "absent" as MintExistence;
    return (value?.data?.parsed?.type === "mint" ? "exists" : "absent") as MintExistence;
  });
}
