/**
 * MetaMask `eth-phishing-detect` ingest (bulk SQL).
 *
 * Source: https://github.com/MetaMask/eth-phishing-detect
 *   raw config: https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json
 *
 * Two buckets stored:
 *   - `blacklist`  → labelType PHISHING  confidence HIGH
 *   - `fuzzylist`  → labelType PHISHING  confidence MEDIUM
 *
 * `whitelist` + `tolerance` are intentionally ignored — not threat signals.
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { normaliseDomain } from "../normalize/domain";
import { emptySummary, type IngestSummary } from "../run/types";

const CONFIG_URL =
  "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json";
const SOURCE_URL = "https://github.com/MetaMask/eth-phishing-detect";
const LICENSE =
  "MetaMask eth-phishing-detect (attribution, non-commercial-as-a-feed)";
const SOURCE_NAME = "MetaMask eth-phishing-detect";
const LABEL_TYPE = "PHISHING";
const CHUNK = 1000;

type Config = {
  blacklist?: string[];
  fuzzylist?: string[];
  whitelist?: string[];
};

export async function ingestMetaMaskPhishing(): Promise<IngestSummary> {
  const summary = emptySummary("MetaMask_phishing");
  const t0 = Date.now();

  let cfg: Config;
  try {
    const res = await fetch(CONFIG_URL, {
      headers: { "user-agent": "interligens-intel-ingest/1", accept: "application/json" },
    });
    if (!res.ok) {
      summary.errors++;
      summary.note = `fetch_${res.status}`;
      summary.durationMs = Date.now() - t0;
      return summary;
    }
    cfg = (await res.json()) as Config;
  } catch (err) {
    summary.errors++;
    summary.note = err instanceof Error ? err.message : "fetch_failed";
    summary.durationMs = Date.now() - t0;
    return summary;
  }

  // Collect (domain, bucket) pairs, dedup within batch. Blacklist wins over
  // fuzzylist when a domain appears in both.
  const rows = new Map<string, "blacklist" | "fuzzylist">();
  for (const d of cfg.fuzzylist ?? []) {
    summary.fetched++;
    const n = normaliseDomain(d);
    if (!n) { summary.skipped++; continue; }
    if (!rows.has(n)) rows.set(n, "fuzzylist");
    summary.normalised++;
  }
  for (const d of cfg.blacklist ?? []) {
    summary.fetched++;
    const n = normaliseDomain(d);
    if (!n) { summary.skipped++; continue; }
    rows.set(n, "blacklist"); // overwrite fuzzy → blacklist
    summary.normalised++;
  }

  const entries = [...rows.entries()];
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    const now = new Date();
    for (const [domain, bucket] of chunk) {
      const label = bucket === "blacklist" ? "MetaMask phishing list" : "MetaMask fuzzy list";
      const confidence = bucket === "blacklist" ? "high" : "medium";
      const category = bucket === "blacklist" ? "phishing" : "fuzzy-phishing";
      const idx = params.length;
      params.push(
        randomUUID(), domain, LABEL_TYPE, label, confidence, category,
        SOURCE_NAME, SOURCE_URL,
        `Published in ${bucket} of eth-phishing-detect/config.json`,
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
      DO UPDATE SET "isActive" = TRUE, "lastSeenAt" = EXCLUDED."lastSeenAt", "confidence" = EXCLUDED."confidence";`;
    try {
      await prisma.$executeRawUnsafe(sql, ...params);
      summary.upserted += chunk.length;
    } catch (err) {
      summary.errors += chunk.length;
      console.error("[metamask] bulk upsert failed", err);
    }
  }

  summary.durationMs = Date.now() - t0;
  return summary;
}
