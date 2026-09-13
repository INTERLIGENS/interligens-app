// ─── RC-SPINE-00 — L'ÉCRIVAIN GOUVERNÉ : LA DÉCISION ───────────────────────
//
// ██  Créer le fondement n'est pas publier le claim.                        ██
// ██  Corriger une assertion, c'est la SUPPLANTER — jamais l'écraser.       ██
//
// ─── La chaîne, fixée avant que ce module existe ──────────────────────────
//
//   EvidenceSnapshot admissible → CaseFileSource gouvernée → CaseFileClaim
//   versionné → décision PUBLIC explicite → producteur canonique
//
// Ce module rend les DEUX décisions de cette chaîne. Il n'écrit rien : il
// prend des lignes LUES et des intentions EXPLICITES, et il rend une décision
// fermée et typée — jamais un booléen, jamais un objet partiel qu'un appelant
// distrait pourrait consommer à moitié. Il est pur, synchrone, sans base : il
// se prouve sans elle.
//
// ─── Les deux propriétés, portées par les TYPES ───────────────────────────
//
//   1 · CRÉER ≠ PUBLIER. `decideFoundation` produit un fondement dont l'état
//       est littéralement `"ATTACHED"`. Sa charge n'a AUCUN champ de
//       publication — `state`, `isPublic` : en poser un est un REFUS nommé,
//       pas un champ ignoré. `decidePublicRelease` exige un `Foundation`
//       (type nominal, produit par `decideFoundation` seul) ET une autorité
//       explicite. Un appelant ne peut pas exprimer « fonder et publier » en
//       un geste : ce sont deux décisions, deux plans, deux exécutions.
//
//   2 · VERSIONNER, PAS ÉCRASER. Un claim dont le `claimId` existe déjà n'est
//       fondé que si l'appelant DÉCLARE la supplantation (`supersedesVersion`
//       égal à la dernière version). Le plan rendu ne contient qu'un INSERT de
//       version N+1 ; il n'existe aucune forme de plan qui modifie une ligne
//       existante. Le sceau de la version supplantée est ÉPINGLÉ dans les
//       préconditions : l'exécuteur le revérifie avant d'écrire.
//
// ─── Le contrat du claim PUBLIC, dérivé et non copié ──────────────────────
//
// Le CHECK `CaseFileClaim_public_requires_provenance` exige, en base :
// `rowNature` classifiée ET `evidenceRefs` ≥ 1. Il ne peut pas exiger que les
// références RÉSOLVENT vers une pièce vérifiable. `decidePublicClaimContract`
// porte la règle complète — nature, références, résolution, provenance
// (`sha256` ∧ `sourceUrl` ∧ `capturedAt`) — et elle est consommée DEUX fois :
// par le fondement et par la libération. La base reste défense en profondeur.
// `threadUrl` n'y entre pas : provenance complémentaire, jamais substitut.
//
// La provenance d'une pièce se juge par `isPubliableSource`, la primitive que
// la projection publique emploie déjà. Un même prédicat, deux consommateurs :
// retirer la pièce d'un claim mord au fondement, à la libération ET au rendu.
//
// ─── Le sceau : une seule normalisation, MESURÉE ─────────────────────────
//
// Mesuré le 2026-09-13 sur les 16 claims scellés de la base : 16/16 vérifient
// sous la normalisation de `integrityAudit.ts` (`actors` et `evidenceRefs`
// toujours en tableau, `null → []`, `claimDate` en `YYYY-MM-DD`). 0/16 sous
// une normalisation qui laisse `actors` absent. L'écrivain scelle donc EXACTEMENT
// comme l'audit vérifie — sinon chaque ligne écrite ici crierait
// CONTENT_MUTATED au premier audit.
//
// ─── EXÉCUTION — CONÇUE, NON LIVRÉE ───────────────────────────────────────
//
// Aucune écriture n'est autorisée pendant la construction. Ce que l'exécuteur
// fera, quand il sera autorisé, sur un `Foundation` :
//
//   · UNE transaction, isolation REPEATABLE READ au minimum. Sources et claim
//     y entrent ensemble ou pas du tout : un refus quelconque est un ROLLBACK
//     complet. Il n'existe pas de « refus partiel » — la décision a déjà
//     refusé tout ce qui n'était pas entier.
//   · RE-DÉCISION DANS LA TRANSACTION. Le plan a été décidé sur des lignes lues
//     hors transaction. L'exécuteur relit (`FOR SHARE`) les snapshots, les
//     sources du dossier et la dernière version du claim, et vérifie
//     `preconditions` : même `sha256` de snapshot, dernière version et sceau
//     inchangés, `sourceId` attendus absents. Un écart est un ABORT nommé.
//   · IDEMPOTENCE PAR IDENTITÉ DE CONTENU. Une source déjà présente sous le
//     même `(casefileRef, sourceId)` avec les mêmes `sha256`, `sourceUrl`,
//     `capturedAt`, `snapshotId` est un no-op ; différente, c'est une COLLISION
//     et un ABORT. Un claim déjà présent sous `(casefileRef, claimId, version)`
//     avec le même `contentHash` est un no-op ; différent, ABORT. Rejouer un
//     plan exécuté rend ALREADY_EXECUTED, jamais une seconde ligne.
//   · `supersedes` est résolu DANS la transaction, par sous-requête sur
//     `(casefileRef, claimId, supersedesVersion)` — la décision ne connaît
//     aucun identifiant de ligne, et n'en connaîtra pas.
//   · Le `contentHash` est celui du plan. Il n'est PAS recalculé côté SQL.
//
// Sur un `PublicRelease` :
//
//   · UN `UPDATE ... SET state = 'PUBLIC'` sur la ligne EXACTE
//     `(casefileRef, claimId, version)`, gardé par `state = 'ATTACHED'` ET
//     `contentHash = expectedContentHash`. `state` n'est pas scellé
//     (versioning.ts) : la promotion ne touche pas au contenu. Zéro ligne
//     touchée est un ABORT — le fondement n'est pas persisté, ou déjà PUBLIC,
//     ou son contenu a bougé ; l'exécuteur distingue les trois par lecture.
//   · Le CHECK en base est la dernière ligne de défense, pas la première.
//
// ⚠️ DOUTE D'ARCHITECTURE, NOMMÉ ET NON TRANCHÉ ICI : `CaseFileClaim` ne porte
// aucune colonne pour JOURNALISER l'autorité de publication (`decidedBy`,
// `decidedAt`). Le plan de libération la porte ; la base n'a pas de siège
// pour elle sans DDL. Où l'autorité explicite se persiste — colonne, table de
// journal, registre existant — est une décision d'architecture qui précède
// tout exécuteur de libération. Elle n'est pas prise dans ce module.

