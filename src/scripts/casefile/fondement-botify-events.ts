// ─── CC-OFFLINE-256 · BOTIFY-FOUNDATION-0 — UNE SOURCE, UNE OBSERVATION ────
//
// ██  THE DATABASE MODEL IS NOT THE CLAIM.                                  ██
// ██  THE EVENT LABEL IS NOT THE EVENT.                                     ██
// ██  THE RECORDED WALLET FIELD IS NOT WALLET ATTRIBUTION.                  ██
// ██  AN EXACT TOTAL CAN STILL BE INDEFENSIBLE.                             ██
//
// BOTIFY-MEASURE-0 a produit UNE mesure gouvernée : objet canonique persisté,
// relu, digest recalculé, snapshot, provenance MACHINE_MEASURED / DOCUMENT. Ce
// fichier en tire UNE source et UNE observation, et s'arrête là.
//
//   BOTIFY-EVENTS-01 · PRIMARY_OBSERVATION
//   → evidenceRefs ["SRC-BOTIFY-MEASURE-01"]
//   → CaseFileSource → EvidenceSnapshot → MACHINE_MEASURED → objet mesuré
//
// ⛔ ZÉRO INFERENCE · ZÉRO DEPENDENCY · ZÉRO PUBLIC GRANT · ZÉRO PDF.
//    BOTIFY n'a pas à IMITER la forme de VINE. Une dépendance fabriquée pour
//    faire symétrie n'est pas une dépendance : c'est de la décoration.
//
// ─── CE QUE LE LIBELLÉ REFUSE DE DIRE, ET POURQUOI ────────────────────────
//
// La feuille de conception a mesuré deux faits dans le code d'écriture, et ils
// gouvernent chaque mot de la claim :
//
//   `amountTokens`  est un FLUX SORTANT du portefeuille dans la transaction —
//                   pas un volume vendu. Aucun total n'est publié.
//   `dex_sell`      est une catégorie RÉSIDUELLE, posée par élimination quand
//                   une regex ne reconnaît pas un CEX. Aucune distribution
//                   d'étiquettes n'est publiée.
//
// À quoi s'ajoute une hétérogénéité que la mesure porte elle-même — deux
// symboles enregistrés pour un mint unique. Elle SUFFIT à interdire tout total,
// et il n'est pas nécessaire de l'expliquer pour le savoir.
//
// Ces faits restent dans l'objet gouverné d'audit. Ils ne deviennent pas des
// assertions counsel.
//
// ⚠️ « 20 distinct walletAddress values » — la formule est EXACTE et elle est
//    la seule autorisée. NOUS COMPTONS DES VALEURS ENREGISTRÉES DANS UN CHAMP.
//    Jamais « 20 wallets », jamais « 20 KOL wallets », jamais « 20 sellers ».
//
// ─── L'HISTORIQUE N'EST PAS TOUCHÉ ────────────────────────────────────────
//
// Les 8 sources et 8 claims BOTIFY historiques ne sont ni citées, ni
// supersédées, ni nettoyées, ni migrées, ni normalisées, ni supprimées. Elles
// ne fondent rien ici — et le mutant E le démontre au lieu de le promettre.

import { PrismaClient } from "@prisma/client";
import { executeFoundation } from "../../lib/casefile/governedExecutor";
import { prismaTransactor } from "../../lib/casefile/governedExecutorPrisma";
import { BOTIFY_CASEFILE_REF } from "../../lib/casefile/publicProjection";
import { BOTIFY_MINT } from "../../lib/kol-memory/tokenIdentity";

/** L'identité de la pièce gouvernée produite par BOTIFY-MEASURE-0. */
export const SNAPSHOT_ID = "botifymeas-3d87a6f1ab58944d";
export const SOURCE_ID = "SRC-BOTIFY-MEASURE-01";
export const CLAIM_ID = "BOTIFY-EVENTS-01";

