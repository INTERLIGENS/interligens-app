// ─── E5 — l'identité d'un token est (chain, contract) ──────────────────────
//
// RÈGLE, sans exception : l'égalité de symbole n'est JAMAIS une preuve
// d'identité.
//
// Un symbole est une étiquette que n'importe qui peut coller sur n'importe quel
// contrat, gratuitement, en trente secondes. C'est précisément le mécanisme des
// tokens imitateurs que ce produit existe pour attraper. Un résolveur qui
// traite « même symbole » comme « même token » ne se contente pas d'être
// imprécis : il valide l'attaque.
//
// Conséquences tenues ici :
//   • deux contrats portant le même symbole sont DEUX TOKENS, jamais un token
//     avec deux avis. On ne les fusionne pas, on ne « choisit » pas le plus
//     liquide en silence ;
//   • cette situation produit un conflit d'identité, et un conflit d'identité
//     interdit RESOLVED et interdit HIGH ;
//   • la seule chose qui tranche une identité, c'est un contrat : fourni par
//     l'appelant (explicit_ca), ou attesté par une source qui lie explicitement
//     ce symbole à CE contrat.
//
// La fonction assertContractIdentity ci-dessous est l'invariant exécutable de
// cette règle. Elle est utilisée à la fois par les tests du résolveur réel et
// par le MUTANT (voir __tests__/mutants/) : si quelqu'un réintroduit un
// jour un aiguillage « même symbole ⇒ même token », le mutant cesse de violer
// l'invariant et son test devient rouge.

import { identityKey } from "./address";
import { normalizeSymbol } from "./symbol";
import type { ResolutionConflict, TokenCandidate, TokenResolution } from "./types";

/** Identités distinctes présentes dans une liste, par symbole normalisé. */
export function groupIdentitiesBySymbol(
  candidates: TokenCandidate[],
): Map<string, TokenCandidate[]> {
  const bySymbol = new Map<string, TokenCandidate[]>();
  for (const c of candidates) {
    const s = normalizeSymbol(c.symbol);
    if (!s) continue;
    const list = bySymbol.get(s) ?? [];
    list.push(c);
    bySymbol.set(s, list);
  }
  return bySymbol;
}

/**
 * Détecte les collisions d'identité de contrat.
 *
 * `settledByContract` : identités dont le contrat a été fourni par l'appelant.
 * Quand l'utilisateur colle une adresse, l'identité est déjà tranchée — la
 * présence d'homonymes ailleurs n'en fait pas un conflit d'identité (elle peut
 * en revanche produire un ticker_vs_address, traité séparément).
 */
export function detectContractIdentityConflicts(
  candidates: TokenCandidate[],
  settledByContract: ReadonlySet<string>,
): ResolutionConflict[] {
  const out: ResolutionConflict[] = [];
  const live = candidates.filter((c) => !c.excluded);
  if (settledByContract.size > 0) return out;

  for (const [symbol, group] of groupIdentitiesBySymbol(live)) {
    const identities = new Set(group.map((c) => identityKey(c.chain, c.address)));
    if (identities.size < 2) continue;
    const chains = new Set(group.map((c) => c.chain));
    out.push({
      kind: "contract_identity",
      detail:
        `${identities.size} contrats distincts portent le symbole $${symbol}` +
        (chains.size > 1 ? ` sur ${chains.size} chaînes` : "") +
        " — le symbole n'identifie pas un token, seul le contrat le fait",
      between: Array.from(identities).sort(),
    });
  }
  return out;
}

/**
 * Invariant exécutable de E5.
 * Lève si une résolution prétend avoir identifié un token alors que plusieurs
 * contrats distincts portaient le symbole retenu et qu'aucun contrat n'avait
 * été fourni. Utilisé en test sur le résolveur réel ET sur le mutant.
 */
export function assertContractIdentity(
  result: Pick<TokenResolution, "status" | "confidence" | "selected" | "candidates" | "conflicts">,
  settledByContract: ReadonlySet<string> = new Set(),
): void {
  if (result.status !== "RESOLVED" || !result.selected) return;
  if (settledByContract.has(identityKey(result.selected.chain, result.selected.address))) return;

  const symbol = normalizeSymbol(result.selected.symbol);
  if (!symbol) return;

  const rivals = new Set(
    result.candidates
      .filter((c) => !c.excluded)
      .filter((c) => normalizeSymbol(c.symbol) === symbol)
      .map((c) => identityKey(c.chain, c.address)),
  );

  if (rivals.size >= 2) {
    throw new Error(
      "VIOLATION E5 — résolution servie comme certaine alors que " +
        `${rivals.size} contrats distincts portent le symbole $${symbol} : ` +
        Array.from(rivals).sort().join(" | ") +
        ". L'égalité de symbole n'est jamais une preuve d'identité.",
    );
  }
}

/** true si un conflit d'identité de contrat interdit toute résolution. */
export function hasBlockingIdentityConflict(conflicts: ResolutionConflict[]): boolean {
  return conflicts.some((c) => c.kind === "contract_identity");
}
