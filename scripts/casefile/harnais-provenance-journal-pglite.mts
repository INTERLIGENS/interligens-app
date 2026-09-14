// ─── T2-PROVENANCE-JOURNAL — LE HARNAIS QUI SAIT ÉCHOUER ───────────────────
//
// ██  « Un harnais qui ne sait pas échouer ne mesure pas. »                  ██
// ██  Ici, RIEN ne touche la production : Postgres JETABLE en WASM (PGlite). ██
//
//   PGLITE_PATH=/chemin/vers/@electric-sql/pglite/dist/index.js \
//   npx tsx scripts/casefile/harnais-provenance-journal-pglite.mts
//
// PGlite n'est PAS une dépendance du dépôt : PGLITE_PATH doit pointer sur une
// installation locale (mesuré avec 0.3.15, PostgreSQL 17.5 en WASM ; la
// production est en 17.11 — même majeure, mêmes catalogues).
//
// DEUX SÉRIES :
//   (A) le VÉRIFICATEUR sait échouer. Le DDL est rejoué, puis SABOTÉ d'une
//       seule manière par scénario, et le vérificateur doit rendre le code et
//       NOMMER l'écart. Un vérificateur qui resterait vert sur un schéma faux
//       ne mesurerait rien.
//   (B) le DDL tient ses règles. Chaque CHECK, la FK, l'append-only et la
//       lecture canonique sont exercés par des écritures réelles — refusées
//       ou acceptées — avec le code SQLSTATE attendu.
//
// Sortie : 0 si chaque scénario a fait ce qu'on attendait de lui, 1 sinon.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifier, TABLE, type Runner } from "./verifier-provenance-journal-schema";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql"), "utf8");

const modPath = process.env.PGLITE_PATH;
if (!modPath) {
  console.error("UNABLE : PGLITE_PATH absent. PGlite n'est pas une dépendance du dépôt ; pointer sur une installation locale (…/@electric-sql/pglite/dist/index.js).");
  process.exit(1);
}
const { PGlite } = await import(modPath);

interface Jetable { run: Runner; exec(sql: string): Promise<unknown>; close(): Promise<void> }

/** Un Postgres neuf, avec la table RÉFÉRENCÉE telle que mesurée (id text PK). */
async function postgresJetable(avecDdl: boolean): Promise<Jetable> {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "EvidenceSnapshot" (id text PRIMARY KEY, sha256 text, "sourceUrl" text)`);
  await db.exec(`INSERT INTO "EvidenceSnapshot" VALUES ('snap-1', '${"a".repeat(64)}', 'https://x.com/search?q=botify'), ('snap-2', NULL, NULL)`);
  if (avecDdl) await db.exec(DDL);
  return {
    run: { query: async <T,>(sql: string, params: readonly unknown[] = []) => (await db.query(sql, params as unknown[])).rows as T[] },
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? "\n     · " + detail : ""}`); };

