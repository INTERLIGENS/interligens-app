// ─── BUILD 8 — PREUVE DE CLÔTURE, lecture seule ────────────────────────────
//
//   DATABASE_URL=… npx tsx scripts/kol-memory/closure-check.mjs
//
// Rejoue les points de clôture démontrables SANS déploiement. Aucune écriture :
// transaction READ ONLY + ROLLBACK, cible vérifiée avant connexion.
//
// Ce qu'il NE peut pas prouver, et pourquoi c'est dit plutôt que contourné :
// les points 4, 5 et 7 portent sur des RÉPONSES d'API. Ils exigent que le code
// de main soit déployé. Ce script prouve que la base et le code sont prêts ; il
// ne prétend pas prouver ce que sert un serveur qu'il n'interroge pas.

import pg from "pg";
const { Client } = pg;
import { isWalletPublishable } from "../../src/lib/kol-memory/walletPublication";
import {
  deriveAttributionConfidence,
  deriveAttributionSource,
} from "../../src/lib/kol-memory/attribution";
import { amountUsdNature } from "../../src/lib/kol-memory/proceedsNature";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY, casefileLookupKey } from "../../src/lib/kol-memory/tokenIdentity";

const EXPECTED_HOST_PREFIX = "ep-square-band";
const RANGS = ["exact", "strong", "probable", "candidate", "unresolved"];