import { isAdmissible } from "./publicationState";
import { claimContentHash, latestVersions } from "./versioning";
import { isSealIntact } from "./sealGuard";
import { isPubliableSource } from "./publicProjection";
import type { PublicSource } from "./canonicalReader";
import { isDataNature, type DataNature } from "@/lib/data-nature/nature";

// ═══ LE CONTRAT DU CLAIM PUBLIC — la primitive partagée ═════════════════════

export const PUBLIC_CLAIM_CONTRACT_CAUSES = [
  /** `rowNature` absente, `UNCLASSIFIED`, ou hors du vocabulaire fermé. */
  "CLAIM_UNCLASSIFIED",
  /** `evidenceRefs` vide, absent, ou pas un tableau. */
  "EVIDENCE_REFS_EMPTY",
  /** Une référence citée que le registre fourni ne connaît pas. */
  "EVIDENCE_REF_UNRESOLVED",
  /** La pièce résolue ne porte pas `sha256` ∧ `sourceUrl` ∧ `capturedAt`. */
  "SOURCE_PROVENANCE_INCOMPLETE",
] as const;
export type PublicClaimContractCause = (typeof PUBLIC_CLAIM_CONTRACT_CAUSES)[number];

export interface PublicClaimContractInput {
  readonly rowNature?: unknown;
  readonly evidenceRefs?: unknown;
}

/**
 * Un refus nomme une CAUSE et un EMPLACEMENT — un nom de champ, une clef de
 * référence, un identifiant. Jamais un contenu : un refus qui citerait ce
 * qu'il refuse le republierait.
 */
export interface Refusal<C extends string> {
  readonly cause: C;
  readonly at: string;
}

export type PublicClaimContractVerdict =
  | {
      readonly verdict: "MET";
      readonly nature: DataNature;
      readonly refs: readonly string[];
      /** Les pièces citées, résolues et publiables. Dans l'ordre des refs. */
      readonly cited: readonly PublicSource[];
    }
  | { readonly verdict: "UNMET"; readonly refusal: Refusal<PublicClaimContractCause> };

const estCleAcceptable = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.trim() === v;

/** Le premier champ qui manque à une pièce. Un nom, jamais un contenu. */
function champManquant(s: PublicSource): string {
  if (!s.sha256) return "sha256";
  if (!s.sourceUrl) return "sourceUrl";
  return "capturedAt";
}

