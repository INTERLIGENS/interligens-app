// ─── T1-INSCRIPTION-31 — LA RÉPÉTITION À BLANC DU FICHIER LIVRÉ ────────────
//
// ██  On ne colle pas une écriture de production irréversible sans l'avoir    ██
// ██  jouée. Ici, sur un Postgres JETABLE (PGlite) — rien ne touche la prod.  ██
//
//   PGLITE_PATH=/chemin/vers/@electric-sql/pglite/dist/index.js \
//   npx tsx scripts/evidence-chain/repetition-inscription-31-pglite.mts
//
// Ce harnais rejoue EXACTEMENT `docs/prep/INSCRIPTION_31.sql`, le fichier qui
// sera collé — pas une reconstruction, pas un équivalent : le fichier lui-même,
// coupé en deux au point où commence son post-check.
//
// La séquence est positionnée à 2 comme en production (deux répétitions à blanc
// en transaction annulée ont consommé 1 et 2), pour que les `id` observés soient
// ceux que le fondateur verra réellement.
//
// QUATRE SÉRIES :
//   (A) le bloc passe, et son post-check intégré rend ok = true
//   (B) les invariants de cohérence avec "EvidenceItem"
//   (C) le verrou append-only tient sur les lignes FRAÎCHEMENT posées
//   (D) LA MESURE DE FERMETURE, jouée d'avance : registre → autorité →
//       résolution, dans les DEUX configurations d'environnement possibles.
//
// Sortie : 0 si tout est conforme, 1 sinon.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readStorageLocations,
  type StorageLocationRef,
} from "../../src/lib/evidence-chain/storageLocationJournal";
import {
  resoudreLocalisation,
  autoriteDuRegistreDeLocalisation,
} from "../../src/lib/evidence-chain/storageResolution";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DDL = readFileSync(path.join(REPO, "docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql"), "utf8");
const FICHIER = readFileSync(path.join(REPO, "docs/prep/INSCRIPTION_31.sql"), "utf8");
const LES31: Array<[string, string]> = JSON.parse(
  readFileSync(path.join(REPO, "scripts/evidence-chain/__fixtures__/les-31-mesurees.json"), "utf8"),
);

const modPath = process.env.PGLITE_PATH;
if (!modPath) {
  console.error("UNABLE : PGLITE_PATH absent. Pointer sur une installation locale de @electric-sql/pglite.");
  process.exit(1);
}
const { PGlite } = await import(modPath);

// Le fichier se coupe en deux au début de son post-check.
const iPost = FICHIER.indexOf("SELECT\n  count(*)");
if (iPost < 0) { console.error("UNABLE : post-check introuvable dans INSCRIPTION_31.sql"); process.exit(1); }
const BLOC = FICHIER.slice(0, iPost);
const POSTCHECK = FICHIER.slice(iPost);

/** La séquence de PRODUCTION au moment de la répétition. Les deux épreuves
 * append-only en transaction annulée ont consommé 1 puis 2 : un ROLLBACK ne
 * rend pas une valeur d'IDENTITY. Le premier INSERT réel portera donc 3. */
const SEQUENCE_PROD = 2;

let ok = true;
const dit = (c: boolean, q: string, d = "") => {
  console.log(`  ${c ? "✅" : "❌"} ${q}${d ? ` — ${d}` : ""}`);
  if (!c) ok = false;
};

const db = new PGlite();
await db.exec(`CREATE TABLE "EvidenceItem" (id text PRIMARY KEY, "r2Key" text)`);
for (const [id, k] of LES31) await db.query(`INSERT INTO "EvidenceItem" VALUES ($1,$2)`, [id, k]);
await db.exec(DDL);
await db.exec(
  `SELECT setval(pg_get_serial_sequence('evidence_storage_location_journal','id'), ${SEQUENCE_PROD}, true)`,
);

