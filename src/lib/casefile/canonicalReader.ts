// ─── BUILD 9 / ÉTAPE 5 — LIRE LE DOSSIER DEPUIS L'AUTORITÉ CANONIQUE ───────
//
// ██  Le renderer ne FABRIQUE ni n'INTERPRÈTE la provenance. Il la rend.    ██
//
// ─── Le gate que ce module tient ──────────────────────────────────────────
//
// « Aucun claim public démontré ne perd SILENCIEUSEMENT son fondement
//   probatoire entre le stockage canonique et le rendu public. »
//
// Le mot qui compte est *silencieusement*. Un claim peut parfaitement être
// publié sans preuve visible — mais alors il doit le DIRE, pas laisser croire
// qu'il en a une. D'où `provenance: null` explicite plutôt qu'un champ absent.
//
// ─── Ce qui a rendu ce module nécessaire ──────────────────────────────────
//
// Mesuré le 2026-09-07 : le type `CaseFileClaim` du renderer ne porte ni
// `evidence_refs` ni `thread_url`. Le PDF interne rendait donc ID, sévérité,
// titre, date, catégorie — et laissait tomber exactement ce qui démontre le
// claim. Une assertion démontrable publiée sans son fondement est plus fragile
// qu'une assertion prudente : elle a l'air soutenue.
//
// ─── Frontière de données internes ────────────────────────────────────────
//
// `localFilePath`, `sessionId`, `notes` et les identifiants de ligne ne
// sortent JAMAIS. L'auditabilité publique se fait sur une URL et une
// empreinte, pas sur l'arborescence de la machine qui a capté la pièce.
//
// Le module ne SÉLECTIONNE même pas ces colonnes : ce qui n'est pas lu ne peut
// pas fuir par un `...spread` distrait.

import { prisma } from "@/lib/prisma";
import { artifactState, type ArtifactState } from "./publicationState";

/** Une source du registre, telle qu'elle peut être rendue publiquement. */
export interface PublicSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly caption: string | null;
  /** L'instant de CAPTURE. Jamais l'instant de rendu — voir l'en-tête. */
  readonly capturedAt: string | null;
  readonly sourceUrl: string | null;
  /** Empreinte de la pièce, quand elle existe. Preuve d'intégrité. */
  readonly sha256: string | null;
}

/** Le fondement probatoire d'un claim, ou son absence DÉCLARÉE. */
export interface ClaimProvenance {
  /** Le fil ou document cité par le claim lui-même. */
  readonly threadUrl: string | null;
  /** Les sources RÉSOLUES du registre. Une référence non résolue n'y est pas. */
  readonly sources: readonly PublicSource[];
  /** Les références citées que le registre ne connaît pas. Jamais masquées. */
  readonly unresolvedRefs: readonly string[];
}

export interface PublicClaim {
  readonly claimId: string;
  readonly title: string;
  readonly titleFr: string | null;
  readonly description: string | null;
  readonly descriptionFr: string | null;
  readonly category: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly claimDate: string | null;
  readonly state: ArtifactState;
  /**
   * `null` signifie « ce claim ne porte aucun fondement » — et c'est une
   * information, pas une omission. Un champ absent laisserait le renderer
   * décider ; un `null` explicite l'oblige à le dire.
   */
  readonly provenance: ClaimProvenance | null;
}