// ═══ (A) LE VÉRIFICATEUR SAIT ÉCHOUER ═══════════════════════════════════════
interface Sabotage { nom: string; sql: string | null; avecDdl?: boolean; code: 0 | 2 | 3; ecartAttendu: RegExp | null }
const SABOTAGES: readonly Sabotage[] = [
  { nom: "TÉMOIN · DDL rejoué tel quel", sql: null, code: 0, ecartAttendu: null },
  { nom: "table ABSENTE (DDL non rejoué)", sql: null, avecDdl: false, code: 2, ecartAttendu: null },
  { nom: "colonne MANQUANTE · sha256 supprimée", sql: `ALTER TABLE ${TABLE} DROP COLUMN sha256`, code: 3, ecartAttendu: /^colonne ABSENTE : sha256$/ },
  { nom: "colonne MANQUANTE · verification_method supprimée (CASCADE emporte 2 CHECK)", sql: `ALTER TABLE ${TABLE} DROP COLUMN verification_method CASCADE`, code: 3, ecartAttendu: /^colonne ABSENTE : verification_method$/ },
  { nom: "DEFAULT ajouté sur declared_at", sql: `ALTER TABLE ${TABLE} ALTER COLUMN declared_at SET DEFAULT now()`, code: 3, ecartAttendu: /^défaut INTERDIT \(donnée déclarée, pas une horloge\) : declared_at — réel now\(\)$/ },
  { nom: "DEFAULT ajouté sur verified_at", sql: `ALTER TABLE ${TABLE} ALTER COLUMN verified_at SET DEFAULT now()`, code: 3, ecartAttendu: /^défaut INTERDIT \(donnée déclarée, pas une horloge\) : verified_at — réel now\(\)$/ },
  { nom: "trigger ABSENT · no_rewrite", sql: `DROP TRIGGER ${TABLE}_no_rewrite ON ${TABLE}`, code: 3, ecartAttendu: /^APPEND-ONLY non exécutable : trigger ABSENT evidence_provenance_journal_no_rewrite/ },
  { nom: "trigger ABSENT · no_truncate", sql: `DROP TRIGGER ${TABLE}_no_truncate ON ${TABLE}`, code: 3, ecartAttendu: /^APPEND-ONLY non exécutable : trigger ABSENT evidence_provenance_journal_no_truncate/ },
  { nom: "index ABSENT · lecture « dernier état connu »", sql: `DROP INDEX ${TABLE}_snapshot_idx`, code: 3, ecartAttendu: /^index ABSENT : evidence_provenance_journal_snapshot_idx$/ },
  { nom: "CHECK de cohérence ABSENT · verified_iff_verification", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_verified_iff_verification_check`, code: 3, ecartAttendu: /^contrainte ABSENTE : evidence_provenance_journal_verified_iff_verification_check$/ },
  { nom: "domaine ÉLARGI à la main · provenance_kind admet 'INFERRED'", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_provenance_kind_check, ADD CONSTRAINT ${TABLE}_provenance_kind_check CHECK (provenance_kind IN ('UNKNOWN','OPERATOR_DECLARED','EXTRACTED','VERIFIED','INFERRED'))`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_provenance_kind_check : forme divergente — réel .*INFERRED/ },
  { nom: "FK affaiblie · ON DELETE CASCADE", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_snapshot_fkey, ADD CONSTRAINT ${TABLE}_snapshot_fkey FOREIGN KEY (evidence_snapshot_id) REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE CASCADE`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_snapshot_fkey : forme divergente — réel .*ON DELETE CASCADE$/ },
  { nom: "colonne INATTENDUE ajoutée", sql: `ALTER TABLE ${TABLE} ADD COLUMN inferred_from text`, code: 3, ecartAttendu: /^colonne INATTENDUE : inferred_from$/ },
  { nom: "nullabilité relâchée · declared_by DROP NOT NULL", sql: `ALTER TABLE ${TABLE} ALTER COLUMN declared_by DROP NOT NULL`, code: 3, ecartAttendu: /^nullabilité divergente : declared_by — attendu NO, réel YES$/ },
  { nom: "PRÉREQUIS · PK de \"EvidenceSnapshot\" absente (table référencée sans identité)", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_snapshot_fkey; ALTER TABLE "EvidenceSnapshot" DROP CONSTRAINT "EvidenceSnapshot_pkey"`, code: 3, ecartAttendu: /^PRÉREQUIS ABSENT : aucune PRIMARY KEY \(id\) sur "EvidenceSnapshot"/ },
];

lignes.push("── (A) le vérificateur sait échouer");
for (const s of SABOTAGES) {
  const pg = await postgresJetable(s.avecDdl ?? true);
  try {
    if (s.sql) await pg.exec(s.sql);
    const v = await verifier(pg.run);
    const codeOk = v.code === s.code;
    const ecartOk = s.ecartAttendu === null ? v.ecarts.length === 0 || s.code === 2 : v.ecarts.some((e) => s.ecartAttendu!.test(e));
    check(`${s.nom} → exit ${s.code}${s.ecartAttendu ? ", écart nommé" : ""}`, codeOk && ecartOk,
      `réel : exit ${v.code} · ${v.ecarts.length} écart(s)${v.ecarts.length ? " : " + v.ecarts.join(" | ") : ""}`);
  } finally {
    await pg.close();
  }
}

