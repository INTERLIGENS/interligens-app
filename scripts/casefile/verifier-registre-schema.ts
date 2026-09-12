#!/usr/bin/env tsx
/**
 * VÉRIFICATION DU DDL `governed_objects` — LECTURE SEULE, ET RIEN D'AUTRE.
 *
 * ██  Un message de commit sur l'état de la base n'est pas une source de   ██
 * ██  vérité. On interroge information_schema.                             ██
 *
 * USAGE
 *     npx tsx scripts/casefile/verifier-registre-schema.ts [--json]
 *
 * CE SCRIPT N'APPLIQUE RIEN. Il ne contient aucun CREATE, aucun ALTER, aucun
 * INSERT, aucun DROP. Le DDL se colle dans l'ÉDITEUR SQL NEON — règle du
 * dépôt, et le verrou A9 arrête de toute façon `prisma migrate` sur P1012
 * avant tout accès réseau.
 *
 * Il compare la structure RÉELLE à la structure ATTENDUE, colonne par colonne,
 * et il NOMME chaque écart. Une vérification qui rendrait seulement « la table
 * existe » laisserait passer une colonne manquante, un type divergent, ou un
 * index absent — trois choses qui ne se voient qu'au premier échec en
 * production.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env.local"), quiet: true });

const AS_JSON = process.argv.includes("--json");
const prisma = new PrismaClient();

/** La structure ATTENDUE — dérivée du DDL livré, colonne par colonne. */
const COLONNES_ATTENDUES: ReadonlyArray<readonly [string, string, "NO" | "YES"]> = [
  ["id", "text", "NO"],
  ["bucket", "text", "NO"],
  ["storage_key", "text", "NO"],
  ["object_nature", "text", "NO"],
  ["provenance", "text", "NO"],
  ["authority_state", "text", "NO"],
  ["invalidation_state", "text", "NO"],
  ["invalidation_reason", "text", "YES"],
  ["invalidated_at", "timestamp with time zone", "YES"],
  ["invalidated_by", "text", "YES"],
  ["retention_class", "text", "NO"],
  ["subject", "text", "NO"],
  ["batch_id", "text", "YES"],
  // NULLABLES à dessein : une ligne née de l'OBSERVATION ne peut pas porter
  // une empreinte sans lire les octets. NULL = NON ÉTABLI — ni « inconnu donc
  // mauvais », ni « probablement identique ».
  ["sha256", "text", "YES"],
  ["size_bytes", "integer", "NO"],
  ["content_type", "text", "YES"],
  ["producer", "text", "NO"],
  ["allocated_at", "timestamp with time zone", "NO"],
  ["registered_at", "timestamp with time zone", "YES"],
  ["last_reconciled_at", "timestamp with time zone", "YES"],
  ["reconcile_note", "text", "YES"],
  ["updated_at", "timestamp with time zone", "NO"],
];

const INDEX_ATTENDUS = [
  "governed_objects_pkey",
  "governed_objects_bucket_key_uniq",
  "governed_objects_state_allocated_idx",
  "governed_objects_subject_idx",
  "governed_objects_sha256_idx",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("UNABLE : DATABASE_URL absente.");
    process.exit(1);
  }

  const colonnes = await prisma.$queryRaw<
    { column_name: string; data_type: string; is_nullable: string }[]
  >`SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_name = 'governed_objects'
     ORDER BY ordinal_position`;

  if (colonnes.length === 0) {
    console.error(
      "ABSENTE : la table `governed_objects` n'existe pas dans la base visée.\n" +
      "          DDL : docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql\n" +
      "          À coller dans l'éditeur SQL Neon, après snapshot de branche.",
    );
    await prisma.$disconnect();
    process.exit(2);
  }

  const index = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE tablename = 'governed_objects'`;
  const nomsIndex = index.map((i) => i.indexname).sort();

  const reelles = new Map(colonnes.map((c) => [c.column_name, c]));
  const ecarts: string[] = [];

  for (const [nom, type, nullable] of COLONNES_ATTENDUES) {
    const r = reelles.get(nom);
    if (!r) { ecarts.push(`colonne ABSENTE : ${nom}`); continue; }
    if (r.data_type !== type) ecarts.push(`type divergent : ${nom} — attendu ${type}, réel ${r.data_type}`);
    if (r.is_nullable !== nullable) {
      ecarts.push(`nullabilité divergente : ${nom} — attendu ${nullable}, réel ${r.is_nullable}`);
    }
    reelles.delete(nom);
  }
  for (const nom of reelles.keys()) ecarts.push(`colonne INATTENDUE : ${nom}`);
  for (const i of INDEX_ATTENDUS) {
    if (!nomsIndex.includes(i)) ecarts.push(`index ABSENT : ${i}`);
  }

  // Une table qui existe mais qui porte déjà des lignes au moment de la pose
  // ne serait pas la table qu'on croit avoir créée.
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM governed_objects`;

  if (AS_JSON) {
    console.log(JSON.stringify({
      table: "governed_objects", colonnes: colonnes.length,
      index: nomsIndex, lignes: Number(n), ecarts,
    }, null, 2));
  } else {
    console.log(`\nTABLE governed_objects — ${colonnes.length} colonnes, ${Number(n)} ligne(s)`);
    console.log(`index : ${nomsIndex.join(", ")}`);
    if (ecarts.length === 0) {
      console.log("\n✅ CONFORME au DDL livré — colonnes, types, nullabilité, index.");
    } else {
      console.log(`\n❌ ${ecarts.length} ÉCART(S) :`);
      for (const e of ecarts) console.log(`  · ${e}`);
    }
    console.log("");
  }

  await prisma.$disconnect();
  process.exit(ecarts.length === 0 ? 0 : 3);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
