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

import { prisma } from "@/lib/prisma";
import {
  auditClaims,
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

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

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
    claimId: r.claimId,
    version: r.version,
    contentHash: r.contentHash,
    title: r.title,
    titleFr: r.titleFr,
    description: r.description,
    descriptionFr: r.descriptionFr,
    category: r.category,
    severity: r.severity,
    status: r.status,
    claimDate: iso(r.claimDate),
    actors: asStrings(r.actors),
    threadUrl: r.threadUrl,
    evidenceRefs: asStrings(r.evidenceRefs),
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
