// ─── SPINE-00 — L'EXÉCUTEUR GOUVERNÉ ────────────────────────────────────────
//
// ██  Créer le fondement n'est pas publier le claim.                        ██
// ██  L'état public est une PROJECTION d'une décision persistée.            ██
//
// Deux chemins, deux fonctions, deux types d'entrée qui ne se recouvrent pas :
//
//   (I)  executeFoundation — une CaseFileSource dérivée d'un EvidenceSnapshot
//        et un CaseFileClaim versionné, en ATTACHED. Rien de PUBLIC, jamais :
//        l'INSERT porte le littéral 'ATTACHED', et l'entrée ne connaît aucun
//        champ de publication (decideFoundation refuse PUBLICATION_IN_FOUNDATION).
//   (II) executeRelease — persiste la décision GRANT, la relit, la juge, puis
//        promeut. La SEULE écriture de `state = 'PUBLIC'` de src/.
//   (III) executeRevoke — persiste la décision REVOKE, la relit, la juge, puis
//        RAMÈNE la version de PUBLIC à ATTACHED. La SEULE écriture de
//        `state = 'ATTACHED'` de src/ (le fondement INSÈRE 'ATTACHED' ; il ne
//        transite pas). Ne supprime rien, ne modifie aucune version, ne touche
//        à aucun sceau. (T1-REVOKE-ELIGIBILITY)
//
// ─── Pourquoi la décision et l'écriture partagent la transaction ──────────
//
// L'en-tête de governedWriter décrivait un plan décidé hors transaction puis
// revérifié dedans. Ici la décision EST prise dans la transaction, sur des
// lignes lues sous verrou (`FOR UPDATE` sur les versions du claim, `FOR SHARE`
// sur le dossier et les pièces). Il n'y a donc pas de préconditions à rejouer :
// ce que la décision a vu est ce que l'INSERT trouvera. C'est plus fort, et
// c'est plus court.
//
// ─── SQL brut, connexion injectée ─────────────────────────────────────────
//
// `prisma/` est gelé : la table de décisions n'a pas de modèle ORM, comme
// `governed_objects` (registre.ts). Tout passe par `db.query(sql, params)` sur
// une connexion que l'appelant fournit dans une transaction qu'il ouvre —
// `SqlTransactor`. L'adaptateur de production est `governedExecutorPrisma.ts` ;
// les preuves tournent sur un Postgres jetable et, en transaction annulée, sur
// la production. Le SQL est ÉCRIT EN CLAIR à chaque appel, jamais assemblé :
// la garde S24 découvre les tables atteintes en lisant ces gabarits.
//
// ─── Fail closed ──────────────────────────────────────────────────────────
//
// Tout refus est un `GovernedAbort` levé DANS la transaction : le transactor
// annule, l'appelant reçoit une cause NOMMÉE et un emplacement. Une erreur
// inattendue (réseau, contrainte imprévue) n'est PAS traduite en refus : elle
// remonte telle quelle, et la transaction est annulée de la même façon. Rien
// n'est écrit à moitié.

import {
  attestPersistedDecision,
  decideFoundation,
  decidePublicRelease,
  decideRevoke,
  isRevocationCause,
  type RevokeIntent,
  type RevokeRefusalCause,
  type ClaimAssertionInput,
  type DossierIdentity,
  type ExistingClaimInput,
  type ExistingSourceInput,
  type Foundation,
  type FoundationRefusalCause,
  type GovernedClaimRow,
  type GovernedSourceRow,
  type PersistedDecisionRow,
  type Refusal,
  type ReleaseIntent,
  type ReleaseRefusalCause,
  type ReleaseTargetRow,
  type SnapshotRowInput,
  type SourceFromSnapshotInput,
} from "./governedWriter";
import { canonicalSealMaterial, claimContentHash } from "./versioning";
import { isSealIntact } from "./sealGuard";
import {
  provenanceDecoration,
  readLatestJournalRows,
  resolveJournalProvenance,
  type JournalRow,
} from "./journalProvenance";
import type { PublicSource } from "./canonicalReader";

// ═══ LA CONNEXION, INJECTÉE ═════════════════════════════════════════════════

/** Une connexion DANS une transaction. `$1..$n` positionnels, rendu en lignes. */
export interface SqlRunner {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}

/**
 * Ouvre une transaction, exécute, VALIDE si `fn` rend, ANNULE si `fn` lève.
 * Isolation attendue : REPEATABLE READ au minimum.
 */
export interface SqlTransactor {
  transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T>;
}

