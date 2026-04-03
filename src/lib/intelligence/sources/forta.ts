// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Forta Scam Detector Ingestor
// Queries Forta GraphQL API for scam-labeled addresses/contracts.
// Requires FORTA_API_KEY env var.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeAddress } from "../normalize";
import type { IntelEntityType, MatchBasis } from "../types";
import type { SourceRaw } from "./types";

const FORTA_GRAPHQL_URL = "https://api.forta.network/graphql";

const SCAM_DETECTOR_BOT =
  "0x1d646c4045189991fdfd24a66100422bf1729cf2";

const QUERY = `{
  labels(input: {
    sourceIds: ["${SCAM_DETECTOR_BOT}"],
    labels: ["scammer_eoa", "scammer_contract", "phishing"],
    first: 1000
  }) {
    labels {
      label {
        entity
        label
        confidence
        entityType
      }
    }
  }
}`;

function mapLabel(label: string): {
  entityType: IntelEntityType;
  matchBasis: MatchBasis;
} {
  switch (label) {
    case "scammer_contract":
      return { entityType: "CONTRACT", matchBasis: "EXACT_CONTRACT" };
    case "scammer_eoa":
      return { entityType: "ADDRESS", matchBasis: "EXACT_ADDRESS" };
    case "phishing":
    default:
      return { entityType: "ADDRESS", matchBasis: "EXACT_ADDRESS" };
  }
}

interface FortaLabel {
  entity: string;
  label: string;
  confidence: number;
  entityType?: string;
}

export async function fetchForta(): Promise<SourceRaw[]> {
  const apiKey = process.env.FORTA_API_KEY;
  if (!apiKey) {
    console.warn("FORTA_API_KEY not set — skipping Forta ingest");
    return [];
  }

  const res = await fetch(FORTA_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: QUERY }),
  });

  if (!res.ok) {
    console.warn(`Forta fetch failed: ${res.status}`);
    return [];
  }

  const json = await res.json();
  const labels: FortaLabel[] =
    json?.data?.labels?.labels?.map(
      (l: { label: FortaLabel }) => l.label
    ) ?? [];

  const results: SourceRaw[] = [];

  for (const l of labels) {
    if (l.confidence < 0.6) continue;

    const entity = l.entity?.trim();
    if (!entity) continue;

    const { entityType, matchBasis } = mapLabel(l.label);

    // If Forta says entityType is "contract", override our mapping
    const finalEntityType =
      l.entityType?.toLowerCase() === "contract" ? "CONTRACT" : entityType;
    const finalMatchBasis =
      finalEntityType === "CONTRACT" ? "EXACT_CONTRACT" : matchBasis;

    results.push({
      sourceSlug: "forta",
      sourceTier: 2,
      entityType: finalEntityType,
      value: normalizeAddress(entity),
      chain: entity.startsWith("0x") ? "ethereum" : undefined,
      riskClass: "HIGH",
      matchBasis: finalMatchBasis,
      label: l.label,
      externalUrl: `https://explorer.forta.network/address/${entity}`,
      meta: { confidence: l.confidence, fortaLabel: l.label },
    });
  }

  return results;
}
