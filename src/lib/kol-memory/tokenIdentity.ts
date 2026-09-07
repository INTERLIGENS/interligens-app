// ─── BUILD 8 / DÉCISION 3 — L'IDENTITÉ D'UN TOKEN, UNE SEULE ───────────────
//
// ██  Un mint est une identité on-chain. Une clé de route est une chaîne     ██
// ██  d'URL. Les confondre a produit DEUX BOTIFY dans le même produit.       ██
//
// ─── Ce qui a été mesuré ───────────────────────────────────────────────────
//
// Deux constantes coexistaient, à un caractère près, dans deux modules qui
// servent le MÊME écran :
//
//   src/lib/kol/handleToMint.ts   BOTIFY_MINT   = BYZ9…UnZac[ja4]…Th69xb   43 car.
//   src/lib/kol/proceeds.ts       CA_MAP.BOTIFY = BYZ9…UnZac[ija4]…Th69xb  44 car.
//
// Comptage sur ep-square-band, 2026-09-07, en lecture seule :
//
//                                    44 car.   43 car.
//     KolProceedsEvent.tokenAddress      262         0
//     KolTokenLink.contractAddress         5         0
//     KolTokenInvolvement.tokenMint        3         0
//
// Le 43 caractères n'existe dans AUCUNE ligne de la base. Il n'a jamais été un
// mint : c'est une clé de route synthétique, née côté casefile/démo. BUILD 7
// l'a déjà canonicalisé dans ce sens ; ce module rend la décision exécutoire.
//
// Or `/en/kol/[handle]`, `/fr/kol/[handle]` et `/api/casefile` résolvaient sur
// le 43. Le lien casefile d'une fiche pointait donc vers une identité que rien
// ne porte, à côté d'un chiffre de proceeds calculé sur l'autre.
//
// ─── La règle, exactement ──────────────────────────────────────────────────
//
//   · Le 44 caractères EST le mint. Tout consommateur de mint l'utilise.
//   · Le 43 caractères survit UNIQUEMENT comme clé de route interne, dans un
//     type distinct, et n'est JAMAIS accepté là où un mint est attendu.
//   · Le passage de l'un à l'autre est explicite, nommé, et unidirectionnel.
//
// La séparation est portée par le TYPE autant que par la fonction : un
// `SyntheticRouteKey` ne se substitue pas à un `TokenMint` par inadvertance.

/** Le mint BOTIFY canonique — 44 caractères, présent en base, on-chain. */
export const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";

/**
 * La clé de route synthétique historique — 43 caractères, ZÉRO ligne en base.
 *
 * Conservée parce que des URLs, des snapshots d'anti-régression et des
 * artefacts de casefile la portent déjà : la supprimer casserait des liens
 * existants sans rien corriger. Elle est ici pour être RECONNUE et REFUSÉE,
 * pas pour être utilisée.
 */
export const BOTIFY_SYNTHETIC_ROUTE_KEY = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";

/** Marqueur de type : une chaîne validée comme mint. */
export type TokenMint = string & { readonly __brand: "TokenMint" };

/** Marqueur de type : une clé de route, jamais un mint. */
export type SyntheticRouteKey = string & { readonly __brand: "SyntheticRouteKey" };

/** Alphabet base58 Bitcoin/Solana — sans 0, O, I, l. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Longueurs admises pour un mint Solana. */
const MINT_MIN_LEN = 32;
const MINT_MAX_LEN = 44;

export class SyntheticKeyAsMintError extends Error {
  constructor(where: string) {
    super(
      `[kol-memory] identité de token refusée (${where}) : la clé de route ` +
        `synthétique BOTIFY (${BOTIFY_SYNTHETIC_ROUTE_KEY.length} caractères) a été ` +
        "présentée là où un mint est attendu. Elle n'existe dans aucune ligne " +
        `de la base ; le mint canonique est ${BOTIFY_MINT} (${BOTIFY_MINT.length} caractères).`,
    );
    this.name = "SyntheticKeyAsMintError";
  }
}

export class InvalidMintError extends Error {
  constructor(where: string, value: unknown, reason: string) {
    super(
      `[kol-memory] identité de token refusée (${where}) : ${reason} — ` +
        `${JSON.stringify(typeof value === "string" ? value.slice(0, 60) : value)}.`,
    );
    this.name = "InvalidMintError";
  }
}

/** Reconnaît la clé de route synthétique. C'est le seul endroit qui la nomme. */
export function isSyntheticRouteKey(value: unknown): value is SyntheticRouteKey {
  return value === BOTIFY_SYNTHETIC_ROUTE_KEY;
}

