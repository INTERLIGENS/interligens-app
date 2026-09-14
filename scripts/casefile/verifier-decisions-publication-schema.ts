#!/usr/bin/env tsx
/**
 * VÉRIFICATION DU DDL `casefile_claim_publication_decisions` — LECTURE SEULE.
 *
 * ██  Un message de commit sur l'état de la base n'est pas une source de   ██
 * ██  vérité. On interroge information_schema et pg_catalog.               ██
 *
 * USAGE
 *     npx tsx scripts/casefile/verifier-decisions-publication-schema.ts [--json]
 *
 * SORTIE
 *     0  CONFORME au DDL livré — colonnes, types, nullabilité, défauts, PK,
 *        CHECK, FK, index, triggers append-only
 *     2  ABSENTE — la table n'existe pas (à lancer AVANT la pose : c'est la
 *        réponse attendue)
 *     3  ÉCARTS nommés
 *     1  UNABLE (pas de DATABASE_URL, erreur réseau)
 *
 * CE SCRIPT N'APPLIQUE RIEN. Aucun CREATE, ALTER, INSERT, DROP. Le DDL est
 * docs/prep/MIGRATION_DECISIONS_PUBLICATION_CLAIM_2026-09-14.sql, à coller
 * dans l'éditeur SQL Neon. Le verrou A9 arrête de toute façon `prisma migrate`
 * sur P1012 avant tout accès réseau.
 *
 * Il vérifie aussi le PRÉREQUIS de la FK composite — l'unique
 * ("casefileRef","claimId",version) sur "CaseFileClaim" — parce que sans lui la
 * contrainte « aucun GRANT sur une version inexistante » n'est pas posable.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");
const TABLE = "casefile_claim_publication_decisions";
const DDL = "docs/prep/MIGRATION_DECISIONS_PUBLICATION_CLAIM_2026-09-14.sql";
const prisma = new PrismaClient();

/** La structure ATTENDUE — dérivée du DDL livré : nom, type, nullabilité, défaut (null = aucun). */
const COLONNES_ATTENDUES: ReadonlyArray<readonly [string, string, "NO" | "YES", RegExp | null]> = [
  ["id", "bigint", "NO", null], // IDENTITY : pas de column_default, identity_generation = ALWAYS
  ["casefile_ref", "text", "NO", null],
  ["claim_id", "text", "NO", null],
  ["claim_version", "integer", "NO", null],
  ["audience", "text", "NO", null],
  ["decision", "text", "NO", null],
  ["decided_by", "text", "NO", null],
  ["decided_at", "timestamp with time zone", "NO", null], // PAS de défaut, à dessein
  ["recorded_at", "timestamp with time zone", "NO", /^now\(\)$/],
  // T1-CAUSE-ET-REVOKE-REEL — posée à la main le 2026-09-14 (décision GPT 1) :
  // nullable, SANS défaut. Le vocabulaire et la cohérence GRANT/REVOKE sont
  // deux CHECK ci-dessous. Pas de `basis` libre : décision GPT 2, NO-GO.
  ["cause", "text", "YES", null],
];

/**
 * Les contraintes ATTENDUES, par nom et par forme. Postgres RÉÉCRIT les CHECK
 * (`IN ('A','B')` devient `= ANY (ARRAY['A'::text, 'B'::text])`, `IN ('A')`
 * devient `= 'A'::text`) : on compare donc à un motif tolérant aux deux formes,
 * et on exige les LITTÉRAUX du domaine — ni un de plus, ni un de moins.
 */
