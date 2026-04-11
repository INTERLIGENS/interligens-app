/**
 * Retail Vision Phase 2B — knownPromos.json → KolPromotionMention.
 *
 * Pipeline curaté complémentaire de `kolPromotionMention.ts` (Watcher-based).
 * Importe la liste curée `src/scripts/seed/knownPromos.json` directement dans
 * `KolPromotionMention`, et résout `DIONE_PENDING_OSINT` via le tokenAddress
 * réel observé dans `KolProceedsEvent` (tokenSymbol = 'DIONE').
 *
 * Stratégie :
 *   1. Charger knownPromos.json
 *   2. Pour chaque kolHandle référencé : vérifier KolProfile, créer si absent
 *      (handle minimal, label="unknown", platform="x")
 *   3. Résoudre `DIONE_PENDING_OSINT` via SELECT DISTINCT tokenAddress
 *      FROM "KolProceedsEvent" WHERE tokenSymbol = 'DIONE'. Si aucun mint
 *      n'est trouvé → laisser le placeholder tel quel (fail-soft).
 *   4. Upsert chaque entrée par clé unique (sourcePlatform, sourcePostId).
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_KNOWN_PROMOS=1 pnpm tsx src/scripts/seed/knownPromosImport.ts
 */
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

interface KnownPromo {
  kolHandle: string;
  chain: string;
  tokenMint: string;
  tokenSymbol: string;
  sourcePlatform: string;
  sourcePostId: string;
  sourceUrl: string;
  postedAt: string;
  contentSnippet: string;
}

async function resolveDioneMint(): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ tokenAddress: string }>>(
    `SELECT DISTINCT "tokenAddress"
       FROM "KolProceedsEvent"
      WHERE "tokenSymbol" = 'DIONE'
        AND "tokenAddress" IS NOT NULL
        AND "tokenAddress" <> ''
        AND "tokenAddress" NOT LIKE 'PENDING%'
        AND "tokenAddress" NOT LIKE '%PENDING%'`
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    console.warn(`[known-promos] DIONE: ${rows.length} distinct mints found, picking first:`, rows);
  }
  return rows[0].tokenAddress;
}

async function ensureKolProfile(handle: string, dryRun: boolean): Promise<boolean> {
  const existing = await prisma.kolProfile.findUnique({ where: { handle } });
  if (existing) return false;
  console.log(`[known-promos] KolProfile missing → will create handle=${handle}`);
  if (dryRun) return true;
  await prisma.kolProfile.create({
    data: {
      handle,
      platform: "x",
      label: "unknown",
      riskFlag: "unverified",
      confidence: "low",
      status: "active",
    },
  });
  return true;
}

async function main() {
  const dryRun = process.env.SEED_KNOWN_PROMOS !== "1";
  console.log(`[known-promos] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const file = path.resolve(__dirname, "knownPromos.json");
  const raw = fs.readFileSync(file, "utf8");
  const promos: KnownPromo[] = JSON.parse(raw);
  console.log(`[known-promos] loaded ${promos.length} curated entries from ${path.basename(file)}`);

  const handles = Array.from(new Set(promos.map(p => p.kolHandle)));
  let createdProfiles = 0;
  for (const h of handles) {
    if (await ensureKolProfile(h, dryRun)) createdProfiles += 1;
  }

  const dioneMint = await resolveDioneMint();
  console.log(`[known-promos] DIONE resolution: ${dioneMint ?? "NOT FOUND (placeholder kept)"}`);

  let upserts = 0;
  let resolved = 0;
  let leftPending = 0;
  const byHandle = new Map<string, number>();

  for (const p of promos) {
    let tokenMint = p.tokenMint;
    if (tokenMint === "DIONE_PENDING_OSINT") {
      if (dioneMint) {
        tokenMint = dioneMint;
        resolved += 1;
      } else {
        leftPending += 1;
      }
    }

    const postedAt = new Date(p.postedAt);
    byHandle.set(p.kolHandle, (byHandle.get(p.kolHandle) ?? 0) + 1);

    console.log("[known-promos] entry", {
      kol: p.kolHandle,
      token: p.tokenSymbol,
      mint: tokenMint.slice(0, 12) + (tokenMint.length > 12 ? "…" : ""),
      sourcePostId: p.sourcePostId,
      postedAt: postedAt.toISOString(),
    });

    if (dryRun) continue;

    try {
      await prisma.kolPromotionMention.upsert({
        where: {
          sourcePlatform_sourcePostId: {
            sourcePlatform: p.sourcePlatform,
            sourcePostId: p.sourcePostId,
          },
        },
        create: {
          kolHandle: p.kolHandle,
          chain: p.chain,
          tokenMint,
          tokenSymbol: p.tokenSymbol,
          sourcePlatform: p.sourcePlatform,
          sourcePostId: p.sourcePostId,
          sourceUrl: p.sourceUrl,
          postedAt,
          contentSnippet: p.contentSnippet,
        },
        update: {
          kolHandle: p.kolHandle,
          chain: p.chain,
          tokenMint,
          tokenSymbol: p.tokenSymbol,
          sourceUrl: p.sourceUrl,
          postedAt,
          contentSnippet: p.contentSnippet,
        },
      });
      upserts += 1;
    } catch (err) {
      console.warn("[known-promos] upsert failed (soft)", {
        kol: p.kolHandle,
        sourcePostId: p.sourcePostId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[known-promos] summary", {
    entries: promos.length,
    handles: handles.length,
    createdProfiles: dryRun ? `${createdProfiles} (preview)` : createdProfiles,
    upserts: dryRun ? `${promos.length} (preview)` : upserts,
    dioneResolved: resolved,
    dioneLeftPending: leftPending,
    byHandle: Object.fromEntries(byHandle),
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[known-promos] fatal", e);
  process.exit(1);
});