/**
 * Un mint valide : base58, longueur Solana, ET pas la clé synthétique.
 *
 * L'ordre des refus n'est pas neutre. La clé synthétique EST du base58 de
 * 43 caractères — elle passe toutes les vérifications de forme. Seul un refus
 * NOMMÉ l'arrête, et c'est pour ça qu'il existe.
 */
export function isTokenMint(value: unknown): value is TokenMint {
  if (typeof value !== "string") return false;
  if (isSyntheticRouteKey(value)) return false;
  if (value.length < MINT_MIN_LEN || value.length > MINT_MAX_LEN) return false;
  return BASE58.test(value);
}

/**
 * LE point de passage. Toute valeur qui prétend être un mint traverse ici.
 *
 * Lève plutôt que de rendre `null` : un appelant qui reçoit `null` peut
 * l'ignorer, un appelant qui reçoit une exception ne le peut pas. C'est la
 * différence entre un garde-fou et une suggestion.
 */
export function assertTokenMint(value: unknown, where: string): TokenMint {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidMintError(where, value, "valeur absente ou non textuelle");
  }
  if (isSyntheticRouteKey(value)) {
    throw new SyntheticKeyAsMintError(where);
  }
  if (value.length < MINT_MIN_LEN || value.length > MINT_MAX_LEN) {
    throw new InvalidMintError(
      where,
      value,
      `longueur ${value.length} hors bornes Solana [${MINT_MIN_LEN}, ${MINT_MAX_LEN}]`,
    );
  }
  if (!BASE58.test(value)) {
    throw new InvalidMintError(where, value, "caractères hors alphabet base58");
  }
  return value as TokenMint;
}

/**
 * Traduction explicite clé de route → mint canonique. Unidirectionnelle.
 *
 * Il n'existe volontairement AUCUNE fonction inverse : un mint ne se
 * « dégrade » pas en clé de route. La route legacy peut résoudre vers
 * l'identité réelle ; l'identité réelle n'a aucune raison de repartir vers
 * une chaîne que la base ne connaît pas.
 */
export function canonicalMintForRouteKey(key: string): TokenMint | null {
  return isSyntheticRouteKey(key) ? (BOTIFY_MINT as TokenMint) : null;
}

/**
 * Normalise une entrée qui peut être l'une ou l'autre. Le seul endroit du
 * produit autorisé à accepter les deux — et il rend toujours le mint.
 */
export function resolveToCanonicalMint(value: unknown, where: string): TokenMint {
  if (isSyntheticRouteKey(value)) return BOTIFY_MINT as TokenMint;
  return assertTokenMint(value, where);
}

// ─── Handle → mint ─────────────────────────────────────────────────────────
//
// Reprise à l'identique de `src/lib/kol/handleToMint.ts`, à une chose près :
// la constante est la bonne. La LISTE n'est pas touchée — l'arbitrage exclut
// toute nouvelle investigation BOTIFY, et modifier qui est dans cette liste
// serait une affirmation nominative nouvelle, pas une correction d'identité.
//
// Cette liste reste une AFFIRMATION ÉDITORIALE codée en dur, sans provenance
// ni chemin de revue. Le constat est au backlog ; il n'est pas traité ici.

const BOTIFY_KOLS = new Set<string>([
  "kokoski",
  "bkokoski",
  "gordongekko",
  "GordonGekko",
  "gordon",
  "sxyz500",
  "lynk0x",
  "planted",
  "DonWedge",
  "donwedge",
]);

/**
 * Handle → mint canonique, ou `null` si le handle n'est lié à aucun cas connu.
 * Les appelants DOIVENT traiter `null`.
 *
 * Le corps est celui de `kolHandleToMint`, au caractère près — y compris
 * l'absence de `trim()` et de retrait du `@`. Corriger la constante et la
 * tolérance d'entrée dans le même geste rendrait impossible d'attribuer un
 * changement de résolution à l'un ou à l'autre. Seule l'identité change.
 */
export function kolHandleToCanonicalMint(handle: string | null | undefined): TokenMint | null {
  if (!handle) return null;
  // Match both the exact handle and its lower-cased form so seed data that
  // writes "GordonGekko" still resolves when a URL passes "gordongekko".
  if (BOTIFY_KOLS.has(handle)) return BOTIFY_MINT as TokenMint;
  if (BOTIFY_KOLS.has(handle.toLowerCase())) return BOTIFY_MINT as TokenMint;
  return null;
}
