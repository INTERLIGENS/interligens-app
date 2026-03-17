import { prisma } from "@/lib/prisma";
import { extractFromUrl } from "./extract";
import { routeIntake }    from "./router";
import { applyTrustBoost } from "./trustScore";

export interface WatchSource {
  id:          string;
  name:        string;
  url:         string;
  investigator: string;
  tags:        string[];
  lastChecked?: Date;
  lastHash?:   string; // hash of last content to detect changes
}

/**
 * Check a single URL source for new content.
 * Returns intakeId if new content found, null if unchanged.
 */
export async function checkSource(source: WatchSource): Promise<string | null> {
  let extractResult;
  try {
    extractResult = await extractFromUrl(source.url);
  } catch {
    return null; // URL fetch failed silently in cron context
  }

  // Simple change detection: hash of extracted addresses count + first address
  const addresses = extractResult.extracted.addresses;
  const contentSig = `${addresses.length}:${addresses[0]?.address ?? "empty"}`;

  if (contentSig === source.lastHash) return null; // no change

  // New content detected — create intake record
  const provenance = JSON.stringify({
    investigatorHandle: source.investigator,
    context: `Auto-watch: ${source.name}`,
    tags: source.tags,
  });

  const intake = await prisma.intakeRecord.create({
    data: {
      status:      "pending",
      inputType:   "url",
      sourceRef:   source.url,
      submittedBy: "watcher",
      provenance,
      parserUsed:  extractResult.parserUsed,
      rawText:     extractResult.rawText ?? null,
      rawTextTruncated: extractResult.rawTextTruncated,
      extracted:   JSON.stringify(extractResult.extracted),
      classification:   "rawdoc",
      routerConfidence: 0,
      extractWarnings:  JSON.stringify(extractResult.warnings),
    },
  });

  const boostedConfidence = applyTrustBoost(0.4, source.investigator);
  const routeResult = await routeIntake(intake.id, extractResult.extracted, extractResult.parserUsed);

  await prisma.intakeRecord.update({
    where: { id: intake.id },
    data: {
      status:           routeResult.linkedBatchId ? "routed" : "needs_manual",
      classification:   routeResult.classification,
      routerConfidence: Math.max(routeResult.confidence, boostedConfidence),
      pendingBatch:     routeResult.pendingBatch,
      linkedBatchId:    routeResult.linkedBatchId ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action:  "INTAKE_WATCHER_TRIGGERED",
      actorId: "watcher",
      meta:    JSON.stringify({ sourceId: source.id, intakeId: intake.id, contentSig }),
    },
  });

  return intake.id;
}