// ═══ (B) LE DDL TIENT SES RÈGLES ════════════════════════════════════════════
lignes.push("── (B) le DDL tient ses règles (écritures réelles, SQLSTATE attendu)");
{
  const pg = await postgresJetable(true);
  const sqlstate = async (sql: string, params: unknown[] = []): Promise<string> => {
    try { await pg.run.query(sql, params); return "OK"; } catch (e) { return String((e as { code?: string }).code ?? (e as Error).message); }
  };
  const INS = `INSERT INTO ${TABLE} (evidence_snapshot_id, sha256, provenance_kind, reference_kind, source_url, declared_by, declared_at, verified_by, verified_at, verification_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
  const T0 = "2026-09-14T10:00:00Z";
  const SHA = "a".repeat(64);
  // Un `null` EXPLICITE doit partir comme NULL : `??` l'aurait remplacé par le
  // défaut, et les scénarios « sans URL » / « declared_at NULL » n'auraient
  // jamais envoyé de NULL (c'est exactement ce que le premier passage a rougi).
  type Champs = "snap" | "sha" | "kind" | "ref" | "url" | "by" | "at" | "vby" | "vat" | "vm";
  const DEFAUTS: Record<Champs, unknown> = { snap: "snap-1", sha: null, kind: "OPERATOR_DECLARED", ref: "PUBLICATION", url: "https://x.com/u/status/1", by: "operator:david", at: T0, vby: null, vat: null, vm: null };
  const ins = (v: Partial<Record<Champs, unknown>>) =>
    sqlstate(INS, (Object.keys(DEFAUTS) as Champs[]).map((k) => (k in v ? v[k] : DEFAUTS[k])));

  check("TÉMOIN POSITIF · OPERATOR_DECLARED + PUBLICATION + URL → accepté", (await ins({ sha: SHA })) === "OK");
  check("TÉMOIN POSITIF · EXTRACTED + QUERY_CONTEXT (la table DIT que c'est un contexte de découverte) → accepté", (await ins({ kind: "EXTRACTED", ref: "QUERY_CONTEXT", url: "https://x.com/search?q=botify", by: "tool:inbox_manifest.py" })) === "OK");
  check("TÉMOIN POSITIF · VERIFIED avec (qui, quand, méthode admise) → accepté", (await ins({ kind: "VERIFIED", vby: "operator:david", vat: T0, vm: "URL_MATCHES_CAPTURED_POST" })) === "OK");
  check("TÉMOIN POSITIF · requalification UNKNOWN (sans URL, sans reference_kind) → accepté", (await ins({ kind: "UNKNOWN", ref: null, url: null })) === "OK");

  check("REFUSÉ 23514 · VERIFIED sans verified_by/at/method", (await ins({ kind: "VERIFIED" })) === "23514");
  check("REFUSÉ 23514 · VERIFIED avec méthode mais sans verified_at", (await ins({ kind: "VERIFIED", vby: "operator:david", vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23514 · OPERATOR_DECLARED portant verified_by (les trois ou aucun)", (await ins({ vby: "operator:david", vat: T0, vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23514 · méthode hors domaine « URL_RESPONDS » (répondre n'est pas correspondre)", (await ins({ kind: "VERIFIED", vby: "operator:david", vat: T0, vm: "URL_RESPONDS" })) === "23514");
  check("REFUSÉ 23514 · VERIFIED sur un QUERY_CONTEXT (discovery context is not source provenance)", (await ins({ kind: "VERIFIED", ref: "QUERY_CONTEXT", url: "https://x.com/search?q=botify", vby: "operator:david", vat: T0, vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23514 · UNKNOWN avec une URL (une URL est une déclaration)", (await ins({ kind: "UNKNOWN", ref: null, url: "https://x.com/u/status/1" })) === "23514");
  check("REFUSÉ 23514 · UNKNOWN avec un reference_kind", (await ins({ kind: "UNKNOWN", ref: "PUBLICATION", url: null })) === "23514");
  check("REFUSÉ 23514 · déclaration SANS URL", (await ins({ url: null })) === "23514");
  check("REFUSÉ 23514 · provenance_kind hors domaine « INFERRED »", (await ins({ kind: "INFERRED" })) === "23514");
  check("REFUSÉ 23514 · reference_kind hors domaine « SEARCH »", (await ins({ ref: "SEARCH" })) === "23514");
  check("REFUSÉ 23514 · declared_by vide", (await ins({ by: "" })) === "23514");
  check("REFUSÉ 23514 · declared_by avec blanc de bord", (await ins({ by: " operator:david" })) === "23514");
  check("REFUSÉ 23514 · source_url avec blanc de bord", (await ins({ url: "https://x.com/u/status/1 " })) === "23514");
  check("REFUSÉ 23514 · sha256 mal formé", (await ins({ sha: "ABC" })) === "23514");
  check("REFUSÉ 23502 · declared_at NULL (pas de DEFAULT qui comblerait)", (await ins({ at: null })) === "23502");
  check("REFUSÉ 23503 · pièce inexistante (FK vers l'identité gouvernée)", (await ins({ snap: "snap-404" })) === "23503");
  check("REFUSÉ 428C9 · id fourni par l'appelant (GENERATED ALWAYS)", (await sqlstate(`INSERT INTO ${TABLE} (id, evidence_snapshot_id, provenance_kind, declared_by, declared_at) VALUES (999, 'snap-1', 'UNKNOWN', 'x', $1)`, [T0])) === "428C9");

  check("APPEND-ONLY 23001 · UPDATE refusé", (await sqlstate(`UPDATE ${TABLE} SET declared_by = 'autre' WHERE id = 1`)) === "23001");
  check("APPEND-ONLY 23001 · DELETE refusé", (await sqlstate(`DELETE FROM ${TABLE} WHERE id = 1`)) === "23001");
  check("APPEND-ONLY 23001 · TRUNCATE refusé", (await sqlstate(`TRUNCATE ${TABLE}`)) === "23001");
  check("RESTRICT 23503 · supprimer une pièce qui porte un journal est refusé", (await sqlstate(`DELETE FROM "EvidenceSnapshot" WHERE id = 'snap-1'`)) === "23503");
  check("RESTRICT 23503 · renuméroter une pièce qui porte un journal est refusé", (await sqlstate(`UPDATE "EvidenceSnapshot" SET id = 'snap-1b' WHERE id = 'snap-1'`)) === "23503");

  // La lecture canonique : le dernier état connu de snap-1 est la requalification UNKNOWN (4e INSERT).
  const dernier = await pg.run.query<{ provenance_kind: string; id: number }>(
    `SELECT id, provenance_kind FROM ${TABLE} WHERE evidence_snapshot_id = $1 ORDER BY id DESC LIMIT 1`, ["snap-1"]);
  check("LECTURE CANONIQUE · dernier état connu de snap-1 = UNKNOWN (la requalification, id max), l'historique reste lisible",
    dernier[0]?.provenance_kind === "UNKNOWN" && Number((await pg.run.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${TABLE} WHERE evidence_snapshot_id = 'snap-1'`))[0].n) === 4,
    JSON.stringify(dernier));
  const tous = await pg.run.query<{ evidence_snapshot_id: string; provenance_kind: string }>(
    `SELECT s.id AS evidence_snapshot_id, COALESCE(j.provenance_kind, 'UNKNOWN') AS provenance_kind
       FROM "EvidenceSnapshot" s
       LEFT JOIN LATERAL (SELECT * FROM ${TABLE} WHERE evidence_snapshot_id = s.id ORDER BY id DESC LIMIT 1) j ON true
      ORDER BY s.id`);
  check("LECTURE CANONIQUE · une pièce SANS ligne vaut UNKNOWN sans consulter \"sourceUrl\"",
    tous.length === 2 && tous[1].evidence_snapshot_id === "snap-2" && tous[1].provenance_kind === "UNKNOWN", JSON.stringify(tous));

  // Le plan de la lecture canonique passe par l'index (evidence_snapshot_id, id DESC).
  // Sur 4 lignes le planificateur préfère un seq scan : on le lui interdit pour
  // voir si l'index SAIT servir la requête — c'est la forme de l'index qu'on prouve.
  await pg.exec(`ANALYZE ${TABLE}; SET enable_seqscan = off`);
  const plan = (await pg.run.query<{ "QUERY PLAN": string }>(`EXPLAIN SELECT * FROM ${TABLE} WHERE evidence_snapshot_id = 'snap-1' ORDER BY id DESC LIMIT 1`)).map((r) => r["QUERY PLAN"]).join(" / ");
  check("INDEX · la lecture canonique est servie par evidence_provenance_journal_snapshot_idx, sans tri", plan.includes("evidence_provenance_journal_snapshot_idx") && !/\bSort\b/.test(plan), plan);

  const v = await verifier(pg.run);
  check("le vérificateur reste CONFORME après ces écritures (4 lignes = information, pas écart)", v.code === 0 && v.introspection.lignes === 4, `exit ${v.code}, ${v.introspection.lignes} ligne(s)`);
  await pg.close();
}

console.log(lignes.join("\n"));
console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko} / ${lignes.filter((l) => /^(OK|KO) /.test(l)).length}`);
process.exitCode = ko === 0 ? 0 : 1;
