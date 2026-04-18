/**
 * DefiLlama protocols ingest.
 *
 * Source: https://api.llama.fi/protocols
 *   - MIT-licensed dataset (llama.fi/license). Attribution preserved on row.
 *
 * Dual output:
 *   1. ProtocolLabel — canonical row per protocol (slug unique)
 *   2. DomainLabel — a TRUSTED label for each protocol's primary URL, so the
 *      orchestrator can contextualise "uniswap.org ≠ malicious; it's the
 *      real Uniswap front-end"
 *
 * LIMITATION: the /protocols endpoint does NOT include the list of contract
 * addresses for each protocol. That would need /protocol/{slug} calls per
 * protocol, which isn't worth the quota spend right now. We accept this —
 * AddressLabel only gets threat rows (OFAC, ScamSniffer) for the seed layer.
 */

import { prisma } from "@/lib/prisma";
import { normaliseDomain } from "../normalize/domain";
import { emptySummary, type IngestSummary } from "../run/types";

const URL = "https://api.llama.fi/protocols";
const SOURCE_URL = "https://defillama.com";
const LICENSE = "MIT / public data (DefiLlama — https://defillama.com/docs/api)";

type Protocol = {
  id?: string;
  name: string;
  slug: string;
  category?: string | null;
  url?: string | null;
  logo?: string | null;
  description?: string | null;
  twitter?: string | null;
  chains?: string[];
  tvl?: number | null;
};

export async function ingestDefiLlama(): Promise<IngestSummary> {
  const summary = emptySummary("DefiLlama_protocols");
  summary.note =
    "/protocols endpoint does not expose per-protocol contract addresses; metadata-only import.";
  const t0 = Date.now();

  let raw: unknown;
  try {
    const res = await fetch(URL, {
      headers: { "user-agent": "interligens-intel-ingest/1" },
    });
    if (!res.ok) {
      summary.errors++;
      summary.note = `fetch_${res.status}`;
      summary.durationMs = Date.now() - t0;
      return summary;
    }
    raw = await res.json();
  } catch (err) {
    summary.errors++;
    summary.note = err instanceof Error ? err.message : "fetch_failed";
    summary.durationMs = Date.now() - t0;
    return summary;
  }

  if (!Array.isArray(raw)) {
    summary.errors++;
    summary.durationMs = Date.now() - t0;
    return summary;
  }

  for (const r of raw as Protocol[]) {
    summary.fetched++;
    if (!r?.slug || !r?.name) { summary.skipped++; continue; }
    summary.normalised++;

    // 1. ProtocolLabel (upsert by slug).
    try {
      const existing = await prisma.protocolLabel.findUnique({
        where: { slug: r.slug },
        select: { id: true },
      });
      await prisma.protocolLabel.upsert({
        where: { slug: r.slug },
        update: {
          name: r.name,
          category: r.category ?? null,
          chains: r.chains ?? [],
          website: r.url ?? null,
          twitter: r.twitter ?? null,
          logo: r.logo ?? null,
          description: r.description ?? null,
          tvlUsd: typeof r.tvl === "number" ? r.tvl : null,
          fetchedAt: new Date(),
        },
        create: {
          slug: r.slug,
          name: r.name,
          category: r.category ?? null,
          chains: r.chains ?? [],
          website: r.url ?? null,
          twitter: r.twitter ?? null,
          logo: r.logo ?? null,
          description: r.description ?? null,
          tvlUsd: typeof r.tvl === "number" ? r.tvl : null,
          sourceName: "DefiLlama",
          sourceUrl: SOURCE_URL,
        },
      });
      if (existing) summary.updated++; else summary.upserted++;
    } catch (err) {
      summary.errors++;
      console.error("[defillama] protocol upsert failed", r.slug, err);
      continue;
    }

    // 2. Domain trust label. Skip if no usable URL.
    if (r.url) {
      const domain = normaliseDomain(r.url);
      if (!domain) continue;
      try {
        await prisma.domainLabel.upsert({
          where: {
            dedup_key: {
              domain,
              labelType: "TRUSTED",
              label: `DefiLlama: ${r.name}`,
              sourceUrl: SOURCE_URL,
            },
          },
          update: { isActive: true, lastSeenAt: new Date() },
          create: {
            domain,
            labelType: "TRUSTED",
            label: `DefiLlama: ${r.name}`,
            confidence: "high",
            category: r.category ?? "defi-protocol",
            entityName: r.name,
            sourceName: "DefiLlama",
            sourceUrl: SOURCE_URL,
            evidence: `Registered protocol domain for ${r.slug}`,
            visibility: "public",
            license: LICENSE,
            tosRisk: "low",
            isActive: true,
          },
        });
      } catch (err) {
        // Non-fatal — protocol row is the priority.
        console.warn("[defillama] trusted-domain upsert failed", domain, err);
      }
    }
  }

  summary.durationMs = Date.now() - t0;
  return summary;
}
