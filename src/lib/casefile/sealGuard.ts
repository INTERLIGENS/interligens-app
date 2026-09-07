// ─── BUILD 9 — ON NE RÉÉCRIT PAS UNE VERSION SCELLÉE ───────────────────────
//
// ██  Une assertion ne se corrige pas. Elle est SUPPLANTÉE.                 ██
//
// ─── La propriété que ce module rend exécutable ───────────────────────────
//
// L'étape 6 a posé le sceau et l'audit : une modification en place se DÉTECTE.
// Détecter, c'est constater après coup. Ce module refuse AVANT.
//
//     « Aucune correction légitime ne réécrit SILENCIEUSEMENT une version
//       scellée. »
//
// Le mot qui compte est *silencieusement*. Corriger est parfaitement légitime
// — c'est même ce qu'on veut, quand une assertion est mal formulée. Ce qui ne
// l'est pas, c'est de le faire par-dessus la version scellée : le sceau ne
// prouve plus rien, et l'assertion d'hier devient irrécupérable.
//
// La voie légitime crée une version N+1 qui SUPPLANTE la précédente. L'ancienne
// reste, avec son sceau intact, et l'historique du dossier reste lisible.
//
// ─── Pourquoi un refus, alors que l'audit détecte déjà ────────────────────
//
// Parce que l'audit tourne quand on le lance, et qu'une réécriture silencieuse
// se remarque d'autant moins qu'elle est ancienne. Un refus à l'écriture ne
// dépend de personne.

import { claimContentHash, type SealableClaim } from "./versioning";

/** L'état d'une révision de claim, tel qu'on peut le comparer. */
export interface SealedRevision extends SealableClaim {
  readonly version: number;
  /** `null` = jamais scellé. Une absence, jamais une accusation. */
  readonly contentHash?: string | null;
}

export class SilentRewriteError extends Error {
  constructor(claimId: string, version: number) {
    super(
      `[casefile] réécriture refusée : le claim ${claimId} v${version} est scellé, ` +
        "et son contenu change sans que la version soit incrémentée. Une assertion " +
        "ne se corrige pas — elle est supplantée par une version N+1 qui la référence. " +
        "L'ancienne reste, avec son sceau intact.",
    );
    this.name = "SilentRewriteError";
  }
}

export class BrokenSealError extends Error {
  constructor(claimId: string, version: number) {
    super(
      `[casefile] version ${version} du claim ${claimId} : le sceau ne correspond ` +
        "pas au contenu. La ligne a été modifiée en place APRÈS son scellement. " +
        "Aucune écriture n'est possible avant d'avoir établi ce qui a changé.",
    );
    this.name = "BrokenSealError";
  }
}

/**
 * Vérifie qu'une révision scellée porte bien son contenu.
 *
 * `contentHash` absent rend `false` sans lever : « jamais scellé » n'est pas
 * « altéré », et confondre les deux transformerait une absence en accusation.
 */
export function isSealIntact(r: SealedRevision): boolean {
  return !!r.contentHash && claimContentHash(r) === r.contentHash;
}

/**
 * LE refus. À appeler avant toute écriture sur un claim existant.
 *
 * Trois issues, et une seule est une erreur de forme :
 *
 *   contenu inchangé            → rien à dire, l'écriture ne touche pas au fond
 *   contenu changé, version +   → supplantation légitime, autorisée
 *   contenu changé, même version→ REFUS, c'est une réécriture silencieuse
 *
 * Une révision non scellée n'est pas protégée par ce garde : il n'y a rien à
 * comparer. C'est la raison pour laquelle le scellement doit être fait, et pas
 * seulement possible.
 */
export function assertNoSilentRewrite(
  avant: SealedRevision,
  apres: SealedRevision,
): void {
  // Le sceau de la ligne EXISTANTE doit d'abord tenir. S'il ne tient pas, la
  // ligne a déjà été modifiée en place, et autoriser une écriture par-dessus
  // effacerait la trace de la première.
  if (avant.contentHash && !isSealIntact(avant)) {
    throw new BrokenSealError(avant.claimId, avant.version);
  }

  const contenuChange = claimContentHash(avant) !== claimContentHash(apres);
  if (!contenuChange) return;

  if (apres.version <= avant.version) {
    throw new SilentRewriteError(avant.claimId, avant.version);
  }
}

