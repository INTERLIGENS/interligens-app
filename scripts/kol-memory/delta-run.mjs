// ─── BUILD 8 — DELTA-RUN, lecture seule ────────────────────────────────────
//
// Rejoue les trois décisions de P0/P1/D3 sur le corpus RÉEL et rend le delta
// avant/après. Aucune écriture : une transaction READ ONLY, un ROLLBACK.
//
//   npx tsx scripts/kol-memory/delta-run.mjs
//
// Exige DATABASE_URL. La cible est vérifiée AVANT toute requête : le script
// refuse de tourner ailleurs que sur ep-square-band.
//
// En `.mjs` et non `.ts` : `pg` n'est présent qu'en dépendance TRANSITIVE et
// n'a pas de types. L'ajouter proprement demanderait de toucher package.json,
// qui est un chemin gelé. Un harnais de mesure n'a pas à forcer ça.
//
// Ce que le delta prouve, et ce qu'il ne prouve pas : il montre ce que les
// nouvelles règles rendent sur les lignes existantes. Il ne dit pas si une
// attribution est vraie — aucune mesure ne le dirait. Il dit ce que le produit
// AFFIRMAIT et ce qu'il affirme maintenant.

import pg from "pg";
const { Client } = pg;
import {
  deriveAttributionConfidence,
  deriveAttributionSource,
  requiresHumanReview,
} from "../../src/lib/kol-memory/attribution";
import { isWalletPublishable, walletNature } from "../../src/lib/kol-memory/walletPublication";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "../../src/lib/kol-memory/tokenIdentity";

const EXPECTED_HOST_PREFIX = "ep-square-band";

function tally(values) {
  const out = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absent — le delta-run ne devine pas sa cible.");

  const host = new URL(url).hostname.split(".")[0];
  if (!host.startsWith(EXPECTED_HOST_PREFIX)) {
    throw new Error(`Cible refusée : ${host}. Attendu ${EXPECTED_HOST_PREFIX}*.`);
  }
  console.log(`# BUILD 8 delta-run — cible ${host}, LECTURE SEULE\n`);

  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("BEGIN TRANSACTION READ ONLY");

  try {
    // ── 1. Attribution — P0 ────────────────────────────────────────────────
    //
    // Avant : `resolveWalletToKol` rendait exact/manual pour TOUTE ligne
    // active trouvée. Après : la dérivation lit ce que la ligne porte.
    const wallets = await c.query(`SELECT confidence, "attributionStatus", "attributionSource", "claimType",
               "isPubliclyUsable", status, "rowNature"
          FROM "KolWallet" WHERE status = 'active'`);

    const rows = wallets.rows;
    console.log("## 1. ATTRIBUTION — P0");
    console.log(`lignes actives : ${rows.length}`);
    console.log("\navant (comportement mesuré de resolveWalletToKol) :");
    console.log(`  confidence : { exact: ${rows.length} }`);
    console.log(`  source     : { manual: ${rows.length} }`);
    console.log(`  revue      : { requise: 0 }`);
    console.log("\naprès (dérivation) :");
    console.table(tally(rows.map(deriveAttributionConfidence)));
    console.table(tally(rows.map(deriveAttributionSource)));
    const revue = rows.filter(requiresHumanReview).length;
    console.log(`  revue humaine requise : ${revue} / ${rows.length}`);

    const plusExact = rows.filter((r) => deriveAttributionConfidence(r) === "exact").length;
    console.log(
      `\n→ ${rows.length - plusExact} lignes cessent d'être servies comme « exact / manual ».`,
    );
    console.log(
      "→ Conséquence câblée : events/processor.ts gate sur confidence === 'exact' avant\n" +
        "  computeProceedsForHandle (qui appelle Helius) et buildKolCanonicalSnapshot.\n" +
        `  Ce déclenchement passe de ${rows.length} à ${plusExact} lignes éligibles.`,
    );

    // ── 2. Publiabilité des wallets — P1 ───────────────────────────────────
    const servis = await c.query(`SELECT w."isPubliclyUsable", w.status, w."rowNature"
          FROM "KolWallet" w
          JOIN "KolProfile" k ON k.handle = w."kolHandle"
         WHERE k."publishStatus" = 'published'
            OR (k."publishable" AND k."publishStatus" = 'draft')`);

    const avant = servis.rows;
    const apres = avant.filter(isWalletPublishable);
    console.log("\n## 2. PUBLIABILITÉ DES WALLETS — P1");
    console.log(`avant (aucun filtre, /api/kol/[handle]) : ${avant.length} wallets servis`);
    console.log(`après (PUBLISHABLE_WALLET_FILTER)       : ${apres.length} wallets servis`);
    console.log(`→ ${avant.length - apres.length} adresses retirées de la sortie nominative.`);
    console.log("\nnature des wallets qui RESTENT servis (attachée, jamais supprimante) :");
    console.table(tally(apres.map(walletNature)));

    // ── 3. Identité BOTIFY — D3 ────────────────────────────────────────────
    const mints = await c.query(
      `SELECT 'KolProceedsEvent.tokenAddress' src,
              count(*) FILTER (WHERE "tokenAddress" = $1)::text canonique,
              count(*) FILTER (WHERE "tokenAddress" = $2)::text synthetique
         FROM "KolProceedsEvent"
       UNION ALL SELECT 'KolTokenLink.contractAddress',
              count(*) FILTER (WHERE "contractAddress" = $1)::text,
              count(*) FILTER (WHERE "contractAddress" = $2)::text FROM "KolTokenLink"
       UNION ALL SELECT 'KolTokenInvolvement.tokenMint',
              count(*) FILTER (WHERE "tokenMint" = $1)::text,
              count(*) FILTER (WHERE "tokenMint" = $2)::text FROM "KolTokenInvolvement"`,
      [BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY],
    );
    console.log("\n## 3. IDENTITÉ BOTIFY — D3");
    console.table(mints.rows);
    const totalSynth = mints.rows.reduce((n, r) => n + Number(r.synthetique), 0);
    console.log(
      totalSynth === 0
        ? "→ La clé synthétique n'existe dans AUCUNE ligne. Les consommateurs de mint\n" +
            "  recâblés visent désormais l'identité que la base porte réellement."
        : `→ ATTENTION : ${totalSynth} lignes portent la clé synthétique. À arbitrer.`,
    );
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
