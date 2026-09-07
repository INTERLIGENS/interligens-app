// ─── BUILD 9 / ÉTAPE 7 — LA VUE INTERNE D'UN DOSSIER ───────────────────────
//
// ██  Surface ADMIN. Elle voit tout le dossier — mais elle DIT ce qu'elle voit. ██
//
// ─── Trois vues, une autorité ─────────────────────────────────────────────
//
//   PublicProjection   ce qui est publiable, plus les avis de retrait
//   InternalCaseView   le dossier ENTIER, chaque claim portant son ÉTAT
//   IntegrityReport    des constats, jamais du contenu
//
// `/api/casefile` est authentifiée (SEC P0, `checkAuth` toujours exigé). Elle
// n'est donc pas une projection publique : lui appliquer le filtre PUBLIC
// rendrait zéro claim à un opérateur qui a précisément besoin de voir ce qui
// n'est pas publié. Elle reçoit le dossier entier.
//
// Mais « tout voir » n'autorise pas « ne rien dire » : chaque claim rendu ici
// porte `state`. Sans lui, un opérateur lirait huit assertions sans pouvoir
// distinguer celles qui sont publiables de celles qui sont seulement
// rattachées — et c'est exactement la confusion que BUILD 9 démonte.
//
// ─── Ce que cette vue ne rend pas ─────────────────────────────────────────
//
// Le lecteur canonique ne sélectionne ni identifiants de ligne, ni sceau, ni
// `localFilePath`. La vue interne ne peut donc pas les rendre : elle n'y a pas
// accès. Admin ne veut pas dire « tout », il veut dire « tout le dossier ».

import type { CanonicalCaseFile, PublicClaim } from "./canonicalReader";

/** Un claim tel que la surface admin le reçoit. */
export interface InternalClaim {
  readonly id: string;
  readonly topic: string;
  readonly claim: string | null;
  /** CONFIRMED | UNCONFIRMED | DISPUTED — le statut d'enquête. */
  readonly status: string;
  /** ATTACHED | ADMISSIBLE | PUBLIC — l'état d'artefact. Jamais déduit. */
  readonly state: string;
  readonly evidence: readonly InternalEvidence[];
  /** Les références citées que le registre ne connaît pas. Jamais masquées. */
  readonly unresolved_refs: readonly string[];
}

export interface InternalEvidence {
  readonly type: string;
  readonly ref: string;
  readonly caption: string | null;
  readonly captured_at: string | null;
  readonly source_url: string | null;
  readonly sha256: string | null;
}

export interface InternalCaseView {
  readonly ref: string;
  readonly symbol: string;
  readonly name: string;
  /** `null` = score non établi. Jamais 0 par défaut. */
  readonly tiger_score: number | null;
  readonly verdict: string;
  readonly claims: readonly InternalClaim[];
  readonly sources: readonly InternalEvidence[];
}

function toEvidence(s: {
  sourceId: string; sourceType: string; caption: string | null;
  capturedAt: string | null; sourceUrl: string | null; sha256: string | null;
}): InternalEvidence {
  return {
    type: s.sourceType,
    ref: s.sourceId,
    caption: s.caption,
    // L'horodatage rendu est celui de la CAPTURE. Jamais celui du rendu.
    captured_at: s.capturedAt,
    source_url: s.sourceUrl,
    sha256: s.sha256,
  };
}

function toClaim(c: PublicClaim): InternalClaim {
  const p = c.provenance;
  return {
    id: c.claimId,
    topic: c.title,
    claim: c.description,
    status: c.status ?? "Referenced",
    state: c.state,
    evidence: (p?.sources ?? []).map(toEvidence),
    unresolved_refs: p?.unresolvedRefs ?? [],
  };
}

/**
 * Le dossier canonique, dans la forme que la surface admin attend.
 *
 * Aucune donnée n'est complétée : ce que l'autorité ne porte pas rend `null`
 * ou une liste vide. Un `keyWallets` vide sur BOTIFY est ATTENDU — le dossier
 * ne porte aucun bloc de wallets on-chain, et en fabriquer un pour remplir la
 * forme serait exactement ce que l'étape 7 supprime.
 */
export function toInternalCaseView(dossier: CanonicalCaseFile): InternalCaseView {
  return {
    ref: dossier.ref,
    symbol: dossier.ticker.replace(/^\$/, ""),
    name: dossier.codename,
    tiger_score: dossier.tigerScore,
    verdict: dossier.verdict,
    claims: dossier.claims.map(toClaim),
    sources: dossier.sources.map(toEvidence),
  };
}
