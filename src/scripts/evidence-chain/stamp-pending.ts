/**
 * stamp-pending.ts — Rattrapage TSA des pièces en attente (CC-OFFLINE-56).
 *
 * Les flux serverless (retail submit, commit opérateur) créent les EvidenceItem
 * avec tsaToken NULL (openssl non garanti sur le runtime Vercel + latence TSA
 * inacceptable en requête publique). Ce script, lancé QUOTIDIENNEMENT par
 * launchd sur Host-001 (com.interligens.evidence-stamp.plist, 08:30 — avant le
 * watchdog de 09:00 qui rapporte « TSA pending: N » sur Telegram), horodate
 * tout ce qui attend.
 *
 * ⚠️ openssl : nécessite un openssl avec la sous-commande `ts` (Homebrew
 * OpenSSL 3.x). Le LibreSSL d'Apple (/usr/bin/openssl) ne l'a PAS — le plist
 * met /opt/homebrew/bin en tête de PATH.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-191 — CE SCRIPT NE DÉCIDE PLUS RIEN. IL CÂBLE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DEUX RULINGS gouvernent ce qu'il fait, et tous deux sont implémentés
 * AILLEURS, dans des modules éprouvables sans réseau :
 *
 *   « Timestamping eligibility must be derived from evidentiary eligibility
 *     before any irreversible token is written. »
 *        → `tsaPendingUniverseSql()` (evidence-chain/eligibility.ts).
 *          L'univers n'est plus « tsaToken IS NULL » : la même expression,
 *          entière, sert au watchdog. Mesuré en production le 2026-09-15 :
 *          34 lignes sans jeton, dont 31 éligibles. Les 3 écartées sont
 *          `evi_rep_bd69380a45529aebeba7bc52` (BYTES_LOST, octets supprimés
 *          par la règle auto-delete-30d) et deux sondes EXCLUDED.
 *
 *   « Persisted bytes, not stored digest metadata, are the authority for the
 *     hash submitted to a timestamp service. »
 *        → `stampOne()` (evidence-chain/stampGate.ts) : relecture R2,
 *          SHA-256 recalculé, confrontation, et refus AVANT tout appel TSA.
 *          Le hash soumis vient des OCTETS, jamais de la colonne.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-214 — LE GATE D'AMORÇAGE EST RETIRÉ. IL N'AUTORISAIT RIEN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « An irreversible downstream operation must be gated by authorities
 *     causally required for that operation. Requiring unrelated configuration
 *     is not fail-closed governance; it is false coupling. »
 *
 * Ce fichier a porté, jusqu'au 2026-09-15, un « FAIL-CLOSED D'AMORÇAGE » qui
 * appelait `ouvrirCompartimentGouverne()` — la porte de NAISSANCE — et refusait
 * TOUT le run quand elle était fermée. Le témoin T1-TÉMOIN-TSA-LEGACY a falsifié
 * la condition sous laquelle il avait été accepté. Quatre constats, mesurés :
 *
 *   1. LA VALEUR RENDUE N'ÉTAIT UTILISÉE NULLE PART. `compartiment` ne servait
 *      qu'à sa propre condition ; aucune capacité n'en était tirée. Le lecteur
 *      effectivement employé est `lieu.readObject`, lié au compartiment que le
 *      REGISTRE désigne (`stampGate.ts` étape 0).
 *   2. LES VARIABLES EXIGÉES N'ÉTAIENT PAS CELLES CONSOMMÉES. Le gate exigeait
 *      `R2_EVIDENCE_*` ; le chemin des pièces legacy consomme la fente
 *      `reports` (`CAPACITES_PAR_COMPARTIMENT`), et elle seule.
 *   3. AUCUNE ÉCRITURE R2 N'A LIEU ICI. L'irréversible de ce job est un jeton
 *      chez un tiers et quatre colonnes en base. Rien n'y naît.
 *   4. LE CONTRÔLE EXISTE DÉJÀ, MIEUX PLACÉ. `ouvrirCompartimentDesigne`
 *      vérifie la capacité DU COMPARTIMENT DÉSIGNÉ, par pièce, et refuse en
 *      `CAPABILITY_UNAVAILABLE`. Le gate d'amorçage en était un doublon à
 *      l'échelle du PROCESSUS — l'échelle exacte à laquelle il devenait une
 *      condition artificielle.
 *
 * LA CHAÎNE D'AUTORITÉ DE CE JOB, ET ELLE NE PASSE PAS PAR LA NAISSANCE :
 *
 *   EvidenceItem → autorité de localisation → capacité READ du compartiment
 *                → octets persistés → digest recalculé → éligibilité → TSA
 *
 * ⚠️ CE N'EST PAS UN ASSOUPLISSEMENT. Rien n'est horodaté « à l'aveugle » : le
 * refus qui protégeait réellement l'opération est `stampOne` lui-même, qui
 * REFUSE avant tout appel TSA dès que la localisation ne résout pas
 * (`storage_location_unresolved`) ou que les octets relus ne concordent pas.
 * Ce qui disparaît est une exigence de configuration ; aucun refus ne disparaît.
 *
 * Témoin permanent : `__tests__/evidence-chain/gate-amorcage-retire.test.ts`.
 *
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts               # live
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts --dry-run
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts --limit 100 --throttle-ms 1000
 *
 * Idempotent et reprenable : ne touche que l'univers ci-dessus ; un échec ou un
 * refus laisse la pièce pending pour le run suivant. Aucune autre colonne
 * modifiée.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { timestampWithRouting } from "../../lib/evidence-chain/tsa";
import { tsaPendingUniverseSql } from "../../lib/evidence-chain/eligibility";
import { stampOne, type PendingEvidenceRow } from "../../lib/evidence-chain/stampGate";
import { assemblerResolutionDeStockage, runnerDepuisPrisma } from "../../lib/evidence-chain/runtimeResolution";

const flagN = (name: string, def: number) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : def;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = flagN("limit", 500);
  const throttle = flagN("throttle-ms", 1000);

  // L'univers, d'un bloc, partagé avec le watchdog. Rien n'est assemblé ici.
  const universe = tsaPendingUniverseSql();

  // ── PAS DE GATE D'AMORÇAGE. Voir l'en-tête, CC-OFFLINE-214.
  //
  // Le refus qui protège l'opération irréversible vit dans `stampOne`, PAR
  // PIÈCE : localisation non résolue, octets absents, digest discordant. Une
  // exigence de configuration à l'échelle du processus n'en ajoutait aucun.
  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  try {
    const pending = (await prisma.$queryRawUnsafe(
      `SELECT "id","sha256","r2Key","provenanceType","ingestedAt" FROM "EvidenceItem"
        WHERE ${universe} ORDER BY "ingestedAt" ASC LIMIT $1`,
      limit,
    )) as Array<PendingEvidenceRow & { provenanceType: string | null; ingestedAt: Date }>;

    console.log(
      `[stamp-pending] ${pending.length} pièce(s) éligible(s) en attente de TSA (limit ${limit})${dryRun ? " — DRY-RUN" : ""}`,
    );
    console.log(`[stamp-pending] univers : ${universe}`);

    // ── LA RÉSOLUTION DE COMPARTIMENT, PAR PIÈCE, PAR LE CONSTRUCTEUR CANONIQUE.
    //
    // Le job ne câble plus un lecteur global, et il n'assemble plus la chaîne
    // lui-même : il APPELLE le constructeur. C'est ce qui garantit qu'il consomme
    // la MÊME autorité de registre que celle avec laquelle les 31 ont été
    // démontrées — jusqu'ici il prenait `AUTORITES_DE_LOCALISATION`, vide, et
    // refusait tout ce que l'instrument de mesure résolvait.
    const { resolveStorage, autorites } = await assemblerResolutionDeStockage(
      runnerDepuisPrisma(prisma),
      pending.map((p) => ({ evidenceItemId: p.id, r2Key: p.r2Key })),
    );
    console.log(`[stamp-pending] autorités de localisation : ${autorites.map((a) => a.nom).join(", ") || "(AUCUNE)"}`);

    let done = 0, fail = 0, refused = 0;
    for (const p of pending) {
      if (dryRun) {
        console.log(`  DRY ${p.id} sha=${p.sha256.slice(0, 12)}… key=${p.r2Key ?? "(aucune)"} ingested=${new Date(p.ingestedAt).toISOString()}`);
        continue;
      }
      try {
        const outcome = await stampOne(p, {
          resolveStorage,
          timestamp: (hash) => timestampWithRouting(hash, { criticality: "OTHER" }),
        });
        if (outcome.status === "refused") {
          refused++;
          console.error(`  REFUS ${p.id} [${outcome.kind}] — ${outcome.detail}`);
          continue;
        }
        if (outcome.status === "no_tsa") {
          fail++;
          console.error(`  PENDING ${p.id} — aucune TSA joignable`);
          continue;
        }
        await store.setTsa(p.id, outcome.token, outcome.provider, outcome.genTime, outcome.certChainPem);
        await store.insertAccessLog(p.id, "VERIFY", "stamp-pending",
          `tsa rattrapée via ${outcome.tsaUsed} (${outcome.provider}); hash RECALCULÉ depuis les octets relus ` +
          `(${outcome.byteSize} o, ${outcome.submittedSha256}); cert chain archived; ingestedAt=${new Date(p.ingestedAt).toISOString()}`);
        done++;
        console.log(`  OK  ${p.id} via ${outcome.tsaUsed} (${outcome.provider}) — ${outcome.byteSize} o relus`);
      } catch (e) {
        fail++;
        console.error(`  FAIL ${p.id}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(throttle);
    }

    const rest = (await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "EvidenceItem" WHERE ${universe}`,
    )) as Array<{ n: number }>;
    console.log(
      `[stamp-pending] horodatées=${done}, refus=${refused}, échecs=${fail} — TSA pending éligible restant: ${rest[0]?.n ?? "?"}`,
    );
    if (fail > 0 || refused > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("[stamp-pending] FATAL", e); process.exit(1); });
