import { prisma } from "@/lib/prisma";
import { withTimeout } from "../timeout";
import { normaliseDomain } from "@/lib/intel/ingestion/normalize/domain";
import type {
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
} from "../types";

/**
 * Threat_Intel engine — founding intelligence seed layer.
 *
 * Cross-references the entity against the seeded external threat datasets:
 *   - DomainLabel (MetaMask phishing, Phantom blocklist, ScamSniffer domains,
 *     DefiLlama TRUSTED labels)
 *   - AddressLabel (OFAC SDN, ScamSniffer addresses)
 *   - ProtocolLabel (context: "this domain is the legitimate Uniswap site")
 *
 * Produces THREAT_SIGNAL_FOUND or PROTOCOL_CONTEXT_FOUND events with
 * sourceStatus EXTERNAL_THREAT_SIGNAL_FOUND when threat rows are present.
 */
export async function runThreatIntelEngine(
  input: IntelligenceEngineInput,
): Promise<IntelligenceEngineResult> {
  const result = await withTimeout(runInner(input), input.timeoutMs);
  if (!result) {
    return {
      success: true,
      events: [],
      partialResult: true,
      error: "timeout",
      sourceStatus: "SOURCE_UNAVAILABLE",
    };
  }
  return result;
}

async function runInner(
  input: IntelligenceEngineInput,
): Promise<IntelligenceEngineResult> {
  const entity = input.entity;
  if (!entity) return { success: true, events: [], sourceStatus: "NO_INTERNAL_MATCH_YET" };
  const events: CaseIntelligenceEventDraft[] = [];

  // ── Domain / URL path ────────────────────────────────────────────────
  if (entity.type === "DOMAIN" || entity.type === "URL") {
    const domain = normaliseDomain(entity.value);
    if (!domain) return { success: true, events: [], sourceStatus: "NO_INTERNAL_MATCH_YET" };
    try {
      const labels = await prisma.domainLabel.findMany({
        where: { domain, isActive: true },
        select: {
          labelType: true,
          label: true,
          confidence: true,
          category: true,
          sourceName: true,
          sourceUrl: true,
          evidence: true,
          entityName: true,
        },
        take: 10,
      });

      const threats = labels.filter((l) => l.labelType !== "TRUSTED");
      const trusted = labels.filter((l) => l.labelType === "TRUSTED");

      if (threats.length > 0) {
        const top = threats[0];
        const severity =
          top.labelType === "DRAINER" || top.labelType === "SANCTIONS"
            ? "HIGH"
            : top.labelType === "MALICIOUS_DAPP" || top.labelType === "PHISHING"
              ? top.confidence === "high" ? "HIGH" : "MEDIUM"
              : "MEDIUM";
        events.push({
          entityId: entity.id,
          eventType: "THREAT_SIGNAL_FOUND",
          sourceModule: "Threat_Intel",
          severity,
          title: `${threats.length} threat intel hit${threats.length === 1 ? "" : "s"} on ${domain}`,
          summary: threats
            .slice(0, 3)
            .map((l) => `${l.sourceName}: ${l.label}`)
            .join(" · "),
          confidence:
            top.confidence === "high" ? 0.85
            : top.confidence === "medium" ? 0.65
            : 0.4,
          payload: { domain, threatLabels: threats, trustedLabels: trusted },
        });
        return { success: true, events, sourceStatus: "EXTERNAL_THREAT_SIGNAL_FOUND" };
      }

      if (trusted.length > 0) {
        // Context hit, not a threat.
        events.push({
          entityId: entity.id,
          eventType: "PROTOCOL_CONTEXT_FOUND",
          sourceModule: "Threat_Intel",
          severity: "LOW",
          title: `Known protocol: ${trusted[0].entityName ?? trusted[0].label}`,
          summary: `${domain} is a registered ${trusted[0].category ?? "protocol"} front-end (${trusted[0].sourceName})`,
          confidence: 0.85,
          payload: { domain, trustedLabels: trusted },
        });
        return { success: true, events, sourceStatus: "INTERNAL_MATCH_FOUND" };
      }

      // Source availability probe.
      const any = await prisma.domainLabel.findFirst({ select: { id: true } });
      return {
        success: true,
        events,
        sourceStatus: any ? "NO_INTERNAL_MATCH_YET" : "SOURCE_UNAVAILABLE",
      };
    } catch (err) {
      return {
        success: true,
        events,
        error: err instanceof Error ? err.message : "threat_intel_failed",
        sourceStatus: "SOURCE_UNAVAILABLE",
      };
    }
  }

  // ── Wallet / contract path ───────────────────────────────────────────
  if (entity.type === "WALLET" || entity.type === "CONTRACT") {
    const address = entity.value.trim();
    if (address.length < 10) {
      return { success: true, events: [], sourceStatus: "NO_INTERNAL_MATCH_YET" };
    }
    try {
      const labels = await prisma.addressLabel.findMany({
        where: {
          isActive: true,
          address: { equals: address, mode: "insensitive" },
        },
        select: {
          chain: true, labelType: true, label: true, confidence: true,
          sourceName: true, sourceUrl: true, evidence: true, entityName: true,
        },
        take: 10,
      });

      if (labels.length > 0) {
        const top = labels[0];
        const severity =
          top.label === "OFAC SDN" ? "CRITICAL"
          : top.confidence === "high" ? "HIGH"
          : "MEDIUM";
        events.push({
          entityId: entity.id,
          eventType: "THREAT_SIGNAL_FOUND",
          sourceModule: "Threat_Intel",
          severity,
          title: top.label === "OFAC SDN"
            ? `OFAC sanctioned address on ${top.chain}`
            : `${labels.length} threat label${labels.length === 1 ? "" : "s"} for ${short(address)}`,
          summary: labels.slice(0, 3).map((l) => `${l.sourceName}: ${l.label}`).join(" · "),
          confidence:
            top.confidence === "high" ? 0.9
            : top.confidence === "medium" ? 0.65
            : 0.4,
          payload: { address, labels },
        });
        return { success: true, events, sourceStatus: "EXTERNAL_THREAT_SIGNAL_FOUND" };
      }

      const any = await prisma.addressLabel.findFirst({ select: { id: true } });
      return {
        success: true,
        events,
        sourceStatus: any ? "NO_INTERNAL_MATCH_YET" : "SOURCE_UNAVAILABLE",
      };
    } catch (err) {
      return {
        success: true,
        events,
        error: err instanceof Error ? err.message : "threat_intel_failed",
        sourceStatus: "SOURCE_UNAVAILABLE",
      };
    }
  }

  // Other entity types (HANDLE, TX_HASH, …) aren't served by Threat_Intel;
  // KOL_Registry + Intel_Vault cover them instead.
  return { success: true, events: [], sourceStatus: "NO_INTERNAL_MATCH_YET" };
}

function short(a: string): string {
  return a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a;
}
