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
import type { ArtifactState } from "./publicationState";
import { latestVersions } from "./versioning";
import type { SourceProvenanceKind } from "./provenanceKind";
import {
  provenanceDecoration,
  readJournalProvenance,
  type DerivedUnknownCause,
  type JournalProvenance,
  type JournalSqlRunner,
} from "./journalProvenance";

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
  /**
   * T1-REVOKE-ELIGIBILITY — le lien explicite vers l'EvidenceSnapshot (un
   * BOOLÉEN : l'identifiant du snapshot est interne et ne traverse pas), et la
   * qualification de provenance des octets. Optionnels dans le type parce que
   * les fixtures construisent des pièces sans eux ; ABSENTS, ils valent
   * « non lié » et UNKNOWN — jamais un défaut optimiste.
   *
   * T1-BASCULE-DU-CONTRAT — `provenanceKind` ne vient plus d'un registre en
   * code : il vient du JOURNAL, résolu par `journalProvenance`, et il arrive
   * accompagné de `provenanceCause` — POURQUOI, quand il vaut UNKNOWN. Les
   * deux champs sont posés ENSEMBLE par `provenanceDecoration`, jamais à la
   * main : séparés, ils pourraient diverger.
   *
   * `provenanceCause` est un diagnostic de contrat. Il ne franchit AUCUNE
   * frontière publique : la projection le consomme pour nommer un champ
   * retenu, et ne le rend jamais tel quel.
   */
  readonly evidenceLinked?: boolean;
  readonly provenanceKind?: SourceProvenanceKind;
  readonly provenanceCause?: DerivedUnknownCause | null;
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
   * SPINE-00 · C — la nature de l'assertion et les références CITÉES, lues
   * avec le claim pour que la projection consomme le contrat canonique du
   * claim public (`governedWriter.decidePublicClaimContract`) sur les MÊMES
   * entrées que l'écrivain. Optionnels dans le type parce que les fixtures
   * construisent des claims sans eux — et un claim sans eux n'est pas
   * projetable : absent vaut non classifié, absent vaut zéro référence.
   */
  readonly rowNature?: string | null;
  readonly evidenceRefs?: readonly string[];
  /**
   * `null` signifie « ce claim ne porte aucun fondement » — et c'est une
   * information, pas une omission. Un champ absent laisserait le renderer
   * décider ; un `null` explicite l'oblige à le dire.
   */
  readonly provenance: ClaimProvenance | null;
}

/**
 * Un wallet clé du dossier, tel que `token_casefiles."keyWallets"` le porte.
 *
 * BUILD 9 / ÉTAPE 7 — lu pour que la surface admin cesse de rendre des
 * adresses codées en dur. Un tableau VIDE est une réponse : BOTIFY ne porte
 * aucun bloc de wallets on-chain, et en fabriquer un pour remplir la forme
 * serait exactement ce que l'étape 7 supprime.
 */
export interface CanonicalKeyWallet {
  readonly role: string;
  readonly address: string;
}

export interface CanonicalCaseFile {
  readonly ref: string;
  readonly codename: string;
  readonly ticker: string;
  readonly title: string;
  /** `null` = score non établi. Jamais 0 par défaut. */
  readonly tigerScore: number | null;
  readonly verdict: string;
  /**
   * S1 · phase A — `token_casefiles.publishStatus`, lu avec le dossier pour
   * que l'autorité de publication (`publicationAuthority.ts`) décide sur la
   * LIGNE LUE, sans second accès base. Optionnel dans le type parce que les
   * fixtures de test construisent des dossiers sans lui — et un dossier sans
   * lui est REFUSÉ, jamais publié par défaut.
   */
  readonly publishStatus?: string;
  readonly claims: readonly PublicClaim[];
  readonly sources: readonly PublicSource[];
  readonly keyWallets: readonly CanonicalKeyWallet[];
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** Les formes de ligne lues en SQL brut. Colonnes énumérées, jamais `*`. */
interface SourceRow {
  sourceId: string; sourceType: string; caption: string | null;
  capturedAt: Date | null; sourceUrl: string | null; sha256: string | null;
  /**
   * T1-BASCULE-DU-CONTRAT — le PONT vers l'observation gouvernée, lu pour
   * résoudre la provenance au journal. INTERNE : il est consommé ici et ne
   * figure dans aucune `PublicSource` — `INTERNAL_ONLY_FIELDS` le nomme, et un
   * témoin de frontière le vérifie. Ce qui traverse est le booléen.
   */
  snapshotId: string | null;
}
interface ClaimRow {
  claimId: string; title: string; titleFr: string | null;
  description: string | null; descriptionFr: string | null;
  category: string | null; severity: string | null; status: string | null;
  claimDate: Date | null; threadUrl: string | null;
  evidenceRefs: unknown; rowNature: string | null; state: string; version: number;
}

/**
 * Une pièce, décorée par la provenance QUE LE JOURNAL REND.
 *
 * T1-BASCULE-DU-CONTRAT — la qualification n'est plus lue dans un registre en
 * code : elle arrive ici sous forme de résultat TYPÉ, et les deux champs du
 * jugement sont posés d'un seul geste par `provenanceDecoration`. Une pièce
 * dont le journal ne dit rien porte UNKNOWN **et sa cause** — l'éligibilité
 * saura distinguer l'absence de couverture de l'anomalie de base.
 */
function toPublicSource(r: SourceRow, p: JournalProvenance): PublicSource {
  return {
    sourceId: r.sourceId,
    sourceType: r.sourceType,
    caption: r.caption,
    capturedAt: iso(r.capturedAt),
    sourceUrl: r.sourceUrl,
    sha256: r.sha256,
    // Le PONT ne traverse pas : ce qui sort est le fait qu'il existe.
    evidenceLinked: typeof r.snapshotId === "string" && r.snapshotId !== "",
    ...provenanceDecoration(p),
  };
}

/**
 * `prisma` vu comme le `JournalSqlRunner` du lecteur de journal.
 *
 * `$queryRawUnsafe` et non le template tagué : la requête du journal est un
 * LITTÉRAL du module `journalProvenance`, et ses valeurs passent en `$1`
 * paramétré. Rien d'interpolé ne vient d'ici — l'adaptateur ne fabrique aucun
 * SQL, il transporte celui qu'on lui donne.
 */
const runnerPrisma: JournalSqlRunner = {
  query: <T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) =>
    prisma.$queryRawUnsafe<T[]>(sql, ...params),
};

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

