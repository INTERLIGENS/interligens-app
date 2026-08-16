// src/lib/token/holderConcentration.ts
//
// Concentration des détenteurs — part du supply tenue par les 10 plus gros
// PORTEFEUILLES, courbes de bonding et pools exclus.
//
// ─── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────
//
// `/api/v1/score` lisait cette donnée sur `https://public-api.solscan.io/token/
// holders`. Ce point d'accès est MORT : sonde du 2026-08-16, **HTTP 404** en
// 0,16 s. Il ne renvoyait donc plus jamais rien, et le code faisait
// `if (!res.ok) return null` sans un log.
//
// Conséquence sur le moteur (src/lib/tigerscore/engine.ts), `top10_holder_pct`
// valant toujours `null` :
//
//     holders_concentrated_80  (>80 % du supply)  +15  — ne se déclenche jamais
//     holders_concentrated_60  (>60 % du supply)  +10  — ne se déclenche jamais
//     cluster_risk (≥3 signaux forts)             +10  — se déclenche moins
//
// Mesuré sur les 84 tokens du corpus sondés en production le 2026-08-16 :
// `topHolderPct` valait `null` dans **84 réponses sur 84**.
//
// ─── LE PIÈGE, ET POURQUOI IL EST DISQUALIFIANT ───────────────────────────
//
// `getTokenLargestAccounts` rend les plus gros COMPTES DE TOKENS. Sur Solana,
// la courbe de bonding pump.fun, un pool Raydium / Orca / Meteora, un vault de
// staking ou un escrow sont eux aussi des comptes de tokens — et ce sont
// presque toujours les plus gros. Les compter comme des « détenteurs » produit
// une concentration proche de 100 % sur des tokens où AUCUNE personne ne
// détient quoi que ce soit.
//
// Première passe de mesure, avant ce correctif : 70 des 94 tokens lisibles
// au-dessus de 80 %, dont **10 exactement à 100 %**. Exemple vérifié
// (OLTSESON, `2WnQohaM…pump`) : le compte n°1 détient 958 881 801 tokens, soit
// 99,9 % du supply, et son propriétaire est une PDA du programme
// `pAMMBay6oc…` — l'AMM pump.fun. Le n°17 appartient à `LBUZKhRxPF…`, Meteora
// DLMM. Livrer un verdict RED là-dessus serait un verdict fondé sur un
// artefact de méthode, sur un produit dont l'argument est la reproductibilité.
//
// ─── LA RÈGLE DE CLASSIFICATION ───────────────────────────────────────────
//
// Elle est déterministe et ne repose sur AUCUNE liste de programmes à tenir à
// jour — une liste manquerait le prochain AMM :
//
//   1. `getTokenLargestAccounts` → jusqu'à 20 comptes de tokens.
//   2. `getMultipleAccounts(jsonParsed)` sur ces comptes → le champ
//      `parsed.info.owner`, c'est-à-dire l'autorité qui contrôle le compte.
//   3. `getMultipleAccounts` sur ces autorités → le PROPRIÉTAIRE de leur
//      propre compte.
//
//        autorité détenue par le System Program (1111…1111), non exécutable
//          → PORTEFEUILLE. Compte dans la concentration.
//        autorité détenue par un autre programme, ou exécutable
//          → PDA / compte de programme. EXCLU, et le programme est nommé.
//        compte d'autorité ABSENT de la chaîne
//          → INDÉTERMINÉ. Voir la règle de refus ci-dessous.
//
// ─── LA RÈGLE DE REFUS : UN ENCADREMENT, PAS UN SEUIL ─────────────────────
//
// Un compte indéterminé n'est pas un portefeuille par défaut. Mais le rejeter
// en bloc serait tout aussi arbitraire : mesuré sur le corpus, la part
// indéterminée vaut 0,16 % à 5,13 % par compte, soit bien trop peu pour faire
// franchir un seuil de 60 % ou 80 % à un top 10 qui vaut 0,1 %.
//
// On encadre donc, au lieu de deviner :
//
//     borne basse = les inconnus sont TOUS des programmes  (top10 mesuré)
//     borne haute = les inconnus sont TOUS des portefeuilles
//
// Si les deux bornes tombent dans la MÊME bande de signal, la conclusion ne
// dépend pas de la nature des inconnus : on conclut, en publiant la borne
// basse (la conservatrice) et les deux bornes pour vérification.
//
// Si elles enjambent un seuil, la conclusion DÉPEND d'une hypothèse : le
// module refuse. `available: false`, l'appelant passe `holders_unavailable`,
// la confiance tombe à « Low » et le motif est nommé — au lieu de rendre un
// verdict que personne ne pourrait défendre.
//
//     UNKNOWN ≠ SAFE · NO DATA ≠ NO RISK · et surtout, sur ce produit :
//     un chiffre indéfendable est pire que pas de chiffre.

