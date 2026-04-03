// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — FCA Warning List Ingestor
// FCA register API requires auth headers that vary; this implementation
// uses the public search endpoint with pagination.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeDomain } from "../normalize";
import type { SourceRaw } from "./types";

const FCA_WARNINGS_URL =
  "https://register.fca.org.uk/services/V0.1/Warnings";

interface FcaWarning {
  "Warning Type"?: string;
  "Entity Name"?: string;
  "FRN"?: string;
  "Website"?: string;
  "Date"?: string;
  "Link"?: string;
  [key: string]: unknown;
}

export async function fetchFca(): Promise<SourceRaw[]> {
  const results: SourceRaw[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${FCA_WARNINGS_URL}?pageSize=${pageSize}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "INTERLIGENS/1.0",
        "X-Auth-Email": process.env.FCA_AUTH_EMAIL ?? "",
        "X-Auth-Key": process.env.FCA_AUTH_KEY ?? "",
      },
    });

    if (!res.ok) {
      // FCA API is often unavailable or requires registration.
      // Return what we have so far rather than throwing.
      console.warn(`FCA fetch page ${page} failed: ${res.status}`);
      break;
    }

    const json = await res.json();
    const warnings: FcaWarning[] = json?.Warnings ?? json?.warnings ?? [];

    if (warnings.length === 0) {
      hasMore = false;
      break;
    }

    for (const w of warnings) {
      const name = w["Entity Name"] ?? w["Name"] ?? "";
      const website = w["Website"] ?? w["website"] ?? "";
      const frn = w["FRN"] ?? "";
      const link =
        w["Link"] ??
        (frn
          ? `https://register.fca.org.uk/s/firm?id=${frn}`
          : "https://www.fca.org.uk/scamsmart/warning-list");

      if (typeof website === "string" && website.trim()) {
        const domain = normalizeDomain(website);
        if (domain) {
          results.push({
            sourceSlug: "fca",
            sourceTier: 1,
            entityType: "DOMAIN",
            value: domain,
            riskClass: "SANCTION",
            matchBasis: "EXACT_DOMAIN",
            jurisdiction: "UK",
            listType: "FCA_WARNING",
            externalId: typeof frn === "string" ? frn : undefined,
            externalUrl: typeof link === "string" ? link : undefined,
            label: typeof name === "string" ? name : undefined,
            meta: { entityName: name, warningType: w["Warning Type"] },
          });
        }
      }

      // Also emit a PROJECT entry for the firm name
      if (typeof name === "string" && name.trim()) {
        results.push({
          sourceSlug: "fca",
          sourceTier: 1,
          entityType: "PROJECT",
          value: name.trim(),
          riskClass: "SANCTION",
          matchBasis: "EXACT_DOMAIN",
          jurisdiction: "UK",
          listType: "FCA_WARNING",
          externalId: typeof frn === "string" ? frn : undefined,
          externalUrl: typeof link === "string" ? link : undefined,
          meta: { entityName: name, website, warningType: w["Warning Type"] },
        });
      }
    }

    if (warnings.length < pageSize) {
      hasMore = false;
    }
    page++;
  }

  return results;
}
