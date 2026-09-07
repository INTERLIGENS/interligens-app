/**
 * src/lib/kol/handleToMint.ts
 *
 * ─── BUILD 8 / D3 — CE MODULE EST DEVENU UNE DÉLÉGATION ───────────────────
 *
 * ██  L'autorité vit désormais dans src/lib/kol-memory/tokenIdentity.ts.    ██
 *
 * Ce qu'il portait, et pourquoi c'était faux :
 *
 *   `BOTIFY_MINT` valait ici une chaîne de 43 caractères (…UnZac**ja4**…)
 *   tandis que `CA_MAP.BOTIFY` dans src/lib/kol/proceeds.ts en portait une de
 *   44 (…UnZac**ija4**…). Deux identités à un caractère près, servant le MÊME
 *   écran : la fiche KOL affichait un lien casefile résolu sur l'une, à côté
 *   d'un chiffre de proceeds calculé sur l'autre.
 *
 *   Comptage sur ep-square-band, 2026-09-07, en lecture seule :
 *
 *                                      44 car.   43 car.
 *       KolProceedsEvent.tokenAddress      262         0
 *       KolTokenLink.contractAddress         5         0
 *       KolTokenInvolvement.tokenMint        3         0
 *
 *   Le 43 caractères n'existe dans AUCUNE ligne. Il n'a jamais été un mint :
 *   c'est une clé de route synthétique, née côté casefile/démo.
 *
 * La règle est désormais mécanique : le 44 EST le mint, le 43 survit comme
 * clé de route dans un TYPE distinct et n'est jamais accepté là où un mint est
 * attendu. Voir kol-memory/tokenIdentity.ts.
 *
 * Ce fichier ne décide plus rien : il réexporte.
 */

import {
  BOTIFY_MINT as CANONICAL_BOTIFY_MINT,
  kolHandleToCanonicalMint,
} from "@/lib/kol-memory/tokenIdentity";

export {
  BOTIFY_SYNTHETIC_ROUTE_KEY,
  isTokenMint,
  isSyntheticRouteKey,
  assertTokenMint,
  canonicalMintForRouteKey,
  resolveToCanonicalMint,
} from "@/lib/kol-memory/tokenIdentity";

/**
 * Le mint BOTIFY — 44 caractères, celui que la base porte réellement.
 *
 * ⚠️ La valeur a CHANGÉ : elle était de 43 caractères jusqu'à BUILD 8. Tout
 * appelant qui comparait cette constante à une chaîne codée en dur doit être
 * relu — c'est précisément le défaut qu'on ferme.
 */
export const BOTIFY_MINT: string = CANONICAL_BOTIFY_MINT;

/**
 * Returns the primary token mint for the given KOL handle, or null if the
 * handle is not mapped to a known case. Callers MUST handle null.
 *
 * @deprecated Utiliser `kolHandleToCanonicalMint` de
 * `@/lib/kol-memory/tokenIdentity`. Le corps est identique au caractère près —
 * seule l'identité rendue est corrigée.
 */
export function kolHandleToMint(handle: string | null | undefined): string | null {
  return kolHandleToCanonicalMint(handle);
}