// ═══ LES CAUSES PROPRES À L'EXÉCUTION ═══════════════════════════════════════

export const FOUNDATION_EXECUTION_CAUSES = [
  /** `token_casefiles` ne porte pas ce `ref`. */
  "DOSSIER_ABSENT",
  /** Une pièce à dériver existe déjà sous ce `sourceId` avec un AUTRE contenu. */
  "SOURCE_COLLISION",
  /** Le claim existe au même contenu mais une de ses pièces manque : état que l'atomicité interdit. */
  "INCONSISTENT_STATE",
  /** La supplantation déclarée n'a pas trouvé sa ligne au moment de l'INSERT. */
  "SUPERSEDES_UNRESOLVED",
] as const;
export type FoundationExecutionCause = (typeof FOUNDATION_EXECUTION_CAUSES)[number];

export const RELEASE_EXECUTION_CAUSES = [
  /** Aucune ligne `(casefileRef, claimId, version)`. */
  "TARGET_MISSING",
  /** Le sceau de la ligne ne tient plus : modifiée en place. On ne publie pas par-dessus. */
  "SEAL_BROKEN",
  /** L'INSERT de la décision n'a pas rendu d'id. */
  "DECISION_NOT_RECORDED",
  /** L'UPDATE gardé n'a touché aucune ligne : l'état a bougé sous le verrou. */
  "PROMOTION_NOT_APPLIED",
] as const;
export type ReleaseExecutionCause = (typeof RELEASE_EXECUTION_CAUSES)[number];

export class GovernedAbort<C extends string> extends Error {
  constructor(readonly cause: C, readonly at: string) {
    super(`[casefile/executor] ABORT ${cause} @ ${at}`);
    this.name = "GovernedAbort";
  }
}

// ═══ (I) LE FONDEMENT ═══════════════════════════════════════════════════════

/** Ce que l'appelant fournit. Aucun sha256, aucune URL : ils viennent du snapshot. */
export interface FoundationIntent {
  readonly dossier: DossierIdentity;
  readonly sources: readonly SourceFromSnapshotInput[];
  readonly claim: ClaimAssertionInput;
}

export type FoundationOutcome =
  | {
      readonly outcome: "EXECUTED";
      readonly claim: { casefileRef: string; claimId: string; version: number; contentHash: string };
      readonly sourcesInserted: readonly string[];
    }
  | {
      /** Le même contenu est déjà en base : rien n'a été écrit. */
      readonly outcome: "ALREADY_EXECUTED";
      readonly claim: { casefileRef: string; claimId: string; version: number; contentHash: string };
    }
  | { readonly outcome: "REFUSED"; readonly refusal: Refusal<FoundationRefusalCause> }
  | { readonly outcome: "ABORTED"; readonly refusal: Refusal<FoundationExecutionCause> };

interface SnapshotRow extends Record<string, unknown> {
  id: string; canonicalMint: string | null; sha256: string | null; sourceUrl: string | null; observedAt: string | null;
}
interface SourceRow extends Record<string, unknown> {
  sourceId: string; sourceType: string; caption: string | null; capturedAt: string | null;
  sourceUrl: string | null; sha256: string | null; snapshotId: string | null;
}
interface ClaimVersionRow extends Record<string, unknown> {
  claimId: string; version: number; contentHash: string | null; title: string; titleFr: string | null;
  description: string | null; descriptionFr: string | null; category: string | null; severity: string | null;
  status: string | null; claimDate: string | null; actors: unknown; threadUrl: string | null; evidenceRefs: unknown;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Les pièces déjà au registre, sous la forme que la décision et le contrat
 * lisent, décorées par la provenance QUE LE JOURNAL REND.
 *
 * T1-BASCULE-DU-CONTRAT — les lignes du journal sont lues UNE fois par
 * transaction et passées ici. La résolution est pure : elle ne va pas
 * chercher, elle filtre sur le pont (`snapshotId`) les lignes qu'on lui donne.
 */
const toExisting = (casefileRef: string, s: SourceRow, journal: readonly JournalRow[]): ExistingSourceInput => ({
  kind: "EXISTING", casefileRef, sourceId: s.sourceId, sourceType: s.sourceType, caption: s.caption,
  capturedAt: s.capturedAt, sourceUrl: s.sourceUrl, sha256: s.sha256, snapshotId: s.snapshotId,
  ...provenanceDecoration(resolveJournalProvenance({ sourceId: s.sourceId, snapshotId: s.snapshotId }, journal)),
});

const memeInstant = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return a === b;
  const da = new Date(a).getTime(), db = new Date(b).getTime();
  return !Number.isNaN(da) && da === db;
};

