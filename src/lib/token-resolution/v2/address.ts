// ─── Adresses — validation et normalisation uniques ────────────────────────
// Le repo porte aujourd'hui TROIS regex base58 concurrentes pour le même
// concept (recensé R0, 2026-08-26) :
//   src/lib/token-resolution/normalizeSolanaMint.ts  → SOL_MINT_RE
//   src/app/api/scan/resolve/route.ts                → isScanableAddress (gelé)
//   src/lib/shill-correlation/buyers.ts              → looksLikeSolanaMint
// La V2 n'en porte qu'une par chaîne. Les trois autres restent en place tant
// que leurs modules ne sont pas basculés — ce fichier ne les modifie pas.
//
// Règles non négociables, héritées des chemins existants :
//   • base58 est CASE-SENSITIVE — ne JAMAIS abaisser la casse d'un mint Solana
//     ni d'une adresse Tron (l'alphabet exclut 0/O/I/l).
//   • l'hexadécimal EVM est case-insensitive — normalisé en minuscules, sinon
//     la même adresse produit deux candidats distincts.
//   • les semis éditoriaux posent des marqueurs ("PENDING_OSINT_…", "TBD",
//     "TODO") dans contractAddress. Les renvoyer scannerait un token qui
//     n'existe pas → 500 côté public. Ils sont rejetés ici, une fois pour toutes.

import { type CanonicalChain, isEvmChain } from "./chain";

const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Identifiant de token Hyperliquid (spotMeta) — 0x + 32 hex, ce n'est PAS une adresse EVM. */
const HYPER_TOKEN_ID_RE = /^0x[a-fA-F0-9]{32}$/;

// Marqueurs éditoriaux réellement présents en base : "PENDING:BREAD"
// (KolTokenLink, relevé le 2026-08-26) et la forme "PENDING_OSINT_…" que
// documente le résolveur du scan. \b ne convient PAS : « _ » est un caractère
// de mot, donc "PENDING_OSINT_TOES" ne déclenche aucune frontière de mot et
// passerait au travers. On exige simplement que le marqueur ne soit pas suivi
// d'un alphanumérique, ce qui laisse passer ':' , '_' , '-' et la fin de chaîne.
const PLACEHOLDER_RE = /^(PENDING|TBD|TODO|UNKNOWN|N\/?A)(?![A-Za-z0-9])/i;

export interface NormalizedAddress {
  valid: boolean;
  /** Adresse normalisée prête à servir de clé d'identité, ou null. */
  address: string | null;
  /** Chaîne déduite de la seule FORME, quand elle est déductible sans ambiguïté. */
  inferredChain: CanonicalChain | null;
  /** Mint pump.fun (suffixe littéral "pump") — signal de fraîcheur, pas de validité. */
  isPumpFun: boolean;
  reason?: string;
}

const INVALID = (reason: string): NormalizedAddress => ({
  valid: false,
  address: null,
  inferredChain: null,
  isPumpFun: false,
  reason,
});

/**
 * Normalise une adresse pour une chaîne CONNUE.
 * La chaîne commande le format : une même chaîne de caractères peut être une
 * adresse Tron valide ET du base58 Solana valide (34 chars), d'où l'ordre de
 * test dans inferAddressShape ci-dessous et l'exigence d'une chaîne explicite ici.
 */
export function normalizeAddress(
  raw: string | null | undefined,
  chain: CanonicalChain,
): NormalizedAddress {
  const t = (raw ?? "").trim();
  if (!t) return INVALID("empty");
  if (PLACEHOLDER_RE.test(t)) return INVALID("placeholder");

  if (chain === "SOL") {
    if (!SOL_MINT_RE.test(t)) return INVALID("not_base58_32_44");
    return { valid: true, address: t, inferredChain: "SOL", isPumpFun: t.endsWith("pump") };
  }

  if (chain === "TRON") {
    if (!TRON_ADDRESS_RE.test(t)) return INVALID("not_tron_base58_34");
    return { valid: true, address: t, inferredChain: "TRON", isPumpFun: false };
  }

  if (isEvmChain(chain)) {
    if (!EVM_ADDRESS_RE.test(t)) return INVALID("not_evm_hex_40");
    return { valid: true, address: t.toLowerCase(), inferredChain: chain, isPumpFun: false };
  }

  return INVALID("unsupported_chain");
}