/**
 * LA règle du claim publiable. Pure. Consommée par le fondement ET par la
 * libération — deux fois la même règle, jamais deux règles.
 *
 * L'ordre des refus est stable : nature, puis références, puis chaque
 * référence dans l'ordre où elle est citée — résolution avant provenance.
 */
export function decidePublicClaimContract(
  claim: PublicClaimContractInput,
  registre: ReadonlyMap<string, PublicSource>,
): PublicClaimContractVerdict {
  const unmet = (cause: PublicClaimContractCause, at: string): PublicClaimContractVerdict => ({
    verdict: "UNMET",
    refusal: { cause, at },
  });

  // UNCLASSIFIED n'est pas dans DATA_NATURES : il tombe ici avec null,
  // undefined, une casse approchante ou une valeur inconnue. Aucun défaut.
  if (!isDataNature(claim.rowNature)) return unmet("CLAIM_UNCLASSIFIED", "rowNature");

  const refs = claim.evidenceRefs;
  if (!Array.isArray(refs) || refs.length === 0) return unmet("EVIDENCE_REFS_EMPTY", "evidenceRefs");

  const cited: PublicSource[] = [];
  const clefs: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    const r: unknown = refs[i];
    // Une référence qui n'est pas une clef ne résout vers rien.
    if (!estCleAcceptable(r)) return unmet("EVIDENCE_REF_UNRESOLVED", `evidenceRefs[${i}]`);
    const s = registre.get(r);
    if (!s) return unmet("EVIDENCE_REF_UNRESOLVED", r);
    if (!isPubliableSource(s)) return unmet("SOURCE_PROVENANCE_INCOMPLETE", `${r}.${champManquant(s)}`);
    cited.push(s);
    clefs.push(r);
  }
  return { verdict: "MET", nature: claim.rowNature, refs: clefs, cited };
}

// ═══ LE FONDEMENT — décision 1 ══════════════════════════════════════════════

export const FOUNDATION_REFUSAL_CAUSES = [
  /** Forme inattendue : absente, vide, ou d'un type inattendu. */
  "MALFORMED_INPUT",
  /** Une source, un snapshot ou un claim d'un AUTRE dossier dans la charge. */
  "DOSSIER_MIX",
  /** Une source dérivée cite un snapshot qui n'est pas dans les lignes lues. */
  "SNAPSHOT_MISSING",
  /** Le snapshot existe et n'est pas ADMISSIBLE (publicationState). */
  "SNAPSHOT_NOT_ADMISSIBLE",
  ...PUBLIC_CLAIM_CONTRACT_CAUSES,
  /** Une ESTIMATE sans `methodRef` ni `natureBasis` — CHECK estimate_auditable. */
  "ESTIMATE_NOT_AUDITABLE",
  /** La charge du claim porte un champ de PUBLICATION. Propriété 1. */
  "PUBLICATION_IN_FOUNDATION",
  /** La charge du claim porte version, supersedes, contentHash ou id. */
  "VERSIONING_SUPPLIED",
  /** Le `claimId` existe déjà et aucune supplantation n'est déclarée. Propriété 2. */
  "SILENT_REWRITE",
  /** La supplantation vise une version qui n'est plus la dernière. */
  "STALE_SUPERSEDE",
  /** Une supplantation est déclarée, et le `claimId` n'existe pas. */
  "SUPERSEDES_NOTHING",
  /** La dernière version existante ne porte plus son sceau. On n'écrit pas par-dessus. */
  "SEAL_BROKEN",
  /** La supplantation ne change rien au contenu scellé : rien à versionner. */
  "CONTENT_UNCHANGED",
] as const;
export type FoundationRefusalCause = (typeof FOUNDATION_REFUSAL_CAUSES)[number];

/** Le dossier visé. `canonicalMint` est l'identité que les snapshots portent. */
export interface DossierIdentity {
  readonly ref: string;
  readonly canonicalMint: string;
}

/** Une ligne `EvidenceSnapshot` TELLE QUE LUE. Colonnes énumérées. */
export interface SnapshotRowInput {
  readonly id: string;
  readonly canonicalMint: string | null;
  readonly sha256: string | null;
  readonly sourceUrl: string | null;
  readonly observedAt: Date | string | null;
}

/**
 * Une source À CRÉER, dérivée d'un snapshot admissible. L'appelant ne fournit
 * NI `sha256`, NI `sourceUrl`, NI `capturedAt` : ils viennent du snapshot, et
 * de lui seul. Il n'y a donc pas de divergence possible entre la pièce et sa
 * source — elle est inexprimable.
 */
export interface SourceFromSnapshotInput {
  readonly kind: "FROM_SNAPSHOT";
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly sourceType: string;
  readonly caption?: string | null;
}

