// ─── T1-REGISTRE-DE-LOCALISATION — LE HARNAIS QUI SAIT ÉCHOUER ─────────────
//
// ██  « Un harnais qui ne sait pas échouer ne mesure pas. »                  ██
// ██  Ici, RIEN ne touche la production : Postgres JETABLE en WASM (PGlite). ██
//
//   PGLITE_PATH=/chemin/vers/@electric-sql/pglite/dist/index.js \
//   npx tsx scripts/evidence-chain/harnais-registre-localisation-pglite.mts
//
// PGlite n'est PAS une dépendance du dépôt : PGLITE_PATH doit pointer sur une
// installation locale. La production est en PostgreSQL 17.11 — même majeure,
// mêmes catalogues.
//
// POURQUOI PGlite ET NON UN BEGIN … ROLLBACK CONTRE LA PRODUCTION : la fenêtre
// interdit tout DDL posé et toute écriture de production. Une transaction
// annulée n'écrirait rien, mais elle EXÉCUTERAIT le DDL sur ep-square-band et y
// prendrait des verrous. L'interdit est plus fort que la commodité, et PGlite
// est l'alternative explicitement prévue.
//
// QUATRE SÉRIES :
//   (A) le DDL se joue, et le POST-CHECK est tout vert. Les formes rendues par
//       pg_get_constraintdef sont MESURÉES ici, jamais écrites à la main.
//   (B) le DDL tient ses règles. Chaque CHECK, la FK et l'append-only sont
//       exercés par des écritures réelles — refusées ou acceptées — avec le
//       SQLSTATE attendu. (f) des six preuves vit ici : 23001 sur UPDATE,
//       DELETE et TRUNCATE, en transaction ANNULÉE.
//   (C) le POST-CHECK sait ROUGIR : un sabotage, au moins une ligne ok = false.
//       Un post-check qui resterait vert sur un schéma faux ne mesurerait rien.
//   (D) LA RÉPÉTITION À BLANC : les 31 lignes VERIFIED_BY_HEAD réelles sont
//       inscrites, relues, la résolution des 31 passe de UNRESOLVED à résolue,
//       puis ROLLBACK — et on vérifie que rien n'a bougé.
//
// Sortie : 0 si chaque scénario a fait ce qu'on attendait de lui, 1 sinon.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveStorageLocation,
  type StorageLocationRow,
} from "../../src/lib/evidence-chain/storageLocationJournal";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql"), "utf8");
const POSTCHECK = readFileSync(path.join(REPO, "docs/prep/POSTCHECK_STORAGE_LOCATION_JOURNAL_2026-09-15.sql"), "utf8");
const LES_31: Array<[string, string]> = JSON.parse(
  readFileSync(path.join(REPO, "scripts/evidence-chain/__fixtures__/les-31-mesurees.json"), "utf8"),
);

const modPath = process.env.PGLITE_PATH;
if (!modPath) {
  console.error(
    "UNABLE : PGLITE_PATH absent. PGlite n'est pas une dépendance du dépôt ; pointer sur une\n" +
      "installation locale (…/@electric-sql/pglite/dist/index.js).",
  );
  process.exit(1);
}
const { PGlite } = await import(modPath);

const TABLE = "evidence_storage_location_journal";
let echecs = 0;
const dit = (ok: boolean, quoi: string, detail = "") => {
  console.log(`  ${ok ? "✅" : "❌"} ${quoi}${detail ? ` — ${detail}` : ""}`);
  if (!ok) echecs++;
};

