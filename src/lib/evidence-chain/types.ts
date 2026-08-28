/**
 * CC-OFFLINE-54 — Chaîne de preuve V1 : types & contrats.
 * Énumérations côté TS (le schéma Prisma stocke des String — cf. schema.prod.prisma).
 */

export const SOURCE_TYPES = ["X_POST", "TELEGRAM", "WEB_PAGE", "EXPLORER", "REPO_ARTIFACT", "OTHER"] as const;
export type EvidenceSourceType = (typeof SOURCE_TYPES)[number];

export const LINK_TYPES = ["X_API_RECORD", "ONCHAIN_TX", "WALLET", "MANUAL", "ARCHIVE_MEMBER"] as const;
export type EvidenceLinkType = (typeof LINK_TYPES)[number];

export const CORROBORATION_LEVELS = ["NONE", "SINGLE_SOURCE", "CORROBORATED"] as const;
export type CorroborationLevel = (typeof CORROBORATION_LEVELS)[number];

export const ACCESS_ACTIONS = ["INGEST", "READ", "EXPORT", "LINK", "VERIFY"] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

// Provenance (colonnes ajoutées par MIGRATION_evidence_provenance_v1.sql).
// Les 1070 pièces pré-migration restent NULL = legacy (Option A, zéro réécriture) ;
// le manifeste les expose comme MIGRATED_BACKFILL par dérivation.
export const PROVENANCE_TYPES = ["FIRST_PARTY_CAPTURE", "THIRD_PARTY_SUBMISSION", "MIGRATED_BACKFILL"] as const;
export type ProvenanceType = (typeof PROVENANCE_TYPES)[number];

// "at-capture"   : horodaté au fil de l'eau (hash existait à la capture).
// "retroactive"  : pièce migrée, capturedAt déclarative (marqueur notes legacy).
// "at-ingestion" : la TSA prouve la RÉCEPTION par le système, pas la capture.
export const TIMESTAMP_MODES = ["at-capture", "retroactive", "at-ingestion"] as const;
export type TimestampMode = (typeof TIMESTAMP_MODES)[number];

/** Seule valeur de capturedBy autorisée sans identité — et uniquement en THIRD_PARTY_SUBMISSION. */
export const UNATTRIBUTED = "unattributed";

export interface EvidenceItemRecord {
  /** S4 — NULL = aucune exclusion prononcée ; 'EXCLUDED' = hors chaîne active. */
  evidentiaryStatus?: string | null;
  exclusionReason?: string | null;
  id: string;
  casefileId: string | null;
  r2Key: string | null;
  filePath: string | null;
  mimeType: string | null;
  byteSize: number | null;
  sha256: string;
  capturedAt: Date | null;
  capturedBy: string | null;
  captureHost: string | null;
  captureTool: string | null;
  captureToolVersion: string | null;
  sourceUrl: string | null;
  sourceType: EvidenceSourceType;
  provenanceType: ProvenanceType | null;
  submittedBy: string | null;
  timestampMode: TimestampMode | null;
  ingestedAt: Date;
  tsaToken: Buffer | null;
  tsaProvider: string | null;
  tsaTimestampedAt: Date | null;
  tsaCertChain: string | null;
  immutableStored: boolean;
  immutableRef: string | null;
  notes: string | null;
}

export interface EvidenceLinkRecord {
  id: string;
  evidenceItemId: string;
  linkType: EvidenceLinkType;
  externalId: string | null;
  externalUrl: string | null;
  corroborationLevel: CorroborationLevel;
  createdAt: Date;
}

export interface NewEvidenceItem {
  casefileId?: string | null;
  r2Key?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  sha256: string;
  capturedAt?: Date | null;
  capturedBy?: string | null;
  captureHost?: string | null;
  captureTool?: string | null;
  captureToolVersion?: string | null;
  sourceUrl?: string | null;
  sourceType: EvidenceSourceType;
  provenanceType?: ProvenanceType | null;
  submittedBy?: string | null;
  timestampMode?: TimestampMode | null;
  notes?: string | null;
}

export interface NewEvidenceLink {
  evidenceItemId: string;
  linkType: EvidenceLinkType;
  externalId?: string | null;
  externalUrl?: string | null;
  corroborationLevel?: CorroborationLevel;
}

/**
 * Persistence contract. Prod = Prisma/Postgres (ep-square-band, once the
 * migration is applied). Tests = better-sqlite3 (real SQL, ephemeral) so the
 * pipeline runs for real WITHOUT touching prod or applying the migration.
 */
export interface EvidenceStore {
  findBySha256(sha256: string): Promise<EvidenceItemRecord | null>;
  insertItem(item: NewEvidenceItem): Promise<EvidenceItemRecord>;
  setR2(id: string, r2Key: string, immutableStored: boolean, immutableRef: string | null): Promise<void>;
  setTsa(id: string, tsaToken: Buffer, tsaProvider: string, tsaTimestampedAt: Date, tsaCertChain: string): Promise<void>;
  insertLink(link: NewEvidenceLink): Promise<EvidenceLinkRecord>;
  insertAccessLog(evidenceItemId: string, action: AccessAction, actor: string | null, context: string | null): Promise<void>;
  /**
   * Marque une pièce dont l'archivage des octets a ÉCHOUÉ après insertion.
   *
   * Distinct de `setR2` : celui-ci n'est appelé qu'en cas de succès. Sans ce
   * marquage, une pièce dont le PUT a levé reste `r2Key IS NULL` avec des
   * notes vierges — donc invisible aux deux filtres du watchdog, qui ne
   * comptaient que `[R2:UNAVAILABLE]` et `HASH-ONLY`.
   */
  markR2Failed(id: string, marker: string, reason: string): Promise<void>;
  getItem(id: string): Promise<EvidenceItemRecord | null>;
  /**
   * Les pièces de la chaîne ACTIVE. Les artefacts exclus (S4) en sont écartés,
   * par liste blanche des statuts éligibles — jamais par `<> 'EXCLUDED'`.
   */
  getCasefileItems(casefileId: string): Promise<EvidenceItemRecord[]>;
  /**
   * Voie d'AUDIT — rend TOUT, exclusions comprises.
   *
   * Volontairement nommée en toutes lettres plutôt qu'un `includeExcluded:
   * boolean` sur la méthode normale : un booléen se passe distraitement, un
   * nom de vingt-huit caractères se lit dans une revue. Les 7 pièces exclues
   * restent en base POUR l'audit de provenance — les rendre invisibles partout
   * les rendrait inauditables.
   */
  getCasefileItemsForAuditIncludingExcluded(casefileId: string): Promise<EvidenceItemRecord[]>;
  getItemLinks(evidenceItemId: string): Promise<EvidenceLinkRecord[]>;
}
