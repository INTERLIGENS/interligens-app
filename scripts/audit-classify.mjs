#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Dependency Audit — classement prod / dev / transitif.
//
// `pnpm audit` rend un verdict indistinct : 57 « high » sans dire lesquelles
// atteignent le code livré. Une faille dans une dépendance d'ESLint et une
// faille dans une dépendance de Next.js ne portent pas le même risque — la
// première ne s'exécute jamais en production.
//
// Ce script lit le JSON de `pnpm audit` et classe chaque advisory par la
// RACINE de ses chemins de dépendance : le premier segment après « . » est la
// dépendance directe qui l'introduit.
//
//   prod       la racine est dans "dependencies"     -> code livré
//   dev        la racine est dans "devDependencies"  -> outillage seul
//   inconnu    racine absente des deux               -> à regarder
//
// Et, orthogonalement : DIRECTE si le paquet vulnérable EST la racine,
// TRANSITIVE sinon — parce qu'une transitive se corrige rarement seule.
//
// ── LE VERDICT BLOQUANT ──────────────────────────────────────────────────────
//
// `pnpm audit --audit-level=moderate` rendait un verdict INEXPLOITABLE : rouge
// en permanence sur 112 advisories historiques, dont l'écrasante majorité vit
// dans l'outillage. Un garde qui est rouge quoi qu'il arrive ne dit plus rien —
// une régression NOUVELLE y serait indiscernable du bruit de fond.
//
// Le verdict est donc porté par le MÊME cliquet que la dette de lint :
// `compare()` de scripts/ratchet-check.mjs, importé tel quel, sans variante.
// La doctrine ne change pas — seul le corpus comparé change :
//
//   lint   eslint-suppressions.json  { fichier: { règle:    { count } } }
//   audit  audit-baseline.json       { module:  { GHSA-id:  { count } } }
//
// La baseline historique ACCEPTÉE reste acceptée. Toute advisory qui n'y figure
// PAS et qui atteint le code livré en high/critical est de la dette NEUVE : elle
// bloque. C'est la règle « couple NEUF » du cliquet, appliquée aux advisories.
//
// PÉRIMÈTRE DU BLOCAGE : prod × (critical|high) — exactement la définition de
// `bloquantes` qui existait déjà ici. Le reste (dev, inconnu, moderate, low)
// reste MESURÉ et imprimé à chaque run, jamais masqué, mais ne bloque pas :
// une faille dans une dépendance d'ESLint ne s'exécute pas en production.
//
// RÉGÉNÉRER la baseline (après un correctif, ou pour accepter une dette avec
// une justification écrite dans la PR) :
//   node scripts/audit-classify.mjs --write-baseline
// Le fichier est versionné : l'acceptation se lit dans le diff, par un humain.
//
// Aucune dépendance : node:fs et node:child_process.
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { compare, total } from "./ratchet-check.mjs";

export const BASELINE_FILE = "audit-baseline.json";

const SEVERITES = ["critical", "high", "moderate", "low", "info"];

function auditJson(fichier) {
  if (fichier) return JSON.parse(readFileSync(fichier, "utf8"));
  try {
    return JSON.parse(execSync("pnpm audit --json", { encoding: "utf8", maxBuffer: 64e6 }));
  } catch (e) {
    // `pnpm audit` sort non-zéro DÈS QU'il trouve quelque chose : sa sortie
    // reste exploitable. Ne pas la jeter avec le code de retour.
    const out = e.stdout?.toString() ?? "";
    if (!out.trim()) throw e;
    return JSON.parse(out);
  }
}

/** Racine d'un chemin « .>eslint>minimatch » -> « eslint ». */
export function racine(chemin) {
  const parts = String(chemin).split(">");
  return parts[0] === "." ? parts[1] : parts[0];
}

export function classer(audit, pkg) {
  const prod = new Set(Object.keys(pkg.dependencies ?? {}));
  const dev = new Set(Object.keys(pkg.devDependencies ?? {}));
  const lignes = [];

  for (const a of Object.values(audit.advisories ?? {})) {
    const racines = new Set();
    for (const f of a.findings ?? []) for (const p of f.paths ?? []) racines.add(racine(p));
    const atteintProd = [...racines].some((r) => prod.has(r));
    const connu = [...racines].some((r) => prod.has(r) || dev.has(r));
    lignes.push({
      module: a.module_name,
      severite: a.severity,
      portee: atteintProd ? "prod" : connu ? "dev" : "inconnu",
      lien: racines.has(a.module_name) ? "directe" : "transitive",
      racines: [...racines].sort(),
      id: a.github_advisory_id ?? a.id,
    });
  }
  return lignes;
}