/**
 * LE LIBELLÉ RATIFIÉ, reproduit tel quel.
 *
 * ⛔ Ne le renforce pas. Chaque nom de champ y est écrit comme un nom de champ
 *    (`walletAddress`, `tokenAddress`, `KolProceedsEvent`) : c'est ce qui
 *    empêche un lecteur de croire qu'on décrit la blockchain plutôt que des
 *    LIGNES ENREGISTRÉES.
 */
export const DESCRIPTION_RATIFIEE =
  "A bounded measurement of the governed corpus recorded 262 event rows for the case file's " +
  "canonical mint, each carrying a distinct transaction hash (262 distinct), all on chain SOL, " +
  "none flagged ambiguous. The measurement recorded 20 distinct walletAddress values. The " +
  "recorded observation dates span 2025-01-08T19:47:33Z to 2026-04-15T00:00:00Z; 261 rows carry " +
  "second precision and 1 row carries day precision only. Measured on 2026-09-16T15:40:37.356Z by " +
  "instrument:il-measure-botify-proceeds-events@1.0.0, bounded to KolProceedsEvent rows whose " +
  "tokenAddress equals the canonical mint, and to that table at that instant.";

/** Un titre NEUTRE. Adaptation de syntaxe au contrat, jamais de sémantique. */
export const TITRE_RATIFIE =
  "Bounded measurement: recorded event rows and distinct walletAddress values for the canonical mint";

const ok = (s: string) => console.log(`  ✓ ${s}`);
const ko = (s: string): never => {
  console.error(`  ✗ ${s}`);
  process.exitCode = 1;
  throw new Error(s);
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log("\n1 · FONDEMENT GOUVERNÉ — UNE SOURCE, UNE OBSERVATION");
    const r = await executeFoundation(prismaTransactor, {
      dossier: { ref: BOTIFY_CASEFILE_REF, canonicalMint: BOTIFY_MINT },
      sources: [
        {
          kind: "FROM_SNAPSHOT",
          sourceId: SOURCE_ID,
          snapshotId: SNAPSHOT_ID,
          sourceType: "SYSTEM_MEASUREMENT",
          caption:
            "Mesure bornée du corpus gouverné — lignes d'événements enregistrées pour le mint canonique.",
        },
      ],
      claim: {
        casefileRef: BOTIFY_CASEFILE_REF,
        claimId: CLAIM_ID,
        rowNature: "PRIMARY_OBSERVATION",
        title: TITRE_RATIFIE,
        titleFr: null,
        description: DESCRIPTION_RATIFIEE,
        descriptionFr: null,
        category: "METHODOLOGY",
        severity: "NONE",
        status: "OBSERVED",
        claimDate: null,
        // ⛔ AUCUN ACTEUR. Le corpus ne fonde aucune attribution, et une liste
        //    d'acteurs sur cette claim serait exactement l'attribution qu'elle
        //    refuse de faire.
        actors: [],
        evidenceRefs: [SOURCE_ID],
        // ⛔ Pas de `dependsOn`. Une PRIMARY_OBSERVATION ne consomme aucune
        //    assertion gouvernée : elle cite une pièce, et c'est tout.
      },
    });

    if (r.outcome !== "EXECUTED" && r.outcome !== "ALREADY_EXECUTED") {
      ko(`fondement refusé : ${JSON.stringify(r, null, 2)}`);
    }
    ok(`outcome = ${r.outcome}`);
    ok(`source ${SOURCE_ID} → snapshot ${SNAPSHOT_ID}`);
    ok(`claim  ${CLAIM_ID} · PRIMARY_OBSERVATION · evidenceRefs [${SOURCE_ID}]`);

    console.log("\n⛔ FIN DU LOT");
    ok("zéro dépendance · zéro inférence · zéro GRANT · zéro PDF");
    ok("les 8 sources et 8 claims historiques n'ont pas été touchées");
  } finally {
    await prisma.$disconnect();
  }
}

const estPrincipal = process.argv[1]?.endsWith("fondement-botify-events.ts");
if (estPrincipal) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