export interface CanonicalCaseFile {
  readonly ref: string;
  readonly codename: string;
  readonly ticker: string;
  readonly title: string;
  /** `null` = score non établi. Jamais 0 par défaut. */
  readonly tigerScore: number | null;
  readonly verdict: string;
  readonly claims: readonly PublicClaim[];
  readonly sources: readonly PublicSource[];
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** Les formes de ligne lues en SQL brut. Colonnes énumérées, jamais `*`. */
interface SourceRow {
  sourceId: string; sourceType: string; caption: string | null;
  capturedAt: Date | null; sourceUrl: string | null; sha256: string | null;
}
interface ClaimRow {
  claimId: string; title: string; titleFr: string | null;
  description: string | null; descriptionFr: string | null;
  category: string | null; severity: string | null; status: string | null;
  claimDate: Date | null; threadUrl: string | null;
  evidenceRefs: unknown; state: string;
}

function toPublicSource(r: SourceRow): PublicSource {
  return {
    sourceId: r.sourceId,
    sourceType: r.sourceType,
    caption: r.caption,
    capturedAt: iso(r.capturedAt),
    sourceUrl: r.sourceUrl,
    sha256: r.sha256,
  };
}

/**
 * Résout les références d'un claim contre le registre du dossier.
 *
 * Ce qui ne résout pas est RENDU VISIBLE dans `unresolvedRefs`, jamais écarté
 * en silence. C'est la moitié utile du gate : un fondement manquant qu'on ne
 * voit pas est indiscernable d'un fondement absent.
 */
export function resolveProvenance(
  threadUrl: string | null,
  evidenceRefs: readonly string[],
  registre: ReadonlyMap<string, PublicSource>,
): ClaimProvenance | null {
  const sources: PublicSource[] = [];
  const unresolvedRefs: string[] = [];
  for (const r of evidenceRefs) {
    const s = registre.get(r);
    if (s) sources.push(s);
    else unresolvedRefs.push(r);
  }
  if (!threadUrl && sources.length === 0 && unresolvedRefs.length === 0) return null;
  return { threadUrl, sources, unresolvedRefs };
}

const asRefs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Charge un dossier canonique et ses claims.
 *
 * `onlyPublishable` filtre sur l'état d'artefact, pas sur un booléen : les
 * trois états sont distincts, et un claim `ATTACHED` n'est pas un claim publié
 * dont on aurait oublié le drapeau.
 */
export async function loadCanonicalCaseFile(
  ref: string,
  opts: { onlyPublishable?: boolean } = {},
): Promise<CanonicalCaseFile | null> {
  const dossier = await prisma.tokenCaseFile.findUnique({
    where: { ref },
    select: {
      ref: true, codename: true, ticker: true, title: true,
      tigerScore: true, verdict: true,
    },
  });
  if (!dossier) return null;

  // ── $queryRaw et non le client typé, et c'est un CONSTAT, pas un choix ──
  //
  // `CaseFileSource` et `CaseFileClaim` existent en base (bloc 3) mais ne sont
  // PAS déclarées dans prisma/schema.prod.prisma, qui est un chemin gelé. Le
  // client généré ne les connaît donc pas.
  //
  // On lit en SQL brut, avec des formes de lignes explicites — exactement la
  // dette que BUILD 8 a constatée sur KolProceedsEvent. Les colonnes sont
  // ÉNUMÉRÉES, jamais `SELECT *` : ce qui n'est pas lu ne peut pas fuir.
  const [sourceRows, claimRows] = await Promise.all([
    prisma.$queryRaw<SourceRow[]>`
      SELECT "sourceId", "sourceType", caption, "capturedAt", "sourceUrl", sha256
        FROM "CaseFileSource" WHERE "casefileRef" = ${ref} ORDER BY "sourceId" ASC`,
    prisma.$queryRaw<ClaimRow[]>`
      SELECT "claimId", title, "titleFr", description, "descriptionFr", category,
             severity, status, "claimDate", "threadUrl", "evidenceRefs", state
        FROM "CaseFileClaim" WHERE "casefileRef" = ${ref} ORDER BY "claimId" ASC`,
  ]);

  const sources = sourceRows.map(toPublicSource);
  const registre = new Map(sources.map((s) => [s.sourceId, s]));

  const claims: PublicClaim[] = claimRows
    .filter((c) => !opts.onlyPublishable || c.state === "PUBLIC")
    .map((c) => ({
      claimId: c.claimId,
      title: c.title,
      titleFr: c.titleFr,
      description: c.description,
      descriptionFr: c.descriptionFr,
      category: c.category,
      severity: c.severity,
      status: c.status,
      claimDate: iso(c.claimDate),
      state: c.state as ArtifactState,
      provenance: resolveProvenance(c.threadUrl, asRefs(c.evidenceRefs), registre),
    }));

  return {
    ref: dossier.ref,
    codename: dossier.codename,
    ticker: dossier.ticker,
    title: dossier.title,
    tigerScore: dossier.tigerScore,
    verdict: dossier.verdict,
    claims,
    sources,
  };
}

/**
 * LE gate, appelable par tout sérialiseur.
 *
 * Lève si un claim `PUBLIC` sort sans aucun fondement. Un claim démontrable
 * qui perd sa provenance en chemin est exactement ce que l'étape 5 interdit —
 * et le refus doit être bruyant, sinon il se répète.
 */
export class ProvenanceLostError extends Error {
  constructor(claimId: string, where: string) {
    super(
      `[casefile] rendu refusé (${where}) : le claim ${claimId} est PUBLIC mais ` +
        "ne porte aucun fondement probatoire. Une assertion publiée sans sa " +
        "provenance a l'air soutenue — c'est plus fragile qu'une assertion prudente.",
    );
    this.name = "ProvenanceLostError";
  }
}

export function assertProvenanceSurvives(
  claims: readonly PublicClaim[],
  where: string,
): void {
  for (const c of claims) {
    if (c.state !== "PUBLIC") continue;
    const p = c.provenance;
    const aUnFondement = !!p && (!!p.threadUrl || p.sources.length > 0);
    if (!aUnFondement) throw new ProvenanceLostError(c.claimId, where);
  }
}

/** Les champs internes qui ne doivent jamais franchir la frontière publique. */
export const INTERNAL_ONLY_FIELDS = [
  "localFilePath", "sessionId", "notes", "id", "snapshotId", "casefileRef",
] as const;