const q = async <T,>(sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as T[];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (A) LE BLOC PASSE, ET SON POST-CHECK EST VERT ═══");
try { await db.exec(BLOC); dit(true, "le bloc BEGIN…COMMIT passe SANS ERREUR"); }
catch (e) { dit(false, "le bloc a ÉCHOUÉ", String((e as Error).message).slice(0, 220)); }

const post = (await q<Record<string, unknown>>(POSTCHECK))[0];
console.log(`     post-check : ${JSON.stringify(post)}`);
dit(post?.ok === true, "le post-check intégré rend ok = true");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (B) COHÉRENCE AVEC LES PIÈCES ═══");
const [ids] = await q<{ mn: string; mx: string }>(
  `SELECT min(id)::text AS mn, max(id)::text AS mx FROM evidence_storage_location_journal`);
dit(ids.mn === String(SEQUENCE_PROD + 1) && ids.mx === String(SEQUENCE_PROD + 31),
    `les id réels vont de ${SEQUENCE_PROD + 1} à ${SEQUENCE_PROD + 31} — les trous d'IDENTITY sont attendus`,
    `${ids.mn} → ${ids.mx}`);

const [orph] = await q<{ n: number }>(
  `SELECT count(*)::int AS n FROM evidence_storage_location_journal j
     LEFT JOIN "EvidenceItem" e ON e.id = j.evidence_item_id WHERE e.id IS NULL`);
dit(orph.n === 0, "aucune ligne ne vise une pièce inexistante");

const [div] = await q<{ n: number }>(
  `SELECT count(*)::int AS n FROM evidence_storage_location_journal j
     JOIN "EvidenceItem" e ON e.id = j.evidence_item_id
    WHERE e."r2Key" IS DISTINCT FROM j.storage_key`);
dit(div.n === 0, "chaque storage_key ÉGALE le r2Key de sa pièce — aucune KEY_DIVERGENCE à naître");

// L'identité instrumentale, et l'unicité de l'horodatage : les deux rulings.
const [att] = await q<{ db: number; ob: number; instants: number }>(
  `SELECT count(DISTINCT declared_by)::int AS db, count(DISTINCT observed_by)::int AS ob,
          count(DISTINCT observed_at)::int AS instants FROM evidence_storage_location_journal`);
dit(att.db === 1 && att.ob === 1, "une seule identité, sur les deux colonnes");
dit(att.instants === 1,
    "UN SEUL instant pour les 31 — la précision capturée est celle d'une CAMPAGNE, pas reconstruite");
const [humain] = await q<{ n: number }>(
  `SELECT count(*)::int AS n FROM evidence_storage_location_journal
    WHERE observed_by NOT LIKE 'src/%@%'`);
dit(humain.n === 0, "observed_by désigne un INSTRUMENT (chemin@commit), jamais un opérateur");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ (C) LE VERROU TIENT SUR LES LIGNES FRAÎCHEMENT POSÉES ═══");
const etat = async (sql: string) => { try { await db.query(sql); return "OK"; } catch (e) { return (e as { code?: string }).code ?? "?"; } };
for (const [nom, sql] of [
  ["UPDATE", `UPDATE evidence_storage_location_journal SET bucket = 'x'`],
  ["DELETE", `DELETE FROM evidence_storage_location_journal`],
  ["TRUNCATE", `TRUNCATE evidence_storage_location_journal`],
] as const) {
  await db.exec("BEGIN");
  dit(await etat(sql) === "23001", `${nom} sur les 31 posées → 23001`);
  await db.exec("ROLLBACK");
}
const [reste] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM evidence_storage_location_journal`);
dit(reste.n === 31, "les 31 lignes sont intactes après les trois refus", `${reste.n}`);

// ═══════════════════════════════════════════════════════════════════════════
// LA MESURE DE FERMETURE, JOUÉE D'AVANCE.
// On ne promet pas un résultat qu'on n'a pas éprouvé : c'est cette lecture —
// registre → autorité → résolution — qui ferme réellement la fenêtre, et elle
// se comporte différemment selon la CONFIGURATION. Les deux cas sont joués.
console.log("\n═══ (D) LA MESURE DE FERMETURE, DANS LES DEUX CONFIGURATIONS ═══");
const refs: StorageLocationRef[] = LES31.map(([id, k]) => ({ evidenceItemId: id, r2Key: k }));
const localisations = await readStorageLocations(
  { query: async (sql, p) => (await db.query(sql, (p ?? []) as unknown[])).rows as never[] },
  refs,
);
const autorite = autoriteDuRegistreDeLocalisation(localisations);

const nommes = [...localisations.values()].filter((l) => l.established).length;
dit(nommes === 31, "1 · NOMMÉES par le registre gouverné : 31/31", `${nommes}`);
const buckets = new Set([...localisations.values()].flatMap((l) => (l.established ? [l.bucket] : [])));
dit(buckets.size === 1 && buckets.has("interligens-reports"), "toutes vers interligens-reports",
    [...buckets].join(", "));
const modes = new Set([...localisations.values()].flatMap((l) => (l.established ? [l.mode] : [])));
dit(modes.size === 1 && modes.has("VERIFIED_BY_HEAD"), "toutes en VERIFIED_BY_HEAD, avec observation");

// ── CAS 1 · la configuration d'AUJOURD'HUI : R2_EVIDENCE_BUCKET_NAME absente.
const ENV_AUJOURDHUI = { R2_ACCOUNT_ID: "c", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s" };
const r1 = refs.map((r) => resoudreLocalisation({ id: r.evidenceItemId, r2Key: r.r2Key }, ENV_AUJOURDHUI, [autorite]));
dit(r1.every((x) => !x.ok), "CAS 1 (config actuelle) : 0/31 résolues — la porte gouvernée n'est pas armée");
const motif1 = new Set(r1.flatMap((x) => (x.ok ? [] : [x.detail])));
dit(motif1.size === 1 && [...motif1][0].includes("evidence_compartment_unconfigured"),
    "        et le refus dit POURQUOI — configuration, pas localisation");
dit(![...motif1][0].includes("aucune autorité de localisation ne revendique"),
    "        ce n'est PLUS « aucune autorité ne revendique » : la dette de localisation est SOLDÉE");

// ── CAS 2 · la porte gouvernée ouvre le compartiment NOMMÉ.
const ENV_ARME = { ...ENV_AUJOURDHUI, R2_EVIDENCE_BUCKET_NAME: "interligens-reports" };
const r2 = refs.map((r) => resoudreLocalisation({ id: r.evidenceItemId, r2Key: r.r2Key }, ENV_ARME, [autorite]));
dit(r2.every((x) => x.ok), `CAS 2 (porte armée sur interligens-reports) : ${r2.filter((x) => x.ok).length}/31 RÉSOLUES`);
dit(r2.every((x) => x.ok && x.compartiment === "interligens-reports" && typeof x.readObject === "function"),
    "        chacune rend son compartiment ET sa capacité de lecture liée");
dit(r2.every((x) => x.ok && x.autorite === "registre-de-localisation"),
    "        et l'autorité nommée est bien le registre");

await db.close();
console.log(`\n${ok ? "═══ LE FICHIER EST SÛR À COLLER ═══" : "═══ ÉCARTS — NE PAS COLLER ═══"}`);
process.exit(ok ? 0 : 1);
