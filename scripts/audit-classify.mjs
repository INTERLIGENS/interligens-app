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
// Aucune dépendance : node:fs et node:child_process.
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

export function resume(lignes) {
  const t = {};
  for (const l of lignes) {
    t[l.portee] ??= {};
    t[l.portee][l.severite] = (t[l.portee][l.severite] ?? 0) + 1;
  }
  return t;
}

function main() {
  const fichier = process.argv.find((a) => a.endsWith(".json"));
  const strict = process.argv.includes("--fail-on-prod");
  const lignes = classer(auditJson(fichier), JSON.parse(readFileSync("package.json", "utf8")));
  const t = resume(lignes);

  console.log(`[audit] ${lignes.length} advisories\n`);
  console.log("  portée    " + SEVERITES.map((s) => s.padStart(9)).join(""));
  for (const portee of ["prod", "dev", "inconnu"]) {
    if (!t[portee]) continue;
    console.log("  " + portee.padEnd(10) + SEVERITES.map((s) => String(t[portee][s] ?? 0).padStart(9)).join(""));
  }

  const bloquantes = lignes.filter(
    (l) => l.portee === "prod" && (l.severite === "critical" || l.severite === "high")
  );
  console.log(`\n  atteignant le code livré, high+ : ${bloquantes.length}`);
  for (const b of bloquantes) {
    console.log(`    ${b.severite.padEnd(8)} ${b.module} (${b.lien}) via ${b.racines.join(", ")} — ${b.id}`);
  }
  if (bloquantes.length === 0) console.log("    aucune.");

  // Phase 1 : on MESURE, on ne bloque pas. `--fail-on-prod` existe pour la
  // phase 3, quand le check deviendra required.
  if (strict && bloquantes.length > 0) return 1;
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
