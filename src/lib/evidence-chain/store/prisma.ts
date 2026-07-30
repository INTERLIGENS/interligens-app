/**
 * Prisma/Postgres EvidenceStore (PROD, ep-square-band).
 * ⚠️ Requires MIGRATION_evidence_chain_v1.sql to be applied first (NOT applied
 * by this branch — run it in the Neon SQL Editor). Until then, runtime calls
 * here fail on missing relations; tests use the SQLite store instead.
 */
import type { PrismaClient } from "@prisma/client";
import type {
  EvidenceStore, EvidenceItemRecord, EvidenceLinkRecord,
  NewEvidenceItem, NewEvidenceLink, AccessAction, EvidenceSourceType,
  EvidenceLinkType, CorroborationLevel,
} from "../types";

type PItem = {
  id: string; casefileId: string | null; r2Key: string | null; filePath: string | null;
  mimeType: string | null; byteSize: number | null; sha256: string; capturedAt: Date | null;
  capturedBy: string | null; captureHost: string | null; captureTool: string | null;
  captureToolVersion: string | null; sourceUrl: string | null; sourceType: string;
  ingestedAt: Date; tsaToken: Uint8Array | null; tsaProvider: string | null;
  tsaTimestampedAt: Date | null; tsaCertChain: string | null; immutableStored: boolean;
  immutableRef: string | null; notes: string | null;
};
type PLink = {
  id: string; evidenceItemId: string; linkType: string; externalId: string | null;
  externalUrl: string | null; corroborationLevel: string; createdAt: Date;
};

function toItem(r: PItem): EvidenceItemRecord {
  return { ...r, sourceType: r.sourceType as EvidenceSourceType,
    tsaToken: r.tsaToken ? Buffer.from(r.tsaToken) : null };
}
function toLink(r: PLink): EvidenceLinkRecord {
  return { ...r, linkType: r.linkType as EvidenceLinkType,
    corroborationLevel: r.corroborationLevel as CorroborationLevel };
}

export class PrismaEvidenceStore implements EvidenceStore {
  constructor(private prisma: PrismaClient) {}

  async findBySha256(sha256: string): Promise<EvidenceItemRecord | null> {
    const r = await this.prisma.evidenceItem.findUnique({ where: { sha256 } });
    return r ? toItem(r as unknown as PItem) : null;
  }
  async insertItem(item: NewEvidenceItem): Promise<EvidenceItemRecord> {
    const r = await this.prisma.evidenceItem.create({ data: {
      casefileId: item.casefileId ?? null, r2Key: item.r2Key ?? null, filePath: item.filePath ?? null,
      mimeType: item.mimeType ?? null, byteSize: item.byteSize ?? null, sha256: item.sha256,
      capturedAt: item.capturedAt ?? null, capturedBy: item.capturedBy ?? null,
      captureHost: item.captureHost ?? null, captureTool: item.captureTool ?? null,
      captureToolVersion: item.captureToolVersion ?? null, sourceUrl: item.sourceUrl ?? null,
      sourceType: item.sourceType, notes: item.notes ?? null,
    } });
    return toItem(r as unknown as PItem);
  }
  async setR2(id: string, r2Key: string, immutableStored: boolean, immutableRef: string | null): Promise<void> {
    await this.prisma.evidenceItem.update({ where: { id }, data: { r2Key, immutableStored, immutableRef } });
  }
  async setTsa(id: string, tsaToken: Buffer, tsaProvider: string, tsaTimestampedAt: Date, tsaCertChain: string): Promise<void> {
    await this.prisma.evidenceItem.update({ where: { id }, data: { tsaToken: new Uint8Array(tsaToken), tsaProvider, tsaTimestampedAt, tsaCertChain } });
  }
  async insertLink(link: NewEvidenceLink): Promise<EvidenceLinkRecord> {
    const r = await this.prisma.evidenceLink.create({ data: {
      evidenceItemId: link.evidenceItemId, linkType: link.linkType, externalId: link.externalId ?? null,
      externalUrl: link.externalUrl ?? null, corroborationLevel: link.corroborationLevel ?? "NONE",
    } });
    return toLink(r as unknown as PLink);
  }
  async insertAccessLog(evidenceItemId: string, action: AccessAction, actor: string | null, context: string | null): Promise<void> {
    await this.prisma.evidenceAccessLog.create({ data: { evidenceItemId, action, actor, context } });
  }
  async getItem(id: string): Promise<EvidenceItemRecord | null> {
    const r = await this.prisma.evidenceItem.findUnique({ where: { id } });
    return r ? toItem(r as unknown as PItem) : null;
  }
  async getCasefileItems(casefileId: string): Promise<EvidenceItemRecord[]> {
    const rs = await this.prisma.evidenceItem.findMany({ where: { casefileId }, orderBy: { ingestedAt: "asc" } });
    return (rs as unknown as PItem[]).map(toItem);
  }
  async getItemLinks(evidenceItemId: string): Promise<EvidenceLinkRecord[]> {
    const rs = await this.prisma.evidenceLink.findMany({ where: { evidenceItemId }, orderBy: { createdAt: "asc" } });
    return (rs as unknown as PLink[]).map(toLink);
  }
}
