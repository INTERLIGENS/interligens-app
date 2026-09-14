// ─── T2-PROVENANCE-JOURNAL — LE HARNAIS QUI SAIT ÉCHOUER ───────────────────
// ─── amendé T1-JOURNAL-AMENDE-ET-MESURE (2026-09-14, décisions 4a/4b/5) ────
// ─── amendé T1-DDL-PHASE-A-PRET-A-POSER (2026-09-14, Q1 FK RESTRICT, Q4 forme) ─
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
// QUATRE SÉRIES :
//   (A) le VÉRIFICATEUR sait échouer. Le DDL est rejoué, puis SABOTÉ d'une
//       seule manière par scénario, et le vérificateur doit rendre le code et
//       NOMMER l'écart. Un vérificateur qui resterait vert sur un schéma faux
//       ne mesurerait rien.
//   (B) le DDL tient ses règles. Chaque CHECK, la FK, l'append-only et la
//       lecture canonique sont exercés par des écritures réelles — refusées
//       ou acceptées — avec le code SQLSTATE attendu. Depuis 4a, le cas qui
//       compte double : 'UNKNOWN' ne peut PAS être écrit dans la table.
//   (C) le POST-CHECK SQL (second bloc à coller dans Neon) sait rougir : tout
//       `ok = true` sur le DDL rejoué tel quel, au moins une ligne `ok = false`
//       par sabotage.
//   (D) le BLOC 3 (FK CaseFileSource.snapshotId → RESTRICT/RESTRICT) : la
//       dégradation silencieuse AVANT, le refus 23503 APRÈS, les deux gardes
//       qui LÈVENT sur un état réel différent de l'état mesuré, et son
//       post-check intégré qui sait rougir.
//
// Sortie : 0 si chaque scénario a fait ce qu'on attendait de lui, 1 sinon.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifier, TABLE, type Runner } from "./verifier-provenance-journal-schema";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql"), "utf8");
const POSTCHECK = readFileSync(path.join(REPO, "docs/prep/POSTCHECK_PROVENANCE_JOURNAL_2026-09-14.sql"), "utf8");
const BLOC3 = readFileSync(path.join(REPO, "docs/prep/MIGRATION_FK_SNAPSHOTID_RESTRICT_2026-09-14.sql"), "utf8");
// Le bloc 3 se coupe en deux : le DDL gardé (BEGIN … COMMIT) et son post-check intégré (WITH reel AS …).
const BLOC3_POST_IDX = BLOC3.indexOf("WITH reel AS");
if (BLOC3_POST_IDX < 0) { console.error("UNABLE : post-check intégré introuvable dans le bloc 3"); process.exit(1); }
const BLOC3_DDL = BLOC3.slice(0, BLOC3_POST_IDX);
const BLOC3_POST = BLOC3.slice(BLOC3_POST_IDX);

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

