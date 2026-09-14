// ─── BUILD 9 / ÉTAPE 6 — L'AUDIT D'INTÉGRITÉ D'UN DOSSIER ──────────────────
//
// ██  Ce module lit des colonnes INTERNES. Il ne rend jamais de contenu.    ██
//
// `canonicalReader` est la frontière publique : il ne SÉLECTIONNE même pas les
// identifiants de ligne, pour que rien ne fuie par un spread distrait. L'audit
// a besoin du contraire — les versions, les sceaux, toutes les révisions, y
// compris supplantées.
//
// Les deux ne peuvent donc pas être le même lecteur, et la séparation est la
// garantie : ce qui sort d'ici est une liste de CONSTATS — un type, un claim,
// une version, un nom de champ. Jamais un titre, jamais une description.
//
// Un rapport d'intégrité qui cite ce qu'il a trouvé republie ce qu'il signale.
//
// ─── Pourquoi il lit TOUTES les versions ──────────────────────────────────
//
// Le lecteur public rend la dernière version. Un audit d'immuabilité qui ne
// regarderait que la dernière raterait exactement ce qu'il cherche : une
// version supplantée modifiée après coup. Le passé est ce qui doit être
// immuable ; le présent, lui, a le droit de changer — en créant une version.

//
// ─── La matière scellée n'est pas composée ici ────────────────────────────
//
// SPINE-00 · B : la normalisation ligne → matière scellée que ce module
// appliquait (et que les 16 sceaux persistés vérifient, 16/16) vit désormais
// dans `versioning.canonicalSealMaterial`. L'audit la CONSOMME, il ne la
// redéfinit pas — sinon il pourrait dériver de l'écrivain, et crier à
// l'altération sur des lignes que personne n'a touchées.

import { prisma } from "@/lib/prisma";
import {
  auditClaims,
  canonicalSealMaterial,
  summarizeFindings,
  type AuditableClaim,
  type IntegrityFinding,
  type IntegrityFindingKind,
} from "./versioning";

/** Les colonnes lues pour l'audit. Énumérées, jamais `SELECT *`. */
interface AuditRow {
  claimId: string;
  version: number;
  contentHash: string | null;
  title: string;
  titleFr: string | null;
  description: string | null;
  descriptionFr: string | null;
  category: string | null;
  severity: string | null;
  status: string | null;
  claimDate: Date | null;
  actors: unknown;
  threadUrl: string | null;
  evidenceRefs: unknown;
}

export interface IntegrityReport {
  readonly ref: string;
  /** Nombre de RÉVISIONS examinées, toutes versions confondues. */
  readonly revisionsExaminees: number;
  readonly sourcesAuRegistre: number;
  readonly constats: readonly IntegrityFinding[];
  readonly resume: Record<IntegrityFindingKind, number>;
}

/**
 * Audite un dossier. Lecture seule, aucune écriture, aucun appel réseau.
 *
 * Un dossier absent rend `null` — l'audit d'un dossier qui n'existe pas n'est
 * pas une panne, c'est une réponse.
 */
export async function auditCaseFileIntegrity(ref: string): Promise<IntegrityReport | null> {
  const existe = await prisma.tokenCaseFile.findUnique({
    where: { ref },
    select: { ref: true },
  });
  if (!existe) return null;

  const [sourceRows, claimRows] = await Promise.all([
    prisma.$queryRaw<{ sourceId: string }[]>`
      SELECT "sourceId" FROM "CaseFileSource" WHERE "casefileRef" = ${ref}`,
    prisma.$queryRaw<AuditRow[]>`
      SELECT "claimId", version, "contentHash", title, "titleFr", description,
             "descriptionFr", category, severity, status, "claimDate", actors,
             "threadUrl", "evidenceRefs"
        FROM "CaseFileClaim" WHERE "casefileRef" = ${ref}
       ORDER BY "claimId" ASC, version ASC`,
  ]);

  const registre = new Set(sourceRows.map((s) => s.sourceId));
  const claims: AuditableClaim[] = claimRows.map((r) => ({
    ...canonicalSealMaterial(r),
    version: r.version,
    contentHash: r.contentHash,
  }));

  const constats = auditClaims(claims, registre);
  return {
    ref,
    revisionsExaminees: claims.length,
    sourcesAuRegistre: registre.size,
    constats,
    resume: summarizeFindings(constats),
  };
}
