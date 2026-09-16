// ─── CC-OFFLINE-240 · CF-1 — L'ASSEMBLAGE D'AUTORITÉ ───────────────────────
//
// ██  LA DONNÉE ÉTAIT CORRECTE. LE PRODUIT NE LA LISAIT PAS.               ██
//
// CF-0 l'a mesuré : le producteur PDF alimentait ses claims depuis un JSON
// disque dont la carte ne connaissait pas VINE, pendant que le corpus gouverné
// — pièces, claims scellées, dépendance causale, mesure machine — existait et
// était lisible. Ce module lit ce corpus, et rien d'autre.
//
// ─── CE QUE C'EST, ET CE QUE CE N'EST PAS ─────────────────────────────────
//
// Un ASSEMBLAGE D'AUTORITÉ, pas une vue. Il ne met rien en forme, ne classe
// rien, ne résume rien. Il transporte la chaîne complète pour qu'une projection
// puisse SÉLECTIONNER et un renderer PRÉSENTER — sans qu'aucun des deux n'ait à
// retourner en base.
//
//   SUBJECT → EVIDENCE → CLAIMS SCELLÉES → DÉPENDANCES → LIGNAGE DE MESURE
//
// ─── SUBJECT-AGNOSTIC PAR CONSTRUCTION ────────────────────────────────────
//
// L'entrée est un `CaseFileRef`, et rien d'autre. Aucun `if VINE`, aucune carte
// de mints, aucun `claimId` ni `sourceId` en dur. Ajouter un dossier n'exige
// aucune ligne ici.
//
// ─── CE QU'IL NE LIT PAS, ET C'EST LE POINT ───────────────────────────────
//
// ⛔ `summary` · `summary_fr` · `bodyMarkdown` · `keyWallets` ·
//    `SmokingGun` / `sg.verdict_fr` · le `verdict` légataire ·
//    `loadCaseByMint` et son JSON · `computeScore`.
//
// Ces structures continuent d'exister pour leurs usages historiques. Elles ne
// nourrissent pas cet assemblage. FAIL CLOSED : un dossier sans corpus gouverné
// rend un assemblage VIDE, jamais un repli sur la prose.
//
// ─── LE SCEAU EST LU ICI, ET PAS DANS LE LECTEUR PUBLIC ───────────────────
//
// `contentHash` ne remonte PAS par `canonicalReader` : un témoin du dépôt
// défend cette frontière — le lecteur public ne sélectionne aucun identifiant
// de ligne ni aucun sceau, c'est l'affaire de l'audit. L'assemblage, lui, est un
// objet de niveau COUNSEL : il lit le sceau lui-même, par une requête qui lui
// appartient, sans déplacer la frontière du lecteur public.

import { prisma } from "@/lib/prisma";
import {
  loadCanonicalCaseFile,
  loadClaimDependencies,
  type CanonicalCaseFile,
  type PublicSource,
} from "./canonicalReader";


// ═══ LA FORME ASSEMBLÉE ═════════════════════════════════════════════════════

/** Le sujet. L'identité gouvernée du dossier, sans aucun champ de prose. */
export interface AssembledSubject {
  readonly ref: string;
  readonly codename: string;
  readonly ticker: string;
  readonly title: string;
}

/** Une pièce, avec le lignage que le journal porte. */
export interface AssembledSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly caption: string | null;
  readonly capturedAt: string | null;
  readonly sourceUrl: string | null;
  readonly sha256: string | null;
  readonly snapshotLinked: boolean;
  /** La qualification, RÉSOLUE au journal — jamais devinée. */
  readonly provenanceKind: string;
  /** L'`id` de la ligne qui fait foi, ou `null` si la qualification est dérivée. */
  readonly journalId: string | null;
  /** `r2://…`, URL ou URI selon la nature de la référence. */
  readonly sourceLocator: string | null;
  /**
   * QUI DÉCLARE. Pour une pièce `MACHINE_MEASURED`, c'est l'IDENTITÉ DE
   * L'INSTRUMENT — `instrument:<nom>@<semver>`, forme imposée par un CHECK.
   */
  readonly declaredBy: string | null;
}

