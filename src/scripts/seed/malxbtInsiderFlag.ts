/**
 * Retail Vision Phase 2C — MalXBT insider flag.
 *
 * Source : document interne BOTIFY leaké, MalXBT y est listé comme développeur.
 * → KolProfile.label = "TEAM_MEMBER"
 * → KolProfile.notes = explication leak
 * → KolTokenInvolvement(MalXBT, SOL, BOTIFY).isFundedByProject = true (si la
 *   row existe ; sinon, log + skip — on ne fabrique pas de proceeds inexistant)
 *
 * Idempotent. Dry-run par défaut. Pour écrire :
 *     SEED_MALXBT_INSIDER=1 pnpm tsx src/scripts/seed/malxbtInsiderFlag.ts
 */
import { prisma } from "@/lib/prisma";

const HANDLE = "MalXBT";
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const NEW_LABEL = "TEAM_MEMBER";
const NEW_NOTES =
  "TEAM_MEMBER — développeur BOTIFY confirmé dans document interne leaké (Phase 2C, 2026-04-11).";

async function main() {
  const dryRun = process.env.SEED_MALXBT_INSIDER !== "1";
  console.log(`[malxbt-insider] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const profile = await prisma.kolProfile.findUnique({ where: { handle: HANDLE } });
  if (!profile) {
    console.error(`[malxbt-insider] KolProfile ${HANDLE} not found — run knownPromosImport.ts first.`);
    process.exit(1);
  }
  console.log(`[malxbt-insider] current profile`, {
    handle: profile.handle,
    label: profile.label,
    notes: profile.notes,
  });

  if (!dryRun) {
    await prisma.kolProfile.update({
      where: { handle: HANDLE },
      data: { label: NEW_LABEL, notes: NEW_NOTES },
    });
    console.log(`[malxbt-insider] KolProfile updated → label=${NEW_LABEL}`);
  }

  const involvement = await prisma.kolTokenInvolvement.findFirst({
    where: { kolHandle: HANDLE, chain: "SOL", tokenMint: BOTIFY_MINT },
  });
  if (!involvement) {
    console.warn(
      `[malxbt-insider] KolTokenInvolvement(${HANDLE}, SOL, BOTIFY) does not exist — ` +
      `skip isFundedByProject (no KolProceedsEvent for MalXBT yet, kolTokenInvolvement.ts ` +
      `seed cannot derive a row without proceeds).`
    );
  } else {
    console.log(`[malxbt-insider] involvement found`, {
      id: involvement.id,
      isFundedByProject: involvement.isFundedByProject,
    });
    if (!dryRun) {
      await prisma.kolTokenInvolvement.update({
        where: { id: involvement.id },
        data: { isFundedByProject: true, lastComputedAt: new Date() },
      });
      console.log(`[malxbt-insider] involvement updated → isFundedByProject=true`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[malxbt-insider] fatal", e);
  process.exit(1);
});
