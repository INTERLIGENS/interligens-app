#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// CI Ratchet — C0 Enforceability, phase 1.
//
// Compare DEUX BASELINES de suppressions ESLint : celle de la base de fusion et
// celle de la PR. Il ne relit JAMAIS la sortie d'ESLint — c'est le point du
// dispositif. Comparer des sorties de lint ferait dépendre le verdict de la
// version d'ESLint, de la config, de l'ordre des fichiers et du parallélisme.
// Comparer deux fichiers JSON versionnés ne dépend que du contenu du dépôt.
//
// DEUX RÈGLES, toutes deux nécessaires :
//   1. total(PR) <= total(base)          — la dette globale ne croît pas ;
//   2. aucun couple (fichier, règle) en hausse — la dette ne se DÉPLACE pas.
// La règle 2 seule laisserait passer une compensation ; la règle 1 seule
// laisserait déplacer 50 violations d'un fichier vers un autre à total constant.
//
// RENOMMAGES : `git diff --find-renames` fournit la correspondance. Sans elle,
// renommer un fichier chargé de dette se lirait comme la disparition d'un
// couple et l'apparition d'un couple neuf — donc un échec, sur un changement
// qui n'ajoute rien.
//
// Aucune dépendance : node:child_process, node:fs, et c'est tout.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const SUPPRESSIONS_FILE = "eslint-suppressions.json";

/** Somme des `count` de toutes les entrées d'une baseline. */
export function total(map) {
  return Object.values(map)
    .flatMap((rules) => Object.values(rules))
    .reduce((sum, v) => sum + (v?.count ?? 0), 0);
}

/**
 * Le cœur, pur et testable sans git.
 * @param {object} baseMap  baseline de la base de fusion
 * @param {object} headMap  baseline de la PR
 * @param {Map<string,string>} renames  ancien chemin -> nouveau chemin
 * @returns {string[]} les manquements ; vide = ratchet vert
 */
export function compare(baseMap, headMap, renames = new Map()) {
  const faults = [];
  const tBase = total(baseMap);
  const tHead = total(headMap);
  if (tHead > tBase) {
    faults.push(`TOTAL en hausse : ${tBase} -> ${tHead} (+${tHead - tBase})`);
  }

  // Un couple de la base a-t-il augmenté ? On suit le renommage éventuel.
  for (const [file, rules] of Object.entries(baseMap)) {
    const now = renames.get(file) ?? file;
    for (const [rule, v] of Object.entries(rules)) {
      const after = headMap[now]?.[rule]?.count ?? 0;
      if (after > v.count) {
        faults.push(`${now} :: ${rule} : ${v.count} -> ${after}`);
      }
    }
  }

  // Un couple ABSENT de la base est de la dette neuve, même si le total baisse.
  const reverse = new Map([...renames].map(([from, to]) => [to, from]));
  for (const [file, rules] of Object.entries(headMap)) {
    const before = reverse.get(file) ?? file;
    for (const [rule, v] of Object.entries(rules)) {
      if (baseMap[before]?.[rule] === undefined && v.count > 0) {
        faults.push(`${file} :: ${rule} : couple NEUF (+${v.count})`);
      }
    }
  }
  return faults;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Renommages entre `base` et HEAD, via --find-renames. */
export function renamesFrom(base) {
  const map = new Map();
  let out = "";
  try {
    out = git("diff", "--find-renames", "--diff-filter=R", "--name-status", `${base}...HEAD`);
  } catch {
    return map;
  }
  for (const line of out.split("\n")) {
    const [status, from, to] = line.split("\t");
    if (status?.startsWith("R") && from && to) map.set(from, to);
  }
  return map;
}

function main() {
  const base = process.argv[2] ?? "origin/main";
  let baseMap = {};
  try {
    baseMap = JSON.parse(git("show", `${base}:${SUPPRESSIONS_FILE}`) || "{}");
  } catch {
    // Pas de baseline sur la base : premier passage du ratchet. On ne peut
    // rien exiger d'une référence qui n'existe pas — on le dit et on passe.
    console.log(`[ratchet] aucune baseline sur ${base} — premier passage, rien à comparer.`);
    return 0;
  }
  const headMap = JSON.parse(readFileSync(SUPPRESSIONS_FILE, "utf8") || "{}");
  const faults = compare(baseMap, headMap, renamesFrom(base));

  console.log(`[ratchet] base ${base} : ${total(baseMap)} supprimées — PR : ${total(headMap)}`);
  if (faults.length === 0) {
    console.log("[ratchet] ✅ la dette ne croît pas et ne se déplace pas.");
    return 0;
  }
  console.error(`[ratchet] ❌ ${faults.length} manquement(s) :`);
  for (const f of faults) console.error(`  - ${f}`);
  console.error(
    "\nLa dette de lint est gelée : elle peut baisser, jamais monter.\n" +
      "Corrigez la violation, ou régénérez la baseline SI la hausse est justifiée :\n" +
      `  npx eslint --suppress-all --suppressions-location ${SUPPRESSIONS_FILE}\n` +
      "et expliquez-la dans la description de la PR."
  );
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