/** Une assertion gouvernée, avec son sceau. */
export interface AssembledClaim {
  readonly claimId: string;
  readonly version: number | null;
  readonly rowNature: string | null;
  readonly title: string;
  readonly titleFr: string | null;
  readonly description: string | null;
  readonly descriptionFr: string | null;
  readonly category: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly claimDate: string | null;
  readonly state: string;
  readonly evidenceRefs: readonly string[];
  /** Le sceau du contenu. `null` = la ligne n'en porte pas ; jamais fabriqué. */
  readonly contentHash: string | null;
}

/** Une dépendance causale, épinglée en version des deux côtés. */
export interface AssembledDependency {
  readonly dependentClaimId: string;
  readonly dependentVersion: number;
  readonly sourceClaimId: string;
  readonly sourceVersion: number;
  readonly kind: string;
}

export interface CanonicalAuthorityAssembly {
  readonly subject: AssembledSubject;
  readonly sources: readonly AssembledSource[];
  readonly claims: readonly AssembledClaim[];
  readonly dependencies: readonly AssembledDependency[];
}

// ═══ LE SCEAU, LU PAR L'ASSEMBLAGE ══════════════════════════════════════════

interface SceauRow {
  claimId: string;
  version: number;
  contentHash: string | null;
}

/** Le lignage d'une pièce : son snapshot, et la DERNIÈRE ligne du journal. */
interface LignageRow {
  sourceId: string;
  snapshotId: string | null;
  journalId: string | null;
  sourceLocator: string | null;
  declaredBy: string | null;
}

/**
 * Les sceaux du dossier, par `claimId@version`.
 *
 * Requête SÉPARÉE, et c'est délibéré : la frontière du lecteur public reste
 * intacte. Colonnes énumérées, jamais `*`.
 */
async function lireSceaux(ref: string): Promise<Map<string, string | null>> {
  const rows = await prisma.$queryRaw<SceauRow[]>`
    SELECT "claimId", version, "contentHash"
      FROM "CaseFileClaim" WHERE "casefileRef" = ${ref}`;
  return new Map(rows.map((r) => [`${r.claimId}@${r.version}`, r.contentHash]));
}

// ═══ L'ASSEMBLAGE ═══════════════════════════════════════════════════════════

/**
 * Le lignage des pièces du dossier.
 *
 * ⚠️ La QUALIFICATION reste celle que le LECTEUR a résolue — une seule autorité
 * sur ce fait, et ce n'est pas ici. Cette requête ne rapporte que le
 * COMPLÉMENT que le lecteur public ne transporte pas : le snapshot, le
 * localisateur, et le déclarant. Le `LATERAL … ORDER BY id DESC LIMIT 1` prend
 * la DERNIÈRE ligne par snapshot — la même règle que le résolveur, qui retient
 * lui aussi la plus récente par `id`.
 */
async function lireLignage(ref: string): Promise<Map<string, LignageRow>> {
  const rows = await prisma.$queryRaw<LignageRow[]>`
    SELECT cs."sourceId",
           cs."snapshotId",
           j.id::text        AS "journalId",
           j.source_url      AS "sourceLocator",
           j.declared_by     AS "declaredBy"
      FROM "CaseFileSource" cs
      LEFT JOIN LATERAL (
        SELECT id, source_url, declared_by
          FROM evidence_provenance_journal
         WHERE evidence_snapshot_id = cs."snapshotId"
         ORDER BY id DESC LIMIT 1
      ) j ON true
     WHERE cs."casefileRef" = ${ref}`;
  return new Map(rows.map((r) => [r.sourceId, r]));
}

