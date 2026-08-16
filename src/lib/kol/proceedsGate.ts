// src/lib/kol/proceedsGate.ts
//
// P0 — CONTAINMENT DES PROCEEDS : le point de filtrage UNIQUE.
//
// Ce module décide d'une seule chose : ce profil publie-t-il encore un chiffre
// de proceeds ? Toutes les surfaces qui affichent un montant — API, écrans,
// agrégats, PDF, contexte LLM — passent par ici. Un seul endroit à relire, un
// seul endroit à tester.
//
// ─── POURQUOI PAS publishStatus ───────────────────────────────────────────
//
// Dépublier le profil retirerait AUSSI le nom, le tier, les liens, les
// wallets et les preuves. Or la décision prise ici est étroite et précise :
// « nous ne publions plus CE MONTANT, parce qu'il n'est pas adossé à une
// observation primaire ». Le reste du dossier n'est pas en cause. Un
// interrupteur dédié dit exactement ce qui a été décidé — un interrupteur
// large dirait autre chose, et serait irréversible en pratique (il n'existe
// aucun chemin outillé published → draft → published).
//
// ─── POURQUOI PAS totalDocumented = NULL ──────────────────────────────────
//
// Ce serait une SUPPRESSION. La doctrine du chantier l'interdit : tout est
// conservé, y compris ce qui est retiré de la publication. La valeur reste en
// base, lisible en admin et par toute réinvestigation ; seul son statut de
// publication bascule, et la bascule est journalisée dans
// KolProceedsPublicationLog avec son motif, son acteur et la valeur figée.
//
// ─── FAIL-CLOSED, ET POURQUOI ─────────────────────────────────────────────
//
// isProceedsPublished rend `true` UNIQUEMENT sur la valeur exacte 'published'.
// undefined (le champ n'a pas été sélectionné dans la requête Prisma), null,
// chaîne vide, valeur inconnue : tout cela est traité comme RETIRÉ.
//
// C'est délibéré et c'est le sens du chantier. Le mode de défaillance le plus
// probable ici est l'oubli : une nouvelle surface qui lit totalDocumented sans
// sélectionner proceedsPublication. En fail-open, cet oubli republierait
// silencieusement un chiffre retiré — c'est-à-dire exactement l'incident qu'on
// est en train de contenir. En fail-closed, l'oubli fait disparaître un chiffre
// qui aurait pu rester : c'est visible, ça se corrige, et ça ne publie rien.
//
//     UNKNOWN ≠ SAFE · NO DATA ≠ NO RISK
//
// La même doctrine s'applique aux montants eux-mêmes : `redactProceeds` rend
// `null`, jamais `0`. Zéro est une AFFIRMATION (« cette personne n'a rien
// encaissé »), null est une ABSENCE (« nous ne publions pas de chiffre »). Sur
// une plateforme qui note des personnes, confondre les deux est une faute.

/** Les deux seuls états de publication d'un chiffre de proceeds. */
export const PROCEEDS_PUBLICATION_STATES = ["published", "withdrawn"] as const;
export type ProceedsPublicationState = (typeof PROCEEDS_PUBLICATION_STATES)[number];

/** Portées possibles d'une décision de retrait. Alignées sur le CHECK SQL. */
export const PROCEEDS_SCOPES = ["profile_total", "summary", "event", "involvement"] as const;
export type ProceedsScope = (typeof PROCEEDS_SCOPES)[number];

/**
 * Motifs de décision. Volontairement IDENTIQUES à PUBLICATION_DECISION_CODES
 * (src/lib/watcher-bridge/linkPublicationJournal.ts) : les deux registres
 * doivent rester agrégeables ensemble pour répondre à « qu'a-t-on décidé au
 * sujet de cette personne ? ». Doit rester aligné sur le CHECK
 * KolProceedsPublicationLog_reasonCode_allowed.
 */
export const PROCEEDS_DECISION_CODES = [
  "approved",
  "rejected",
  "contested",
  "erratum",
  "evidence_withdrawn",
  "legal",
  "duplicate",
  "other",
] as const;
export type ProceedsDecisionCode = (typeof PROCEEDS_DECISION_CODES)[number];

export function isProceedsDecisionCode(v: string): v is ProceedsDecisionCode {
  return (PROCEEDS_DECISION_CODES as readonly string[]).includes(v);
}

/** Forme minimale exigée d'un profil pour décider. */
export interface ProceedsPublicationCarrier {
  proceedsPublication?: string | null;
}

/**
 * Le seul prédicat. `true` sur la valeur exacte 'published', sinon `false`.
 *
 * Voir « fail-closed » en tête de fichier : ne pas sélectionner la colonne
 * revient à retirer le chiffre, pas à le publier.
 */
export function isProceedsPublished(profile: ProceedsPublicationCarrier | null | undefined): boolean {
  return profile?.proceedsPublication === "published";
}

/**
 * Filtre Prisma pour les AGRÉGATS (leaderboard, explorer) — les endroits où
 * l'on somme des montants sans passer par un objet profil individuel. Doit être
 * étalé dans le `where`, à côté de PUBLIC_KOL_FILTER.
 *
 *   where: { ...PUBLIC_KOL_FILTER, ...PUBLISHED_PROCEEDS_FILTER }
 */
export const PUBLISHED_PROCEEDS_FILTER = {
  proceedsPublication: "published" as const,
};

/** À étaler dans un `select` Prisma partout où un montant sera rendu. */
export const PROCEEDS_PUBLICATION_SELECT = {
  proceedsPublication: true as const,
};

/**
 * Rend le montant, ou `null` si sa publication est retirée.
 *
 * `null`, jamais `0` : voir l'exposé en tête de fichier. Les appelants qui
 * testent `(x ?? 0) > 0` se comportent correctement sans modification — le
 * bloc disparaît au lieu d'afficher « 0 $ ».
 */
export function redactProceeds<T extends number | null | undefined>(
  profile: ProceedsPublicationCarrier | null | undefined,
  value: T,
): number | null {
  if (!isProceedsPublished(profile)) return null;
  return value ?? null;
}

/**
 * Somme une collection en n'additionnant QUE les montants encore publiés.
 *
 * Sert aux agrégats de dossier (Explorer) et de classement (leaderboard), où
 * un filtre Prisma ne suffit pas parce que la somme se fait en mémoire après
 * un regroupement par handle.
 */
export function sumPublishedProceeds<T extends ProceedsPublicationCarrier>(
  rows: readonly T[],
  pick: (row: T) => number | null | undefined,
): number {
  let total = 0;
  for (const row of rows) {
    if (!isProceedsPublished(row)) continue;
    total += pick(row) ?? 0;
  }
  return total;
}

/**
 * Motif de refus rendu par les surfaces qui servent un DOCUMENT entier bâti
 * autour du montant (dossier PDF, réponse dédiée aux proceeds) plutôt qu'un
 * champ isolé. Un 404 dirait « cette personne n'existe pas » ; un 409 avec ce
 * code dit ce qui s'est réellement passé, et reste vrai pour un auditeur.
 */
export const PROCEEDS_WITHDRAWN_CODE = "proceeds_withdrawn" as const;

export const PROCEEDS_WITHDRAWN_DETAIL =
  "The published proceeds figure for this profile has been withdrawn pending " +
  "re-verification against primary on-chain observations. The underlying data " +
  "is retained; the decision is recorded in KolProceedsPublicationLog.";