/** `keyWallets` est du jsonb : on ne garde que les entrées bien formées. */
const asKeyWallets = (v: unknown): CanonicalKeyWallet[] => {
  if (!Array.isArray(v)) return [];
  const out: CanonicalKeyWallet[] = [];
  for (const w of v) {
    const r = (w ?? {}) as Record<string, unknown>;
    if (typeof r.address === "string" && r.address.length > 0) {
      out.push({ role: typeof r.role === "string" ? r.role : "", address: r.address });
    }
  }
  return out;
};

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
      tigerScore: true, verdict: true, keyWallets: true,
      publishStatus: true,
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
      SELECT "sourceId", "sourceType", caption, "capturedAt", "sourceUrl", sha256, "snapshotId"
        FROM "CaseFileSource" WHERE "casefileRef" = ${ref} ORDER BY "sourceId" ASC`,
    prisma.$queryRaw<ClaimRow[]>`
      SELECT "claimId", title, "titleFr", description, "descriptionFr", category,
             severity, status, "claimDate", "threadUrl", "evidenceRefs",
             "rowNature"::text AS "rowNature", state, version
        FROM "CaseFileClaim" WHERE "casefileRef" = ${ref} ORDER BY "claimId" ASC`,
  ]);

  // ── T1-BASCULE-DU-CONTRAT — LA PROVENANCE, RÉSOLUE AU JOURNAL ──────────
  //
  // Une seule requête pour tout le registre (`DISTINCT ON` sur l'index du
  // journal). Les pièces sans pont n'y entrent même pas : leur UNKNOWN est
  // dérivé du `null`, pas d'un silence de la base — et le lecteur rend une
  // entrée par `sourceId` reçu, donc la carte est totale.
  const provenances = await readJournalProvenance(
    runnerPrisma,
    sourceRows.map((r) => ({ sourceId: r.sourceId, snapshotId: r.snapshotId })),
  );
  const sansProvenance: JournalProvenance = { kind: "UNKNOWN", derived: true, cause: "NO_SNAPSHOT_LINK", journalId: null };
  const sources = sourceRows.map((r) => toPublicSource(r, provenances.get(r.sourceId) ?? sansProvenance));
  const registre = new Map(sources.map((s) => [s.sourceId, s]));

  // ── BUILD 9 / ÉTAPE 6 — une seule version par claim ────────────────────
  //
  // La table est unique sur `(casefileRef, claimId, version)` : plusieurs
  // versions du MÊME claim y coexistent par construction, et c'est le but —
  // une assertion ne se corrige pas, elle est supplantée.
  //
  // Sans ce filtre, un dossier portant C1 v1 et C1 v2 rendait DEUX claims C1
  // sur la même page, dont un périmé. Latent aujourd'hui (les 16 claims
  // migrés sont tous en v1), et c'est la raison de le fermer maintenant : un
  // défaut latent ne se voit pas, celui-ci se serait manifesté le jour de la
  // première correction d'assertion — c'est-à-dire au pire moment.
  const claims: PublicClaim[] = latestVersions(claimRows)
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
      rowNature: c.rowNature,
      evidenceRefs: asRefs(c.evidenceRefs),
      provenance: resolveProvenance(c.threadUrl, asRefs(c.evidenceRefs), registre),
    }));

  return {
    ref: dossier.ref,
    codename: dossier.codename,
    ticker: dossier.ticker,
    title: dossier.title,
    tigerScore: dossier.tigerScore,
    verdict: dossier.verdict,
    publishStatus: dossier.publishStatus,
    claims,
    sources,
    keyWallets: asKeyWallets(dossier.keyWallets),
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
