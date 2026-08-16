// src/lib/token/holderConcentration.ts
//
// Concentration des détenteurs — top 10 en % du supply.
//
// ─── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────
//
// `/api/v1/score` lisait cette donnée sur `https://public-api.solscan.io/token/
// holders`. Ce point d'accès est MORT : sonde du 2026-08-16, **HTTP 404** en
// 0,16 s. Il ne renvoyait donc plus jamais rien, et le code faisait
// `if (!res.ok) return null` sans un log.
//
// Conséquence sur le moteur (src/lib/tigerscore/engine.ts:241-253, 291-294),
// `top10_holder_pct` valant toujours `null` :
//
//     holders_concentrated_80  (>80 % du supply)  +15  — ne se déclenche jamais
//     holders_concentrated_60  (>60 % du supply)  +10  — ne se déclenche jamais
//     cluster_risk (≥3 signaux forts)             +10  — se déclenche moins
//
// Un token dont le top 10 détient 95 % du supply était noté EXACTEMENT comme un
// token parfaitement distribué. Sans erreur, sans log, sans marqueur dans la
// réponse, et avec une confiance inchangée. C'est la forme la plus dangereuse
// de défaillance sur ce produit : pas une panne visible, une conclusion fausse.
//
// ─── LES DEUX MOITIÉS DU CORRECTIF ────────────────────────────────────────
//
// 1. La source. On interroge le RPC Solana — `getTokenLargestAccounts` pour les
//    plus gros comptes, `getTokenSupply` pour le dénominateur. Helius d'abord
//    (clé déjà provisionnée, quotas connus), repli sur le RPC public. Ce sont
//    les deux fournisseurs que `/api/casefile` utilise déjà : aucune nouvelle
//    dépendance, aucun nouveau coût.
//
// 2. Le comportement quand elle est indisponible. Corriger la source ne suffit
//    pas — elle retombera un jour. Ce module ne rend donc JAMAIS un `null` nu :
//    il rend un résultat DISCRIMINÉ. L'appelant ne peut pas confondre
//    « concentration mesurée à 12 % » avec « nous n'avons pas pu mesurer ».
//
//        UNKNOWN ≠ SAFE · NO DATA ≠ NO RISK

/** `getTokenLargestAccounts` rend au plus 20 comptes ; on garde les 10 premiers. */
const TOP_N = 10;
const RPC_TIMEOUT_MS = 5_000;

export type HolderConcentration =
  | {
      available: true;
      /** Part du supply détenue par les 10 plus gros comptes, en %, 1 décimale. */
      top10Pct: number;
      /** Idem pour le plus gros compte seul. */
      top1Pct: number;
      /** Idem pour les trois plus gros. */
      top3Pct: number;
      source: "helius" | "solana_public_rpc";
      /** Nombre de comptes réellement additionnés (< 10 si le token en a moins). */
      holdersCounted: number;
    }
  | {
      available: false;
      /** Motif, destiné au log et au marqueur `dataQuality` de la réponse. */
      reason: string;
    };

type RpcEndpoint = { url: string; source: "helius" | "solana_public_rpc" };

function endpoints(): RpcEndpoint[] {
  const list: RpcEndpoint[] = [];
  const key = process.env.HELIUS_API_KEY;
  // Chaîne vide = ABSENTE. `process.env.X ?? ""` rendrait une URL sans clé, que
  // Helius refuse en 401 — on perdrait le fournisseur principal en silence.
  if (typeof key === "string" && key.length > 0) {
    list.push({ url: `https://mainnet.helius-rpc.com/?api-key=${key}`, source: "helius" });
  }
  list.push({ url: "https://api.mainnet-beta.solana.com", source: "solana_public_rpc" });
  return list;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  // `res.ok` d'abord : un 429 ou un 500 rend un corps JSON d'erreur dont
  // `.result` est `undefined`, ce qui passerait pour « le token n'a aucun
  // détenteur ». C'est le défaut exact du client Helius de proceeds.ts:38-47.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "rpc error");
  if (json.result === undefined || json.result === null) throw new Error("empty result");
  return json.result;
}

function toAmount(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    // Lecture stricte : une chaîne partiellement numérique est un
    // provisionnement raté, pas une valeur. Même doctrine que envNumber.ts.
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Concentration du top 10, ou un refus explicite.
 *
 * Ne lève jamais. Tout échec — réseau, 429, schéma modifié, supply nulle,
 * aucun détenteur — devient `{ available: false, reason }`, jamais un
 * pourcentage par défaut et jamais `0`.
 */
export async function fetchTop10HolderPct(mint: string): Promise<HolderConcentration> {
  if (!mint || typeof mint !== "string") {
    return { available: false, reason: "invalid_mint" };
  }

  const failures: string[] = [];

  for (const ep of endpoints()) {
    try {
      const [largest, supply] = await Promise.all([
        rpc(ep.url, "getTokenLargestAccounts", [mint]),
        rpc(ep.url, "getTokenSupply", [mint]),
      ]);

      const accounts = (largest as { value?: Array<{ uiAmount?: unknown; amount?: unknown }> })
        ?.value;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        failures.push(`${ep.source}:no_holders`);
        continue;
      }

      const total = toAmount(
        (supply as { value?: { uiAmount?: unknown; amount?: unknown } })?.value?.uiAmount,
      );
      // Une supply nulle ou illisible rend le pourcentage indéfini. On refuse
      // plutôt que de diviser et de rendre 0, Infinity ou NaN — NaN serait le
      // pire des trois : toute comparaison avec lui est false, donc le seuil de
      // concentration cesserait d'exister sans rien signaler.
      if (!(total > 0)) {
        failures.push(`${ep.source}:no_supply`);
        continue;
      }

      const top = accounts.slice(0, TOP_N);
      const amounts = top.map((a) => toAmount(a?.uiAmount));
      const held = amounts.reduce((sum, v) => sum + v, 0);
      if (!(held > 0)) {
        failures.push(`${ep.source}:zero_balances`);
        continue;
      }

      // Le supply peut avoir bougé entre les deux appels, ou des comptes gelés
      // peuvent dépasser le circulant. On borne à 100 plutôt que de publier un
      // « top 10 = 103 % » qui décrédibiliserait toute la mesure.
      const pctOf = (v: number) => Math.min(100, Math.round((v / total) * 1000) / 10);

      return {
        available: true,
        top10Pct: pctOf(held),
        top1Pct: pctOf(amounts[0] ?? 0),
        top3Pct: pctOf(amounts.slice(0, 3).reduce((s2, v) => s2 + v, 0)),
        source: ep.source,
        holdersCounted: top.length,
      };
    } catch (err) {
      failures.push(`${ep.source}:${err instanceof Error ? err.message : "error"}`);
    }
  }

  // Aucune source n'a répondu. On le DIT — c'est ce marqueur qui manquait.
  const reason = failures.join(" | ") || "no_endpoint";
  console.warn(`[holderConcentration] indisponible pour ${mint} — ${reason}`);
  return { available: false, reason };
}