/**
 * (I) Fonder : source(s) dérivée(s) + claim versionné, ATTACHED, en UNE
 * transaction. Réexécutable : rejouer le même fondement rend ALREADY_EXECUTED.
 */
export async function executeFoundation(tx: SqlTransactor, intent: FoundationIntent): Promise<FoundationOutcome> {
  try {
    return await tx.transaction(async (db) => {
      const { dossier, claim } = intent;
      if (!estObjet(dossier) || typeof dossier.ref !== "string") {
        return { outcome: "REFUSED", refusal: { cause: "MALFORMED_INPUT", at: "dossier.ref" } };
      }
      const sourcesVoulues: readonly SourceFromSnapshotInput[] = Array.isArray(intent.sources) ? intent.sources : [];

      // ── Le dossier existe, et il est tenu (FOR SHARE) le temps d'écrire.
      const dossiers = await db.query<{ ref: string }>(
        `SELECT ref FROM token_casefiles WHERE ref = $1 FOR SHARE`,
        [dossier.ref],
      );
      if (dossiers.length === 0) throw new GovernedAbort<FoundationExecutionCause>("DOSSIER_ABSENT", dossier.ref);

      // ── Les snapshots cités, TELS QUE LUS. Un id absent restera absent :
      //    SNAPSHOT_MISSING est rendu par la décision, pas deviné ici.
      const snapshotIds = sourcesVoulues.map((s) => (estObjet(s) ? s.snapshotId : null)).filter((x): x is string => typeof x === "string");
      const snapshots = snapshotIds.length === 0 ? [] : await db.query<SnapshotRow>(
        `SELECT id, "canonicalMint", sha256, "sourceUrl", "observedAt"::text AS "observedAt"
           FROM "EvidenceSnapshot"
          WHERE id IN (SELECT jsonb_array_elements_text($1::jsonb))
          FOR SHARE`,
        [JSON.stringify(snapshotIds)],
      );
      const parSnapshot = new Map(snapshots.map((s) => [s.id, s]));

      // ── Le registre existant du dossier, tenu (FOR SHARE).
      const existantes = await db.query<SourceRow>(
        `SELECT "sourceId", "sourceType", caption, "capturedAt"::text AS "capturedAt", "sourceUrl", sha256, "snapshotId"
           FROM "CaseFileSource" WHERE "casefileRef" = $1 ORDER BY "sourceId" FOR SHARE`,
        [dossier.ref],
      );
      const parSourceId = new Map(existantes.map((s) => [s.sourceId, s]));

      // ── IDEMPOTENCE des pièces, par identité de contenu : une pièce voulue
      //    déjà présente avec le MÊME (sha256, sourceUrl, capturedAt, snapshotId)
      //    n'est pas réinsérée ; différente, c'est une COLLISION — fail closed.
      const aDeriver: SourceFromSnapshotInput[] = [];
      for (const s of sourcesVoulues) {
        if (!estObjet(s) || typeof s.sourceId !== "string") { aDeriver.push(s); continue; }
        const deja = parSourceId.get(s.sourceId);
        if (!deja) { aDeriver.push(s); continue; }
        const snap = parSnapshot.get(s.snapshotId);
        const identique = !!snap && deja.snapshotId === snap.id && deja.sha256 === snap.sha256
          && deja.sourceUrl === snap.sourceUrl && memeInstant(deja.capturedAt, snap.observedAt)
          && deja.sourceType === s.sourceType;
        if (!identique) throw new GovernedAbort<FoundationExecutionCause>("SOURCE_COLLISION", s.sourceId);
      }

      // ── Les versions existantes du claim, VERROUILLÉES (FOR UPDATE).
      const claimId = estObjet(claim) && typeof claim.claimId === "string" ? claim.claimId : null;
      const versions = claimId === null ? [] : await db.query<ClaimVersionRow>(
        `SELECT "claimId", version, "contentHash", title, "titleFr", description, "descriptionFr",
                category, severity, status, "claimDate"::text AS "claimDate", actors, "threadUrl", "evidenceRefs"
           FROM "CaseFileClaim" WHERE "casefileRef" = $1 AND "claimId" = $2 ORDER BY version FOR UPDATE`,
        [dossier.ref, claimId],
      );
      const existingClaims: ExistingClaimInput[] = versions.map((v) => ({ casefileRef: dossier.ref, ...v }));

      // ── T1-BASCULE-DU-CONTRAT — LE JOURNAL, LU DANS LA MÊME TRANSACTION ─
      //
      // Une seule requête pour tous les ponts en jeu : les snapshots cités par
      // les pièces à dériver, et ceux des pièces déjà au registre. Lire le
      // journal DANS la transaction n'est pas un détail : la décision doit
      // juger la provenance TELLE QU'ELLE EST au moment où elle écrit, pas
      // telle qu'elle était quand le plan a été formé.
      const journal = await readLatestJournalRows(db, [
        ...snapshots.map((s) => s.id),
        ...existantes.map((s) => s.snapshotId).filter((x): x is string => typeof x === "string"),
      ]);

      // ── LA DÉCISION, sur ces lignes-là.
      //
      // Pour un SNAPSHOT, le pont est l'identité : `evidence_provenance_journal`
      // est indexé par `evidence_snapshot_id`, donc la pièce EST son propre
      // pont. Aucun repli par sha256 — nommément interdit (journalProvenance).
      const snapshotInputs: SnapshotRowInput[] = snapshots.map((s) => ({
        id: s.id, canonicalMint: s.canonicalMint, sha256: s.sha256, sourceUrl: s.sourceUrl, observedAt: s.observedAt,
        ...provenanceDecoration(resolveJournalProvenance({ sourceId: s.id, snapshotId: s.id }, journal)),
      }));
      const decision = decideFoundation({
        dossier,
        snapshots: snapshotInputs,
        sources: [...existantes.map((s) => toExisting(dossier.ref, s, journal)), ...aDeriver],
        existingClaims,
        claim,
      });

      if (decision.decision === "REFUSED") {
        // IDEMPOTENCE du claim, par identité de contenu = le sceau canonique.
        // Un REJEU trouve son claim déjà là : la décision dit SILENT_REWRITE
        // (rejeu d'une création : pas de supplantation déclarée) ou
        // STALE_SUPERSEDE (rejeu d'une correction : la version qu'il supplante
        // n'est plus la dernière, parce que la correction EST la dernière). Si
        // la DERNIÈRE version porte EXACTEMENT le sceau voulu, rien n'est à
        // écrire : ALREADY_EXECUTED.
        //
        // CONTENT_UNCHANGED n'en fait PAS partie : « supplanter la dernière
        // version par un contenu identique » n'est pas le rejeu d'un plan
        // exécuté, c'est une intention neuve qui ne change rien. Elle reste
        // REFUSÉE, avec sa cause.
        const { cause } = decision.refusal;
        const derniere = versions.length > 0 ? versions[versions.length - 1] : null;
        if (derniere && estObjet(claim) && typeof claim.title === "string"
          && (cause === "SILENT_REWRITE" || cause === "STALE_SUPERSEDE")) {
          const voulu = claimContentHash(canonicalSealMaterial(claim as ClaimAssertionInput));
          if (derniere.contentHash === voulu) {
            if (aDeriver.length > 0) {
              // Le claim est là, une de ses pièces ne l'est pas : l'atomicité
              // a été contournée quelque part. On ne complète pas en silence.
              throw new GovernedAbort<FoundationExecutionCause>("INCONSISTENT_STATE", aDeriver[0].sourceId);
            }
            return {
              outcome: "ALREADY_EXECUTED",
              claim: { casefileRef: dossier.ref, claimId: derniere.claimId, version: derniere.version, contentHash: voulu },
            };
          }
        }
        return { outcome: "REFUSED", refusal: decision.refusal };
      }

      // ── L'ÉCRITURE — les pièces, puis le claim. Même transaction.
      const f: Foundation = decision.foundation;
      for (const s of f.sourcesToInsert) await insererSource(db, s);
      const row = f.claimToInsert;
      await insererClaim(db, row);

      return {
        outcome: "EXECUTED",
        claim: { casefileRef: row.casefileRef, claimId: row.claimId, version: row.version, contentHash: row.contentHash },
        sourcesInserted: f.sourcesToInsert.map((s) => s.sourceId),
      };
    });
  } catch (e) {
    if (e instanceof GovernedAbort) return { outcome: "ABORTED", refusal: { cause: e.cause as FoundationExecutionCause, at: e.at } };
    throw e;
  }
}