/** Propriétaire de tout compte utilisateur ordinaire. */
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/** `getTokenLargestAccounts` en rend au plus 20 ; on classe les 20 pour
 *  pouvoir garder les 10 premiers PORTEFEUILLES après exclusion. */
const FETCH_N = 20;
const TOP_N = 10;
const RPC_TIMEOUT_MS = 8_000;

/**
 * Les deux seuils du moteur (engine.ts). Ils définissent trois bandes, et
 * c'est la BANDE qui compte : deux chiffres différents dans la même bande
 * produisent le même signal, donc la même conclusion.
 */
const BAND_HIGH = 80;
const BAND_MED = 60;

/** Bande de signal d'une concentration. */
function band(pct: number): "high" | "med" | "none" {
  if (pct > BAND_HIGH) return "high";
  if (pct > BAND_MED) return "med";
  return "none";
}

/** Programmes reconnus — sert UNIQUEMENT à nommer l'exclusion dans la sortie.
 *  La classification, elle, ne dépend pas de cette table. */
const KNOWN_PROGRAMS: Record<string, string> = {
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pump.fun bonding curve",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "pump.fun AMM",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "Raydium CLMM",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpool",
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: "Meteora DLMM",
  Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: "Meteora Pools",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token",
};

export type HolderClass = "wallet" | "program" | "unknown";

