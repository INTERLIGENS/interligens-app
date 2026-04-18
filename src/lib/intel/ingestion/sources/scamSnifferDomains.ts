/**
 * ScamSniffer DOMAINS ingest.
 * The address list is handled separately in `scamSniffer.ts`.
 *
 * Source: https://github.com/scamsniffer/scam-database
 * Licence: GPL-3.0 (per repo LICENSE).
 *
 * The `blacklist/domains.json` file is a flat array of lowercase domain
 * strings — currently ~345k entries. Row-by-row upserts would be too slow,
 * so we bulk-insert via raw SQL with ON CONFLICT DO UPDATE in chunks.
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { normaliseDomain } from "../normalize/domain";
import { emptySummary, type IngestSummary } from "../run/types";

const URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json";
const SOURCE_URL = "https://github.com/scamsniffer/scam-database";
const LICENSE = "GPL-3.0 (per github.com/scamsniffer/scam-database)";
const SOURCE_NAME = "ScamSniffer";
const LABEL = "ScamSniffer domains blacklist";
const LABEL_TYPE = "SCAM_DOMAIN";

const CHUNK = 1000;

export async function ingestScamSnifferDomains(): Promise<IngestSummary> {
  const summary = emptySummary("ScamSniffer_domains");
  const t0 = Date.now();

  let raw: unknown;
  try {
    const res = await fetch(URL, {
      headers: { "user-agent": "interligens-intel-ingest/1", accept: "application/json" },
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
    summary.note = "unexpected_shape";
    summary.durationMs = Date.now() - t0;
    return summary;
  }

  const uniq = new Set<string>();
  for (const d of raw as unknown[]) {
    summary.fetched++;
    if (typeof d !== "string") { summary.skipped++; continue; }
    const n = normaliseDomain(d);
    if (!n) { summary.skipped++; continue; }
    if (uniq.has(n)) { summary.skipped++; continue; }
    uniq.add(n);
    summary.normalised++;
  }

  const domains = [...uniq];
  for (let i = 0; i < domains.length; i += CHUNK) {
    const batch = domains.slice(i, i + CHUNK);
    // Build a single INSERT…VALUES(…)…ON CONFLICT … per chunk.
    const values: string[] = [];
    const params: unknown[] = [];
    const now = new Date();
    for (const domain of batch) {
      const idx = params.length;
      params.push(
        randomUUID(), // id
        domain,
        LABEL_TYPE,
        LABEL,
        "medium",
        "phishing",
        SOURCE_NAME,
        SOURCE_URL,
        "Domain listed in ScamSniffer blacklist/domains.json",
        "public",
        LICENSE,
        "low",
        true,
        now,
        now,
      );
      values.push(
        `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5},` +
          `$${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10},` +
          `$${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15})`,
      );
    }
    const sql = `INSERT INTO "DomainLabel" (
        "id", "domain", "labelType", "label", "confidence", "category",
        "sourceName", "sourceUrl", "evidence", "visibility", "license",
        "tosRisk", "isActive", "firstSeenAt", "lastSeenAt"
      ) VALUES ${values.join(",")}
      ON CONFLICT ("domain", "labelType", "label", "sourceUrl")
      DO UPDATE SET "isActive" = TRUE, "lastSeenAt" = EXCLUDED."lastSeenAt";`;
    try {
      const affected = await prisma.$executeRawUnsafe(sql, ...params);
      summary.upserted += batch.length; // treat all as upserted; ON CONFLICT covers both
      void affected;
    } catch (err) {
      summary.errors += batch.length;
      console.error("[scamsniffer-domains] batch failed", err);
    }
  }

  summary.durationMs = Date.now() - t0;
  return summary;
}
