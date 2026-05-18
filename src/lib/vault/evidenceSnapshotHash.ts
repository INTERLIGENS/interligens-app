import { createHash } from "crypto";
import type { VaultEvidenceSourceType } from "@prisma/client";

export type SnapshotHashInput = {
  caseId: string;
  url: string | null;
  title: string;
  sourceType: VaultEvidenceSourceType;
  note: string | null;
  tags: string[];
  relatedEntityId: string | null;
  capturedAt: Date;
};

/**
 * Produces a SHA-256 digest of the snapshot record fields at creation time.
 * This is a "snapshot record hash" — it proves the integrity of this record,
 * not that the source URL content is authentic or unchanged.
 */
export function generateSnapshotRecordHash(input: SnapshotHashInput): string {
  const canonical = JSON.stringify({
    caseId: input.caseId,
    url: input.url ?? "",
    title: input.title,
    sourceType: input.sourceType,
    note: input.note ?? "",
    tags: [...input.tags].sort(),
    relatedEntityId: input.relatedEntityId ?? "",
    capturedAt: input.capturedAt.toISOString(),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
