import { createHash } from "crypto";
import type { CanonicalIoc } from "./iocExportBuilder";

/**
 * Produces a deterministic SHA-256 over the included IOC list.
 * This is an "export integrity hash" — it proves the set of indicators at
 * generation time, not that any external source content is authentic.
 *
 * Canonicalisation rules:
 *  - IOCs sorted ascending by id
 *  - tags sorted ascending within each IOC
 *  - nulls normalised to empty string
 *  - dates already ISO strings from the builder
 *  - hash is not included in its own input
 */
export function computeExportHash(iocs: CanonicalIoc[]): string {
  const canonical = JSON.stringify(
    [...iocs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((ioc) => ({
        id: ioc.id,
        type: ioc.type,
        value: ioc.value,
        chain: ioc.chain ?? "",
        firstSeen: ioc.firstSeen ?? "",
        lastSeen: ioc.lastSeen ?? "",
        source: ioc.source,
        confidence: ioc.confidence,
        relatedCaseId: ioc.relatedCaseId,
        relatedEntityId: ioc.relatedEntityId ?? "",
        relatedEvidenceSnapshotId: ioc.relatedEvidenceSnapshotId ?? "",
        publishability: ioc.publishability,
        tags: [...ioc.tags].sort(),
      }))
  );
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