async function insererSource(db: SqlRunner, s: GovernedSourceRow): Promise<void> {
  await db.query(
    `INSERT INTO "CaseFileSource" ("casefileRef", "sourceId", "sourceType", caption, "capturedAt", "sourceUrl", sha256, "snapshotId")
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8)
     RETURNING "sourceId"`,
    [s.casefileRef, s.sourceId, s.sourceType, s.caption, s.capturedAt, s.sourceUrl, s.sha256, s.snapshotId],
  );
}

async function insererClaim(db: SqlRunner, c: GovernedClaimRow): Promise<void> {
  // `supersedes` est résolu ICI, par sous-requête sur l'identité applicative :
  // la décision ne connaît aucun identifiant de ligne. `state` est un LITTÉRAL.
  const rows = await db.query<{ version: number; chained: boolean }>(
    `INSERT INTO "CaseFileClaim"
       ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr", category, severity, status,
        "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", "natureBasis", "methodRef",
        state, version, supersedes, "contentHash")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             $10::date, $11::jsonb, $12, $13::jsonb, $14::"DataNature", $15::jsonb, $16,
             'ATTACHED'::"ArtifactState", $17,
             CASE WHEN $18::int IS NULL THEN NULL
                  ELSE (SELECT p.id FROM "CaseFileClaim" p WHERE p."casefileRef" = $1 AND p."claimId" = $2 AND p.version = $18::int) END,
             $19)
     RETURNING version, (supersedes IS NOT NULL) AS chained`,
    [
      c.casefileRef, c.claimId, c.title, c.titleFr, c.description, c.descriptionFr, c.category, c.severity, c.status,
      c.claimDate, JSON.stringify(c.actors), c.threadUrl, JSON.stringify(c.evidenceRefs), c.rowNature,
      c.natureBasis === null ? null : JSON.stringify(c.natureBasis), c.methodRef,
      c.version, c.supersedes ? c.supersedes.version : null, c.contentHash,
    ],
  );
  if (c.supersedes && !(rows[0]?.chained)) {
    throw new GovernedAbort<FoundationExecutionCause>("SUPERSEDES_UNRESOLVED", `${c.claimId}@v${c.supersedes.version}`);
  }
}