/** Une source DÉJÀ au registre du dossier, telle que lue. Jamais réécrite. */
export interface ExistingSourceInput {
  readonly kind: "EXISTING";
  readonly casefileRef: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly caption: string | null;
  readonly capturedAt: string | null;
  readonly sourceUrl: string | null;
  readonly sha256: string | null;
}

export type SourceInput = SourceFromSnapshotInput | ExistingSourceInput;

/**
 * L'assertion à fonder. AUCUN champ de publication, AUCUN champ de versioning :
 * le type ne les connaît pas, et la primitive refuse leur présence.
 */
export interface ClaimAssertionInput {
  readonly casefileRef: string;
  readonly claimId: string;
  readonly rowNature: unknown;
  readonly title: string;
  readonly titleFr?: string | null;
  readonly description?: string | null;
  readonly descriptionFr?: string | null;
  readonly category?: string | null;
  readonly severity?: string | null;
  readonly status?: string | null;
  /** `YYYY-MM-DD`, ou absent. La même forme que l'audit lit. */
  readonly claimDate?: string | null;
  readonly actors?: readonly string[] | null;
  /** Provenance complémentaire. N'entre PAS dans le contrat public. */
  readonly threadUrl?: string | null;
  readonly evidenceRefs: readonly string[];
  readonly methodRef?: string | null;
  readonly natureBasis?: Readonly<Record<string, unknown>> | null;
  /**
   * La DÉCLARATION de supplantation : la version que cette assertion remplace.
   * Obligatoire si le `claimId` existe, interdite sinon.
   */
  readonly supersedesVersion?: number;
}

/** Une révision existante du claim, telle que lue — avec son sceau. */
export interface ExistingClaimInput {
  readonly casefileRef: string;
  readonly claimId: string;
  readonly version: number;
  readonly contentHash: string | null;
  readonly title: string;
  readonly titleFr?: string | null;
  readonly description?: string | null;
  readonly descriptionFr?: string | null;
  readonly category?: string | null;
  readonly severity?: string | null;
  readonly status?: string | null;
  readonly claimDate?: string | null;
  readonly actors?: unknown;
  readonly threadUrl?: string | null;
  readonly evidenceRefs?: unknown;
}

export interface FoundationRequest {
  readonly dossier: DossierIdentity;
  readonly snapshots: readonly SnapshotRowInput[];
  readonly sources: readonly SourceInput[];
  readonly existingClaims: readonly ExistingClaimInput[];
  readonly claim: ClaimAssertionInput;
}

/** La ligne `CaseFileSource` à insérer. Dérivée, jamais saisie. */
export interface GovernedSourceRow {
  readonly casefileRef: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly caption: string | null;
  readonly sha256: string;
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly snapshotId: string;
}

/** La ligne `CaseFileClaim` à insérer. `state` est un LITTÉRAL. */
export interface GovernedClaimRow {
  readonly casefileRef: string;
  readonly claimId: string;
  readonly title: string;
  readonly titleFr: string | null;
  readonly description: string | null;
  readonly descriptionFr: string | null;
  readonly category: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly claimDate: string | null;
  readonly actors: readonly string[];
  readonly threadUrl: string | null;
  readonly evidenceRefs: readonly string[];
  readonly rowNature: DataNature;
  readonly methodRef: string | null;
  readonly natureBasis: Readonly<Record<string, unknown>> | null;
  readonly state: "ATTACHED";
  readonly version: number;
  /** La version supplantée, par identité applicative. Jamais un id de ligne. */
  readonly supersedes: { readonly claimId: string; readonly version: number } | null;
  readonly contentHash: string;
}

/** Ce que l'exécuteur DOIT revérifier dans sa transaction avant d'écrire. */
export interface FoundationPreconditions {
  readonly snapshots: ReadonlyArray<{ readonly id: string; readonly sha256: string }>;
  readonly sourceIdsExpectedAbsent: readonly string[];
  readonly latestExisting: {
    readonly claimId: string;
    readonly version: number;
    readonly contentHash: string | null;
  } | null;
}

declare const FONDEMENT_DECIDE: unique symbol;

/**
 * Un fondement DÉCIDÉ. Nominal : la marque ne s'obtient que de
 * `decideFoundation`. Un objet construit à la main ne compile pas sans cast,
 * et la marque d'exécution (`isDecidedFoundation`) le refuse quand même.
 */
