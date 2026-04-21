// ─── MM Tracker — Arkham auto-discovery (manual script) ──────────────────
// For each MmEntity, iterate its known wallets and probe Arkham Intelligence
// for additional tagged addresses. Matches are inserted as MmAttribution
// rows with method=ARKHAM and confidence=0.80.
//
// NOTES:
//   • Arkham's public API is rate-limited and requires ARKHAM_API_KEY. If
//     the key is missing the script exits cleanly with a warning.
//   • The script is intentionally manual (no cron) — Arkham data quality
//     varies and every discovery should be human-reviewed before promotion
//     to a higher confidence tier.
//
// Usage: ARKHAM_API_KEY=xyz npx tsx scripts/mm/arkhamDiscovery.ts [slug]
//        (omit slug to run for every entity)

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmChain } from "@/lib/mm/types";
import { writeReviewLog } from "@/lib/mm/registry/reviewLog";

const ARKHAM_BASE = "https://api.arkhamintelligence.com";

interface ArkhamLabel {
  address: string;
  entityName?: string;
  entityId?: string;
  labelName?: string;
  chain?: string;
}

export interface ArkhamDiscoveryOptions {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  /** Limit to one entity by slug. */
  entitySlug?: string;
  /** Dry run — don't persist anything. */
  dryRun?: boolean;
}

export interface ArkhamDiscoveryResult {
  entitiesProcessed: number;
  candidatesFound: number;
  attributionsCreated: number;
  errors: Array<{ item: string; message: string }>;
}

function chainFromArkham(arkhamChain?: string): MmChain | null {
  switch ((arkhamChain ?? "").toLowerCase()) {
    case "ethereum":
      return "ETHEREUM";
    case "base":
      return "BASE";
    case "arbitrum":
    case "arbitrum_one":
      return "ARBITRUM";
    case "optimism":
      return "OPTIMISM";
    case "polygon":
    case "matic":
      return "POLYGON";
    case "bsc":
    case "bnb":
    case "binance":
      return "BNB";
    case "solana":
      return "SOLANA";
    default:
      return null;
  }
}

async function arkhamLabels(
  address: string,
  opts: ArkhamDiscoveryOptions,
): Promise<ArkhamLabel[]> {
  const key = opts.apiKey ?? process.env.ARKHAM_API_KEY;
  if (!key) throw new Error("ARKHAM_API_KEY is not set");
  const fx = opts.fetchImpl ?? fetch;
  const res = await fx(
    `${ARKHAM_BASE}/intelligence/address/${address}/labels`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "API-Key": key,
      },
    },
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`arkham ${res.status}`);
  }
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return body as ArkhamLabel[];
  if (body && typeof body === "object" && "labels" in body) {
    const labels = (body as { labels?: ArkhamLabel[] }).labels;
    return Array.isArray(labels) ? labels : [];
  }
  return [];
}

export async function runArkhamDiscovery(
  opts: ArkhamDiscoveryOptions = {},
): Promise<ArkhamDiscoveryResult> {
  const summary: ArkhamDiscoveryResult = {
    entitiesProcessed: 0,
    candidatesFound: 0,
    attributionsCreated: 0,
    errors: [],
  };

  const entities = await prisma.mmEntity.findMany({
    where: opts.entitySlug ? { slug: opts.entitySlug } : undefined,
    include: {
      attributions: { where: { revokedAt: null } },
    },
  });

  const knownAttributions = new Set<string>();
  for (const e of entities) {
    for (const a of e.attributions) {
      knownAttributions.add(`${a.walletAddress.toLowerCase()}:${a.chain}`);
    }
  }

  for (const entity of entities) {
    summary.entitiesProcessed += 1;
    const entityAliases = [
      entity.name.toLowerCase(),
      ...(entity.knownAliases ?? []).map((a) => a.toLowerCase()),
    ];

    for (const seed of entity.attributions) {
      let labels: ArkhamLabel[] = [];
      try {
        labels = await arkhamLabels(seed.walletAddress, opts);
      } catch (err) {
        summary.errors.push({
          item: seed.walletAddress,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      for (const l of labels) {
        const address = (l.address ?? "").toLowerCase();
        const chain = chainFromArkham(l.chain);
        const candidateEntity = (l.entityName ?? l.labelName ?? "").toLowerCase();
        if (!address || !chain) continue;
        if (!entityAliases.some((alias) => candidateEntity.includes(alias))) continue;
        const key = `${address}:${chain}`;
        if (knownAttributions.has(key)) continue;

        summary.candidatesFound += 1;
        if (opts.dryRun) continue;

        try {
          const created = await prisma.mmAttribution.create({
            data: {
              walletAddress: l.address,
              chain,
              mmEntityId: entity.id,
              attributionMethod: "ARKHAM",
              confidence: 0.8,
              evidenceRefs: [
                {
                  source: "arkham_intelligence",
                  label: l.labelName ?? l.entityName,
                },
              ] as unknown as Prisma.InputJsonValue,
              reviewerUserId: "system",
              reviewedAt: new Date(),
            },
          });
          await writeReviewLog({
            targetType: "ATTRIBUTION",
            targetId: created.id,
            action: "CREATED",
            actorUserId: "system",
            actorRole: "arkham_discovery",
            notes: `Arkham match ${l.labelName ?? l.entityName} → ${entity.slug}`,
            snapshotAfter: {
              walletAddress: l.address,
              chain,
              entitySlug: entity.slug,
              arkhamLabel: l.labelName ?? l.entityName,
            } as unknown as Prisma.InputJsonValue,
          });
          knownAttributions.add(key);
          summary.attributionsCreated += 1;
        } catch (err) {
          summary.errors.push({
            item: `${l.address} → ${entity.slug}`,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return summary;
}

// ─── CLI ─────────────────────────────────────────────────────────────────

async function main() {
  const entitySlug = process.argv[2] && !process.argv[2].startsWith("-")
    ? process.argv[2]
    : undefined;

  console.log(
    `[mm arkham] starting ${entitySlug ? `for ${entitySlug}` : "for all entities"}`,
  );
  if (!process.env.ARKHAM_API_KEY) {
    console.warn("[mm arkham] ARKHAM_API_KEY is not set — exiting without work");
    return;
  }

  const s = await runArkhamDiscovery({ entitySlug });
  console.log("");
  console.log("────────────────────────────────────────");
  console.log("  MM_TRACKER — Arkham discovery summary");
  console.log("────────────────────────────────────────");
  console.log(`  Entities processed   : ${s.entitiesProcessed}`);
  console.log(`  Candidates found     : ${s.candidatesFound}`);
  console.log(`  Attributions created : ${s.attributionsCreated}`);
  console.log(`  Errors               : ${s.errors.length}`);
  if (s.errors.length > 0) {
    for (const e of s.errors) console.log(`   • ${e.item} → ${e.message}`);
  }
}

const isEntry =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("arkhamDiscovery.ts");

if (isEntry) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
