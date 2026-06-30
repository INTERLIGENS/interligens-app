/**
 * $ANSEM roster — KolProfile répertoire seed (9 handles, shadow).
 *
 * Répertoire UNIQUEMENT : forme minimale (handle + displayName=handle +
 * platform="x"), shadow (publishable=false, publishStatus="draft"). ZÉRO scoring,
 * ZÉRO métadonnée fabriquée (pas de followerCount/tier/tags), ZÉRO wallet, ZÉRO
 * KolTokenLink, ZÉRO campagne Watcher, ZÉRO tag promoteur. Juste « ce compte existe ».
 *
 * AUCUNE affirmation $ANSEM dans les fiches (pas de lien token, pas de campagne).
 * Seule exception : _bolivian porte une NOTE INTERNE factuelle « à examiner »
 * (champ internalNote) — un flag d'examen, pas une assertion de promotion.
 *
 * Idempotent : check d'existence insensible à la casse contre KolProfile.handle.
 * Les lignes existantes ne sont JAMAIS modifiées (pas de rename, pas d'écrasement
 * de tier/statut). cryptotony__ et shahh sont déjà en base → seront skippés.
 *
 * Dry-run par défaut. Pour écrire :
 *     SEED_ANSEM=1 pnpm tsx src/scripts/seed/seedAnsemRoster.ts
 */
import { prisma } from "@/lib/prisma";

interface RosterEntry {
  handle: string;
  /** note interne factuelle optionnelle (examen) — seulement si fournie. */
  internalNote?: string;
}

const ROSTER: RosterEntry[] = [
  { handle: "HopiumPapi" },
  { handle: "RuneCrypto_" },
  { handle: "OnlyLJC" },
  { handle: "_TJRTrades" },
  { handle: "fluffycrypt" },
  { handle: "sandyXBT" },
  { handle: "ViperMasol" },
  { handle: "Cryptoze" },
  {
    handle: "_bolivian",
    internalNote:
      "Compte 'The Black Bull' (~51k followers), lié à la campagne $ANSEM, à examiner — joue sur la proximité nominale avec @blknoiz06 qui a publiquement désavoué le token. Examen forensique séparé requis.",
  },
];

function buildRoster(): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<string>();
  for (const e of ROSTER) {
    const key = e.handle.toLowerCase();
    if (seen.has(key)) {
      console.warn(`[ansem-roster] duplicate handle in input: ${e.handle}`);
      continue;
    }
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function main() {
  const dryRun = process.env.SEED_ANSEM !== "1";
  console.log(`[ansem-roster] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const roster = buildRoster();
  console.log(`[ansem-roster] input: ${roster.length} unique handles`);

  // Une seule requête d'existence insensible à la casse.
  const allLower = roster.map((r) => r.handle.toLowerCase());
  const existing = await prisma.kolProfile.findMany({
    where: { handle: { in: allLower, mode: "insensitive" } },
    select: { handle: true },
  });
  const existingLower = new Set(existing.map((e) => e.handle.toLowerCase()));
  console.log(`[ansem-roster] ${existingLower.size} of these already exist (case-insensitive): ${[...existingLower].join(", ") || "(none)"}`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of roster) {
    if (existingLower.has(entry.handle.toLowerCase())) {
      console.log(`[ansem-roster] SKIP (already in base, untouched) handle=${entry.handle}`);
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[ansem-roster] would CREATE handle=${entry.handle}${entry.internalNote ? " (+internalNote)" : ""}`);
      created += 1;
      continue;
    }
    try {
      await prisma.kolProfile.create({
        data: {
          handle: entry.handle,
          displayName: entry.handle,
          platform: "x",
          publishable: false,
          publishStatus: "draft",
          ...(entry.internalNote ? { internalNote: entry.internalNote } : {}),
          // Tout le reste = défauts schema (label "unknown", riskFlag "unverified",
          // confidence "low", status "active", rugCount 0...). Aucun scoring, aucun
          // followerCount/tier/tag, aucun wallet, aucun lien token.
        },
      });
      console.log(`[ansem-roster] CREATE handle=${entry.handle}${entry.internalNote ? " (+internalNote)" : ""}`);
      created += 1;
    } catch (err) {
      errors += 1;
      console.warn("[ansem-roster] create failed (soft)", {
        handle: entry.handle,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[ansem-roster] summary", {
    input: roster.length,
    created: dryRun ? `${created} (preview)` : created,
    skipped,
    errors,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[ansem-roster] fatal", e);
  process.exit(1);
});