export interface Foundation {
  readonly [FONDEMENT_DECIDE]: true;
  readonly casefileRef: string;
  readonly sourcesToInsert: readonly GovernedSourceRow[];
  readonly claimToInsert: GovernedClaimRow;
  /** Les pièces que le claim cite, résolues. Le registre de la libération. */
  readonly citedSources: readonly PublicSource[];
  readonly preconditions: FoundationPreconditions;
}

export type FoundationDecision =
  | { readonly decision: "FOUNDED"; readonly foundation: Foundation }
  | { readonly decision: "REFUSED"; readonly refusal: Refusal<FoundationRefusalCause> };

/** Les fondements passés par la décision. Même mécanisme que `assignRef`. */
const FONDEMENTS_DECIDES = new WeakSet<object>();

export function isDecidedFoundation(x: unknown): x is Foundation {
  return typeof x === "object" && x !== null && FONDEMENTS_DECIDES.has(x);
}

/** Ce qu'une charge de claim n'a pas le droit de porter, et pourquoi. */
const CLEFS_DE_PUBLICATION = ["state", "isPublic", "exclusionReason", "excludedField", "publishStatus"] as const;
const CLEFS_DE_VERSIONING = ["version", "supersedes", "contentHash", "id", "createdAt", "updatedAt"] as const;

const estObjet = (v: unknown): v is object =>
  typeof v === "object" && v !== null && !Array.isArray(v);
// Sans prédicat de type, à dessein : `Array.isArray` rétrécit un
// `readonly T[]` en `any[]`, et chaque élément perdrait son type.
const estTableau = (v: unknown): boolean => Array.isArray(v);
const estTexteOuAbsent = (v: unknown): v is string | null | undefined =>
  v === null || v === undefined || typeof v === "string";
