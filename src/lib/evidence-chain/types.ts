/**
 * CC-OFFLINE-54 — Chaîne de preuve V1 : types & contrats.
 * Énumérations côté TS (le schéma Prisma stocke des String — cf. schema.prod.prisma).
 */

export const SOURCE_TYPES = ["X_POST", "TELEGRAM", "WEB_PAGE", "EXPLORER", "REPO_ARTIFACT", "OTHER"] as const;
export type EvidenceSourceType = (typeof SOURCE_TYPES)[number];

export const LINK_TYPES = ["X_API_RECORD", "ONCHAIN_TX", "WALLET", "MANUAL"] as const;
export type EvidenceLinkType = (typeof LINK_TYPES)[number];

export const CORROBORATION_LEVELS = ["NONE", "SINGLE_SOURCE", "CORROBORATED"] as const;
export type CorroborationLevel = (typeof CORROBORATION_LEVELS)[number];

export const ACCESS_ACTIONS = ["INGEST", "READ", "EXPORT", "LINK", "VERIFY"] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export interface EvidenceItemRecord {
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
  getItem(id: string): Promise<EvidenceItemRecord | null>;
  getCasefileItems(casefileId: string): Promise<EvidenceItemRecord[]>;
  getItemLinks(evidenceItemId: string): Promise<EvidenceLinkRecord[]>;
}