const CONTRAINTES_ATTENDUES: ReadonlyArray<readonly [string, "p" | "c" | "f", RegExp]> = [
  [`${TABLE}_pkey`, "p", /^PRIMARY KEY \(id\)$/],
  [`${TABLE}_audience_check`, "c", /^CHECK \(\(audience = 'PUBLIC'::text\)\)$/],
  [`${TABLE}_decision_check`, "c", /^CHECK \(\(decision = ANY \(ARRAY\['GRANT'::text, 'REVOKE'::text\]\)\)\)$/],
  [`${TABLE}_decided_by_check`, "c", /^CHECK \(\(\(decided_by <> ''::text\) AND \(btrim\(decided_by\) = decided_by\)\)\)$/],
  // Le vocabulaire des causes : UN littéral aujourd'hui. `IN ('A')` est rendu `= 'A'::text`.
  [`${TABLE}_cause_vocabulaire`, "c", /^CHECK \(\(cause = 'INSUFFICIENT_SOURCE_PROVENANCE'::text\)\)$/],
  // La cohérence : un GRANT n'a pas de cause, un REVOKE en a toujours une.
  [`${TABLE}_cause_coherence`, "c", /^CHECK \(\(\(\(decision = 'GRANT'::text\) AND \(cause IS NULL\)\) OR \(\(decision = 'REVOKE'::text\) AND \(cause IS NOT NULL\)\)\)\)$/],
  [
    `${TABLE}_target_fkey`, "f",
    /^FOREIGN KEY \(casefile_ref, claim_id, claim_version\) REFERENCES "CaseFileClaim"\("casefileRef", "claimId", version\) ON UPDATE RESTRICT ON DELETE RESTRICT$/,
  ],
];

const INDEX_ATTENDUS: ReadonlyArray<readonly [string, RegExp]> = [
  [`${TABLE}_pkey`, /USING btree \(id\)$/],
  [`${TABLE}_target_idx`, /USING btree \(casefile_ref, claim_id, claim_version, audience, id DESC\)$/],
];

/**
 * Le DDL SUPPLÉMENTAIRE (append-only). Son absence est un écart NOMMÉ comme tel.
 * Postgres réécrit `UPDATE OR DELETE` en `DELETE OR UPDATE` dans pg_get_triggerdef
 * (mesuré en rejeu PGlite) : on compare à la forme RENDUE, pas à la forme écrite.
 */
const TRIGGERS_ATTENDUS: ReadonlyArray<readonly [string, RegExp]> = [
  [`${TABLE}_no_rewrite`, /BEFORE DELETE OR UPDATE ON public\.casefile_claim_publication_decisions FOR EACH ROW EXECUTE FUNCTION casefile_claim_publication_decisions_append_only\(\)$/],
  [`${TABLE}_no_truncate`, /BEFORE TRUNCATE ON public\.casefile_claim_publication_decisions FOR EACH STATEMENT EXECUTE FUNCTION casefile_claim_publication_decisions_append_only\(\)$/],
];