const estDateJour = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const estEntierPositif = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1;
const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** L'instant d'observation, en ISO. `null` si illisible — donc non admissible. */
function isoInstant(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** La forme SCELLABLE, sous la normalisation MESURÉE de l'audit. */
function formeScellable(c: {
  claimId: string; title: string; titleFr?: string | null; description?: string | null;
  descriptionFr?: string | null; category?: string | null; severity?: string | null;
  status?: string | null; claimDate?: string | null; actors?: unknown;
  threadUrl?: string | null; evidenceRefs?: unknown;
}) {
  return {
    claimId: c.claimId,
    title: c.title,
    titleFr: c.titleFr ?? null,
    description: c.description ?? null,
    descriptionFr: c.descriptionFr ?? null,
    category: c.category ?? null,
    severity: c.severity ?? null,
    status: c.status ?? null,
    claimDate: c.claimDate ?? null,
    actors: asStrings(c.actors),
    threadUrl: c.threadUrl ?? null,
    evidenceRefs: asStrings(c.evidenceRefs),
  };
}

/**
 * DÉCISION 1 — le fondement. Pure, synchrone, sans base.
 *
 * Tout ce qui est refusé l'est par une cause NOMMÉE, à un emplacement NOMMÉ.
 * Rien n'est complété, corrigé ni deviné : une forme inattendue refuse.
 */
export function decideFoundation(request: FoundationRequest): FoundationDecision {
  const refuse = (cause: FoundationRefusalCause, at: string): FoundationDecision => ({
    decision: "REFUSED",
    refusal: { cause, at },
  });

  // ── Forme générale ────────────────────────────────────────────────────
  if (!estObjet(request)) return refuse("MALFORMED_INPUT", "request");
  const { dossier, snapshots, sources, existingClaims, claim } = request;
  if (!estObjet(dossier)) return refuse("MALFORMED_INPUT", "dossier");
  if (!estCleAcceptable(dossier.ref)) return refuse("MALFORMED_INPUT", "dossier.ref");
  if (!estCleAcceptable(dossier.canonicalMint)) return refuse("MALFORMED_INPUT", "dossier.canonicalMint");
  if (!estTableau(snapshots)) return refuse("MALFORMED_INPUT", "snapshots");
  if (!estTableau(sources)) return refuse("MALFORMED_INPUT", "sources");
  if (!estTableau(existingClaims)) return refuse("MALFORMED_INPUT", "existingClaims");
  if (!estObjet(claim)) return refuse("MALFORMED_INPUT", "claim");

  // ── Snapshots : lus, indexés, jamais complétés ────────────────────────
  const parSnapshot = new Map<string, SnapshotRowInput>();
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    if (!estObjet(s) || !estCleAcceptable(s.id)) return refuse("MALFORMED_INPUT", `snapshots[${i}]`);
    if (parSnapshot.has(s.id)) return refuse("MALFORMED_INPUT", `snapshots[${s.id}]`);
    parSnapshot.set(s.id, s);
  }

  // ── Sources : le registre = existantes ∪ dérivées ─────────────────────
  const registre = new Map<string, PublicSource>();
  const sourcesToInsert: GovernedSourceRow[] = [];
  const snapshotsEpingles: Array<{ id: string; sha256: string }> = [];

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!estObjet(src) || !estCleAcceptable(src.sourceId)) return refuse("MALFORMED_INPUT", `sources[${i}]`);
    const where = `sources[${src.sourceId}]`;
    if (registre.has(src.sourceId)) return refuse("MALFORMED_INPUT", where);
    if (!estCleAcceptable(src.sourceType)) return refuse("MALFORMED_INPUT", `${where}.sourceType`);
    if (!estTexteOuAbsent(src.caption)) return refuse("MALFORMED_INPUT", `${where}.caption`);

    if (src.kind === "FROM_SNAPSHOT") {
      if (!estCleAcceptable(src.snapshotId)) return refuse("MALFORMED_INPUT", `${where}.snapshotId`);
      const snap = parSnapshot.get(src.snapshotId);
      if (!snap) return refuse("SNAPSHOT_MISSING", src.snapshotId);
      const observedAt = isoInstant(snap.observedAt);
      if (!isAdmissible({ ...snap, observedAt })) {
        const manquant = !snap.canonicalMint ? "canonicalMint"
          : !snap.sha256 ? "sha256"
          : !snap.sourceUrl ? "sourceUrl"
          : "observedAt";
        return refuse("SNAPSHOT_NOT_ADMISSIBLE", `snapshots[${snap.id}].${manquant}`);
      }
      if (snap.canonicalMint !== dossier.canonicalMint) {
        return refuse("DOSSIER_MIX", `snapshots[${snap.id}].canonicalMint`);
      }
      // `isAdmissible` a établi les trois champs ; les `!` ci-dessous sont
      // des affirmations déjà prouvées, pas des espoirs.
      const ligne: GovernedSourceRow = {
        casefileRef: dossier.ref,
        sourceId: src.sourceId,
        sourceType: src.sourceType,
        caption: src.caption ?? null,
        sha256: snap.sha256 as string,
        sourceUrl: snap.sourceUrl as string,
        capturedAt: observedAt as string,
        snapshotId: snap.id,
      };
      sourcesToInsert.push(ligne);
      snapshotsEpingles.push({ id: snap.id, sha256: ligne.sha256 });
      registre.set(ligne.sourceId, {
        sourceId: ligne.sourceId, sourceType: ligne.sourceType, caption: ligne.caption,
        capturedAt: ligne.capturedAt, sourceUrl: ligne.sourceUrl, sha256: ligne.sha256,
      });
    } else if (src.kind === "EXISTING") {
      if (src.casefileRef !== dossier.ref) return refuse("DOSSIER_MIX", `${where}.casefileRef`);
      if (!estTexteOuAbsent(src.sha256) || !estTexteOuAbsent(src.sourceUrl) || !estTexteOuAbsent(src.capturedAt)) {
        return refuse("MALFORMED_INPUT", `${where}.provenance`);
      }
      registre.set(src.sourceId, {
        sourceId: src.sourceId, sourceType: src.sourceType, caption: src.caption ?? null,
        capturedAt: src.capturedAt ?? null, sourceUrl: src.sourceUrl ?? null, sha256: src.sha256 ?? null,
      });
    } else {
      return refuse("MALFORMED_INPUT", `${where}.kind`);
    }
  }

  // ── Le claim : aucune publication, aucun versioning dans la charge ────
  for (const k of CLEFS_DE_PUBLICATION) {
    if (k in claim) return refuse("PUBLICATION_IN_FOUNDATION", `claim.${k}`);
  }
  for (const k of CLEFS_DE_VERSIONING) {
    if (k in claim) return refuse("VERSIONING_SUPPLIED", `claim.${k}`);
  }
  if (claim.casefileRef !== dossier.ref) return refuse("DOSSIER_MIX", "claim.casefileRef");
  if (!estCleAcceptable(claim.claimId)) return refuse("MALFORMED_INPUT", "claim.claimId");
  if (typeof claim.title !== "string" || claim.title.trim() === "") return refuse("MALFORMED_INPUT", "claim.title");
  for (const k of ["titleFr", "description", "descriptionFr", "category", "severity", "status", "threadUrl", "methodRef"] as const) {
    if (!estTexteOuAbsent(claim[k])) return refuse("MALFORMED_INPUT", `claim.${k}`);
  }
  if (claim.claimDate !== null && claim.claimDate !== undefined && !estDateJour(claim.claimDate)) {
    return refuse("MALFORMED_INPUT", "claim.claimDate");
  }
  if (claim.actors !== null && claim.actors !== undefined) {
    if (!Array.isArray(claim.actors) || !claim.actors.every((a) => typeof a === "string")) {
      return refuse("MALFORMED_INPUT", "claim.actors");
    }
  }
  if (claim.natureBasis !== null && claim.natureBasis !== undefined && !estObjet(claim.natureBasis)) {
    return refuse("MALFORMED_INPUT", "claim.natureBasis");
  }
  if (claim.supersedesVersion !== undefined && !estEntierPositif(claim.supersedesVersion)) {
    return refuse("MALFORMED_INPUT", "claim.supersedesVersion");
  }

  // ── Le contrat public — la primitive partagée, première consommation ──
  const contrat = decidePublicClaimContract(claim, registre);
  if (contrat.verdict === "UNMET") return refuse(contrat.refusal.cause, contrat.refusal.at);

  // Même règle que le CHECK estimate_auditable : une ESTIMATE reste auditable.
  const natureBasis = claim.natureBasis ?? null;
  const methodRef = claim.methodRef ?? null;
  if (contrat.nature === "ESTIMATE" && !methodRef && (!natureBasis || Object.keys(natureBasis).length === 0)) {
    return refuse("ESTIMATE_NOT_AUDITABLE", "claim.methodRef");
  }

  // ── Versioning : supplanter, jamais écraser ───────────────────────────
  for (let i = 0; i < existingClaims.length; i++) {
    const e = existingClaims[i];
    if (!estObjet(e) || !estCleAcceptable(e.claimId) || !estEntierPositif(e.version)) {
      return refuse("MALFORMED_INPUT", `existingClaims[${i}]`);
    }
    if (e.casefileRef !== dossier.ref) return refuse("DOSSIER_MIX", `existingClaims[${e.claimId}].casefileRef`);
  }
  const derniere = latestVersions(existingClaims).find((e) => e.claimId === claim.claimId) ?? null;

  const scellable = formeScellable({ ...claim, evidenceRefs: contrat.refs });
  const contentHash = claimContentHash(scellable);

  let version = 1;
  let supersedes: GovernedClaimRow["supersedes"] = null;
  if (derniere) {
    if (claim.supersedesVersion === undefined) return refuse("SILENT_REWRITE", claim.claimId);
    if (claim.supersedesVersion !== derniere.version) return refuse("STALE_SUPERSEDE", claim.claimId);
    const derniereScellable = { ...formeScellable(derniere), version: derniere.version, contentHash: derniere.contentHash };
    // Un sceau posé qui ne tient plus : la ligne a déjà été modifiée en
    // place. Écrire par-dessus effacerait la trace. `null` = jamais scellé,
    // qui n'est pas une altération — on versionne quand même.
    if (derniere.contentHash && !isSealIntact(derniereScellable)) return refuse("SEAL_BROKEN", claim.claimId);
    if (claimContentHash(derniereScellable) === contentHash) return refuse("CONTENT_UNCHANGED", claim.claimId);
    version = derniere.version + 1;
    supersedes = { claimId: derniere.claimId, version: derniere.version };
  } else if (claim.supersedesVersion !== undefined) {
    return refuse("SUPERSEDES_NOTHING", claim.claimId);
  }

  const claimToInsert: GovernedClaimRow = {
    casefileRef: dossier.ref,
    claimId: claim.claimId,
    title: claim.title,
    titleFr: scellable.titleFr,
    description: scellable.description,
    descriptionFr: scellable.descriptionFr,
    category: scellable.category,
    severity: scellable.severity,
    status: scellable.status,
    claimDate: scellable.claimDate,
    actors: scellable.actors,
    threadUrl: scellable.threadUrl,
    evidenceRefs: contrat.refs,
    rowNature: contrat.nature,
    methodRef,
    natureBasis,
    state: "ATTACHED",
    version,
    supersedes,
    contentHash,
  };

  const foundation = {
    casefileRef: dossier.ref,
    sourcesToInsert,
    claimToInsert,
    citedSources: contrat.cited,
    preconditions: {
      snapshots: snapshotsEpingles,
      sourceIdsExpectedAbsent: sourcesToInsert.map((s) => s.sourceId),
      latestExisting: derniere
        ? { claimId: derniere.claimId, version: derniere.version, contentHash: derniere.contentHash }
        : null,
    },
  } as unknown as Foundation;
  FONDEMENTS_DECIDES.add(foundation);
  return { decision: "FOUNDED", foundation: Object.freeze(foundation) };
}