/**
 * Déduit la chaîne à partir de la seule forme, pour les lignes dont la colonne
 * chain vaut "unknown" (17 en prod) ou une valeur non mappée.
 *
 * ORDRE SIGNIFICATIF : Tron avant Solana. Une adresse Tron ("T" + 33 base58)
 * satisfait aussi SOL_MINT_RE ; l'inverse est faux. Tester Solana d'abord
 * classerait toutes les adresses Tron en Solana — c'est l'ordre déjà retenu par
 * le routeur REFLEX (src/lib/reflex/inputRouter.ts), on ne diverge pas.
 *
 * L'hex EVM ne dit PAS de quelle chaîne EVM il s'agit : on renvoie null en
 * inferredChain et evmAmbiguous=true. Deviner "ETH" ici fabriquerait une
 * identité fausse pour un token Base ou BSC.
 */
export interface AddressShape {
  kind: "sol" | "tron" | "evm" | "hyper_token_id" | "none";
  inferredChain: CanonicalChain | null;
  evmAmbiguous: boolean;
  normalized: string | null;
  isPumpFun: boolean;
}

export function inferAddressShape(raw: string | null | undefined): AddressShape {
  const t = (raw ?? "").trim();
  const none: AddressShape = {
    kind: "none",
    inferredChain: null,
    evmAmbiguous: false,
    normalized: null,
    isPumpFun: false,
  };
  if (!t || PLACEHOLDER_RE.test(t)) return none;

  if (TRON_ADDRESS_RE.test(t)) {
    return { kind: "tron", inferredChain: "TRON", evmAmbiguous: false, normalized: t, isPumpFun: false };
  }
  if (EVM_ADDRESS_RE.test(t)) {
    return {
      kind: "evm",
      inferredChain: null,
      evmAmbiguous: true,
      normalized: t.toLowerCase(),
      isPumpFun: false,
    };
  }
  if (HYPER_TOKEN_ID_RE.test(t)) {
    return {
      kind: "hyper_token_id",
      inferredChain: "HYPER",
      evmAmbiguous: false,
      normalized: t.toLowerCase(),
      isPumpFun: false,
    };
  }
  if (SOL_MINT_RE.test(t)) {
    return {
      kind: "sol",
      inferredChain: "SOL",
      evmAmbiguous: false,
      normalized: t,
      isPumpFun: t.endsWith("pump"),
    };
  }
  return none;
}

/** Raccourci de lisibilité — équivaut à normalizeAddress(raw, chain).valid. */
export function isValidAddress(raw: string | null | undefined, chain: CanonicalChain): boolean {
  return normalizeAddress(raw, chain).valid;
}

/** true si la valeur est un marqueur éditorial ("PENDING_OSINT_…", "TBD"…). */
export function isPlaceholderAddress(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  return !!t && PLACEHOLDER_RE.test(t);
}

/**
 * Liste ordonnée et dédupliquée des adresses exploitables d'un texte/champ,
 * chacune accompagnée de sa forme. Conserve l'ordre d'arrivée : la première
 * adresse d'un post est, empiriquement, celle que le KOL pousse.
 */
export function extractAddressShapes(
  addresses: string[] | null | undefined,
): Array<{ raw: string; shape: AddressShape }> {
  const out: Array<{ raw: string; shape: AddressShape }> = [];
  const seen = new Set<string>();
  for (const a of addresses ?? []) {
    const shape = inferAddressShape(a);
    if (shape.kind === "none" || !shape.normalized) continue;
    const key = `${shape.kind}:${shape.normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ raw: String(a).trim(), shape });
  }
  return out;
}

/** Clé d'identité d'un candidat. Stable, insensible à la casse d'affichage. */
export function identityKey(chain: CanonicalChain, address: string): string {
  return `${chain}:${isEvmChain(chain) ? address.toLowerCase() : address}`;
}
