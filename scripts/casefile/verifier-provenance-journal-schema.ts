#!/usr/bin/env tsx
/**
 * VÉRIFICATION DU DDL `evidence_provenance_journal` — LECTURE SEULE.
 *
 * ██  Un message de commit sur l'état de la base n'est pas une source de   ██
 * ██  vérité. On interroge information_schema et pg_catalog.               ██
 *
 * USAGE
 *     npx tsx scripts/casefile/verifier-provenance-journal-schema.ts [--json]
 *
 * SORTIE
 *     0  CONFORME au DDL livré (amendé 4a/4b/5 le 2026-09-14) — colonnes,
 *        types, nullabilité (reference_kind et source_url NOT NULL), défauts
 *        (et ABSENCE de défaut sur declared_at / verified_at), PK, CHECK
 *        (domaine SANS UNKNOWN, PAS de unknown_has_no_reference,
 *        verified_not_query_context présente, forme de source_url
 *        conditionnée par reference_kind), FK RESTRICT/RESTRICT, index,
 *        triggers append-only présents ET activés
 *     2  ABSENTE — la table n'existe pas (à lancer AVANT la pose : c'est la
 *        réponse attendue)
 *     3  ÉCARTS nommés
 *     1  UNABLE (pas de DATABASE_URL, erreur réseau)
 *
 * CE SCRIPT N'APPLIQUE RIEN. Aucun CREATE, ALTER, INSERT, DROP. Le DDL est
 * docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql, à coller dans
 * l'éditeur SQL Neon. Le verrou A9 arrête de toute façon `prisma migrate`
 * sur P1012 avant tout accès réseau.
 *
 * Il vérifie aussi le PRÉREQUIS de la FK — la PRIMARY KEY (id) sur
 * "EvidenceSnapshot" — parce que sans elle la contrainte « aucune ligne ne
 * vise une pièce inexistante » n'est pas posable.
 *
 * STRUCTURE : la comparaison est une fonction PURE de l'introspection
 * (`comparer`) et l'introspection ne connaît qu'un `Runner` minimal. C'est ce
 * qui permet au harnais scripts/casefile/harnais-provenance-journal-pglite.mts
 * de prouver que ce vérificateur SAIT ÉCHOUER, sur un Postgres jetable, sans
 * toucher la production.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const TABLE = "evidence_provenance_journal";
export const DDL = "docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql";

/** Le minimum commun à Prisma ($queryRawUnsafe) et à PGlite (query). */
export interface Runner {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

/** La structure ATTENDUE — dérivée du DDL livré : nom, type, nullabilité, défaut (null = aucun). */
const COLONNES_ATTENDUES: ReadonlyArray<readonly [string, string, "NO" | "YES", RegExp | null]> = [
  ["id", "bigint", "NO", null], // IDENTITY : pas de column_default, identity_generation = ALWAYS
  ["evidence_snapshot_id", "text", "NO", null],
  ["sha256", "text", "YES", null],
  ["provenance_kind", "text", "NO", null],
  // NOT NULL depuis l'amendement 4a (T1 2026-09-14) : une ligne est une
  // qualification APPORTÉE, elle porte toujours une référence et sa nature.
  ["reference_kind", "text", "NO", null],
  ["source_url", "text", "NO", null],
  ["declared_by", "text", "NO", null],
  ["declared_at", "timestamp with time zone", "NO", null], // PAS de défaut, à dessein
  ["verified_by", "text", "YES", null],
  ["verified_at", "timestamp with time zone", "YES", null], // PAS de défaut, à dessein
  ["verification_method", "text", "YES", null],
  ["recorded_at", "timestamp with time zone", "NO", /^now\(\)$/],
];

/**
 * Les contraintes ATTENDUES, par nom et par forme RENDUE. Postgres réécrit les
 * CHECK (`IN (...)` devient `= ANY (ARRAY[...])`, chaque littéral reçoit
 * `::text`, les parenthèses sont normalisées) : on compare à la forme rendue,
 * mesurée en rejeu PGlite (PG 17), et on exige les LITTÉRAUX du domaine — ni
 * un de plus, ni un de moins.
 */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HTTP_FORM = "^https?://[^/[:space:]]+\\.[^/[:space:]]+(/[^[:space:]]*)?$";
const R2_FORM = "^r2://[a-z0-9][a-z0-9-]{1,61}[a-z0-9]/[^[:space:]]+$";
const URI_FORM = "^[a-z][a-z0-9+.-]*:[^[:space:]]+$";
/**
 * Le CHECK conditionnel (ruling Q4, T1-DDL-PHASE-A) : la forme de source_url
 * suit reference_kind. Postgres rend le CASE sur plusieurs lignes ; les blancs
 * sont normalisés à l'introspection, et la forme attendue est comparée en
 * ÉGALITÉ STRICTE (regex échappée) — un motif affaibli ou élargi est un écart.
 */
const SOURCE_URL_FORM_BY_KIND_RENDU =
  "CHECK ( CASE reference_kind" +
  ` WHEN 'PUBLICATION'::text THEN (source_url ~ '${HTTP_FORM}'::text)` +
  ` WHEN 'PROFILE'::text THEN (source_url ~ '${HTTP_FORM}'::text)` +
  ` WHEN 'QUERY_CONTEXT'::text THEN (source_url ~ '${HTTP_FORM}'::text)` +
  ` WHEN 'DOCUMENT'::text THEN (source_url ~ '${R2_FORM}'::text)` +
  ` WHEN 'OTHER'::text THEN (source_url ~ '${URI_FORM}'::text)` +
  " ELSE false END)";

const CONTRAINTES_ATTENDUES: ReadonlyArray<readonly [string, "p" | "c" | "f", RegExp]> = [
  [`${TABLE}_pkey`, "p", /^PRIMARY KEY \(id\)$/],
  [`${TABLE}_sha256_check`, "c", /^CHECK \(\(sha256 ~ '\^\[0-9a-f\]\{64\}\$'::text\)\)$/],
  // 4a : UNKNOWN n'est PAS dans le domaine. Sa réintroduction est un écart nommé.
  [`${TABLE}_provenance_kind_check`, "c", /^CHECK \(\(provenance_kind = ANY \(ARRAY\['OPERATOR_DECLARED'::text, 'EXTRACTED'::text, 'VERIFIED'::text\]\)\)\)$/],
  [`${TABLE}_reference_kind_check`, "c", /^CHECK \(\(reference_kind = ANY \(ARRAY\['QUERY_CONTEXT'::text, 'PUBLICATION'::text, 'PROFILE'::text, 'DOCUMENT'::text, 'OTHER'::text\]\)\)\)$/],
  [`${TABLE}_source_url_check`, "c", /^CHECK \(\(\(source_url <> ''::text\) AND \(btrim\(source_url\) = source_url\)\)\)$/],
  [`${TABLE}_declared_by_check`, "c", /^CHECK \(\(\(declared_by <> ''::text\) AND \(btrim\(declared_by\) = declared_by\)\)\)$/],
  [`${TABLE}_verified_by_check`, "c", /^CHECK \(\(\(verified_by <> ''::text\) AND \(btrim\(verified_by\) = verified_by\)\)\)$/],
  [`${TABLE}_verification_method_check`, "c", /^CHECK \(\(verification_method = ANY \(ARRAY\['URL_MATCHES_CAPTURED_POST'::text, 'ARCHIVE_SNAPSHOT_MATCHES'::text, 'PLATFORM_API_RECORD_MATCHES'::text\]\)\)\)$/],
  [
    `${TABLE}_verified_iff_verification_check`, "c",
    /^CHECK \(\(\(\(provenance_kind = 'VERIFIED'::text\) = \(verified_by IS NOT NULL\)\) AND \(\(provenance_kind = 'VERIFIED'::text\) = \(verified_at IS NOT NULL\)\) AND \(\(provenance_kind = 'VERIFIED'::text\) = \(verification_method IS NOT NULL\)\)\)\)$/,
  ],
  // unknown_has_no_reference : SUPPRIMÉE par 4a. Si elle réapparaît, c'est une
  // « contrainte INATTENDUE » — le vérificateur la nomme (boucle sur parNom).
  [`${TABLE}_source_url_form_by_kind_check`, "c", new RegExp("^" + escapeRegExp(SOURCE_URL_FORM_BY_KIND_RENDU) + "$")],
  [
    `${TABLE}_verified_not_query_context_check`, "c",
    /^CHECK \(\(NOT \(\(provenance_kind = 'VERIFIED'::text\) AND \(reference_kind = 'QUERY_CONTEXT'::text\)\)\)\)$/,
  ],
  [
    `${TABLE}_snapshot_fkey`, "f",
    /^FOREIGN KEY \(evidence_snapshot_id\) REFERENCES "EvidenceSnapshot"\(id\) ON UPDATE RESTRICT ON DELETE RESTRICT$/,
  ],
];

const INDEX_ATTENDUS: ReadonlyArray<readonly [string, RegExp]> = [
  [`${TABLE}_pkey`, /USING btree \(id\)$/],
  [`${TABLE}_snapshot_idx`, /USING btree \(evidence_snapshot_id, id DESC\)$/],
];

/**
 * Le DDL SUPPLÉMENTAIRE (append-only). Son absence est un écart NOMMÉ comme tel.
 * Postgres réécrit `UPDATE OR DELETE` en `DELETE OR UPDATE` dans pg_get_triggerdef :
 * on compare à la forme RENDUE, pas à la forme écrite. Un trigger présent mais
 * DÉSACTIVÉ (tgenabled <> 'O') est aussi un écart : il ne protège plus rien.
 */
const TRIGGERS_ATTENDUS: ReadonlyArray<readonly [string, RegExp]> = [
  [`${TABLE}_no_rewrite`, /BEFORE DELETE OR UPDATE ON public\.evidence_provenance_journal FOR EACH ROW EXECUTE FUNCTION evidence_provenance_journal_append_only\(\)$/],
  [`${TABLE}_no_truncate`, /BEFORE TRUNCATE ON public\.evidence_provenance_journal FOR EACH STATEMENT EXECUTE FUNCTION evidence_provenance_journal_append_only\(\)$/],
];

export interface Colonne { column_name: string; data_type: string; is_nullable: string; column_default: string | null; identity_generation: string | null }
export interface Contrainte { conname: string; contype: string; def: string }
export interface Index { indexname: string; indexdef: string }
export interface Trigger { tgname: string; def: string; tgenabled: string }

export interface Introspection {
  readonly prerequisPk: boolean;
  readonly colonnes: readonly Colonne[];
  readonly contraintes: readonly Contrainte[];
  readonly index: readonly Index[];
  readonly triggers: readonly Trigger[];
  /** null quand la table est absente. */
  readonly lignes: number | null;
}

export interface Verdict {
  readonly code: 0 | 2 | 3;
  readonly etat: "CONFORME" | "ABSENTE" | "ECARTS";
  readonly ecarts: readonly string[];
  readonly introspection: Introspection;
}

/** LECTURE SEULE. Six SELECT sur les catalogues, un count. */
export async function introspecter(run: Runner): Promise<Introspection> {
  // ── PRÉREQUIS : la PK sur la table référencée ────────────────────────────
  const prerequis = await run.query<Contrainte>(
    `SELECT c.conname, c.contype::text AS contype, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'EvidenceSnapshot' AND c.contype = 'p'`,
  );
  const prerequisPk = prerequis.some((c) => c.def === "PRIMARY KEY (id)");

  const colonnes = await run.query<Colonne>(
    `SELECT column_name, data_type, is_nullable, column_default, identity_generation
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [TABLE],
  );
  if (colonnes.length === 0) {
    return { prerequisPk, colonnes: [], contraintes: [], index: [], triggers: [], lignes: null };
  }

  // `contype <> 'n'` : PostgreSQL 18 expose les NOT NULL comme contraintes dans
  // pg_constraint, 17 (la prod, 17.11) ne le fait pas. La nullabilité est
  // vérifiée par information_schema.columns ; ici on ne compte que PK, CHECK, FK.
  // Blancs normalisés (`\s+` → ' ') : le CHECK conditionnel est rendu sur
  // plusieurs lignes ; les autres formes attendues n'en contiennent pas.
  const contraintes = await run.query<Contrainte>(
    `SELECT c.conname, c.contype::text AS contype, regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g') AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1 AND c.contype <> 'n'
      ORDER BY c.conname`,
    [TABLE],
  );
  const index = await run.query<Index>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname`,
    [TABLE],
  );
  const triggers = await run.query<Trigger>(
    `SELECT t.tgname, pg_get_triggerdef(t.oid) AS def, t.tgenabled::text AS tgenabled
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND NOT t.tgisinternal
      ORDER BY t.tgname`,
    [TABLE],
  );
  // Une table qui porte déjà des lignes au moment de la pose ne serait pas la
  // table qu'on croit avoir créée. Après la première ligne, ce compte est une
  // information, pas un écart.
  const [{ n }] = await run.query<{ n: number | bigint }>(`SELECT count(*)::int AS n FROM evidence_provenance_journal`);

  return { prerequisPk, colonnes, contraintes, index, triggers, lignes: Number(n) };
}

/** PURE. Compare l'introspection au DDL livré et NOMME chaque écart. */
export function comparer(intro: Introspection): Verdict {
  const ecarts: string[] = [];
  if (!intro.prerequisPk) {
    ecarts.push('PRÉREQUIS ABSENT : aucune PRIMARY KEY (id) sur "EvidenceSnapshot" — la FK vers l\'identité gouvernée n\'est pas posable');
  }
  if (intro.lignes === null) {
    return { code: 2, etat: "ABSENTE", ecarts, introspection: intro };
  }

  // ── Colonnes : nom, type, nullabilité, défaut, identité ─────────────────
  const reelles = new Map(intro.colonnes.map((c) => [c.column_name, c]));
  for (const [nom, type, nullable, defaut] of COLONNES_ATTENDUES) {
    const r = reelles.get(nom);
    if (!r) { ecarts.push(`colonne ABSENTE : ${nom}`); continue; }
    if (r.data_type !== type) ecarts.push(`type divergent : ${nom} — attendu ${type}, réel ${r.data_type}`);
    if (r.is_nullable !== nullable) ecarts.push(`nullabilité divergente : ${nom} — attendu ${nullable}, réel ${r.is_nullable}`);
    if (defaut === null && r.column_default !== null) {
      // declared_at / verified_at : un DEFAULT fabriquerait une date que personne n'a déclarée.
      const gravite = nom === "declared_at" || nom === "verified_at" ? "défaut INTERDIT (donnée déclarée, pas une horloge)" : "défaut INATTENDU";
      ecarts.push(`${gravite} : ${nom} — réel ${r.column_default}`);
    }
    if (defaut !== null && !(r.column_default ?? "").match(defaut)) ecarts.push(`défaut divergent : ${nom} — attendu ${defaut}, réel ${r.column_default}`);
    reelles.delete(nom);
  }
  for (const nom of reelles.keys()) ecarts.push(`colonne INATTENDUE : ${nom}`);
  const id = intro.colonnes.find((c) => c.column_name === "id");
  if (id && id.identity_generation !== "ALWAYS") ecarts.push(`id : attendu GENERATED ALWAYS AS IDENTITY, réel ${id.identity_generation ?? "aucune identité"}`);

  // ── Contraintes : PK, CHECK (domaines fermés + cohérences), FK ──────────
  const parNom = new Map(intro.contraintes.map((c) => [c.conname, c]));
  for (const [nom, type, forme] of CONTRAINTES_ATTENDUES) {
    const r = parNom.get(nom);
    if (!r) { ecarts.push(`contrainte ABSENTE : ${nom}`); continue; }
    if (r.contype !== type) ecarts.push(`contrainte ${nom} : type attendu ${type}, réel ${r.contype}`);
    if (!forme.test(r.def)) ecarts.push(`contrainte ${nom} : forme divergente — réel ${r.def}`);
    parNom.delete(nom);
  }
  // Une contrainte de plus n'est pas anodine : un CHECK ajouté à la main
  // élargit ou rétrécit un domaine sans passer par le DDL livré.
  for (const [nom, c] of parNom) ecarts.push(`contrainte INATTENDUE : ${nom} — ${c.def}`);

  // ── Index : la relecture « dernier état connu » ─────────────────────────
  const idx = new Map(intro.index.map((i) => [i.indexname, i.indexdef]));
  for (const [nom, forme] of INDEX_ATTENDUS) {
    const d = idx.get(nom);
    if (!d) { ecarts.push(`index ABSENT : ${nom}`); continue; }
    if (!forme.test(d)) ecarts.push(`index ${nom} : forme divergente — réel ${d}`);
    idx.delete(nom);
  }
  for (const nom of idx.keys()) ecarts.push(`index INATTENDU : ${nom}`);

  // ── Triggers append-only : le DDL SUPPLÉMENTAIRE ────────────────────────
  const trg = new Map(intro.triggers.map((t) => [t.tgname, t]));
  for (const [nom, forme] of TRIGGERS_ATTENDUS) {
    const t = trg.get(nom);
    if (!t) { ecarts.push(`APPEND-ONLY non exécutable : trigger ABSENT ${nom} (DDL supplémentaire, section marquée du fichier)`); continue; }
    if (!forme.test(t.def)) ecarts.push(`trigger ${nom} : forme divergente — réel ${t.def}`);
    // tgenabled : 'O' = origin (actif). 'D' = DISABLE TRIGGER ; 'R'/'A' = replica/always.
    if (t.tgenabled !== "O") ecarts.push(`APPEND-ONLY non exécutable : trigger ${nom} DÉSACTIVÉ (tgenabled = ${t.tgenabled}, attendu O)`);
    trg.delete(nom);
  }
  for (const nom of trg.keys()) ecarts.push(`trigger INATTENDU : ${nom}`);

  return ecarts.length === 0
    ? { code: 0, etat: "CONFORME", ecarts, introspection: intro }
    : { code: 3, etat: "ECARTS", ecarts, introspection: intro };
}

export async function verifier(run: Runner): Promise<Verdict> {
  return comparer(await introspecter(run));
}

// ─── Le point d'entrée : PRODUCTION, lecture seule ─────────────────────────
async function main(): Promise<number> {
  const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { config } = await import("dotenv");
  config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });
  const AS_JSON = process.argv.includes("--json");

  if (!process.env.DATABASE_URL) {
    console.error("UNABLE : DATABASE_URL absente.");
    return 1;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const run: Runner = {
    query: async <T,>(sql: string, params: readonly unknown[] = []) => prisma.$queryRawUnsafe<T[]>(sql, ...params),
  };

  try {
    const v = await verifier(run);
    const i = v.introspection;

    if (v.etat === "ABSENTE") {
      if (AS_JSON) {
        console.log(JSON.stringify({ table: TABLE, etat: "ABSENTE", prerequisPk: i.prerequisPk, ecarts: v.ecarts }, null, 2));
      } else {
        console.error(
          `ABSENTE : la table \`${TABLE}\` n'existe pas dans la base visée.\n` +
          `          DDL : ${DDL}\n` +
          "          À coller dans l'éditeur SQL Neon, après snapshot de branche.\n" +
          `          prérequis FK (PRIMARY KEY (id) sur "EvidenceSnapshot") : ${i.prerequisPk ? "PRÉSENT" : "ABSENT"}`,
        );
      }
      return 2;
    }

    if (AS_JSON) {
      console.log(JSON.stringify({
        table: TABLE, colonnes: i.colonnes.length,
        contraintes: i.contraintes.map((c) => c.conname), index: i.index.map((x) => x.indexname),
        triggers: i.triggers.map((t) => t.tgname), lignes: i.lignes, prerequisPk: i.prerequisPk, ecarts: v.ecarts,
      }, null, 2));
    } else {
      console.log(`\nTABLE ${TABLE} — ${i.colonnes.length} colonnes, ${i.lignes} ligne(s)`);
      console.log(`contraintes : ${i.contraintes.map((c) => c.conname).join(", ")}`);
      console.log(`index       : ${i.index.map((x) => x.indexname).join(", ")}`);
      console.log(`triggers    : ${i.triggers.map((t) => `${t.tgname} (tgenabled=${t.tgenabled})`).join(", ") || "aucun"}`);
      if (v.code === 0) {
        console.log("\n✅ CONFORME au DDL livré (amendé 4a/4b/5) — colonnes, types, nullabilité, défauts (aucun sur declared_at/verified_at), PK, CHECK (sans UNKNOWN), FK, index, triggers activés.");
      } else {
        console.log(`\n❌ ${v.ecarts.length} ÉCART(S) :`);
        for (const e of v.ecarts) console.log(`  · ${e}`);
      }
      console.log("");
    }
    return v.code;
  } finally {
    await prisma.$disconnect();
  }
}

const lanceDirectement = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (lanceDirectement) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => { console.error(err); process.exit(1); });
}
