// ─── T1-CAUSE-ET-REVOKE-REEL — LES CHECK DE LA CAUSE, VIOLÉS EXPRÈS, EN TRANSACTION ANNULÉE ──
//
// ██  Un CHECK qu'on n'a pas essayé de violer n'est pas un CHECK mesuré.     ██
//
//   npx tsx scripts/casefile/prouver-contraintes-cause-pg17-rollback.mts
//
// Contre la PRODUCTION, UNE transaction, un SAVEPOINT par essai, ROLLBACK
// final. Prouve le SQLSTATE 23514 (check_violation) sur :
//   a) INSERT GRANT avec une cause non NULL          → 23514 (cohérence)
//   b) INSERT REVOKE avec cause NULL                 → 23514 (cohérence)
//   c) INSERT REVOKE avec une cause hors vocabulaire → 23514 (vocabulaire)
//   d) INSERT REVOKE avec INSUFFICIENT_SOURCE_PROVENANCE → PASSE, puis annulé
// Relecture après ROLLBACK : toujours 3 lignes, ids 16/17/18, GRANT, cause NULL.
//
// Effet de bord déclaré : chaque INSERT, même refusé par un CHECK, consomme
// une valeur de la séquence id. Non transactionnel. Seul l'ordre compte.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = "IL-SHILL-VINE-001";
const CIBLE = ["VINE-0xS-01", 2] as const; // une version qui EXISTE : la FK doit passer pour que seul le CHECK parle

interface Client { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`); };

/** Tente un INSERT dans un SAVEPOINT ; rend le SQLSTATE ou "PASSE". Toujours annulé. */
async function essai(c: Client, nom: string, decision: string, cause: string | null): Promise<{ etat: string; contrainte: string | null }> {
  await c.query(`SAVEPOINT essai`);
  try {
    await c.query(
      `INSERT INTO casefile_claim_publication_decisions
         (casefile_ref, claim_id, claim_version, audience, decision, decided_by, decided_at, cause)
       VALUES ($1, $2, $3, 'PUBLIC', $4, 'preuve-contraintes-T1', '2026-09-14T17:00:00Z'::timestamptz, $5)`,
      [REF, CIBLE[0], CIBLE[1], decision, cause],
    );
    return { etat: "PASSE", contrainte: null };
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    return { etat: err.code ?? "ERREUR", contrainte: err.constraint ?? null };
  } finally {
    await c.query(`ROLLBACK TO SAVEPOINT essai`);
    void nom;
  }
}

async function main(): Promise<number> {
  const m = readFileSync(path.join(REPO, ".env.local"), "utf8").match(/^DATABASE_URL="?([^"\n]+)"?$/m);
  if (!m) { console.error("DATABASE_URL absente de .env.local"); return 1; }
  const pgSpec = "pg";
  const pg = (await import(pgSpec)).default as { Client: new (o: { connectionString: string }) => { connect(): Promise<void>; end(): Promise<void>; query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> } };
  const client = new pg.Client({ connectionString: m[1] });
  await client.connect();
  const c: Client = { query: (sql, params) => client.query(sql, params as unknown[]) };
  const etat = async () => (await c.query(`SELECT count(*)::int AS n, string_agg(id::text || ':' || decision || ':' || coalesce(cause, '∅'), ',' ORDER BY id) AS ids FROM casefile_claim_publication_decisions`)).rows[0];
  const seq = async () => String((await c.query(`SELECT last_value::text AS v FROM casefile_claim_publication_decisions_id_seq`)).rows[0].v);
  try {
    console.log(`PREUVE DES CHECK · ${String((await c.query("SELECT version()")).rows[0].version).split(",")[0]}`);
    const avant = await etat(); const seqAvant = await seq();
    console.log("AVANT  ", JSON.stringify(avant), "séquence", seqAvant);
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const a = await essai(c, "a", "GRANT", "INSUFFICIENT_SOURCE_PROVENANCE");
      check("a) INSERT GRANT avec cause non NULL → 23514 sur _cause_coherence", a.etat === "23514" && a.contrainte === "casefile_claim_publication_decisions_cause_coherence", `${a.etat} ${a.contrainte}`);
      const b = await essai(c, "b", "REVOKE", null);
      check("b) INSERT REVOKE avec cause NULL → 23514 sur _cause_coherence", b.etat === "23514" && b.contrainte === "casefile_claim_publication_decisions_cause_coherence", `${b.etat} ${b.contrainte}`);
      const cc = await essai(c, "c", "REVOKE", "BECAUSE_I_SAID_SO");
      check("c) INSERT REVOKE avec cause hors vocabulaire → 23514 sur _cause_vocabulaire", cc.etat === "23514" && cc.contrainte === "casefile_claim_publication_decisions_cause_vocabulaire", `${cc.etat} ${cc.contrainte}`);
      const d = await essai(c, "d", "REVOKE", "INSUFFICIENT_SOURCE_PROVENANCE");
      check("d) INSERT REVOKE avec INSUFFICIENT_SOURCE_PROVENANCE → PASSE (puis annulé)", d.etat === "PASSE", d.etat);
      // Et la casse : « insufficient_source_provenance » n'est PAS dans le vocabulaire.
      const e = await essai(c, "e", "REVOKE", "insufficient_source_provenance");
      check("e) cause en minuscules → 23514 sur _cause_vocabulaire (aucune approximation)", e.etat === "23514" && e.contrainte === "casefile_claim_publication_decisions_cause_vocabulaire", `${e.etat} ${e.contrainte}`);
      const dedans = await etat();
      check("dans la transaction, après les essais annulés : toujours 3 lignes", Number(dedans.n) === 3, JSON.stringify(dedans));
    } finally {
      await c.query("ROLLBACK");
    }
    const apres = await etat(); const seqApres = await seq();
    console.log("APRÈS  ", JSON.stringify(apres), "séquence", seqApres);
    check("APRÈS ROLLBACK · 3 lignes, 16:GRANT:∅,17:GRANT:∅,18:GRANT:∅", Number(apres.n) === 3 && apres.ids === "16:GRANT:∅,17:GRANT:∅,18:GRANT:∅", String(apres.ids));
    lignes.push(`   séquence id : ${seqAvant} → ${seqApres} (consommée par les essais annulés — non transactionnel, déclaré)`);
  } finally {
    await client.end();
  }
  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko}`);
  return ko === 0 ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { console.error(e); process.exitCode = 1; });
