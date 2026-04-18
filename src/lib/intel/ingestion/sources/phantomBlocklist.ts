/**
 * Phantom blocklist ingest (bulk SQL).
 *
 * Source: https://github.com/phantom/blocklist
 *   - blocklist.yaml     — Solana malicious dApps
 *   - eth-blocklist.yaml — EVM malicious dApps
 *   - fuzzylist.yaml     — typosquats / near-misses
 *
 * Licence: MIT (per repo LICENSE). Source attribution on every row.
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { normaliseDomain } from "../normalize/domain";
import { emptySummary, type IngestSummary } from "../run/types";

const BASE = "https://raw.githubusercontent.com/phantom/blocklist/master";
const SOURCE_URL = "https://github.com/phantom/blocklist";
const LICENSE = "MIT (per phantom/blocklist)";
const SOURCE_NAME = "Phantom blocklist";
const CHUNK = 1000;

const FILES = [
  { file: "blocklist.yaml",     label: "Phantom SOL blocklist",  labelType: "MALICIOUS_DAPP", category: "solana-dapp",    confidence: "high"   },
  { file: "eth-blocklist.yaml", label: "Phantom EVM blocklist",  labelType: "MALICIOUS_DAPP", category: "evm-dapp",       confidence: "high"   },
  { file: "fuzzylist.yaml",     label: "Phantom fuzzy list",     labelType: "PHISHING",       category: "fuzzy-typosquat",confidence: "medium" },
] as const;

function extractUrls(yaml: string): string[] {
  const out: string[] = [];
  const re = /-\s*url:\s*"?([^"\s#]+)"?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(yaml)) !== null) out.push(m[1]);
  return out;
}

export async function ingestPhantomBlocklist(): Promise<IngestSummary> {
  const summary = emptySummary("Phantom_blocklist");
  const t0 = Date.now();

  for (const spec of FILES) {
    let yaml: string;
    try {
      const res = await fetch(`${BASE}/${spec.file}`, { headers: { "user-agent": "interligens-intel-ingest/1" } });
      if (!res.ok) { summary.errors++; continue; }
      yaml = await res.text();
    } catch {
      summary.errors++;
      continue;
    }

    const uniq = new Set<string>();
    for (const raw of extractUrls(yaml)) {
      summary.fetched++;
      const n = normaliseDomain(raw);
      if (!n) { summary.skipped++; continue; }
      if (uniq.has(n)) { summary.skipped++; continue; }
      uniq.add(n);
      summary.normalised++;
    }

    const domains = [...uniq];
    for (let i = 0; i < domains.length; i += CHUNK) {
      const chunk = domains.slice(i, i + CHUNK);
      const values: string[] = [];
      const params: unknown[] = [];
      const now = new Date();
      for (const domain of chunk) {
        const idx = params.length;
        params.push(
          randomUUID(), domain, spec.labelType, spec.label, spec.confidence,
          spec.category, SOURCE_NAME, SOURCE_URL,
          `Listed in phantom/blocklist/${spec.file}`,
          "public", LICENSE, "low", true, now, now,
        );
        values.push(
          `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5},` +
          ` $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10},` +
          ` $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15})`,
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
        await prisma.$executeRawUnsafe(sql, ...params);
        summary.upserted += chunk.length;
      } catch (err) {
        summary.errors += chunk.length;
        console.error("[phantom] bulk upsert failed", spec.file, err);
      }
    }
  }

  summary.durationMs = Date.now() - t0;
  return summary;
}