// ═══ LA LIBÉRATION — décision 2 ═════════════════════════════════════════════

/** LA valeur qui autorise. Le seul littéral de ce genre dans le dépôt. */
export const EXPLICIT_PUBLIC_DECISION = "EXPLICIT_PUBLIC_DECISION" as const;

/**
 * L'autorité de publication, EXPLICITE. Elle nomme qui décide, quand, et
 * QUELLE version exacte — une autorité qui viserait « le claim » sans version
 * publierait ce qu'on écrira ensuite.
 */
export interface ExplicitPublicationAuthority {
  readonly kind: typeof EXPLICIT_PUBLIC_DECISION;
  readonly decidedBy: string;
  /** ISO-8601 UTC strict, `Z` obligatoire. */
  readonly decidedAt: string;
  readonly casefileRef: string;
  readonly claimId: string;
  readonly version: number;
}

export const RELEASE_REFUSAL_CAUSES = [
  /** L'objet n'est pas passé par `decideFoundation`. */
  "NOT_A_FOUNDATION",
  /** Aucune autorité, ou une forme qui n'en est pas une. */
  "NO_EXPLICIT_AUTHORITY",
  /** L'autorité vise un autre dossier, un autre claim ou une autre version. */
  "AUTHORITY_TARGET_MISMATCH",
  ...PUBLIC_CLAIM_CONTRACT_CAUSES,
] as const;
export type ReleaseRefusalCause = (typeof RELEASE_REFUSAL_CAUSES)[number];