let ko = 0;
const ok = (n, cond, detail) => {
  console.log(`${cond ? "✅" : "❌"} ${n} — ${detail}`);
  if (!cond) ko++;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absent.");
  const host = new URL(url).hostname.split(".")[0];
  if (!host.startsWith(EXPECTED_HOST_PREFIX)) throw new Error(`Cible refusée : ${host}`);
  console.log(`# BUILD 8 — preuve de clôture · ${host} · LECTURE SEULE\n`);

  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("BEGIN TRANSACTION READ ONLY");

  try {
    // ── 1. Aucun wallet non publiable ne peut être servi ───────────────────
    const w = await c.query(`
      SELECT w."isPubliclyUsable", w.status
        FROM "KolWallet" w JOIN "KolProfile" k ON k.handle = w."kolHandle"
       WHERE k."publishStatus"='published' OR (k."publishable" AND k."publishStatus"='draft')`);
    const servis = w.rows.filter(isWalletPublishable);
    const nonPubliablesServis = servis.filter((r) => r.isPubliclyUsable !== true).length;
    ok(
      "1. publiabilité",
      nonPubliablesServis === 0,
      `${servis.length} wallets servis sur ${w.rows.length} candidats · ` +
        `${nonPubliablesServis} non publiable(s) parmi les servis`,
    );

    // ── 2. Partition d'attribution complète ────────────────────────────────
    const a = await c.query(`
      SELECT confidence, "attributionStatus", "attributionSource", "claimType"
        FROM "KolWallet" WHERE status='active'`);
    const rangs = a.rows.map(deriveAttributionConfidence);
    const inconnus = rangs.filter((r) => !RANGS.includes(r)).length;
    const repartition = RANGS.map((r) => `${r}=${rangs.filter((x) => x === r).length}`).join(" · ");
    ok(
      "2. attribution",
      rangs.length === a.rows.length && inconnus === 0,
      `${rangs.length}/${a.rows.length} classés, 0 hors vocabulaire · ${repartition}`,
    );
    const sources = a.rows.map(deriveAttributionSource);
    ok(
      "2b. sources",
      sources.every((s) => s === "inferred" || s === "on_chain_footprint"),
      `${sources.filter((s) => s === "on_chain_footprint").length} on_chain_footprint · ` +
        `${sources.filter((s) => s === "inferred").length} inferred`,
    );

    // ── 3. Nature des montants — code ET base ──────────────────────────────
    const e = await c.query(`SELECT "pricingSource", "amountUsd", ambiguous FROM "KolProceedsEvent"`);
    const parNature = {};
    for (const r of e.rows) {
      const n = amountUsdNature(r);
      parNature[n] = (parNature[n] ?? 0) + 1;
    }
    const totalCode = Object.values(parNature).reduce((s, n) => s + n, 0);
    ok(
      "3. nature (code)",
      totalCode === e.rows.length,
      `${totalCode}/${e.rows.length} · ` +
        Object.entries(parNature).map(([k, v]) => `${k}=${v}`).join(" · "),
    );

    // La colonne existe-t-elle, et dit-elle la même chose que le code ?
    const col = await c.query(`
      SELECT count(*) n FROM information_schema.columns
       WHERE table_schema='public' AND table_name='KolProceedsEvent'
         AND column_name='amountUsdNature'`);
    if (Number(col.rows[0].n) === 0) {
      console.log("⏭️  3b. nature (base) — colonne absente : migration non appliquée sur cette cible");
    } else {
      const db = await c.query(`
        SELECT "pricingSource", "amountUsd", ambiguous,
               COALESCE("amountUsdNature"::text,'UNCLASSIFIED') AS en_base
          FROM "KolProceedsEvent"`);
      const ecarts = db.rows.filter((r) => amountUsdNature(r) !== r.en_base);
      ok(
        "3b. nature (base ↔ code)",
        ecarts.length === 0,
        `${db.rows.length - ecarts.length}/${db.rows.length} cohérents · ${ecarts.length} écart(s)`,
      );
      const est = await c.query(`
        SELECT count(*) n FROM "KolProceedsEvent"
         WHERE "amountUsdNature"='ESTIMATE'
           AND "amountUsdMethodRef" IS NULL
           AND ("amountUsdBasis" IS NULL OR "amountUsdBasis"='{}'::jsonb)`);
      ok("3c. ESTIMATE auditables", Number(est.rows[0].n) === 0, `${est.rows[0].n} inauditable(s)`);
    }

    // ── 4/5. Identité BOTIFY — ce que le CODE décide ───────────────────────
    ok(
      "5. alias refusé comme clé",
      casefileLookupKey(BOTIFY_SYNTHETIC_ROUTE_KEY) === BOTIFY_MINT &&
        casefileLookupKey(BOTIFY_MINT) === BOTIFY_MINT,
      "les deux entrées convergent vers le mint canonique",
    );
    const mints = await c.query(
      `SELECT count(*) FILTER (WHERE "tokenAddress"=$1) canon,
              count(*) FILTER (WHERE "tokenAddress"=$2) synth
         FROM "KolProceedsEvent"`,
      [BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY],
    );
    ok(
      "4. mint canonique",
      Number(mints.rows[0].canon) > 0 && Number(mints.rows[0].synth) === 0,
      `${mints.rows[0].canon} lignes sur le canonique · ${mints.rows[0].synth} sur l'alias`,
    );

    // ── 6. Joignabilité des profils publiés ────────────────────────────────
    const p = await c.query(`
      SELECT handle FROM "KolProfile"
       WHERE "publishStatus"='published' OR ("publishable" AND "publishStatus"='draft')`);
    const tous = await c.query(`SELECT handle FROM "KolProfile"`);
    const parMinuscule = new Map();
    for (const r of tous.rows) {
      const k = r.handle.toLowerCase();
      parMinuscule.set(k, (parMinuscule.get(k) ?? 0) + 1);
    }
    // Règle réelle : exact d'abord (toujours vrai ici, le handle vient de la
    // base), donc tout profil publié est joignable par son handle canonique.
    // On mesure en plus la joignabilité par la forme MINUSCULE, qui est ce que
    // la route envoie.
    const parMinusculeOk = p.rows.filter((r) => {
      const k = r.handle.toLowerCase();
      return r.handle === k || parMinuscule.get(k) === 1;
    });
    ok(
      "6. joignabilité",
      parMinusculeOk.length === p.rows.length,
      `${parMinusculeOk.length}/${p.rows.length} profils publiés résolubles ` +
        `(exact, ou insensible sans ambiguïté)`,
    );
    const ambigus = p.rows.filter((r) => parMinuscule.get(r.handle.toLowerCase()) > 1);
    ok(
      "7. aucun nouveau défaut de casse",
      ambigus.length === 0,
      ambigus.length === 0
        ? "aucun profil publié en collision de casse"
        : `collision : ${ambigus.map((r) => r.handle).join(", ")}`,
    );
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }

  console.log(
    ko === 0
      ? "\n✅ Tous les points démontrables sans déploiement sont conformes."
      : `\n❌ ${ko} point(s) non conforme(s).`,
  );
  console.log(
    "\nNON COUVERT ICI — exige le déploiement de main :\n" +
      "  · la réponse réelle de /api/kol/[handle] (points 1 et 6 côté API)\n" +
      "  · la réponse réelle de /api/casefile (points 4 et 5 côté API)",
  );
  process.exit(ko === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
