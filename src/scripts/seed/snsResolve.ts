/**
 * Retail Vision Phase 6F-2 — SNS .sol seeder.
 *
 * Cible : KolProfile sans KolWallet chain=SOL existant.
 * Tente resolveSnsForHandle(handle) et, en cas de succès, crée un
 * KolWallet en attributionSource="sns", status review, isPubliclyUsable=false.
 *
 * Dry-run par défaut. SEED_SNS=1 pour écrire.
 *
 * Rate-limit 250ms/handle par politesse envers le proxy Bonfida public.
 */
import { prisma } from "@/lib/prisma";
import { resolveSnsForHandle } from "@/lib/chains/sns";

interface Summary {
  profilesTargeted: number;
  tested: number;
  resolved: number;
  created: number;
  errors: number;
}

async function main() {
  const dryRun = process.env.SEED_SNS !== "1";
  console.log(`[sns] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const profiles = await prisma.kolProfile.findMany({
    select: {
      handle: true,
      kolWallets: { where: { chain: "SOL" }, select: { id: true } },
    },
  });
  const targets = profiles.filter((p) => p.kolWallets.length === 0);
  console.log(
    `[sns] ${profiles.length} profiles total, ${targets.length} without SOL wallet`
  );

  const summary: Summary = {
    profilesTargeted: targets.length,
    tested: 0,
    resolved: 0,
    created: 0,
    errors: 0,
  };

  for (const p of targets) {
    summary.tested += 1;
    try {
      const hit = await resolveSnsForHandle(p.handle);
      if (!hit) {
        // Miss is the common case — log one line for dry-run insight only.
        continue;
      }
      summary.resolved += 1;
      console.log(`[sns] ✅ ${p.handle} ← ${hit.domain} → ${hit.address}`);

      if (dryRun) continue;

      const existing = await prisma.kolWallet.findFirst({
        where: { kolHandle: p.handle, address: hit.address, chain: "SOL" },
        select: { id: true },
      });
      if (existing) {
        console.log(`[sns]   already exists, skip`);
        continue;
      }
      await prisma.kolWallet.create({
        data: {
          kolHandle: p.handle,
          address: hit.address,
          chain: "SOL",
          label: `sns:${hit.domain}`,
          attributionSource: "sns",
          attributionNote: `Resolved via SNS (${hit.domain}) on ${new Date().toISOString().slice(0, 10)}`,
          attributionStatus: "review",
          isPubliclyUsable: false,
          discoveredAt: new Date(),
          status: "active",
          confidence: "medium",
        },
      });
      summary.created += 1;
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[sns] soft-fail ${p.handle}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("[sns] summary", summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[sns] fatal", e);
  process.exit(1);
});