// ═══ (II) LA LIBÉRATION ═════════════════════════════════════════════════════

/** Qui décide, et quand SELON LUI. La base horodate elle-même l'écriture. */
export interface ReleaseAuthorityInput {
  readonly decidedBy: string;
  /** ISO-8601 UTC strict, `Z` obligatoire. */
  readonly decidedAt: string;
}

export type ReleaseOutcome =
  | {
      readonly outcome: "RELEASED";
      readonly target: { casefileRef: string; claimId: string; version: number; contentHash: string };
      readonly decisionId: string;
    }
  | { readonly outcome: "REFUSED"; readonly refusal: Refusal<ReleaseRefusalCause> }
  | { readonly outcome: "ABORTED"; readonly refusal: Refusal<ReleaseExecutionCause> };

interface TargetRow extends ReleaseTargetRow, Record<string, unknown> {
  title: string; titleFr: string | null; description: string | null; descriptionFr: string | null;
  category: string | null; severity: string | null; status: string | null; claimDate: string | null;
  actors: unknown; threadUrl: string | null;
}
interface DecisionRow extends Record<string, unknown> {
  id: string; casefile_ref: string; claim_id: string; claim_version: number; audience: string;
  decision: string; decided_by: string; decided_at: string; cause: string | null;
}

const ISO_UTC_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** L'autorité est-elle bien formée ? Le même test pour libérer et pour révoquer. */
const autoriteMalformee = (authority: ReleaseAuthorityInput): string | null => {
  if (!estObjet(authority) || typeof authority.decidedBy !== "string" || authority.decidedBy.trim() === "" || authority.decidedBy.trim() !== authority.decidedBy) {
    return "authority.decidedBy";
  }
  if (typeof authority.decidedAt !== "string" || !ISO_UTC_STRICT.test(authority.decidedAt)) return "authority.decidedAt";
  return null;
};

/** L'emplacement d'un refus : `claimId@vN`. Un nom, jamais un contenu. */
const emplacement = (c: { readonly claimId: string; readonly version: number }): string => [c.claimId, "v" + String(c.version)].join("@");

/** La cible d'une décision : les quatre colonnes qui l'identifient. */
interface CibleDecision {
  readonly casefileRef: string;
  readonly claimId: string;
  readonly version: number;
  readonly audience: string;
}

/**
 * a) LE VERROU — la ligne exacte, et elle seule. Partagé par la libération et
 * la révocation ; l'une exige ensuite ATTACHED, l'autre PUBLIC.
 */
