// src/lib/vault/vaultLookup.ts
import { prisma } from "@/lib/prisma";

export type VaultSeverity = "info" | "warn" | "danger";
export type VaultConfidence = "low" | "medium" | "high";

export interface VaultResult {
  match: boolean;
  categories: string[];
  topLabel?: string;
  confidence?: VaultConfidence;
  severity?: VaultSeverity;
}

const DANGER_TYPES = new Set(["scam","phishing","drainer","exploiter","sanction"]);
const WARN_TYPES   = new Set(["insider","kol","cluster_member","incident_related"]);

function severityFor(categories: string[]): VaultSeverity {
  if (categories.some(c => DANGER_TYPES.has(c))) return "danger";
  if (categories.some(c => WARN_TYPES.has(c)))   return "warn";
  return "info";
}

function topLabelFor(categories: string[]): string | undefined {
  for (const t of ["scam","phishing","drainer","exploiter","sanction","insider","kol","cluster_member","incident_related","whale","airdrop_target","other"]) {
    if (categories.includes(t)) return t;
  }
  return categories[0];
}

function confidenceFrom(labels: Array<{ confidence: string }>): VaultConfidence {
  if (labels.some(l => l.confidence === "high"))   return "high";
  if (labels.some(l => l.confidence === "medium")) return "medium";
  return "low";
}

export async function vaultLookup(chain: string, address: string): Promise<VaultResult> {
  const normChain   = chain.trim().toLowerCase();
  const normAddress = address.trim();

  // Fast-path: cache
  try {
    const cached = await prisma.riskSummaryCache.findUnique({
      where: { chain_address: { chain: normChain, address: normAddress } },
    });
    if (cached) {
      const parsed = JSON.parse(cached.summary) as VaultResult;
      return parsed;
    }
  } catch {}

  // Fallback: direct lookup
  const labels = await prisma.addressLabel.findMany({
    where: { chain: normChain, address: normAddress },
    take: 20,
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return { match: false, categories: [] };
  }

  const categories = [...new Set(labels.map(l => l.labelType))];
  const confidence = confidenceFrom(labels);
  const severity   = severityFor(categories);
  const topLabel   = topLabelFor(categories);

  const result: VaultResult = { match: true, categories, topLabel, confidence, severity };

  // Write cache
  try {
    await prisma.riskSummaryCache.upsert({
      where: { chain_address: { chain: normChain, address: normAddress } },
      create: { chain: normChain, address: normAddress, summary: JSON.stringify(result) },
      update: { summary: JSON.stringify(result) },
    });
  } catch {}

  return result;
}

/** Rebuild cache for a list of addresses after approve */
export async function rebuildCacheForAddresses(
  entries: Array<{ chain: string; address: string }>
): Promise<void> {
  const seen = new Set<string>();
  for (const { chain, address } of entries) {
    const key = `${chain}:${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Delete stale cache — vaultLookup will rebuild on next call
    try {
      await prisma.riskSummaryCache.deleteMany({
        where: { chain: chain.toLowerCase(), address: address.trim() },
      });
    } catch {}
  }
}