/** Les advisories qui portent le verdict : livrées ET high/critical. */
export function bloquantes(lignes) {
  return lignes.filter((l) => l.portee === "prod" && (l.severite === "critical" || l.severite === "high"));
}

/**
 * Projette des advisories dans la forme que `compare()` sait lire :
 * { module: { GHSA-id: { count } } }. Le `count` vaut toujours 1 — une
 * advisory est présente ou absente, elle ne s'accumule pas. La règle utile du
 * cliquet est donc « couple NEUF », et la règle de total suit gratuitement.
 */
export function versBaseline(lignes) {
  const map = {};
  for (const l of lignes) {
    (map[l.module] ??= {})[String(l.id)] = { count: 1 };
  }
  return map;
}

export function resume(lignes) {
  const t = {};
  for (const l of lignes) {
    t[l.portee] ??= {};
    t[l.portee][l.severite] = (t[l.portee][l.severite] ?? 0) + 1;
  }
  return t;
}

/** Baseline versionnée. Absente = première passe, rien à opposer. */
function lireBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, "utf8") || "{}");
  } catch {
    return null;
  }
}

function main() {
  const fichier = process.argv.find((a) => a.endsWith(".json") && !a.endsWith(BASELINE_FILE));
  const strict = process.argv.includes("--fail-on-prod");
  const cliquet = process.argv.includes("--fail-on-new");
  const ecrire = process.argv.includes("--write-baseline");
  const lignes = classer(auditJson(fichier), JSON.parse(readFileSync("package.json", "utf8")));
  const t = resume(lignes);

  console.log(`[audit] ${lignes.length} advisories\n`);
  console.log("  portée    " + SEVERITES.map((s) => s.padStart(9)).join(""));
  for (const portee of ["prod", "dev", "inconnu"]) {
    if (!t[portee]) continue;
    console.log("  " + portee.padEnd(10) + SEVERITES.map((s) => String(t[portee][s] ?? 0).padStart(9)).join(""));
  }

  const livrees = bloquantes(lignes);
  console.log(`\n  atteignant le code livré, high+ : ${livrees.length}`);
  for (const b of livrees) {
    console.log(`    ${b.severite.padEnd(8)} ${b.module} (${b.lien}) via ${b.racines.join(", ")} — ${b.id}`);
  }
  if (livrees.length === 0) console.log("    aucune.");

  const head = versBaseline(livrees);

  if (ecrire) {
    writeFileSync(BASELINE_FILE, JSON.stringify(head, null, 2) + "\n");
    console.log(`\n[audit] baseline réécrite : ${BASELINE_FILE} (${total(head)} advisories acceptées).`);
    console.log("[audit] versionnez-la et JUSTIFIEZ l'acceptation dans la description de la PR.");
    return 0;
  }

  // ── LE CLIQUET ────────────────────────────────────────────────────────────
  // Même mécanique que la dette de lint : la baseline peut rester, elle ne peut
  // pas grossir. Une advisory absente de la baseline est de la dette neuve.
  if (cliquet) {
    const base = lireBaseline();
    if (base === null) {
      console.log(`\n[audit] aucune baseline ${BASELINE_FILE} — première passe, rien à opposer.`);
      return 0;
    }
    const faults = compare(base, head);
    console.log(`\n[audit] cliquet : baseline ${total(base)} acceptées — mesuré ${total(head)}`);
    if (faults.length === 0) {
      console.log("[audit] ✅ aucune dette NEUVE atteignant le code livré.");
      return 0;
    }
    console.error(`[audit] ❌ ${faults.length} manquement(s) :`);
    for (const f of faults) console.error(`  - ${f}`);
    console.error(
      "\nLa dette d'audit atteignant le code livré est gelée : elle peut baisser,\n" +
        "jamais monter. Corrigez la dépendance (`pnpm update`, ou une résolution),\n" +
        "ou régénérez la baseline SI l'acceptation est justifiée :\n" +
        `  node scripts/audit-classify.mjs --write-baseline\n` +
        "et expliquez-la dans la description de la PR."
    );
    return 1;
  }

  // `--fail-on-prod` : le durcissement TOTAL (zéro advisory prod high+), qui
  // reste la cible de la phase 3. Il n'admet aucune baseline — d'où le cliquet
  // ci-dessus comme étape intermédiaire réellement bloquante.
  if (strict && livrees.length > 0) return 1;
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