async function verrouillerCible<C extends string>(db: SqlRunner, cible: CibleDecision): Promise<TargetRow> {
  const cibles = await db.query<TargetRow>(
    `SELECT "casefileRef", "claimId", version, state::text AS state, "contentHash", "rowNature"::text AS "rowNature",
            "evidenceRefs", title, "titleFr", description, "descriptionFr", category, severity, status,
            "claimDate"::text AS "claimDate", actors, "threadUrl"
       FROM "CaseFileClaim"
      WHERE "casefileRef" = $1 AND "claimId" = $2 AND version = $3
      FOR UPDATE`,
    [cible.casefileRef, cible.claimId, cible.version],
  );
  if (cibles.length === 0) throw new GovernedAbort<C>("TARGET_MISSING" as C, emplacement(cible));
  const row = cibles[0];
  if (row.contentHash && !isSealIntact(row)) throw new GovernedAbort<C>("SEAL_BROKEN" as C, emplacement(row));
  return row;
}

/**
 * c) LA RELECTURE — la dernière décision de la cible, depuis la base, puis
 * son ATTESTATION. Le SEUL appel d'`attestPersistedDecision` de src/ : la
 * libération et la révocation relisent ici, toutes deux, juste après leur
 * INSERT respectif.
 */
async function relireDerniereDecision(db: SqlRunner, cible: CibleDecision) {
  const relues = await db.query<DecisionRow>(
    `SELECT id::text AS id, casefile_ref, claim_id, claim_version, audience, decision, decided_by, decided_at::text AS decided_at, cause
       FROM casefile_claim_publication_decisions
      WHERE casefile_ref = $1 AND claim_id = $2 AND claim_version = $3 AND audience = $4
      ORDER BY id DESC LIMIT 1`,
    [cible.casefileRef, cible.claimId, cible.version, cible.audience],
  );
  const relue = relues[0];
  return relue ? attestPersistedDecision(toPersistedRow(relue)) : null;
}

/**
 * (II) Libérer : la séquence du ruling, dans UNE transaction.
 *
 *   a) verrouiller la ligne visée · b) insérer la décision GRANT, prendre son id
 *   c) relire la dernière décision de la cible · d) trois conditions, sinon ABORT
 *   e) alors seulement, UPDATE gardé par state = 'ATTACHED' ET contentHash.
 *
 * Il n'existe aucune autre fonction qui écrive `state`. Une promotion sans
 * décision persistée n'est pas refusée : elle n'est pas exprimable par ce module.
 */
export async function executeRelease(
  tx: SqlTransactor,
  intent: ReleaseIntent,
  authority: ReleaseAuthorityInput,
): Promise<ReleaseOutcome> {
  const malformee = autoriteMalformee(authority);
  if (malformee) return { outcome: "REFUSED", refusal: { cause: "NO_PERSISTED_DECISION", at: malformee } };
  try {
    return await tx.transaction(async (db) => {
      // a) LE VERROU — la ligne exacte, et elle seule.
      const row = await verrouillerCible<ReleaseExecutionCause>(db, intent);

      // b) LA DÉCISION, PERSISTÉE. `id` est l'ordre total, rendu en texte.
      //    'GRANT' est un LITTÉRAL : ce chemin ne peut écrire que lui.
      const inserees = await db.query<{ id: string }>(
        `INSERT INTO casefile_claim_publication_decisions
           (casefile_ref, claim_id, claim_version, audience, decision, decided_by, decided_at)
         VALUES ($1, $2, $3, $4, 'GRANT', $5, $6::timestamptz)
         RETURNING id::text AS id`,
        [intent.casefileRef, intent.claimId, intent.version, intent.audience, authority.decidedBy, authority.decidedAt],
      );
      const insertedId = inserees[0]?.id;
      if (typeof insertedId !== "string" || insertedId === "") throw new GovernedAbort<ReleaseExecutionCause>("DECISION_NOT_RECORDED", "decision.id");

      // c) LA RELECTURE — la dernière décision de la cible, depuis la base.
      const persisted = await relireDerniereDecision(db, intent);

      // d) LES TROIS CONDITIONS, puis le contrat sur la ligne À L'INSTANT.
      const registre = await lireRegistre(db, intent.casefileRef);
      const verdict = decidePublicRelease(intent, row, registre, persisted, insertedId);
      if (verdict.decision === "REFUSED") {
        throw new RefusedRelease(verdict.refusal);
      }

      // e) LA PROMOTION — gardée. Zéro ligne = l'état a bougé sous nous : ABORT.
      const promues = await db.query<{ version: number }>(
        `UPDATE "CaseFileClaim"
            SET state = 'PUBLIC'::"ArtifactState", "updatedAt" = now()
          WHERE "casefileRef" = $1 AND "claimId" = $2 AND version = $3
            AND state = 'ATTACHED'::"ArtifactState" AND "contentHash" = $4
          RETURNING version`,
        [intent.casefileRef, intent.claimId, intent.version, verdict.release.target.expectedContentHash],
      );
      if (promues.length !== 1) throw new GovernedAbort<ReleaseExecutionCause>("PROMOTION_NOT_APPLIED", `${intent.claimId}@v${intent.version}`);

      return {
        outcome: "RELEASED",
        target: { ...verdict.release.target, contentHash: verdict.release.target.expectedContentHash },
        decisionId: verdict.release.decision.id,
      };
    });
  } catch (e) {
    if (e instanceof RefusedRelease) return { outcome: "REFUSED", refusal: e.refusal };
    if (e instanceof GovernedAbort) return { outcome: "ABORTED", refusal: { cause: e.cause as ReleaseExecutionCause, at: e.at } };
    throw e;
  }
}