export type HolderConcentration =
  | {
      available: true;
      /**
       * Part du supply détenue par les 10 plus gros PORTEFEUILLES, en %,
       * 1 décimale. Les comptes de programme sont exclus du numérateur ; le
       * dénominateur reste le supply total. Le chiffre ne peut donc que
       * baisser par rapport à un comptage naïf — jamais monter.
       */
      top10Pct: number;
      top1Pct: number;
      top3Pct: number;
      /** Part du supply immobilisée dans des programmes (courbe, pools, vaults). */
      programHeldPct: number;
      /** Part du supply dont le porteur n'a pas pu être classé. */
      unknownHeldPct: number;
      /**
       * Encadrement de `top10Pct`. `top10PctMax` est la valeur qu'il
       * prendrait si TOUS les comptes indéterminés étaient des portefeuilles.
       * Les deux bornes sont dans la même bande de signal, sinon ce résultat
       * n'aurait pas été produit.
       */
      top10PctMax: number;
      /** Programmes exclus, nommés quand ils sont connus. */
      excludedPrograms: string[];
      source: "helius" | "solana_public_rpc";
      /** Nombre de PORTEFEUILLES réellement additionnés (0 à 10). */
      walletsCounted: number;
      /** Comptes examinés avant classification. */
      accountsExamined: number;
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

type AccountInfo = { owner?: unknown; executable?: unknown } | null;

/**
 * Classe une autorité de compte de tokens.
 *
 * `null` en entrée = le compte de l'autorité n'existe pas sur la chaîne. Ce
 * n'est PAS un portefeuille par défaut : une PDA jamais financée en lamports
 * se présente exactement ainsi. On rend `unknown`, et la règle de refus
 * décidera si cela empêche de conclure.
 */
export function classifyOwner(info: AccountInfo): { cls: HolderClass; program: string | null } {
  if (!info || typeof info.owner !== "string") return { cls: "unknown", program: null };
  if (info.executable === true) return { cls: "program", program: info.owner };
  if (info.owner === SYSTEM_PROGRAM) return { cls: "wallet", program: null };
  return { cls: "program", program: info.owner };
}

function programLabel(programId: string): string {
  return KNOWN_PROGRAMS[programId] ?? programId;
}

/**
 * Concentration des 10 plus gros portefeuilles, ou un refus explicite.
 *
 * Ne lève jamais. Tout échec — réseau, 429, schéma modifié, supply nulle,
 * classification non fiable — devient `{ available: false, reason }`, jamais
 * un pourcentage par défaut et jamais `0`.
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

      const accounts = (largest as { value?: Array<{ address?: unknown; uiAmount?: unknown }> })
        ?.value;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        failures.push(`${ep.source}:no_holders`);
        continue;
      }

      const total = toAmount(
        (supply as { value?: { uiAmount?: unknown } })?.value?.uiAmount,
      );
      // Une supply nulle ou illisible rend le pourcentage indéfini. On refuse
      // plutôt que de diviser et de rendre 0, Infinity ou NaN — NaN serait le
      // pire des trois : toute comparaison avec lui est false, donc le seuil de
      // concentration cesserait d'exister sans rien signaler.
      if (!(total > 0)) {
        failures.push(`${ep.source}:no_supply`);
        continue;
      }

      const examined = accounts
        .slice(0, FETCH_N)
        .map((a) => ({ address: typeof a?.address === "string" ? a.address : null, amount: toAmount(a?.uiAmount) }))
        .filter((a): a is { address: string; amount: number } => a.address !== null);
      if (examined.length === 0) {
        failures.push(`${ep.source}:no_addresses`);
        continue;
      }

      // ── Étape 2 : de qui ces comptes de tokens dépendent-ils ? ────────────
      const parsed = (await rpc(ep.url, "getMultipleAccounts", [
        examined.map((a) => a.address),
        { encoding: "jsonParsed" },
      ])) as { value?: Array<{ data?: { parsed?: { info?: { owner?: unknown } } } } | null> };
      const authorities = (parsed?.value ?? []).map((v) => {
        const o = v?.data?.parsed?.info?.owner;
        return typeof o === "string" ? o : null;
      });

      // ── Étape 3 : ces autorités sont-elles des portefeuilles ? ────────────
      const distinct = [...new Set(authorities.filter((a): a is string => a !== null))];
      const authInfo = new Map<string, AccountInfo>();
      if (distinct.length > 0) {
        const owned = (await rpc(ep.url, "getMultipleAccounts", [
          distinct,
          { encoding: "base64" },
        ])) as { value?: Array<AccountInfo> };
        distinct.forEach((addr, i) => authInfo.set(addr, owned?.value?.[i] ?? null));
      }

      // ── Classification ───────────────────────────────────────────────────
      let programHeld = 0;
      let unknownHeld = 0;
      const wallets: number[] = [];
      const unknownAmounts: number[] = [];
      const excluded = new Set<string>();

      for (let i = 0; i < examined.length; i++) {
        const auth = authorities[i] ?? null;
        const { cls, program } = classifyOwner(auth === null ? null : authInfo.get(auth) ?? null);
        if (cls === "wallet") wallets.push(examined[i].amount);
        else if (cls === "program") {
          programHeld += examined[i].amount;
          if (program) excluded.add(programLabel(program));
        } else {
          unknownHeld += examined[i].amount;
          unknownAmounts.push(examined[i].amount);
        }
      }

      const pctOf = (v: number) => Math.min(100, Math.round((v / total) * 1000) / 10);
      const unknownPct = pctOf(unknownHeld);

      wallets.sort((a, b) => b - a);
      const top = wallets.slice(0, TOP_N);
      const held = top.reduce((s, v) => s + v, 0);

      // ── Encadrement ──────────────────────────────────────────────────────
      // Borne haute : les indéterminés comptent tous comme des portefeuilles.
      const optimistic = [...wallets, ...unknownAmounts].sort((a, b) => b - a).slice(0, TOP_N);
      const heldMax = optimistic.reduce((s, v) => s + v, 0);
      const lo = pctOf(held);
      const hi = pctOf(heldMax);

      // ── Règle de refus ───────────────────────────────────────────────────
      // On refuse UNIQUEMENT quand la conclusion dépend de la nature des
      // comptes indéterminés — c'est-à-dire quand les deux bornes ne tombent
      // pas dans la même bande de signal.
      if (band(lo) !== band(hi)) {
        failures.push(
          `${ep.source}:holder_classification_ambiguous(top10 entre ${lo}% et ${hi}%, ` +
            `bandes ${band(lo)}/${band(hi)}, inconnu=${unknownPct}%)`,
        );
        continue;
      }

      return {
        available: true,
        // 0 est ici une MESURE, pas un défaut : « les 10 plus gros
        // portefeuilles ne détiennent rien, tout est dans la courbe ». Le cas
        // est distingué du refus par `available: true`.
        top10Pct: lo,
        top10PctMax: hi,
        top1Pct: pctOf(top[0] ?? 0),
        top3Pct: pctOf(top.slice(0, 3).reduce((s, v) => s + v, 0)),
        programHeldPct: pctOf(programHeld),
        unknownHeldPct: unknownPct,
        excludedPrograms: [...excluded],
        source: ep.source,
        walletsCounted: top.length,
        accountsExamined: examined.length,
      };
    } catch (err) {
      failures.push(`${ep.source}:${err instanceof Error ? err.message : "error"}`);
    }
  }

  // Aucune source n'a permis de conclure. On le DIT — c'est ce marqueur qui
  // manquait, et c'est lui qui fait tomber la confiance à « Low ».
  const reason = failures.join(" | ") || "no_endpoint";
  console.warn(`[holderConcentration] indisponible pour ${mint} — ${reason}`);
  return { available: false, reason };
}
