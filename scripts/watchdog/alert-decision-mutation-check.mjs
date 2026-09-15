// ─── LE DÉCIDEUR — le harnais sait-il seulement échouer ? ──────────────────
//
//   node scripts/watchdog/alert-decision-mutation-check.mjs
//
// Un harnais qui ne sait pas échouer ne mesure pas. Ce script RÉINTRODUIT, un
// par un, les défauts exacts que `alertDecision.ts` ne doit pas avoir, et exige
// que la suite rougisse à chaque fois.
//
// Deux familles de mutants, parce que deux choses décident du silence :
//
//   LA COMPARAISON — `>` vs `>=` vs `<`, et le `||` de `(lastAlertAt || 0)`.
//     Le passage de `>` à `>=` est le plus intéressant : c'est une des formes
//     que prendrait la CORRECTION du défaut de conception. Il doit rougir —
//     non pas parce qu'il serait mauvais, mais parce qu'aucune fenêtre
//     d'observabilité n'a le droit de le livrer en douce.
//
//   LA FENÊTRE — 24h vs 12h vs 48h. Elle vaut la période du cron launchd ; ce
//     test-là est le constat rendu exécutable.
//
// ─── Sécurité du harnais ──────────────────────────────────────────────────
//
// Le fichier muté est restauré dans un `finally`, avec vérification sha256. Si
// la restauration échoue, le script le dit et sort en erreur : mieux vaut un
// rouge bruyant qu'un décideur laissé muté sur le disque.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const CIBLE = "src/lib/watchdog/alertDecision.ts";
const TESTS = [
  "src/lib/watchdog/__tests__/alertDecision.test.ts",
  "src/lib/watchdog/__tests__/runJournal.test.ts",
];

const ENV = {
  ...process.env,
  DATABASE_URL: "postgresql://ci:ci@db.invalid:5432/none?sslmode=disable",
  ADMIN_TOKEN: "ci-not-a-secret",
  VAULT_AUDIT_SALT: "ci-not-a-secret",
  ADMIN_BASIC_USER: "ci",
  ADMIN_BASIC_PASS: "ci-not-a-secret",
};

/** { nom, de, vers } — `de` doit être présent EXACTEMENT UNE FOIS. */
const MUTANTS = [
  // ── La comparaison ──────────────────────────────────────────────────────
  {
    nom: "comparaison `>` → `>=` (la correction non autorisée du défaut)",
    de: "const stale = deltaMs > realertWindowMs;",
    vers: "const stale = deltaMs >= realertWindowMs;",
  },
  {
    nom: "comparaison `>` → `<` (inversion franche)",
    de: "const stale = deltaMs > realertWindowMs;",
    vers: "const stale = deltaMs < realertWindowMs;",
  },
  {
    nom: "comparaison neutralisée : `stale` toujours faux",
    de: "const stale = deltaMs > realertWindowMs;",
    vers: "const stale = false;",
  },
  {
    nom: "`(lastAlertAt || 0)` → `?? 0` (le NaN cesse de retomber sur 0)",
    de: "const deltaMs = input.now - (input.state.lastAlertAt || 0);",
    vers: "const deltaMs = input.now - (input.state.lastAlertAt ?? 0);",
  },
  {
    nom: "signature : `!==` → `===` (changed inversé)",
    de: "const changed = input.signature !== input.state.lastSignature;",
    vers: "const changed = input.signature === input.state.lastSignature;",
  },
  // ── La branche ──────────────────────────────────────────────────────────
  {
    nom: "branche `changed || stale` → `changed && stale`",
    de: "const send = changed || stale;",
    vers: "const send = changed && stale;",
  },
  {
    nom: "branche `changed || stale` → `changed` seul (la fenêtre ne sert plus)",
    de: "const send = changed || stale;",
    vers: "const send = changed;",
  },
  // ── La fenêtre ──────────────────────────────────────────────────────────
  {
    nom: "fenêtre 24h → 48h (élargie : deux fois plus de silence)",
    de: "export const REALERT_WINDOW_MS = 24 * 3_600_000;",
    vers: "export const REALERT_WINDOW_MS = 48 * 3_600_000;",
  },
  {
    nom: "fenêtre 24h → 12h (rétrécie : elle ne vaut plus la cadence du cron)",
    de: "export const REALERT_WINDOW_MS = 24 * 3_600_000;",
    vers: "export const REALERT_WINDOW_MS = 12 * 3_600_000;",
  },
  {
    nom: "fenêtre 24h → 0 (l'anti-spam disparaît)",
    de: "export const REALERT_WINDOW_MS = 24 * 3_600_000;",
    vers: "export const REALERT_WINDOW_MS = 0;",
  },
];

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function suiteEstVerte() {
  try {
    execSync(`npx vitest run ${TESTS.join(" ")}`, { env: ENV, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const original = readFileSync(CIBLE, "utf8");
const shaAvant = sha(CIBLE);
let echecs = 0;

try {
  console.log("# Le décideur du watchdog — le harnais sait-il échouer ?\n");

  if (!suiteEstVerte()) {
    console.error("❌ La suite est ROUGE avant toute mutation. Rien à prouver.");
    process.exit(1);
  }
  console.log(`✅ référence VERTE — ${TESTS.length} fichiers de test passent\n`);

  for (const m of MUTANTS) {
    const occurrences = original.split(m.de).length - 1;
    if (occurrences !== 1) {
      console.error(`❌ ${m.nom}\n   ancre trouvée ${occurrences} fois (attendu : 1). Mutant périmé.`);
      echecs++;
      continue;
    }
    writeFileSync(CIBLE, original.replace(m.de, m.vers));
    const vert = suiteEstVerte();
    writeFileSync(CIBLE, original);

    if (vert) {
      console.error(`❌ ${m.nom}\n   → la suite reste VERTE. Le mutant survit : rien ne le retient.`);
      echecs++;
    } else {
      console.log(`✅ ${m.nom}\n   → ROUGE`);
    }
  }
} finally {
  writeFileSync(CIBLE, original);
  if (sha(CIBLE) !== shaAvant) {
    console.error(`\n💥 RESTAURATION ÉCHOUÉE sur ${CIBLE}. Le fichier est MUTÉ sur le disque.`);
    process.exit(2);
  }
}

console.log(
  `\n${echecs === 0 ? "✅" : "❌"} ${MUTANTS.length - echecs}/${MUTANTS.length} mutants tués.`
);
process.exit(echecs === 0 ? 0 : 1);