/** Un refus de la décision 2, porté hors de la transaction pour qu'elle s'annule. */
class RefusedRelease extends Error {
  constructor(readonly refusal: Refusal<ReleaseRefusalCause>) {
    super(`[casefile/executor] REFUSED ${refusal.cause} @ ${refusal.at}`);
    this.name = "RefusedRelease";
  }
}

// ═══ (III) LA RÉVOCATION ════════════════════════════════════════════════════

export const REVOKE_EXECUTION_CAUSES = [
  /** Aucune ligne `(casefileRef, claimId, version)`. */
  "TARGET_MISSING",
  /** Le sceau de la ligne ne tient plus : modifiée en place. On ne révoque pas par-dessus une altération — on la signale. */
  "SEAL_BROKEN",
  /** L'INSERT de la décision n'a pas rendu d'id. */
  "DECISION_NOT_RECORDED",
  /** L'UPDATE gardé n'a touché aucune ligne : l'état a bougé sous le verrou. */
  "DEMOTION_NOT_APPLIED",
] as const;
export type RevokeExecutionCause = (typeof REVOKE_EXECUTION_CAUSES)[number];

export type RevokeOutcome =
  | {
      readonly outcome: "REVOKED";
      readonly target: { casefileRef: string; claimId: string; version: number; contentHash: string };
      readonly decisionId: string;
      /** La cause telle que RELUE en base après l'INSERT — égale à celle de l'intention, sinon REFUSED. */
      readonly cause: RevokeIntent["cause"];
    }
  | { readonly outcome: "REFUSED"; readonly refusal: Refusal<RevokeRefusalCause> }
  | { readonly outcome: "ABORTED"; readonly refusal: Refusal<RevokeExecutionCause> };

/** Un refus de la décision 3, porté hors de la transaction pour qu'elle s'annule. */
class RefusedRevoke extends Error {
  constructor(readonly refusal: Refusal<RevokeRefusalCause>) {
    super(`[casefile/executor] REFUSED ${refusal.cause} @ ${refusal.at}`);
    this.name = "RefusedRevoke";
  }
}

/**
 * (III) Révoquer : la séquence symétrique de la libération, dans UNE transaction.
 *
 *   a) verrouiller la ligne visée · b) insérer la décision REVOKE, prendre son id
 *   c) relire la dernière décision de la cible · d) trois conditions, sinon ABORT
 *   e) alors seulement, UPDATE gardé par state = 'PUBLIC' ET contentHash.
 *
 * L'UPDATE ne touche que `state` et `updatedAt`. Le `contentHash`, le contenu,
 * la version, la chaîne `supersedes` : rien n'est modifié, rien n'est supprimé.
 * Le GRANT antérieur reste dans le journal, sous un id inférieur.
 */
