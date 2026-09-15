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
 * FAIL-CLOSED D'AMORÇAGE : sans configuration R2, aucune relecture n'est
 * possible, donc AUCUN horodatage n'est tenté. Le script sort en échec plutôt
 * que d'horodater à l'aveugle — c'est précisément le mode dégradé qui a permis
 * d'écrire des pièces sans octets.
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
import { ouvrirCompartimentGouverne, rendreRefusDeCompartiment } from "../../lib/evidence-chain/compartment";
import { resolveurGouverne } from "../../lib/evidence-chain/storageResolution";

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

  // ── FAIL-CLOSED D'AMORÇAGE ─────────────────────────────────────────────
  //
  // La porte est UNIQUE et elle REFUSE : sans `R2_EVIDENCE_BUCKET_NAME`, ce
  // job ne relit rien. Il ne se rabat PAS sur `R2_BUCKET_NAME` — relire les
  // octets dans le compartiment des archives, puis poser un jeton dessus,
  // attesterait un objet que le chemin d'écriture gouverné n'a pas choisi.
  const compartiment = ouvrirCompartimentGouverne();
  if (!compartiment.ok && !dryRun) {
    console.error(
      `[stamp-pending] ${rendreRefusDeCompartiment(compartiment)}\n` +
        "               Aucun horodatage tenté. Un jeton posé sans relecture attesterait une colonne, pas une preuve.",
    );
    process.exitCode = 1;
    return;
  }
  // LA RÉSOLUTION DE COMPARTIMENT, PAR PIÈCE. Le job ne câble plus un lecteur
  // global : il câble la capacité de RÉSOUDRE, et c'est la résolution qui rend
  // un lecteur — lié au compartiment qu'elle a nommé, pour cette pièce-là.
  const resolveStorage = resolveurGouverne();

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
