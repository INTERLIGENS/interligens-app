/**
 * readback-verify.ts — LA RELECTURE, HORS DES TESTS. LECTURE SEULE.
 *
 * ██  CE SCRIPT N'ÉCRIT RIEN. NI EN BASE, NI DANS R2, NI CHEZ UNE TSA.      ██
 *
 * Il exerce exactement la capacité que `stampOne` exige avant tout horodatage
 * — relire les octets persistés, recalculer le SHA-256, confronter — et il
 * l'exerce SANS la moitié qui écrit. Un gate éprouvé uniquement par des
 * doubles injectés ne prouve pas que la relecture FONCTIONNE contre le vrai
 * stockage ; c'est ce trou-là que ce script ferme, et rien d'autre.
 *
 *   pnpm tsx src/scripts/evidence-chain/readback-verify.ts            # 1 pièce
 *   pnpm tsx src/scripts/evidence-chain/readback-verify.ts --limit 5
 *
 * L'univers est le MÊME que celui du job : `tsaPendingUniverseSql()`. Une
 * pièce disqualifiée n'est donc jamais relue ici non plus.
 *
 * Sort en 1 dès qu'une pièce refuse. Une divergence sur une pièce éligible
 * n'est PAS un incident de script : c'est un constat sur la chaîne de
 * conservation, et il se remonte avant toute autre action.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";
import { readbackDigest } from "../../lib/evidence-chain/readback";
import { assemblerResolutionDeStockage, runnerDepuisPrisma } from "../../lib/evidence-chain/runtimeResolution";
import { STORAGE_LOCATION_UNRESOLVED } from "../../lib/evidence-chain/stampGate";

async function main() {
  const i = process.argv.indexOf("--limit");
  const limit = i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : 1;

  const prisma = new PrismaClient();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","sha256","r2Key","byteSize" FROM "EvidenceItem"
        WHERE ${tsaPendingUniverseSql()} ORDER BY "ingestedAt" ASC LIMIT $1`,
      limit,
    )) as Array<{ id: string; sha256: string; r2Key: string | null; byteSize: number | null }>;

    // ── LE CHEMIN DE PRODUCTION, ASSEMBLÉ PAR LE CONSTRUCTEUR CANONIQUE.
    //
    // ⛔ ET PLUS DE PORTE DE NAISSANCE ICI. Ce script n'écrit RIEN : exiger
    // `R2_EVIDENCE_BUCKET_NAME` pour RELIRE des octets historiques confondait
    // exactement les deux permissions que l'INVARIANT 1 sépare — un compartiment
    // legacy reste LISIBLE sans être une destination. Le compartiment de
    // chaque pièce est celui que le REGISTRE nomme, et la capacité d'y accéder
    // est celle de CE compartiment.
    const { resolveStorage, autorites } = await assemblerResolutionDeStockage(
      runnerDepuisPrisma(prisma),
      rows.map((r) => ({ evidenceItemId: r.id, r2Key: r.r2Key })),
    );
    console.log(`[readback-verify] autorités de localisation : ${autorites.map((a) => a.nom).join(", ") || "(AUCUNE)"}`);

    let refus = 0;
    let lisibles = 0;
    const parCompartiment = new Map<string, number>();
    for (const p of rows) {
      console.log(`\n  pièce   : ${p.id}`);
      console.log(`  clé     : ${p.r2Key}`);
      console.log(`  colonne : ${p.sha256} (byteSize ${p.byteSize})`);

      // ÉTAPE 0 — OÙ LIRE. Chercher au mauvais endroit et ne rien trouver
      // n'est pas constater une absence : la sonde refuse AVANT de lire.
      const lieu = await resolveStorage({ id: p.id, r2Key: p.r2Key });
      if (!lieu.ok) {
        refus++;
        console.log(`  VERDICT : REFUS [${STORAGE_LOCATION_UNRESOLVED}] — ${lieu.detail}`);
        continue;
      }
      console.log(`  lieu    : ${lieu.compartiment} (autorité ${lieu.autorite})`);
      parCompartiment.set(lieu.compartiment, (parCompartiment.get(lieu.compartiment) ?? 0) + 1);

      const v = await readbackDigest({
        r2Key: p.r2Key,
        expectedSha256: p.sha256,
        readObject: lieu.readObject,
      });
      if (v.ok) {
        lisibles++;
        console.log(`  relu    : ${v.sha256} (${v.byteSize} o)`);
        console.log(`  VERDICT : CONCORDE`);
      } else {
        refus++;
        // ⚠️ « illisible » et « relu mais divergent » ne sont PAS le même fait.
        // Un `digest_mismatch` établit que les octets ont été LUS — c'est un
        // constat sur leur contenu, pas sur leur accessibilité.
        if (v.kind === "digest_mismatch" || v.kind === "object_empty") lisibles++;
        console.log(`  VERDICT : REFUS [${v.kind}] — ${v.detail}`);
      }
    }
    console.log(`\n[readback-verify] ${rows.length} pièce(s) · ${rows.length - refus} concordantes, ${refus} refus.`);
    console.log(`[readback-verify] RÉSOLUES : ${[...parCompartiment.values()].reduce((a, b) => a + b, 0)} / ${rows.length}`);
    for (const [c, n] of parCompartiment) console.log(`        → ${c} : ${n}`);
    console.log(`[readback-verify] LISIBLES (octets effectivement lus) : ${lisibles} / ${rows.length}`);
    if (refus > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("[readback-verify] FATAL", e); process.exit(1); });