export async function executeRevoke(
  tx: SqlTransactor,
  intent: RevokeIntent,
  authority: ReleaseAuthorityInput,
): Promise<RevokeOutcome> {
  const malformee = autoriteMalformee(authority);
  if (malformee) return { outcome: "REFUSED", refusal: { cause: "NO_PERSISTED_DECISION", at: malformee } };
  // La cause est jugée AVANT toute transaction : une cause hors vocabulaire
  // n'ouvre rien, n'insère rien.
  if (!estObjet(intent) || !isRevocationCause(intent.cause)) return { outcome: "REFUSED", refusal: { cause: "CAUSE_UNKNOWN", at: "cause" } };
  try {
    return await tx.transaction(async (db) => {
      // a) LE VERROU — la ligne exacte, et elle seule.
      const row = await verrouillerCible<RevokeExecutionCause>(db, intent);

      // b) LA DÉCISION, PERSISTÉE, AVEC SA CAUSE. 'REVOKE' est un LITTÉRAL : ce
      //    chemin ne peut écrire que lui. La cause vient de l'intention (vocabulaire
      //    fermé, jugé avant la transaction) et la base la re-vérifie par CHECK.
      const inserees = await db.query<{ id: string }>(
        `INSERT INTO casefile_claim_publication_decisions
           (casefile_ref, claim_id, claim_version, audience, decision, decided_by, decided_at, cause)
         VALUES ($1, $2, $3, $4, 'REVOKE', $5, $6::timestamptz, $7)
         RETURNING id::text AS id`,
        [intent.casefileRef, intent.claimId, intent.version, intent.audience, authority.decidedBy, authority.decidedAt, intent.cause],
      );
      const insertedId = inserees[0]?.id;
      if (typeof insertedId !== "string" || insertedId === "") throw new GovernedAbort<RevokeExecutionCause>("DECISION_NOT_RECORDED", "decision.id");

      // c) LA RELECTURE — la dernière décision de la cible, depuis la base.
      const persisted = await relireDerniereDecision(db, intent);

      // d) LES TROIS CONDITIONS. Aucun contrat : on révoque PARCE QUE les pièces ne suffisent pas.
      const verdict = decideRevoke(intent, row, persisted, insertedId);
      if (verdict.decision === "REFUSED") throw new RefusedRevoke(verdict.refusal);

      // e) LE RETRAIT — gardé par state = 'PUBLIC' ET contentHash. Seuls `state`
      //    et `updatedAt` bougent. Zéro ligne = l'état a bougé sous nous : ABORT.
      const retirees = await db.query<{ version: number }>(
        `UPDATE "CaseFileClaim"
            SET state = 'ATTACHED'::"ArtifactState", "updatedAt" = now()
          WHERE "casefileRef" = $1 AND "claimId" = $2 AND version = $3
            AND state = 'PUBLIC'::"ArtifactState" AND "contentHash" = $4
          RETURNING version`,
        [intent.casefileRef, intent.claimId, intent.version, verdict.revocation.target.expectedContentHash],
      );
      if (retirees.length !== 1) throw new GovernedAbort<RevokeExecutionCause>("DEMOTION_NOT_APPLIED", `${intent.claimId}@v${intent.version}`);

      return {
        outcome: "REVOKED",
        target: { ...verdict.revocation.target, contentHash: verdict.revocation.target.expectedContentHash },
        decisionId: verdict.revocation.decision.id,
        cause: verdict.revocation.cause,
      };
    });
  } catch (e) {
    if (e instanceof RefusedRevoke) return { outcome: "REFUSED", refusal: e.refusal };
    if (e instanceof GovernedAbort) return { outcome: "ABORTED", refusal: { cause: e.cause as RevokeExecutionCause, at: e.at } };
    throw e;
  }
}

const toPersistedRow = (r: DecisionRow): PersistedDecisionRow => ({
  id: String(r.id),
  casefileRef: r.casefile_ref,
  claimId: r.claim_id,
  claimVersion: Number(r.claim_version),
  audience: r.audience,
  decision: r.decision,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  cause: r.cause === undefined ? null : r.cause,
});

async function lireRegistre(db: SqlRunner, casefileRef: string): Promise<Map<string, PublicSource>> {
  const rows = await db.query<SourceRow>(
    `SELECT "sourceId", "sourceType", caption, "capturedAt"::text AS "capturedAt", "sourceUrl", sha256, "snapshotId"
       FROM "CaseFileSource" WHERE "casefileRef" = $1 ORDER BY "sourceId" FOR SHARE`,
    [casefileRef],
  );
  // T1-BASCULE-DU-CONTRAT — la provenance du registre vient du JOURNAL, lu
  // dans la même transaction que les pièces. C'est ce registre que
  // `decidePublicRelease` juge : la porte de publication ne s'ouvre donc que
  // sur une qualification VERIFIED effectivement inscrite et gouvernée.
  const journal = await readLatestJournalRows(
    db,
    rows.map((s) => s.snapshotId).filter((x): x is string => typeof x === "string"),
  );
  return new Map(rows.map((s) => [s.sourceId, {
    sourceId: s.sourceId, sourceType: s.sourceType, caption: s.caption,
    capturedAt: s.capturedAt, sourceUrl: s.sourceUrl, sha256: s.sha256, evidenceLinked: typeof s.snapshotId === "string" && s.snapshotId !== "",
    ...provenanceDecoration(resolveJournalProvenance({ sourceId: s.sourceId, snapshotId: s.snapshotId }, journal)),
  }]));
}
