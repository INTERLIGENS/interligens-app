/**
 * SQLite-backed EvidenceStore (better-sqlite3). Used by TESTS so the ingestion
 * pipeline runs for REAL against a real SQL DB WITHOUT touching ep-square-band
 * and WITHOUT applying the (intentionally unapplied) prod migration.
 */
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type {
  EvidenceStore, EvidenceItemRecord, EvidenceLinkRecord,
  NewEvidenceItem, NewEvidenceLink, AccessAction, EvidenceSourceType,
  EvidenceLinkType, CorroborationLevel, ProvenanceType, TimestampMode,
} from "../types";

type Row = Record<string, unknown>;

function toItem(r: Row): EvidenceItemRecord {
  return {
    id: String(r.id),
    casefileId: (r.casefileId as string) ?? null,
    r2Key: (r.r2Key as string) ?? null,
    filePath: (r.filePath as string) ?? null,
    mimeType: (r.mimeType as string) ?? null,
    byteSize: r.byteSize == null ? null : Number(r.byteSize),
    sha256: String(r.sha256),
    capturedAt: r.capturedAt ? new Date(String(r.capturedAt)) : null,
    capturedBy: (r.capturedBy as string) ?? null,
    captureHost: (r.captureHost as string) ?? null,
    captureTool: (r.captureTool as string) ?? null,
    captureToolVersion: (r.captureToolVersion as string) ?? null,
    sourceUrl: (r.sourceUrl as string) ?? null,
    sourceType: String(r.sourceType) as EvidenceSourceType,
    provenanceType: ((r.provenanceType as string) ?? null) as ProvenanceType | null,
    submittedBy: (r.submittedBy as string) ?? null,
    timestampMode: ((r.timestampMode as string) ?? null) as TimestampMode | null,
    ingestedAt: new Date(String(r.ingestedAt)),
    tsaToken: r.tsaToken ? Buffer.from(r.tsaToken as Buffer) : null,
    tsaProvider: (r.tsaProvider as string) ?? null,
    tsaTimestampedAt: r.tsaTimestampedAt ? new Date(String(r.tsaTimestampedAt)) : null,
    tsaCertChain: (r.tsaCertChain as string) ?? null,
    immutableStored: !!r.immutableStored,
    immutableRef: (r.immutableRef as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

function toLink(r: Row): EvidenceLinkRecord {
  return {
    id: String(r.id),
    evidenceItemId: String(r.evidenceItemId),
    linkType: String(r.linkType) as EvidenceLinkType,
    externalId: (r.externalId as string) ?? null,
    externalUrl: (r.externalUrl as string) ?? null,
    corroborationLevel: String(r.corroborationLevel) as CorroborationLevel,
    createdAt: new Date(String(r.createdAt)),
  };
}

export class SqliteEvidenceStore implements EvidenceStore {
  private db: Database.Database;
  constructor(path = ":memory:") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS EvidenceItem (
        id TEXT PRIMARY KEY, casefileId TEXT, r2Key TEXT, filePath TEXT, mimeType TEXT,
        byteSize INTEGER, sha256 TEXT UNIQUE NOT NULL, capturedAt TEXT, capturedBy TEXT,
        captureHost TEXT, captureTool TEXT, captureToolVersion TEXT, sourceUrl TEXT,
        sourceType TEXT NOT NULL DEFAULT 'OTHER',
        provenanceType TEXT, submittedBy TEXT, timestampMode TEXT,
        ingestedAt TEXT NOT NULL,
        tsaToken BLOB, tsaProvider TEXT, tsaTimestampedAt TEXT, tsaCertChain TEXT,
        immutableStored INTEGER NOT NULL DEFAULT 0, immutableRef TEXT, notes TEXT);
      CREATE TABLE IF NOT EXISTS EvidenceLink (
        id TEXT PRIMARY KEY, evidenceItemId TEXT NOT NULL, linkType TEXT NOT NULL,
        externalId TEXT, externalUrl TEXT, corroborationLevel TEXT NOT NULL DEFAULT 'NONE',
        createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS EvidenceAccessLog (
        id TEXT PRIMARY KEY, evidenceItemId TEXT NOT NULL, action TEXT NOT NULL,
        actor TEXT, at TEXT NOT NULL, context TEXT);
    `);
  }
  close() { this.db.close(); }

  async findBySha256(sha256: string): Promise<EvidenceItemRecord | null> {
    const r = this.db.prepare("SELECT * FROM EvidenceItem WHERE sha256=?").get(sha256) as Row | undefined;
    return r ? toItem(r) : null;
  }
  async insertItem(item: NewEvidenceItem): Promise<EvidenceItemRecord> {
    const id = "ev_" + randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO EvidenceItem
      (id,casefileId,r2Key,filePath,mimeType,byteSize,sha256,capturedAt,capturedBy,captureHost,
       captureTool,captureToolVersion,sourceUrl,sourceType,provenanceType,submittedBy,timestampMode,
       ingestedAt,immutableStored,notes)
      VALUES (@id,@casefileId,@r2Key,@filePath,@mimeType,@byteSize,@sha256,@capturedAt,@capturedBy,
       @captureHost,@captureTool,@captureToolVersion,@sourceUrl,@sourceType,@provenanceType,
       @submittedBy,@timestampMode,@ingestedAt,0,@notes)`).run({
      id, casefileId: item.casefileId ?? null, r2Key: item.r2Key ?? null, filePath: item.filePath ?? null,
      mimeType: item.mimeType ?? null, byteSize: item.byteSize ?? null, sha256: item.sha256,
      capturedAt: item.capturedAt ? item.capturedAt.toISOString() : null, capturedBy: item.capturedBy ?? null,
      captureHost: item.captureHost ?? null, captureTool: item.captureTool ?? null,
      captureToolVersion: item.captureToolVersion ?? null, sourceUrl: item.sourceUrl ?? null,
      sourceType: item.sourceType, provenanceType: item.provenanceType ?? null,
      submittedBy: item.submittedBy ?? null, timestampMode: item.timestampMode ?? null,
      ingestedAt: now, notes: item.notes ?? null,
    });
    return (await this.getItem(id))!;
  }
  async setR2(id: string, r2Key: string, immutableStored: boolean, immutableRef: string | null): Promise<void> {
    this.db.prepare("UPDATE EvidenceItem SET r2Key=?, immutableStored=?, immutableRef=? WHERE id=?")
      .run(r2Key, immutableStored ? 1 : 0, immutableRef, id);
  }
  async setTsa(id: string, tsaToken: Buffer, tsaProvider: string, tsaTimestampedAt: Date, tsaCertChain: string): Promise<void> {
    this.db.prepare("UPDATE EvidenceItem SET tsaToken=?, tsaProvider=?, tsaTimestampedAt=?, tsaCertChain=? WHERE id=?")
      .run(tsaToken, tsaProvider, tsaTimestampedAt.toISOString(), tsaCertChain, id);
  }
  async insertLink(link: NewEvidenceLink): Promise<EvidenceLinkRecord> {
    const id = "el_" + randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO EvidenceLink (id,evidenceItemId,linkType,externalId,externalUrl,corroborationLevel,createdAt)
      VALUES (?,?,?,?,?,?,?)`).run(id, link.evidenceItemId, link.linkType, link.externalId ?? null,
      link.externalUrl ?? null, link.corroborationLevel ?? "NONE", now);
    return toLink(this.db.prepare("SELECT * FROM EvidenceLink WHERE id=?").get(id) as Row);
  }
  async insertAccessLog(evidenceItemId: string, action: AccessAction, actor: string | null, context: string | null): Promise<void> {
    this.db.prepare("INSERT INTO EvidenceAccessLog (id,evidenceItemId,action,actor,at,context) VALUES (?,?,?,?,?,?)")
      .run("al_" + randomUUID(), evidenceItemId, action, actor, new Date().toISOString(), context);
  }
  async getItem(id: string): Promise<EvidenceItemRecord | null> {
    const r = this.db.prepare("SELECT * FROM EvidenceItem WHERE id=?").get(id) as Row | undefined;
    return r ? toItem(r) : null;
  }
  async getCasefileItems(casefileId: string): Promise<EvidenceItemRecord[]> {
    return (this.db.prepare("SELECT * FROM EvidenceItem WHERE casefileId=? ORDER BY ingestedAt").all(casefileId) as Row[]).map(toItem);
  }
  async getItemLinks(evidenceItemId: string): Promise<EvidenceLinkRecord[]> {
    return (this.db.prepare("SELECT * FROM EvidenceLink WHERE evidenceItemId=? ORDER BY createdAt").all(evidenceItemId) as Row[]).map(toLink);
  }
}