interface LignePostCheck { point: string; ok: boolean; attendu: string; reel: string }
const postCheck = (pg: Jetable) => pg.run.query<LignePostCheck>(POSTCHECK);

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? "\n     · " + detail : ""}`); };

// ═══ (A) LE VÉRIFICATEUR SAIT ÉCHOUER ═══════════════════════════════════════
interface Sabotage { nom: string; sql: string | null; avecDdl?: boolean; code: 0 | 2 | 3; ecartAttendu: RegExp | null }
const SABOTAGES: readonly Sabotage[] = [
  { nom: "TÉMOIN · DDL rejoué tel quel", sql: null, code: 0, ecartAttendu: null },
  { nom: "table ABSENTE (DDL non rejoué)", sql: null, avecDdl: false, code: 2, ecartAttendu: null },
  // ── Les sabotages commandés par 4a / 4b ──
  { nom: "4a · UNKNOWN RÉINTRODUIT dans le domaine de provenance_kind", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_provenance_kind_check, ADD CONSTRAINT ${TABLE}_provenance_kind_check CHECK (provenance_kind IN ('UNKNOWN','OPERATOR_DECLARED','EXTRACTED','VERIFIED'))`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_provenance_kind_check : forme divergente — réel .*'UNKNOWN'::text/ },
  { nom: "4a · unknown_has_no_reference RÉINTRODUITE", sql: `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_unknown_has_no_reference_check CHECK ((provenance_kind = 'UNKNOWN') = (source_url IS NULL) AND (provenance_kind = 'UNKNOWN') = (reference_kind IS NULL))`, code: 3, ecartAttendu: /^contrainte INATTENDUE : evidence_provenance_journal_unknown_has_no_reference_check/ },
  { nom: "4b · verified_not_query_context RETIRÉE", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_verified_not_query_context_check`, code: 3, ecartAttendu: /^contrainte ABSENTE : evidence_provenance_journal_verified_not_query_context_check$/ },
  { nom: "4a · nullabilité relâchée · reference_kind DROP NOT NULL", sql: `ALTER TABLE ${TABLE} ALTER COLUMN reference_kind DROP NOT NULL`, code: 3, ecartAttendu: /^nullabilité divergente : reference_kind — attendu NO, réel YES$/ },
  { nom: "4a · nullabilité relâchée · source_url DROP NOT NULL", sql: `ALTER TABLE ${TABLE} ALTER COLUMN source_url DROP NOT NULL`, code: 3, ecartAttendu: /^nullabilité divergente : source_url — attendu NO, réel YES$/ },
  // ── Les sabotages commandés par Q4 (forme de source_url par reference_kind) ──
  { nom: "Q4 · CHECK conditionnel source_url_form_by_kind RETIRÉ", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_source_url_form_by_kind_check`, code: 3, ecartAttendu: /^contrainte ABSENTE : evidence_provenance_journal_source_url_form_by_kind_check$/ },
  { nom: "Q4 · CHECK conditionnel REMPLACÉ par un ^https?:// global (ce que GPT refuse)", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_source_url_form_by_kind_check, ADD CONSTRAINT ${TABLE}_source_url_form_by_kind_check CHECK (source_url ~ '^https?://')`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_source_url_form_by_kind_check : forme divergente — réel CHECK \(\(source_url ~ '\^https\?:\/\/'::text\)\)$/ },
  { nom: "Q4 · forme DOCUMENT élargie au texte libre (r2:// devient facultatif)", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_source_url_form_by_kind_check, ADD CONSTRAINT ${TABLE}_source_url_form_by_kind_check CHECK (CASE reference_kind WHEN 'PUBLICATION' THEN source_url ~ '^https?://[^/[:space:]]+\\.[^/[:space:]]+(/[^[:space:]]*)?$' WHEN 'PROFILE' THEN source_url ~ '^https?://[^/[:space:]]+\\.[^/[:space:]]+(/[^[:space:]]*)?$' WHEN 'QUERY_CONTEXT' THEN source_url ~ '^https?://[^/[:space:]]+\\.[^/[:space:]]+(/[^[:space:]]*)?$' WHEN 'DOCUMENT' THEN true WHEN 'OTHER' THEN source_url ~ '^[a-z][a-z0-9+.-]*:[^[:space:]]+$' ELSE false END)`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_source_url_form_by_kind_check : forme divergente — réel .*'DOCUMENT'::text THEN true/ },
  // ── Les sabotages de la première livraison, conservés ──
  { nom: "colonne MANQUANTE · sha256 supprimée", sql: `ALTER TABLE ${TABLE} DROP COLUMN sha256`, code: 3, ecartAttendu: /^colonne ABSENTE : sha256$/ },
  { nom: "colonne MANQUANTE · verification_method supprimée (CASCADE emporte 2 CHECK)", sql: `ALTER TABLE ${TABLE} DROP COLUMN verification_method CASCADE`, code: 3, ecartAttendu: /^colonne ABSENTE : verification_method$/ },
  { nom: "DEFAULT ajouté sur declared_at", sql: `ALTER TABLE ${TABLE} ALTER COLUMN declared_at SET DEFAULT now()`, code: 3, ecartAttendu: /^défaut INTERDIT \(donnée déclarée, pas une horloge\) : declared_at — réel now\(\)$/ },
  { nom: "DEFAULT ajouté sur verified_at", sql: `ALTER TABLE ${TABLE} ALTER COLUMN verified_at SET DEFAULT now()`, code: 3, ecartAttendu: /^défaut INTERDIT \(donnée déclarée, pas une horloge\) : verified_at — réel now\(\)$/ },
  { nom: "trigger ABSENT · no_rewrite", sql: `DROP TRIGGER ${TABLE}_no_rewrite ON ${TABLE}`, code: 3, ecartAttendu: /^APPEND-ONLY non exécutable : trigger ABSENT evidence_provenance_journal_no_rewrite/ },
  { nom: "trigger ABSENT · no_truncate", sql: `DROP TRIGGER ${TABLE}_no_truncate ON ${TABLE}`, code: 3, ecartAttendu: /^APPEND-ONLY non exécutable : trigger ABSENT evidence_provenance_journal_no_truncate/ },
  { nom: "trigger DÉSACTIVÉ · no_rewrite (présent, tgenabled = D)", sql: `ALTER TABLE ${TABLE} DISABLE TRIGGER ${TABLE}_no_rewrite`, code: 3, ecartAttendu: /^APPEND-ONLY non exécutable : trigger evidence_provenance_journal_no_rewrite DÉSACTIVÉ \(tgenabled = D, attendu O\)$/ },
  { nom: "index ABSENT · lecture « dernier état connu »", sql: `DROP INDEX ${TABLE}_snapshot_idx`, code: 3, ecartAttendu: /^index ABSENT : evidence_provenance_journal_snapshot_idx$/ },
  { nom: "CHECK de cohérence ABSENT · verified_iff_verification", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_verified_iff_verification_check`, code: 3, ecartAttendu: /^contrainte ABSENTE : evidence_provenance_journal_verified_iff_verification_check$/ },
  { nom: "domaine ÉLARGI à la main · provenance_kind admet 'INFERRED'", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_provenance_kind_check, ADD CONSTRAINT ${TABLE}_provenance_kind_check CHECK (provenance_kind IN ('OPERATOR_DECLARED','EXTRACTED','VERIFIED','INFERRED'))`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_provenance_kind_check : forme divergente — réel .*INFERRED/ },
  { nom: "FK affaiblie · ON DELETE CASCADE", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_snapshot_fkey, ADD CONSTRAINT ${TABLE}_snapshot_fkey FOREIGN KEY (evidence_snapshot_id) REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE CASCADE`, code: 3, ecartAttendu: /^contrainte evidence_provenance_journal_snapshot_fkey : forme divergente — réel .*ON DELETE CASCADE$/ },
  { nom: "colonne INATTENDUE ajoutée", sql: `ALTER TABLE ${TABLE} ADD COLUMN inferred_from text`, code: 3, ecartAttendu: /^colonne INATTENDUE : inferred_from$/ },
  { nom: "nullabilité relâchée · declared_by DROP NOT NULL", sql: `ALTER TABLE ${TABLE} ALTER COLUMN declared_by DROP NOT NULL`, code: 3, ecartAttendu: /^nullabilité divergente : declared_by — attendu NO, réel YES$/ },
  { nom: "PRÉREQUIS · PK de \"EvidenceSnapshot\" absente (table référencée sans identité)", sql: `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_snapshot_fkey; ALTER TABLE "EvidenceSnapshot" DROP CONSTRAINT "EvidenceSnapshot_pkey"`, code: 3, ecartAttendu: /^PRÉREQUIS ABSENT : aucune PRIMARY KEY \(id\) sur "EvidenceSnapshot"/ },
];

lignes.push("── (A) le vérificateur sait échouer");
// (C) est joué dans la même boucle : même Postgres, même sabotage, le post-check SQL doit rougir aussi.
const resultatsC: string[] = [];
for (const s of SABOTAGES) {
  const pg = await postgresJetable(s.avecDdl ?? true);
  try {
    if (s.sql) await pg.exec(s.sql);
    const v = await verifier(pg.run);
    const codeOk = v.code === s.code;
    const ecartOk = s.ecartAttendu === null ? v.ecarts.length === 0 || s.code === 2 : v.ecarts.some((e) => s.ecartAttendu!.test(e));
    check(`${s.nom} → exit ${s.code}${s.ecartAttendu ? ", écart nommé" : ""}`, codeOk && ecartOk,
      `réel : exit ${v.code} · ${v.ecarts.length} écart(s)${v.ecarts.length ? " : " + v.ecarts.join(" | ") : ""}`);

    // (C) le post-check SQL sur le même schéma. Table absente : la requête échoue (42P01), c'est attendu.
    if (s.code === 2) {
      const err = await postCheck(pg).then(() => "OK").catch((e) => String((e as { code?: string }).code ?? (e as Error).message));
      resultatsC.push(`${err === "42P01" ? "OK " : "KO "} POST-CHECK · ${s.nom} → 42P01 (table absente)\n     · réel : ${err}`);
      if (err !== "42P01") ko++;
    } else {
      const rows = await postCheck(pg);
      const faux = rows.filter((r) => !r.ok);
      const attenduVert = s.code === 0;
      const ok = attenduVert ? faux.length === 0 && rows.length > 0 : faux.length > 0;
      if (!ok) ko++;
      resultatsC.push(`${ok ? "OK " : "KO "} POST-CHECK · ${s.nom} → ${attenduVert ? "tout ok = true" : "au moins une ligne ok = false"}\n     · réel : ${rows.length} ligne(s), ${faux.length} false${faux.length ? " : " + faux.map((f) => f.point).join(" | ") : ""}`);
    }
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
  check("TÉMOIN POSITIF · DOCUMENT avec un localisateur gouverné r2://<bucket>/<clé> → accepté", (await ins({ ref: "DOCUMENT", url: "r2://interligens-evidence/botify-main/leaked-deck.pdf" })) === "OK");
  check("TÉMOIN POSITIF · QUERY_CONTEXT avec l'URL VINE ENCODÉE (%20) → accepté", (await ins({ kind: "EXTRACTED", ref: "QUERY_CONTEXT", url: "https://x.com/search?q=from:0xSweep%20VINE", by: "tool:inbox_manifest.py" })) === "OK");
  check("TÉMOIN POSITIF · OTHER avec un URI à schéma (urn:) → accepté", (await ins({ ref: "OTHER", url: "urn:isbn:9780000000000" })) === "OK");

  // ── Q4 : la forme du localisateur suit la nature de la référence.
  check("Q4 REFUSÉ 23514 · PUBLICATION avec une valeur non-HTTP (hôte nu)", (await ins({ url: "x.com/0xSweep/status/1" })) === "23514");
  check("Q4 REFUSÉ 23514 · PUBLICATION avec un schéma en MAJUSCULES (valeur non canonique)", (await ins({ url: "HTTPS://x.com/0xSweep/status/1" })) === "23514");
  check("Q4 REFUSÉ 23514 · PUBLICATION avec un r2:// (un objet R2 n'est pas une publication)", (await ins({ url: "r2://interligens-evidence/x.png" })) === "23514");
  check("Q4 REFUSÉ 23514 · PROFILE avec une valeur non-HTTP", (await ins({ ref: "PROFILE", url: "@0xSweep" })) === "23514");
  check("Q4 REFUSÉ 23514 · QUERY_CONTEXT avec une valeur non-HTTP (ftp://)", (await ins({ kind: "EXTRACTED", ref: "QUERY_CONTEXT", url: "ftp://x.com/search" })) === "23514");
  check("Q4 REFUSÉ 23514 · QUERY_CONTEXT avec la valeur RÉELLE de prod des pièces VINE (espace non encodée : pas une URL)", (await ins({ kind: "EXTRACTED", ref: "QUERY_CONTEXT", url: "https://x.com/search?q=from:0xSweep VINE" })) === "23514");
  check("Q4 REFUSÉ 23514 · DOCUMENT avec un chemin local (propre à une machine, hors vocabulaire)", (await ins({ ref: "DOCUMENT", url: "/Users/dood/Desktop/OSINT/capture.png" })) === "23514");
  check("Q4 REFUSÉ 23514 · DOCUMENT avec une URL publique pub-….r2.dev (hors vocabulaire)", (await ins({ ref: "DOCUMENT", url: "https://pub-interligens.r2.dev/evidence/a.pdf" })) === "23514");
  check("Q4 REFUSÉ 23514 · DOCUMENT avec un bucket hors règles de nommage (majuscule)", (await ins({ ref: "DOCUMENT", url: "r2://Bucket/a.pdf" })) === "23514");
  check("Q4 REFUSÉ 23514 · DOCUMENT r2:// sans clé", (await ins({ ref: "DOCUMENT", url: "r2://interligens-evidence/" })) === "23514");
  check("Q4 REFUSÉ 23514 · OTHER en prose (« voir le dossier »)", (await ins({ ref: "OTHER", url: "voir le dossier" })) === "23514");
  check("Q4 REFUSÉ 23514 · source_url avec une espace intérieure sous PUBLICATION", (await ins({ url: "https://x.com/0xSweep/status/1 2" })) === "23514");

  // ── 4a : le cas nouveau, il compte double. Deux formes, deux refus.
  check("4a REFUSÉ 23514 · provenance_kind = 'UNKNOWN' avec une référence complète (le DOMAINE refuse)", (await ins({ kind: "UNKNOWN" })) === "23514");
  check("4a REFUSÉ 23502 · provenance_kind = 'UNKNOWN' dans l'ancienne forme (sans URL ni reference_kind : le NOT NULL refuse AVANT le CHECK)", (await ins({ kind: "UNKNOWN", ref: null, url: null })) === "23502");

  check("REFUSÉ 23514 · VERIFIED sans verified_by/at/method", (await ins({ kind: "VERIFIED" })) === "23514");
  check("REFUSÉ 23514 · VERIFIED avec méthode mais sans verified_at", (await ins({ kind: "VERIFIED", vby: "operator:david", vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23514 · OPERATOR_DECLARED portant verified_by (les trois ou aucun)", (await ins({ vby: "operator:david", vat: T0, vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23514 · méthode hors domaine « URL_RESPONDS » (répondre n'est pas correspondre)", (await ins({ kind: "VERIFIED", vby: "operator:david", vat: T0, vm: "URL_RESPONDS" })) === "23514");
  check("4b REFUSÉ 23514 · VERIFIED sur un QUERY_CONTEXT (discovery context is not source provenance)", (await ins({ kind: "VERIFIED", ref: "QUERY_CONTEXT", url: "https://x.com/search?q=botify", vby: "operator:david", vat: T0, vm: "URL_MATCHES_CAPTURED_POST" })) === "23514");
  check("REFUSÉ 23502 · déclaration SANS URL (NOT NULL, plus de CHECK à contourner)", (await ins({ url: null })) === "23502");
  check("REFUSÉ 23502 · déclaration SANS reference_kind (NOT NULL)", (await ins({ ref: null })) === "23502");
  check("REFUSÉ 23514 · provenance_kind hors domaine « INFERRED »", (await ins({ kind: "INFERRED" })) === "23514");
  check("REFUSÉ 23514 · reference_kind hors domaine « SEARCH »", (await ins({ ref: "SEARCH" })) === "23514");
  check("REFUSÉ 23514 · declared_by vide", (await ins({ by: "" })) === "23514");
  check("REFUSÉ 23514 · declared_by avec blanc de bord", (await ins({ by: " operator:david" })) === "23514");
  check("REFUSÉ 23514 · source_url vide", (await ins({ url: "" })) === "23514");
  check("REFUSÉ 23514 · source_url avec blanc de bord", (await ins({ url: "https://x.com/u/status/1 " })) === "23514");
  check("REFUSÉ 23514 · sha256 mal formé", (await ins({ sha: "ABC" })) === "23514");
  check("REFUSÉ 23502 · declared_at NULL (pas de DEFAULT qui comblerait)", (await ins({ at: null })) === "23502");
  check("REFUSÉ 23503 · pièce inexistante (FK vers l'identité gouvernée)", (await ins({ snap: "snap-404" })) === "23503");
  check("REFUSÉ 428C9 · id fourni par l'appelant (GENERATED ALWAYS)", (await sqlstate(`INSERT INTO ${TABLE} (id, evidence_snapshot_id, provenance_kind, reference_kind, source_url, declared_by, declared_at) VALUES (999, 'snap-1', 'OPERATOR_DECLARED', 'PUBLICATION', 'https://x.com/u/status/1', 'x', $1)`, [T0])) === "428C9");

  check("APPEND-ONLY 23001 · UPDATE refusé", (await sqlstate(`UPDATE ${TABLE} SET declared_by = 'autre' WHERE id = 1`)) === "23001");
  check("APPEND-ONLY 23001 · DELETE refusé", (await sqlstate(`DELETE FROM ${TABLE} WHERE id = 1`)) === "23001");
  check("APPEND-ONLY 23001 · TRUNCATE refusé", (await sqlstate(`TRUNCATE ${TABLE}`)) === "23001");
  check("RESTRICT 23503 · supprimer une pièce qui porte un journal est refusé", (await sqlstate(`DELETE FROM "EvidenceSnapshot" WHERE id = 'snap-1'`)) === "23503");
  check("RESTRICT 23503 · renuméroter une pièce qui porte un journal est refusé", (await sqlstate(`UPDATE "EvidenceSnapshot" SET id = 'snap-1b' WHERE id = 'snap-1'`)) === "23503");

  // La lecture canonique : snap-1 porte 6 lignes (OPERATOR_DECLARED, EXTRACTED, VERIFIED, OPERATOR_DECLARED/DOCUMENT,
  // EXTRACTED/QUERY_CONTEXT, OPERATOR_DECLARED/OTHER). Le dernier état connu est le 6e INSERT — une requalification
  // vers une qualification MOINS forte, qui reste une qualification apportée : on ne « redescend » jamais à UNKNOWN.
  const dernier = await pg.run.query<{ provenance_kind: string; reference_kind: string; id: number }>(
    `SELECT id, provenance_kind, reference_kind FROM ${TABLE} WHERE evidence_snapshot_id = $1 ORDER BY id DESC LIMIT 1`, ["snap-1"]);
  check("LECTURE CANONIQUE · dernier état connu de snap-1 = la 6e ligne (OPERATOR_DECLARED/OTHER, id max), l'historique reste lisible",
    dernier[0]?.provenance_kind === "OPERATOR_DECLARED" && dernier[0]?.reference_kind === "OTHER" && Number((await pg.run.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${TABLE} WHERE evidence_snapshot_id = 'snap-1'`))[0].n) === 6,
    JSON.stringify(dernier));
  const tous = await pg.run.query<{ evidence_snapshot_id: string; provenance_kind: string }>(
    `SELECT s.id AS evidence_snapshot_id, COALESCE(j.provenance_kind, 'UNKNOWN') AS provenance_kind
       FROM "EvidenceSnapshot" s
       LEFT JOIN LATERAL (SELECT * FROM ${TABLE} WHERE evidence_snapshot_id = s.id ORDER BY id DESC LIMIT 1) j ON true
      ORDER BY s.id`);
  check("LECTURE CANONIQUE · une pièce SANS ligne vaut UNKNOWN par COALESCE — la SEULE façon dont UNKNOWN existe — sans consulter \"sourceUrl\"",
    tous.length === 2 && tous[1].evidence_snapshot_id === "snap-2" && tous[1].provenance_kind === "UNKNOWN", JSON.stringify(tous));
  const stocke = await pg.run.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${TABLE} WHERE provenance_kind = 'UNKNOWN'`);
  check("4a · aucune ligne STOCKÉE ne porte 'UNKNOWN' (0 après tous les essais)", Number(stocke[0].n) === 0);

  // Le plan de la lecture canonique passe par l'index (evidence_snapshot_id, id DESC).
  await pg.exec(`ANALYZE ${TABLE}; SET enable_seqscan = off`);
  const plan = (await pg.run.query<{ "QUERY PLAN": string }>(`EXPLAIN SELECT * FROM ${TABLE} WHERE evidence_snapshot_id = 'snap-1' ORDER BY id DESC LIMIT 1`)).map((r) => r["QUERY PLAN"]).join(" / ");
  check("INDEX · la lecture canonique est servie par evidence_provenance_journal_snapshot_idx, sans tri", plan.includes("evidence_provenance_journal_snapshot_idx") && !/\bSort\b/.test(plan), plan);

  const v = await verifier(pg.run);
  check("le vérificateur reste CONFORME après ces écritures (6 lignes = information, pas écart)", v.code === 0 && v.introspection.lignes === 6, `exit ${v.code}, ${v.introspection.lignes} ligne(s)`);
  // Le post-check, lui, exige une table VIDE : après 6 lignes, exactement UNE ligne false, « table VIDE ».
  const pc = await postCheck(pg);
  const pcFaux = pc.filter((r) => !r.ok).map((r) => r.point);
  check("POST-CHECK · après 6 lignes, exactement une ligne ok = false : « table VIDE » (le post-check est pour la POSE, pas pour la vie de la table)", pcFaux.length === 1 && pcFaux[0] === "table VIDE", pcFaux.join(" | "));
  await pg.close();
}

lignes.push("── (C) le post-check SQL (second bloc Neon) sait rougir");
lignes.push(...resultatsC);

// ═══ (D) LE BLOC 3 — FK CaseFileSource.snapshotId → RESTRICT/RESTRICT ═══════
lignes.push("── (D) le bloc 3 (FK snapshotId RESTRICT/RESTRICT) : dégradation avant, refus après, gardes, post-check");
{
  interface Bloc3Ligne { point: string; ok: boolean; attendu: string; reel: string }
  /** "CaseFileSource" telle que MESURÉE en prod : FK snapshotId ON DELETE SET NULL, 2 sources liées, 8 à NULL. */
  async function postgresCaseFileSource(fkInitiale = `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL`, avecFk = true) {
    const db = new PGlite();
    await db.exec(`CREATE TABLE "EvidenceSnapshot" (id text PRIMARY KEY, sha256 text, "sourceUrl" text);
      INSERT INTO "EvidenceSnapshot" VALUES ('34f4068a', '${"8".repeat(64)}', 'https://x.com/search?q=from:0xSweep VINE'), ('f24e3252', '${"c".repeat(64)}', 'https://x.com/search?q=from:0xSweep VINE');
      CREATE TABLE token_casefiles (ref text PRIMARY KEY);
      INSERT INTO token_casefiles VALUES ('IL-SHILL-VINE-001'), ('IL-SHILL-BOTIFY-001');
      CREATE TABLE "CaseFileSource" (
        id text PRIMARY KEY, "casefileRef" text NOT NULL, "sourceId" text NOT NULL, "snapshotId" text,
        CONSTRAINT "CaseFileSource_casefileRef_fkey" FOREIGN KEY ("casefileRef") REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
        CONSTRAINT "CaseFileSource_ref_sourceid_key" UNIQUE ("casefileRef", "sourceId")
        ${avecFk ? `, CONSTRAINT "CaseFileSource_snapshotId_fkey" ${fkInitiale}` : ""}
      );
      INSERT INTO "CaseFileSource" VALUES ('s09', 'IL-SHILL-VINE-001', 'SRC-0xS-09', '34f4068a'), ('s18', 'IL-SHILL-VINE-001', 'SRC-0xS-18', 'f24e3252');
      INSERT INTO "CaseFileSource" SELECT 'b' || g, 'IL-SHILL-BOTIFY-001', 'SRC-00' || g, NULL FROM generate_series(1, 8) g;`);
    // Après un échec DANS le BEGIN du bloc 3 (une garde qui lève), la session
    // reste en transaction avortée (25P02) et la requête suivante planterait :
    // c'est exactement ce que le premier passage de cette série a rougi. On
    // ROLLBACK après tout échec (WARNING inoffensif hors transaction).
    const sqlstate = async (sql: string): Promise<string> => {
      try { await db.exec(sql); return "OK"; }
      catch (e) { await db.exec("ROLLBACK").catch(() => undefined); return String((e as { code?: string }).code ?? (e as Error).message); }
    };
    const post = async () => (await db.query(BLOC3_POST)).rows as Bloc3Ligne[];
    return { db, sqlstate, post, close: () => db.close() };
  }

  // AVANT le bloc 3 : la dégradation SILENCIEUSE que Q1 refuse — mesurée, pas racontée.
  {
    const pg = await postgresCaseFileSource();
    check("D · AVANT · supprimer un EvidenceSnapshot référencé PASSE (ON DELETE SET NULL)", (await pg.sqlstate(`DELETE FROM "EvidenceSnapshot" WHERE id = '34f4068a'`)) === "OK");
    const s09 = ((await pg.db.query(`SELECT "snapshotId" FROM "CaseFileSource" WHERE id = 's09'`)).rows as Array<{ snapshotId: string | null }>)[0];
    check("D · AVANT · SRC-0xS-09 a perdu son observation EN SILENCE (snapshotId = NULL, aucune ligne ne l'écrit)", s09?.snapshotId === null, JSON.stringify(s09));
    const faux = (await pg.post()).filter((r: Bloc3Ligne) => !r.ok).map((r: Bloc3Ligne) => r.point);
    check("D · AVANT · le post-check du bloc 3 ROUGIT sur l'état actuel (SET NULL)", faux.length >= 3 && faux.some((f) => f.startsWith("FK snapshotId : définition rendue")), faux.join(" | "));
    await pg.close();
  }

  // LE BLOC 3 tel qu'il sera collé : le fichier ENTIER, d'un coup, DDL gardé + post-check.
  {
    const pg = await postgresCaseFileSource();
    const results = (await pg.db.exec(BLOC3)) as Array<{ rows: Bloc3Ligne[] }>;
    const rows = results[results.length - 1]?.rows ?? [];
    const faux = rows.filter((r) => !r.ok);
    check("D · BLOC 3 collé d'un coup → PASSE, post-check intégré : tout ok = true", rows.length === 8 && faux.length === 0, `${rows.length} ligne(s), ${faux.length} false${faux.length ? " : " + faux.map((f) => f.point + " (réel " + f.reel + ")").join(" | ") : ""}`);
    const def = ((await pg.db.query(`SELECT pg_get_constraintdef(oid) AS def, confdeltype::text AS d, confupdtype::text AS u FROM pg_constraint WHERE conname = 'CaseFileSource_snapshotId_fkey'`)).rows as Array<{ def: string; d: string; u: string }>)[0];
    check("D · APRÈS · pg_get_constraintdef = ON UPDATE RESTRICT ON DELETE RESTRICT, confdeltype = r, confupdtype = r",
      def?.def === `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT` && def?.d === "r" && def?.u === "r", JSON.stringify(def));
    check("D · APRÈS · supprimer un EvidenceSnapshot référencé → 23503", (await pg.sqlstate(`DELETE FROM "EvidenceSnapshot" WHERE id = '34f4068a'`)) === "23503");
    check("D · APRÈS · renuméroter un EvidenceSnapshot référencé → 23503", (await pg.sqlstate(`UPDATE "EvidenceSnapshot" SET id = 'autre' WHERE id = 'f24e3252'`)) === "23503");
    check("D · APRÈS · les 2 sources gardent leur snapshotId (rien n'a été mis à NULL)", Number(((await pg.db.query(`SELECT count(*)::int AS n FROM "CaseFileSource" WHERE "snapshotId" IS NOT NULL`)).rows as Array<{ n: number }>)[0].n) === 2);
    check("D · APRÈS · une source à NULL reste hors contrainte (INSERT snapshotId NULL passe)", (await pg.sqlstate(`INSERT INTO "CaseFileSource" VALUES ('b9', 'IL-SHILL-BOTIFY-001', 'SRC-009', NULL)`)) === "OK");
    check("D · APRÈS · rejouer le bloc 3 est REFUSÉ par la garde 1 (déjà en RESTRICT/RESTRICT) → 55000", (await pg.sqlstate(BLOC3_DDL)) === "55000");
    await pg.close();
  }

  // LES GARDES : un état réel différent de l'état mesuré → rien n'est modifié.
  {
    const pg = await postgresCaseFileSource();
    // Une orpheline ne peut pas entrer par la FK : on la fabrique en suspendant les triggers de FK (session_replication_role), comme le ferait une restauration partielle.
    await pg.db.exec(`SET session_replication_role = replica; INSERT INTO "CaseFileSource" VALUES ('orph', 'IL-SHILL-VINE-001', 'SRC-ORPH', 'n-existe-pas'); SET session_replication_role = origin;`);
    const code = await pg.sqlstate(BLOC3_DDL);
    const encore = ((await pg.db.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'CaseFileSource_snapshotId_fkey'`)).rows as Array<{ def: string }>)[0]?.def;
    check("D · GARDE 2 · une source orpheline (snapshotId sans EvidenceSnapshot) → le bloc LÈVE 23503 et ne pose rien", code === "23503" && encore === `FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL`, `code ${code} · contrainte encore : ${encore}`);
    await pg.close();
  }
  {
    const pg = await postgresCaseFileSource(`FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE CASCADE`);
    const code = await pg.sqlstate(BLOC3_DDL);
    check("D · GARDE 1 · forme réelle inattendue (ON DELETE CASCADE) → 55000, rien posé", code === "55000" && ((await pg.db.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'CaseFileSource_snapshotId_fkey'`)).rows as Array<{ def: string }>)[0]?.def.endsWith("ON DELETE CASCADE"), `code ${code}`);
    await pg.close();
  }
  {
    const pg = await postgresCaseFileSource(undefined, false);
    const code = await pg.sqlstate(BLOC3_DDL);
    check("D · GARDE 1 · contrainte ABSENTE → 55000, rien posé", code === "55000", `code ${code}`);
    await pg.close();
  }
}


console.log(lignes.join("\n"));
const total = lignes.filter((l) => /^(OK|KO) /.test(l)).length;
console.log(`\n${ko === 0 ? "✅" : "❌"} scénarios KO = ${ko} / ${total}`);
process.exitCode = ko === 0 ? 0 : 1;