/** Le plan de libération : une cible EXACTE et l'autorité qui la vise. */
export interface PublicRelease {
  readonly target: {
    readonly casefileRef: string;
    readonly claimId: string;
    readonly version: number;
    readonly expectedContentHash: string;
  };
  readonly authority: ExplicitPublicationAuthority;
}

export type ReleaseDecision =
  | { readonly decision: "RELEASABLE"; readonly release: PublicRelease }
  | { readonly decision: "REFUSED"; readonly refusal: Refusal<ReleaseRefusalCause> };

const ISO_UTC_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * DÉCISION 2 — la libération. Pure, synchrone, sans base.
 *
 * Elle ne fait PAS confiance au fondement : elle re-dérive le contrat public
 * sur la ligne à publier, contre les pièces citées. C'est la seconde
 * consommation de la primitive partagée — et c'est ce qui fait qu'un
 * fondement altéré après décision ne se publie pas.
 */
export function decidePublicRelease(foundation: Foundation, authority: ExplicitPublicationAuthority): ReleaseDecision {
  const refuse = (cause: ReleaseRefusalCause, at: string): ReleaseDecision => ({
    decision: "REFUSED",
    refusal: { cause, at },
  });

  if (!isDecidedFoundation(foundation)) return refuse("NOT_A_FOUNDATION", "foundation");

  if (!estObjet(authority)) return refuse("NO_EXPLICIT_AUTHORITY", "authority");
  const a = authority as unknown as Record<string, unknown>;
  if (a.kind !== EXPLICIT_PUBLIC_DECISION) return refuse("NO_EXPLICIT_AUTHORITY", "authority.kind");
  if (!estCleAcceptable(a.decidedBy)) return refuse("NO_EXPLICIT_AUTHORITY", "authority.decidedBy");
  if (typeof a.decidedAt !== "string" || !ISO_UTC_STRICT.test(a.decidedAt)) {
    return refuse("NO_EXPLICIT_AUTHORITY", "authority.decidedAt");
  }

  const row = foundation.claimToInsert;
  if (a.casefileRef !== row.casefileRef) return refuse("AUTHORITY_TARGET_MISMATCH", "authority.casefileRef");
  if (a.claimId !== row.claimId) return refuse("AUTHORITY_TARGET_MISMATCH", "authority.claimId");
  if (a.version !== row.version) return refuse("AUTHORITY_TARGET_MISMATCH", "authority.version");

  const registre = new Map(foundation.citedSources.map((s) => [s.sourceId, s]));
  const contrat = decidePublicClaimContract(row, registre);
  if (contrat.verdict === "UNMET") return refuse(contrat.refusal.cause, contrat.refusal.at);

  return {
    decision: "RELEASABLE",
    release: {
      target: {
        casefileRef: row.casefileRef,
        claimId: row.claimId,
        version: row.version,
        expectedContentHash: row.contentHash,
      },
      authority: {
        kind: EXPLICIT_PUBLIC_DECISION,
        decidedBy: a.decidedBy,
        decidedAt: a.decidedAt,
        casefileRef: row.casefileRef,
        claimId: row.claimId,
        version: row.version,
      },
    },
  };
}
