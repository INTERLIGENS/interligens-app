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
import { getEvidenceObject } from "../../lib/evidence-chain/r2";
import { ouvrirCompartimentGouverne, rendreRefusDeCompartiment } from "../../lib/evidence-chain/compartment";

async function main() {
  const i = process.argv.indexOf("--limit");
  const limit = i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : 1;

  const compartiment = ouvrirCompartimentGouverne();
  if (!compartiment.ok) {
    console.error(`[readback-verify] ${rendreRefusDeCompartiment(compartiment)}`);
    process.exit(1);
  }
  console.log(`[readback-verify] compartiment : ${compartiment.bucket}`);

  const prisma = new PrismaClient();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","sha256","r2Key","byteSize" FROM "EvidenceItem"
        WHERE ${tsaPendingUniverseSql()} ORDER BY "ingestedAt" ASC LIMIT $1`,
      limit,
    )) as Array<{ id: string; sha256: string; r2Key: string | null; byteSize: number | null }>;

    let refus = 0;
    for (const p of rows) {
      const v = await readbackDigest({
        r2Key: p.r2Key,
        expectedSha256: p.sha256,
        readObject: (k) => getEvidenceObject(compartiment.s3, compartiment.bucket, k),
      });
      console.log(`\n  pièce   : ${p.id}`);
      console.log(`  clé     : ${p.r2Key}`);
      console.log(`  colonne : ${p.sha256} (byteSize ${p.byteSize})`);
      if (v.ok) {
        console.log(`  relu    : ${v.sha256} (${v.byteSize} o)`);
        console.log(`  VERDICT : CONCORDE`);
      } else {
        refus++;
        console.log(`  VERDICT : REFUS [${v.kind}] — ${v.detail}`);
      }
    }
    console.log(`\n[readback-verify] ${rows.length} relue(s), ${refus} refus.`);
    if (refus > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("[readback-verify] FATAL", e); process.exit(1); });