/**
 * Le SQL d'une supplantation. RENDU, jamais exécuté.
 *
 * `INSERT` d'une version N+1 qui référence l'ancienne par `supersedes`. Aucun
 * `UPDATE` sur la ligne scellée : c'est tout le point.
 *
 * Le sceau de la nouvelle version est calculé ICI, par la même implémentation
 * que partout ailleurs. Deux implémentations d'un même sceau devraient
 * s'accorder à l'octet près, et la première divergence ferait crier à
 * l'altération sur des lignes que personne n'a touchées.
 */
export function renderSupersedeSql(
  casefileRef: string,
  avant: SealedRevision,
  apres: SealableClaim,
): string {
  const q = (s: string): string => "'" + s.replace(/'/g, "''") + "'";
  const nul = (s: string | null | undefined): string => (s == null ? "NULL" : q(s));
  const v = avant.version + 1;
  const h = claimContentHash({ ...apres, claimId: avant.claimId });

  return [
    `-- Supplantation du claim ${avant.claimId} : v${avant.version} → v${v}`,
    "-- RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.",
    "--",
    "-- AUCUN UPDATE sur la version scellée. Elle reste, avec son sceau intact.",
    "-- L'état de publication de la nouvelle version est ATTACHED : une",
    "-- reformulation ne se publie pas d'elle-même, elle se re-décide.",
    "BEGIN;",
    `INSERT INTO "CaseFileClaim"`,
    `  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",`,
    `   category, severity, status, "claimDate", "threadUrl", "evidenceRefs",`,
    `   version, supersedes, "contentHash", "rowNature", state)`,
    `SELECT ${q(casefileRef)}, ${q(avant.claimId)}, ${q(apres.title)}, ${nul(apres.titleFr)},`,
    `       ${nul(apres.description)}, ${nul(apres.descriptionFr)}, ${nul(apres.category)},`,
    `       ${nul(apres.severity)}, ${nul(apres.status)}, ${apres.claimDate ? q(apres.claimDate) + "::date" : "NULL"},`,
    `       ${nul(apres.threadUrl)}, ${q(JSON.stringify(apres.evidenceRefs ?? []))}::jsonb,`,
    `       ${v}, c.id, ${q(h)}, NULL, 'ATTACHED'`,
    `  FROM "CaseFileClaim" c`,
    ` WHERE c."casefileRef" = ${q(casefileRef)} AND c."claimId" = ${q(avant.claimId)}`,
    `   AND c.version = ${avant.version}`,
    `ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;`,
    "COMMIT;",
    "",
    "-- ─── POST-CHECKS ──────────────────────────────────────────────────────",
    `-- 1 · la version ${avant.version} est INTACTE. ATTENDU : 1 ligne, sceau inchangé`,
    `SELECT version, "contentHash" FROM "CaseFileClaim"`,
    ` WHERE "casefileRef" = ${q(casefileRef)} AND "claimId" = ${q(avant.claimId)}`,
    ` ORDER BY version;`,
    "",
    `-- 2 · la nouvelle version référence bien l'ancienne. ATTENDU : 1`,
    `SELECT count(*) AS chainee FROM "CaseFileClaim" n`,
    `  JOIN "CaseFileClaim" a ON a.id = n.supersedes`,
    ` WHERE n."casefileRef" = ${q(casefileRef)} AND n."claimId" = ${q(avant.claimId)}`,
    `   AND n.version = ${v} AND a.version = ${avant.version};`,
    "",
    "-- 3 · relancer l'audit : CONTENT_MUTATED et VERSION_GAP doivent valoir 0.",
    "--     auditCaseFileIntegrity(ref) — src/lib/casefile/integrityAudit.ts",
  ].join("\n");
}