interface Jetable {
  q<T = Record<string, unknown>>(sql: string, p?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

/** Un Postgres neuf, avec "EvidenceItem" TEL QUE MESURÉ (id text PK) et les 31. */
async function jetable(avecDdl = true): Promise<Jetable> {
  const db = new PGlite();
  // La table RÉFÉRENCÉE, réduite à ce que la FK exige : id text PRIMARY KEY.
  // Mesuré le 2026-09-15 sur ep-square-band : "EvidenceItem_pkey" PRIMARY KEY (id).
  await db.exec(`CREATE TABLE "EvidenceItem" (id text PRIMARY KEY, "r2Key" text, "tsaToken" bytea, "evidentiaryStatus" text)`);
  for (const [id, key] of LES_31) {
    await db.query(`INSERT INTO "EvidenceItem" (id, "r2Key") VALUES ($1, $2)`, [id, key]);
  }
  if (avecDdl) await db.exec(DDL);
  return {
    q: async <T,>(sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as T[],
    exec: (sql: string) => db.exec(sql),
    close: () => db.close(),
  };
}

/** Joue une écriture et rend le SQLSTATE, ou "OK". */
async function etat(db: Jetable, sql: string, p: unknown[] = []): Promise<string> {
  try { await db.q(sql, p); return "OK"; } catch (e) { return (e as { code?: string }).code ?? "SANS-CODE"; }
}

const INSERT = `INSERT INTO ${TABLE}
  (evidence_item_id, bucket, storage_key, establishment_mode, declared_by, declared_at, observed_by, observed_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;
const ID0 = LES_31[0][0];
const CLE0 = LES_31[0][1];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (A) LE DDL SE JOUE, ET LE POST-CHECK EST TOUT VERT ═══");
{
  const db = await jetable();
  const lignes = await db.q<{ point: string; ok: boolean; attendu: string; reel: string }>(POSTCHECK);
  const rouges = lignes.filter((l) => !l.ok);
  dit(lignes.length > 0, `le post-check rend ${lignes.length} point(s)`);
  dit(rouges.length === 0, "tous les points sont verts");
  for (const r of rouges) console.log(`      · ${r.point}\n        attendu : ${r.attendu}\n        réel    : ${r.reel}`);
  await db.close();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (B) LE DDL TIENT SES RÈGLES ═══");
{
  const db = await jetable();
  const T = "2026-09-15T10:00:00Z";

  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "OK",
      "une DECLARED_AT_WRITE bien formée est ACCEPTÉE");

  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "VERIFIED_BY_HEAD", "T1", T, "T1/mesure", T]) === "OK",
      "une VERIFIED_BY_HEAD avec son observation est ACCEPTÉE");

  // ── Le vocabulaire est CLOS. Les trois fautes que GPT a nommées NO-GO.
  for (const mode of ["INFERRED_FROM_PREFIX", "BY_CONVENTION", "UNKNOWN"]) {
    dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, mode, "T1", T, null, null]) === "23514",
        `« ${mode} » est REFUSÉ (23514) — le vocabulaire est clos`);
  }

  // ── VERIFIED_BY_HEAD ⇔ observation, DANS LES DEUX SENS.
  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "VERIFIED_BY_HEAD", "T1", T, null, null]) === "23514",
      "VERIFIED_BY_HEAD SANS observation est REFUSÉE (23514)");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "VERIFIED_BY_HEAD", "T1", T, "T1", null]) === "23514",
      "VERIFIED_BY_HEAD avec un observateur mais SANS date est REFUSÉE (23514)");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "DECLARED_AT_WRITE", "T1", T, "T1", T]) === "23514",
      "DECLARED_AT_WRITE AVEC observation est REFUSÉE (23514) — l'autre sens compte aussi");

  // ── La forme du compartiment et de la clé.
  dit(await etat(db, INSERT, [ID0, "INTERLIGENS-Reports", CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "23514",
      "un bucket en majuscules est REFUSÉ (23514)");
  dit(await etat(db, INSERT, [ID0, "-mauvais-", CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "23514",
      "un bucket qui commence par un tiret est REFUSÉ (23514)");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", "/" + CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "23514",
      "une clé à `/` initial est REFUSÉE (23514) — ce serait une AUTRE clé");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", " " + CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "23514",
      "une clé à blanc de bord est REFUSÉE (23514)");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", "a\nb", "DECLARED_AT_WRITE", "T1", T, null, null]) === "23514",
      "une clé à caractère de contrôle est REFUSÉE (23514)");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", "dossier/mon fichier.pdf", "DECLARED_AT_WRITE", "T1", T, null, null]) === "OK",
      "une clé à espace INTERNE est ACCEPTÉE — S3 l'autorise, on n'invente pas la contrainte");
  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "DECLARED_AT_WRITE", "  ", T, null, null]) === "23514",
      "un déclarant vide est REFUSÉ (23514) — toute ligne est un acte signé");

  // ── La FK : aucune ligne ne vise une pièce qui n'existe pas.
  dit(await etat(db, INSERT, ["evi_inexistante", "interligens-reports", CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]) === "23503",
      "une pièce inexistante est REFUSÉE (23503)");
  dit(await etat(db, `DELETE FROM "EvidenceItem" WHERE id = $1`, [ID0]) === "23503",
      "supprimer une pièce journalisée est REFUSÉ (23503) — RESTRICT, l'historique tient à la pièce");

  // ── declared_at est OBLIGATOIRE et SANS DEFAULT : rien ne fabrique une date.
  dit(await etat(db, INSERT, [ID0, "interligens-reports", CLE0, "DECLARED_AT_WRITE", "T1", null, null, null]) === "23502",
      "declared_at NULL est REFUSÉ (23502) — aucun défaut ne fabrique « maintenant »");

  await db.close();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (B bis) APPEND-ONLY — LA PREUVE (f), EN TRANSACTION ANNULÉE ═══");
{
  const db = await jetable();
  const T = "2026-09-15T10:00:00Z";
  await db.q(INSERT, [ID0, "interligens-reports", CLE0, "DECLARED_AT_WRITE", "T1", T, null, null]);

  await db.exec("BEGIN");
  dit(await etat(db, `UPDATE ${TABLE} SET bucket = 'interligens-evidence'`) === "23001",
      "UPDATE est REFUSÉ (23001 restrict_violation)");
  await db.exec("ROLLBACK");

  await db.exec("BEGIN");
  dit(await etat(db, `DELETE FROM ${TABLE}`) === "23001", "DELETE est REFUSÉ (23001)");
  await db.exec("ROLLBACK");

  await db.exec("BEGIN");
  dit(await etat(db, `TRUNCATE ${TABLE}`) === "23001",
      "TRUNCATE est REFUSÉ (23001) — il ne passe pas par les triggers de ligne");
  await db.exec("ROLLBACK");

  const [{ n }] = await db.q<{ n: string }>(`SELECT count(*)::text AS n FROM ${TABLE}`);
  dit(n === "1", "après les trois refus, la ligne est TOUJOURS là", `${n} ligne(s)`);

  // Un déplacement, lui, est une NOUVELLE ligne — et l'ancienne reste lisible.
  await db.q(INSERT, [ID0, "interligens-evidence", CLE0, "VERIFIED_BY_HEAD", "T1", T, "T1/mesure", T]);
  const hist = await db.q<{ bucket: string }>(`SELECT bucket FROM ${TABLE} WHERE evidence_item_id = $1 ORDER BY id`, [ID0]);
  dit(hist.length === 2 && hist[0].bucket === "interligens-reports" && hist[1].bucket === "interligens-evidence",
      "un déplacement est une NOUVELLE ligne, et l'historique reste entier");
  await db.close();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (C) LE POST-CHECK SAIT ROUGIR ═══");
{
  const sabotages: Array<[string, string]> = [
    ["un trigger retiré", `DROP TRIGGER ${TABLE}_no_truncate ON ${TABLE}`],
    ["un CHECK retiré", `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_establishment_mode_check`],
    ["une colonne en trop", `ALTER TABLE ${TABLE} ADD COLUMN r2_bucket text`],
    ["l'index cible retiré", `DROP INDEX ${TABLE}_item_idx`],
    ["un DEFAULT sur declared_at", `ALTER TABLE ${TABLE} ALTER COLUMN declared_at SET DEFAULT now()`],
    ["la FK dégradée en CASCADE", `ALTER TABLE ${TABLE} DROP CONSTRAINT ${TABLE}_item_fkey,
       ADD CONSTRAINT ${TABLE}_item_fkey FOREIGN KEY (evidence_item_id) REFERENCES "EvidenceItem"(id) ON DELETE CASCADE`],
  ];
  for (const [quoi, sql] of sabotages) {
    const db = await jetable();
    await db.exec(sql);
    const lignes = await db.q<{ ok: boolean }>(POSTCHECK);
    const rouges = lignes.filter((l) => !l.ok).length;
    dit(rouges > 0, `${quoi} → le post-check rougit`, `${rouges} ligne(s) ok = false`);
    await db.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (D) LA RÉPÉTITION À BLANC — LES 31, PUIS ROLLBACK ═══");
{
  const db = await jetable();
  const OBSERVE_LE = "2026-09-15T00:00:00Z";

  // AVANT : le registre est vide, et les 31 sont STORAGE_LOCATION_UNRESOLVED.
  const avant = LES_31.map(([id, key]) => resolveStorageLocation({ evidenceItemId: id, r2Key: key }, []));
  dit(avant.every((r) => !r.established && r.cause === "NO_LOCATION_EVENT"),
      `AVANT : ${avant.length}/31 en STORAGE_LOCATION_UNRESOLVED (cause NO_LOCATION_EVENT)`);

  const [{ n: vide }] = await db.q<{ n: string }>(`SELECT count(*)::text AS n FROM ${TABLE}`);
  dit(vide === "0", "la table est posée VIDE — aucun backfill");

  await db.exec("BEGIN");

  // ── L'INSCRIPTION DES 31, avec les valeurs MESURÉES (62 HeadObject).
  // ⚠️ Le compartiment vient de la MESURE, jamais du préfixe de la clé.
  for (const [id, key] of LES_31) {
    await db.q(INSERT, [id, "interligens-reports", key, "VERIFIED_BY_HEAD",
                        "T1/registre-de-localisation", OBSERVE_LE, "T1/mesure-localisation", OBSERVE_LE]);
  }
  const [{ n: inscrites }] = await db.q<{ n: string }>(`SELECT count(*)::text AS n FROM ${TABLE}`);
  dit(inscrites === "31", "31 lignes VERIFIED_BY_HEAD inscrites", `${inscrites} ligne(s)`);

  // ── LA RELECTURE, par la requête de production, telle quelle.
  const rows = (await db.q(
    `SELECT DISTINCT ON (evidence_item_id)
            id::text AS "id", evidence_item_id AS "evidenceItemId", bucket AS "bucket",
            storage_key AS "storageKey", establishment_mode AS "establishmentMode",
            declared_by AS "declaredBy", declared_at AS "declaredAt",
            observed_by AS "observedBy", observed_at AS "observedAt"
       FROM ${TABLE} WHERE evidence_item_id = ANY($1) ORDER BY evidence_item_id, id DESC`,
    [LES_31.map(([id]) => id)],
  )) as unknown as StorageLocationRow[];
  dit(rows.length === 31, "la relecture rend 31 lignes, une par pièce", `${rows.length}`);

  const apres = LES_31.map(([id, key]) => resolveStorageLocation({ evidenceItemId: id, r2Key: key }, rows));
  const resolues = apres.filter((r) => r.established);
  dit(resolues.length === 31, `APRÈS : ${resolues.length}/31 RÉSOLUES`);
  dit(resolues.every((r) => r.established && r.bucket === "interligens-reports"),
      "les 31 sont situées dans interligens-reports — le compartiment MESURÉ");
  dit(resolues.every((r) => r.established && r.mode === "VERIFIED_BY_HEAD" && r.observation !== null),
      "les 31 portent leur mode ET leur observation (qui a mesuré, quand)");

  // ── ROLLBACK, et la vérification que RIEN n'a bougé.
  await db.exec("ROLLBACK");
  const [{ n: apresRollback }] = await db.q<{ n: string }>(`SELECT count(*)::text AS n FROM ${TABLE}`);
  dit(apresRollback === "0", "après ROLLBACK : la table est de nouveau VIDE", `${apresRollback} ligne(s)`);

  const rejoue = LES_31.map(([id, key]) => resolveStorageLocation({ evidenceItemId: id, r2Key: key }, []));
  dit(rejoue.every((r) => !r.established && r.cause === "NO_LOCATION_EVENT"),
      "et les 31 sont revenues à STORAGE_LOCATION_UNRESOLVED — rien n'a bougé");

  const [{ n: items }] = await db.q<{ n: string }>(`SELECT count(*)::text AS n FROM "EvidenceItem"`);
  dit(items === "31", "les 31 pièces sont intactes — aucune n'a été touchée");

  await db.close();
}

console.log(`\n═══ ${echecs === 0 ? "TOUT VERT" : `${echecs} ÉCHEC(S)`} ═══`);
process.exit(echecs === 0 ? 0 : 1);
