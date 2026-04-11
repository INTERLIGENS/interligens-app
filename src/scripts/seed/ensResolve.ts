/**
 * Retail Vision Phase 6B — ENS reverse seed for KolProfile.
 *
 * Iterates KolProfile rows that have NO ETH wallet attached, and tries
 * three ENS name patterns per handle:
 *
 *   - {handle}.eth
 *   - {handle}_crypto.eth
 *   - {handle}_nft.eth
 *
 * The first successful resolution is upserted into KolWallet with
 * `chain="ETH"`, `source="ens"`. Fail soft on every step:
 *   - 404 / no resolver / addr() returns 0x0 → silent skip
 *   - RPC timeout / non-200 → silent skip
 *
 * Idempotent. Dry-run par défaut. Pour écrire :
 *     SEED_ENS=1 pnpm tsx src/scripts/seed/ensResolve.ts
 *
 * Notes :
 *   - Twitter handles often contain underscores `_`, which are valid in
 *     ENS names. We do NOT strip them (the handle is the source of truth).
 *   - We rate-limit to 200 ms / RPC call to be polite to publicnode.
 *   - The script does NOT mutate KolProfile (handle, label, etc.)
 *   - The script does NOT create wallets for non-ETH chains.
 */
import { prisma } from "@/lib/prisma";
import { resolveEns } from "@/lib/ens/resolve";

const RPC_URL = "https://ethereum.publicnode.com";
const RATE_LIMIT_MS = 200;

interface Hit {
  kolHandle: string;
  pattern: string;
  address: string;
}

function patternsForHandle(handle: string): string[] {
  // ENS labels are case-insensitive but conventionally lowercased.
  // We sanitize: lowercase + drop a trailing underscore that's a Twitter
  // artifact only (e.g. `atitty_` would query `atitty_.eth` which the
  // ENS registry happily accepts; we keep both forms to be exhaustive).
  const h = handle.toLowerCase();
  const stripped = h.endsWith("_") ? h.slice(0, -1) : h;
  const variants = new Set<string>([
    `${h}.eth`,
    `${h}_crypto.eth`,
    `${h}_nft.eth`,
  ]);
  if (stripped !== h) {
    variants.add(`${stripped}.eth`);
    variants.add(`${stripped}_crypto.eth`);
    variants.add(`${stripped}_nft.eth`);
  }
  return Array.from(variants);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const dryRun = process.env.SEED_ENS !== "1";
  console.log(`[ens-seed] mode=${dryRun ? "DRY-RUN" : "WRITE"} rpc=${RPC_URL}`);

  // Find all KolProfile that don't already have an ETH wallet.
  const profiles = await prisma.kolProfile.findMany({
    select: { handle: true },
    orderBy: { createdAt: "asc" },
  });
  const ethWallets = await prisma.kolWallet.findMany({
    where: { chain: { in: ["ETH", "ETHEREUM"] } },
    select: { kolHandle: true },
  });
  const haveEth = new Set(ethWallets.map(w => w.kolHandle.toLowerCase()));

  const targets = profiles.filter(p => !haveEth.has(p.handle.toLowerCase()));
  console.log(`[ens-seed] ${profiles.length} profiles total, ${haveEth.size} already have ETH wallet, ${targets.length} to resolve`);

  const hits: Hit[] = [];
  let attempted = 0;
  let rpcCalls = 0;
  let errors = 0;

  for (const p of targets) {
    attempted += 1;
    const patterns = patternsForHandle(p.handle);
    let found: { pattern: string; address: string } | null = null;
    for (const pat of patterns) {
      try {
        const addr = await resolveEns(pat, RPC_URL);
        rpcCalls += 1;
        if (addr) {
          found = { pattern: pat, address: addr };
          break;
        }
      } catch (err) {
        errors += 1;
        // fail soft, continue
      }
      await sleep(RATE_LIMIT_MS);
    }

    if (!found) {
      if (attempted % 25 === 0) {
        console.log(`[ens-seed] progress: ${attempted}/${targets.length} (${hits.length} hits)`);
      }
      continue;
    }

    console.log(`[ens-seed] HIT ${p.handle} via ${found.pattern} → ${found.address}`);
    hits.push({ kolHandle: p.handle, pattern: found.pattern, address: found.address });

    if (dryRun) continue;

    try {
      // KolWallet has no @@unique constraint, so we manually dedup on
      // (kolHandle, address, chain) before creating.
      const existing = await prisma.kolWallet.findFirst({
        where: { kolHandle: p.handle, address: found.address, chain: "ETH" },
        select: { id: true },
      });
      if (existing) {
        console.log(`[ens-seed] wallet already exists for ${p.handle} ${found.address} (skip)`);
      } else {
        await prisma.kolWallet.create({
          data: {
            kolHandle: p.handle,
            address: found.address,
            chain: "ETH",
            label: `ens:${found.pattern}`,
            attributionSource: "ens",
            attributionNote: `Resolved via ENS public resolver (${found.pattern}) on ${new Date().toISOString().slice(0, 10)}`,
            attributionStatus: "review",
            isPubliclyUsable: false,
            discoveredAt: new Date(),
          },
        });
      }
    } catch (err) {
      errors += 1;
      console.warn("[ens-seed] upsert failed (soft)", {
        kolHandle: p.handle,
        address: found.address,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[ens-seed] summary", {
    profiles: profiles.length,
    targets: targets.length,
    attempted,
    rpcCalls,
    hits: hits.length,
    errors,
    mode: dryRun ? "DRY-RUN" : "WRITE",
  });
  if (hits.length) {
    console.log("[ens-seed] resolutions:");
    for (const h of hits) console.log(`  ${h.kolHandle} ← ${h.pattern} → ${h.address}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[ens-seed] fatal", e);
  process.exit(1);
});