/**
 * LA COMPOSITION, PURE. Aucune base, aucune horloge, aucun réseau.
 *
 * Séparée de la lecture pour une raison précise : les mutants de CF-1 portent
 * sur le COMPORTEMENT — une pièce manquante, une dépendance absente, un sceau
 * nul — et un mutant qui exigerait de simuler une base ne prouverait que le
 * simulacre. Ici, l'entrée EST la donnée, et le mutant est une donnée.
 */
export function composerAssemblage(
  dossier: CanonicalCaseFile,
  deps: ReadonlyMap<string, ReadonlyArray<{ claimId: string; version: number; kind: string }>>,
  sceaux: ReadonlyMap<string, string | null>,
  lignages: ReadonlyMap<string, { snapshotId: string | null; journalId: string | null; sourceLocator: string | null; declaredBy: string | null }>,
): CanonicalAuthorityAssembly {
  const sources: AssembledSource[] = (dossier.sources as readonly PublicSource[]).map((s) => {
    // La qualification vient du LECTEUR, qui l'a déjà résolue au journal : une
    // seule autorité sur ce fait. Le lignage n'apporte que le complément.
    const lignage = lignages.get(s.sourceId) ?? null;
    return {
      sourceId: s.sourceId,
      sourceType: s.sourceType,
      caption: s.caption ?? null,
      capturedAt: s.capturedAt ?? null,
      sourceUrl: s.sourceUrl ?? null,
      sha256: s.sha256 ?? null,
      snapshotLinked: s.evidenceLinked === true,
      provenanceKind: s.provenanceKind ?? "UNKNOWN",
      journalId: lignage?.journalId ?? null,
      sourceLocator: lignage?.sourceLocator ?? null,
      declaredBy: lignage?.declaredBy ?? null,
    };
  });

  const claims: AssembledClaim[] = dossier.claims.map((c) => ({
    claimId: c.claimId,
    version: c.version ?? null,
    rowNature: c.rowNature ?? null,
    title: c.title,
    titleFr: c.titleFr,
    description: c.description,
    descriptionFr: c.descriptionFr,
    category: c.category,
    severity: c.severity,
    status: c.status,
    claimDate: c.claimDate,
    state: c.state,
    evidenceRefs: c.evidenceRefs ?? [],
    contentHash: sceaux.get(`${c.claimId}@${c.version ?? ""}`) ?? null,
  }));

  const dependencies: AssembledDependency[] = [];
  for (const [cle, liste] of deps) {
    const sep = cle.lastIndexOf("@");
    const dependentClaimId = cle.slice(0, sep);
    const dependentVersion = Number(cle.slice(sep + 1));
    for (const d of liste) {
      dependencies.push({
        dependentClaimId,
        dependentVersion,
        sourceClaimId: d.claimId,
        sourceVersion: d.version,
        kind: d.kind,
      });
    }
  }
  dependencies.sort(
    (a, b) =>
      a.dependentClaimId.localeCompare(b.dependentClaimId) ||
      a.sourceClaimId.localeCompare(b.sourceClaimId),
  );

  return {
    subject: {
      ref: dossier.ref,
      codename: dossier.codename,
      ticker: dossier.ticker,
      title: dossier.title,
    },
    sources,
    claims,
    dependencies,
  };
}

/**
 * Assemble le corpus gouverné d'un dossier. `null` si le dossier n'existe pas —
 * jamais un objet partiel, jamais un repli sur la prose.
 */
export async function assembleAuthority(ref: string): Promise<CanonicalAuthorityAssembly | null> {
  const dossier: CanonicalCaseFile | null = await loadCanonicalCaseFile(ref);
  if (!dossier) return null;
  const [deps, sceaux, lignages] = await Promise.all([
    loadClaimDependencies(ref),
    lireSceaux(ref),
    lireLignage(ref),
  ]);
  return composerAssemblage(dossier, deps, sceaux, lignages);
}
