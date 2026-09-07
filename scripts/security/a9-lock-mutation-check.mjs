// ─── A9 — LE VERROU TIENT-IL ENCORE ? ──────────────────────────────────────
//
//   node scripts/security/a9-lock-mutation-check.mjs
//
// Stabiliser un test peut le vider. Ce harnais prouve le contraire : il
// RÉINTRODUIT la mauvaise cible de migration dans les deux schemas, un par un,
// et exige que le test rougisse à chaque fois.
//
// Un budget d'exécution n'est pas une garantie. Allonger le premier ne retire
// rien à la seconde — mais cela se démontre, ça ne se déclare pas.
//
// ─── Sécurité du harnais ───────────────────────────────────────────────────
//
// `prisma/` est un chemin GELÉ. Ce script y écrit TRANSITOIREMENT, jamais en
// vue d'un commit, et restaure dans un `finally` avec vérification sha256. Si
// la restauration échoue, il le dit et sort en erreur : mieux vaut un rouge
// bruyant qu'un schema laissé muté.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const TEST = "__tests__/security/prisma-migrate-target-lock.test.ts";
const SCHEMAS = ["prisma/schema.prod.prisma", "prisma/schema.prisma"];

/** Le verrou : une variable qui n'existe nulle part et ne doit jamais être posée. */
const VERROU = 'directUrl = env("PRISMA_MIGRATE_INTENTIONNELLEMENT_DESACTIVE_VOIR_CLAUDE_MD")';
/** La mauvaise cible historique : ep-bold-sky, la base de production. */
const MAUVAISE_CIBLE = 'directUrl = env("DATABASE_URL_UNPOOLED")';

const ENV = {
  ...process.env,
  DATABASE_URL: "postgresql://ci:ci@db.invalid:5432/none?sslmode=disable",
  ADMIN_TOKEN: "ci-not-a-secret",
  VAULT_AUDIT_SALT: "ci-not-a-secret",
  ADMIN_BASIC_USER: "ci",
  ADMIN_BASIC_PASS: "ci-not-a-secret",
};

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function testEstVert() {
  try {
    execSync(`npx vitest run ${TEST}`, { env: ENV, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const original = Object.fromEntries(SCHEMAS.map((p) => [p, readFileSync(p, "utf8")]));
const shaAvant = Object.fromEntries(SCHEMAS.map((p) => [p, sha(p)]));

let echecs = 0;

try {
  console.log("# A9 — le verrou de cible de migration\n");

  // ── Référence ────────────────────────────────────────────────────────────
  if (!testEstVert()) {
    console.error("❌ Le test est ROUGE avant toute mutation. Rien à prouver.");
    process.exit(1);
  }
  console.log("✅ référence verte — le verrou est en place et le test passe\n");

  // ── Un schema à la fois ──────────────────────────────────────────────────
  for (const p of SCHEMAS) {
    if (!original[p].includes(VERROU)) {
      console.error(`❌ ${p} — le verrou est introuvable. Mutant périmé.`);
      echecs++;
      continue;
    }
    writeFileSync(p, original[p].replace(VERROU, MAUVAISE_CIBLE));
    const vert = testEstVert();
    writeFileSync(p, original[p]);

    if (vert) {
      console.error(
        `❌ ${p} — MUTANT SURVIVANT : la cible de migration repointe sur\n` +
          "   DATABASE_URL_UNPOOLED (ep-bold-sky, la production) et le test reste VERT.\n" +
          "   Le verrou ne serait plus vérifié par rien.",
      );
      echecs++;
    } else {
      console.log(`✅ ${p} — la mauvaise cible fait ROUGIR le test.`);
    }
  }
} finally {
  for (const p of SCHEMAS) {
    writeFileSync(p, original[p]);
    if (sha(p) !== shaAvant[p]) {
      console.error(`❌ RESTAURATION INCOMPLÈTE de ${p} — NE PAS COMMITTER en l'état.`);
      echecs++;
    }
  }
}

console.log(
  echecs === 0
    ? "\n✅ Le verrou tient. Le test rougit sur une mauvaise cible, les deux schemas\n" +
        "   sont restaurés à l'octet près — allonger le budget n'a rien retiré."
    : `\n❌ ${echecs} échec(s).`,
);
process.exit(echecs === 0 ? 0 : 1);
