// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — AMF France Blacklist Ingestor
// Fetches the AMF blacklist of unauthorized investment service providers.
// Weight: 0.18 in intelligence scoring (regulatory tier 1).
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeDomain } from "../normalize";
import type { SourceRaw } from "./types";

// AMF publishes a JSON endpoint for their warning list
const AMF_BLACKLIST_URL =
  "https://geco.amf-france.org/api/v1/liste-noire?language=fr";

// Fallback: direct page scrape structure
const AMF_FALLBACK_URL =
  "https://www.amf-france.org/fr/espace-epargnants/proteger-son-epargne/listes-noires-et-mises-en-garde";

interface AmfEntry {
  name?: string;
  website?: string;
  url?: string;
  domain?: string;
  type?: string;
  date?: string;
  [key: string]: unknown;
}

export async function fetchAmf(): Promise<SourceRaw[]> {
  const results: SourceRaw[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(AMF_BLACKLIST_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "INTERLIGENS/1.0",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[amf] HTTP ${res.status} from primary endpoint`);
      return [];
    }

    const json = await res.json();

    // AMF API may return different structures
    const entries: AmfEntry[] = Array.isArray(json)
      ? json
      : json?.data ?? json?.results ?? json?.items ?? [];

    for (const entry of entries) {
      const rawWebsite = entry.website ?? entry.url ?? entry.domain ?? "";
      const name = entry.name ?? "";

      // Emit domain entry
      if (typeof rawWebsite === "string" && rawWebsite.trim()) {
        const domain = normalizeDomain(rawWebsite);
        if (domain && domain.includes(".")) {
          results.push({
            sourceSlug: "amf",
            sourceTier: 1,
            entityType: "DOMAIN",
            value: domain,
            riskClass: "SANCTION",
            matchBasis: "EXACT_DOMAIN",
            jurisdiction: "FR",
            listType: "AMF_BLACKLIST",
            externalUrl: AMF_FALLBACK_URL,
            label: typeof name === "string" ? name.slice(0, 200) : undefined,
            meta: { entityName: name, type: entry.type, date: entry.date },
          });
        }
      }

      // Also emit a PROJECT entry for the entity name
      if (typeof name === "string" && name.trim()) {
        results.push({
          sourceSlug: "amf",
          sourceTier: 1,
          entityType: "PROJECT",
          value: name.trim(),
          riskClass: "SANCTION",
          matchBasis: "EXACT_DOMAIN",
          jurisdiction: "FR",
          listType: "AMF_BLACKLIST",
          externalUrl: AMF_FALLBACK_URL,
          meta: { entityName: name, website: rawWebsite, type: entry.type },
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("abort")) {
      console.warn(`[amf] fetch failed: ${msg}`);
    }
  }

  return results;
}