interface Colonne { column_name: string; data_type: string; is_nullable: string; column_default: string | null; identity_generation: string | null }
interface Contrainte { conname: string; contype: string; def: string }
interface Index { indexname: string; indexdef: string }
interface Trigger { tgname: string; tgenabled: string; def: string }
interface Ligne { id: string; decision: string; cause: string | null; decided_by: string }

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("UNABLE : DATABASE_URL absente.");
    return 1;
  }

  const ecarts: string[] = [];

  // ── PRÉREQUIS : l'unique composite sur la table référencée ──────────────
  const prerequis = await prisma.$queryRaw<Contrainte[]>`
    SELECT c.conname, c.contype::text AS contype, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = 'CaseFileClaim' AND c.contype = 'u'`;
  const uniqueCible = prerequis.find((c) => c.def === 'UNIQUE ("casefileRef", "claimId", version)');
  if (!uniqueCible) {
    ecarts.push('PRÉREQUIS ABSENT : aucun UNIQUE ("casefileRef","claimId",version) sur "CaseFileClaim" — la FK composite n\'est pas posable');
  }

  // ── La table ────────────────────────────────────────────────────────────
  const colonnes = await prisma.$queryRaw<Colonne[]>`
    SELECT column_name, data_type, is_nullable, column_default, identity_generation
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ${TABLE}
     ORDER BY ordinal_position`;

  if (colonnes.length === 0) {
    if (AS_JSON) {
      console.log(JSON.stringify({ table: TABLE, etat: "ABSENTE", prerequisUnique: !!uniqueCible, ecarts }, null, 2));
    } else {
      console.error(
        `ABSENTE : la table \`${TABLE}\` n'existe pas dans la base visée.\n` +
        `          DDL : ${DDL}\n` +
        "          À coller dans l'éditeur SQL Neon, après snapshot de branche.\n" +
        `          prérequis FK (unique composite sur "CaseFileClaim") : ${uniqueCible ? "PRÉSENT" : "ABSENT"}`,
      );
    }
    return 2;
  }

  // `contype <> 'n'` : PostgreSQL 18 expose les NOT NULL comme contraintes dans
  // pg_constraint, 17 (la prod) ne le fait pas. La nullabilité est vérifiée par
  // information_schema.columns ci-dessus ; ici on ne compte que PK, CHECK, FK.
  const contraintes = await prisma.$queryRaw<Contrainte[]>`
    SELECT c.conname, c.contype::text AS contype, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = ${TABLE} AND c.contype <> 'n'
     ORDER BY c.conname`;
  const index = await prisma.$queryRaw<Index[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${TABLE} ORDER BY indexname`;
  const triggers = await prisma.$queryRaw<Trigger[]>`
    SELECT t.tgname, t.tgenabled::text AS tgenabled, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ${TABLE} AND NOT t.tgisinternal
     ORDER BY t.tgname`;

  // ── Colonnes : nom, type, nullabilité, défaut, identité ─────────────────
  const reelles = new Map(colonnes.map((c) => [c.column_name, c]));
  for (const [nom, type, nullable, defaut] of COLONNES_ATTENDUES) {
    const r = reelles.get(nom);
    if (!r) { ecarts.push(`colonne ABSENTE : ${nom}`); continue; }
    if (r.data_type !== type) ecarts.push(`type divergent : ${nom} — attendu ${type}, réel ${r.data_type}`);
    if (r.is_nullable !== nullable) ecarts.push(`nullabilité divergente : ${nom} — attendu ${nullable}, réel ${r.is_nullable}`);
    if (defaut === null && r.column_default !== null) ecarts.push(`défaut INATTENDU : ${nom} — réel ${r.column_default}`);
    if (defaut !== null && !(r.column_default ?? "").match(defaut)) ecarts.push(`défaut divergent : ${nom} — attendu ${defaut}, réel ${r.column_default}`);
    reelles.delete(nom);
  }
  for (const nom of reelles.keys()) ecarts.push(`colonne INATTENDUE : ${nom}`);
  const id = colonnes.find((c) => c.column_name === "id");
  if (id && id.identity_generation !== "ALWAYS") ecarts.push(`id : attendu GENERATED ALWAYS AS IDENTITY, réel ${id.identity_generation ?? "aucune identité"}`);

  // ── Contraintes : PK, CHECK (domaines fermés), FK composite ─────────────
  const parNom = new Map(contraintes.map((c) => [c.conname, c]));
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

  // ── Index : la relecture par l'exécuteur ────────────────────────────────
  const idx = new Map(index.map((i) => [i.indexname, i.indexdef]));
  for (const [nom, forme] of INDEX_ATTENDUS) {
    const d = idx.get(nom);
    if (!d) { ecarts.push(`index ABSENT : ${nom}`); continue; }
    if (!forme.test(d)) ecarts.push(`index ${nom} : forme divergente — réel ${d}`);
    idx.delete(nom);
  }
  for (const nom of idx.keys()) ecarts.push(`index INATTENDU : ${nom}`);

  // ── Triggers append-only : le DDL SUPPLÉMENTAIRE ────────────────────────
  const trg = new Map(triggers.map((t) => [t.tgname, t]));
  for (const [nom, forme] of TRIGGERS_ATTENDUS) {
    const t = trg.get(nom);
    if (!t) { ecarts.push(`APPEND-ONLY non exécutable : trigger ABSENT ${nom} (DDL supplémentaire, section marquée du fichier)`); continue; }
    if (!forme.test(t.def)) ecarts.push(`trigger ${nom} : forme divergente — réel ${t.def}`);
    // Un trigger présent mais DÉSACTIVÉ (ALTER TABLE … DISABLE TRIGGER) ne protège rien :
    // tgenabled 'O' = origin/local (actif), 'D' = disabled, 'R'/'A' = replica/always.
    if (t.tgenabled !== "O") ecarts.push(`trigger ${nom} : présent mais tgenabled = ${t.tgenabled} (attendu O = actif)`);
    trg.delete(nom);
  }
  for (const nom of trg.keys()) ecarts.push(`trigger INATTENDU : ${nom}`);

  // Une table qui porte déjà des lignes au moment de la pose ne serait pas la
  // table qu'on croit avoir créée. Après la première décision, ce compte est
  // une information, pas un écart.
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM casefile_claim_publication_decisions`;

  // ── Les lignes qui EXISTENT : la pose de la colonne n'a rien réécrit ──────
  // Les trois GRANT du 2026-09-14 (ids 16/17/18) doivent être là, GRANT, cause
  // NULL, decided_by intact. Toute ligne postérieure doit respecter la cohérence
  // (le CHECK le garantit ; on le MESURE quand même, ligne par ligne).
  const lignes = await prisma.$queryRaw<Ligne[]>`
    SELECT id::text AS id, decision, cause, decided_by FROM casefile_claim_publication_decisions ORDER BY id`;
  for (const id of ["16", "17", "18"]) {
    const l = lignes.find((x) => x.id === id);
    if (!l) { ecarts.push(`ligne ABSENTE : décision #${id} (GRANT du 2026-09-14)`); continue; }
    if (l.decision !== "GRANT") ecarts.push(`ligne #${id} : attendu GRANT, réel ${l.decision}`);
    if (l.cause !== null) ecarts.push(`ligne #${id} : cause attendue NULL, réelle ${l.cause}`);
    if (l.decided_by !== "David Douville") ecarts.push(`ligne #${id} : decided_by divergent — réel ${l.decided_by}`);
  }
  for (const l of lignes) {
    if (l.decision === "GRANT" && l.cause !== null) ecarts.push(`ligne #${l.id} : GRANT avec une cause (${l.cause})`);
    if (l.decision === "REVOKE" && l.cause !== "INSUFFICIENT_SOURCE_PROVENANCE") ecarts.push(`ligne #${l.id} : REVOKE sans cause du vocabulaire (${l.cause})`);
  }

  if (AS_JSON) {
    console.log(JSON.stringify({
      table: TABLE, colonnes: colonnes.length,
      contraintes: contraintes.map((c) => c.conname), index: [...index.map((i) => i.indexname)],
      triggers: triggers.map((t) => `${t.tgname}:${t.tgenabled}`), lignes: Number(n),
      decisions: lignes.map((l) => `${l.id}:${l.decision}:${l.cause ?? "∅"}`), prerequisUnique: !!uniqueCible, ecarts,
    }, null, 2));
  } else {
    console.log(`\nTABLE ${TABLE} — ${colonnes.length} colonnes, ${Number(n)} ligne(s)`);
    console.log(`contraintes : ${contraintes.map((c) => c.conname).join(", ")}`);
    console.log(`index       : ${index.map((i) => i.indexname).join(", ")}`);
    console.log(`triggers    : ${triggers.map((t) => `${t.tgname} (${t.tgenabled === "O" ? "actif" : t.tgenabled})`).join(", ") || "aucun"}`);
    console.log(`décisions   : ${lignes.map((l) => `#${l.id} ${l.decision}${l.cause ? "/" + l.cause : ""}`).join(", ") || "aucune"}`);
    if (ecarts.length === 0) {
      console.log("\n✅ CONFORME — colonnes (dont cause), types, nullabilité, défauts, PK, CHECK (dont vocabulaire et cohérence de la cause), FK, index, triggers actifs, lignes 16/17/18.");
    } else {
      console.log(`\n❌ ${ecarts.length} ÉCART(S) :`);
      for (const e of ecarts) console.log(`  · ${e}`);
    }
    console.log("");
  }
  return ecarts.length === 0 ? 0 : 3;
}

main()
  .then(async (code) => { await prisma.$disconnect(); process.exit(code); })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
