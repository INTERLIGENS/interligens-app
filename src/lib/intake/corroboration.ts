import { prisma } from "@/lib/prisma";

export interface CorrobResult {
  address:        string;
  chain:          string;
  evidenceCount:  number;
  intakeIds:      string[];
  confidence:     "low" | "medium" | "high";
  autoElevate:    boolean;
}

/**
 * Scan all IntakeRecords and compute cross-UIR corroboration scores.
 * An address seen in N>=2 distinct intake records gets elevated confidence.
 */
export async function computeCorroboration(): Promise<CorrobResult[]> {
  const records = await prisma.intakeRecord.findMany({
    where: { status: { in: ["routed", "needs_manual"] } },
    select: { id: true, extracted: true },
  });

  // Build address → [intakeIds] map
  const addrMap = new Map<string, { intakeIds: Set<string>; chain: string }>();

  for (const record of records) {
    const extracted = JSON.parse(record.extracted || "{}");
    for (const a of extracted.addresses ?? []) {
      const key = `${a.chain}:${a.address}`;
      if (!addrMap.has(key)) addrMap.set(key, { intakeIds: new Set(), chain: a.chain });
      addrMap.get(key)!.intakeIds.add(record.id);
    }
  }

  const results: CorrobResult[] = [];

  for (const [key, { intakeIds, chain }] of addrMap.entries()) {
    const address       = key.split(":").slice(1).join(":");
    const evidenceCount = intakeIds.size;
    if (evidenceCount < 2) continue; // only track multi-source

    const confidence: "low" | "medium" | "high" =
      evidenceCount >= 5 ? "high" :
      evidenceCount >= 3 ? "medium" : "low";

    results.push({
      address, chain, evidenceCount,
      intakeIds:   [...intakeIds],
      confidence,
      autoElevate: evidenceCount >= 3,
    });
  }

  return results.sort((a, b) => b.evidenceCount - a.evidenceCount);
}

/**
 * Elevate AddressLabel confidence for corroborated addresses.
 */
export async function applyCorroborationToLabels(): Promise<number> {
  const results = await computeCorroboration();
  let updated = 0;

  for (const r of results) {
    if (!r.autoElevate) continue;
    const res = await prisma.addressLabel.updateMany({
      where: { chain: r.chain, address: r.address, confidence: { in: ["low", "medium"] } },
      data:  { confidence: r.confidence },
    });
    updated += res.count;
  }

  return updated;
}
