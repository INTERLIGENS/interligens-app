// src/lib/intel-vault/scan-lookup.ts
// Lookup function to augment existing scan results with Intel Vault data.
import { prisma } from "@/lib/prisma";

export interface VaultMatch {
  match: boolean;
  severity: "none" | "low" | "medium" | "high" | "critical";
  categories: string[];
  confidence: string;
  explainAvailable: boolean;
  labels?: Array<{ labelType: string; label: string; confidence: string }>;
}

const SEVERITY_MAP: Record<string, VaultMatch["severity"]> = {
  scam: "critical",
  drainer: "critical",
  phishing: "high",
  exploiter: "high",
  insider: "medium",
  cluster_member: "medium",
  incident_related: "medium",
  kol: "low",
  whale: "low",
  airdrop_target: "low",
  other: "low",
};

export async function vaultLookup(chain: string, address: string): Promise<VaultMatch> {
  // Check cache first
  const cached = await prisma.riskSummaryCache.findUnique({
    where: { chain_address: { chain, address } },
  });

  if (cached) {
    try {
      return JSON.parse(cached.summary) as VaultMatch;
    } catch {}
  }

  const labels = await prisma.addressLabel.findMany({
    where: { chain: chain as never, address },
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return { match: false, severity: "none", categories: [], confidence: "none", explainAvailable: false };
  }

  const severities = labels.map(l => SEVERITY_MAP[l.labelType] ?? "low");
  const severityOrder: VaultMatch["severity"][] = ["none", "low", "medium", "high", "critical"];
  const topSeverity = severities.reduce((a, b) =>
    severityOrder.indexOf(b) > severityOrder.indexOf(a) ? b : a, "none"
  );

  const topConfidence = labels.find(l => l.confidence === "high")?.confidence
    ?? labels.find(l => l.confidence === "medium")?.confidence
    ?? "low";

  const result: VaultMatch = {
    match: true,
    severity: topSeverity,
    categories: [...new Set(labels.map(l => l.labelType))],
    confidence: topConfidence,
    explainAvailable: true,
    labels: labels.slice(0, 3).map(l => ({
      labelType: l.labelType,
      label: l.label,
      confidence: l.confidence,
    })),
  };

  // Cache the result
  await prisma.riskSummaryCache.upsert({
    where: { chain_address: { chain, address } },
    create: { chain, address, summary: JSON.stringify(result) },
    update: { summary: JSON.stringify(result) },
  });

  return result;
}
