// ─── SPINE-00 · B — L'AUDIT D'INTÉGRITÉ, EN LIGNE DE COMMANDE ──────────────
//
// ██  LECTURE SEULE. SELECT uniquement. Aucune écriture, aucun recalcul.    ██
//
//   npx tsx scripts/casefile/audit-integrity.ts IL-SHILL-BOTIFY-001 IL-SHILL-VINE-001
//
// C'est le TÉMOIN POSITIF de la primitive `canonicalSealMaterial`, rejouable :
// chaque sceau persisté est recalculé par l'audit réel (`integrityAudit.ts`),
// donc par la primitive, et comparé au sceau en base. `CONTENT_MUTATED = 0` et
// `UNSEALED = 0` sur un dossier veulent dire : tous ses sceaux vérifient
// contre la normalisation canonique.
//
// Mesuré le 2026-09-14 : 16/16 sur les deux dossiers, 0 constat de contenu.
// Une divergence future de la primitive rougirait ICI, sur la baseline réelle
// — pas seulement sur un cas synthétique.
//
// Ce que ce script N'IMPRIME PAS : un titre, une description, une valeur de
// champ. Un rapport d'intégrité qui cite ce qu'il a trouvé republie ce qu'il
// signale. Il imprime des compteurs et, par constat, un claim, une version et
// un NOM de champ.

import { prisma } from "@/lib/prisma";
import { auditCaseFileIntegrity } from "@/lib/casefile/integrityAudit";

async function main(): Promise<number> {
  const refs = process.argv.slice(2);
  if (refs.length === 0) {
    console.error("usage: tsx scripts/casefile/audit-integrity.ts <casefileRef> [<casefileRef> ...]");
    return 2;
  }

  let rouge = 0;
  for (const ref of refs) {
    const r = await auditCaseFileIntegrity(ref);
    if (!r) {
      console.log(`${ref} · dossier absent — ce n'est pas une panne, c'est une réponse`);
      continue;
    }
    console.log(`${ref} · révisions examinées=${r.revisionsExaminees} · sources au registre=${r.sourcesAuRegistre}`);
    for (const [kind, n] of Object.entries(r.resume)) console.log(`  ${kind}=${n}`);
    for (const c of r.constats) console.log(`  · ${c.kind} ${c.claimId} v${c.version} champ=${c.field}`);
    if (r.resume.CONTENT_MUTATED > 0 || r.resume.UNSEALED > 0) rouge += 1;
  }
  return rouge === 0 ? 0 : 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
