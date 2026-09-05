#!/usr/bin/env node
// --- BUILD 7 / S3 — LE RUN, EN MÉMOIRE ------------------------------------
//
// Aucune base, aucun réseau, aucune persistance. Il lit le corpus relevé en
// lecture seule (src/lib/similarity/__fixtures__/s3-corpus.ts), applique la
// politique d'extraction déclarée AVANT le run, et fait tourner le comparateur
// GELÉ. Il n'écrit que sur la sortie standard.
//
// Usage : npx tsx scripts/similarity/s3-run.ts

import {
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_FEATURE_KEYS,
  compareSubjects,
  specFor,
  type ComparisonResult,
  type SubjectComparison,
} from "@/lib/similarity";
import { isKnownMethodRef, resolveMethodRef } from "@/lib/methodology/registry";
import { SIMILARITY_V1_SHA256 } from "@/lib/methodology/artifact";
import {
  botifySubject,
  vineGroupSubject,
  vineSubject,
} from "@/lib/similarity/__fixtures__/s3-extract";
import { S3_CORPUS_SOURCE } from "@/lib/similarity/__fixtures__/s3-corpus";

const short = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

function renderValue(r: ComparisonResult, side: "left" | "right"): string {
  const s = r.basis[side];
  if (s.state !== "OBSERVED" || !s.value) return `_${s.state}_`;
  if (s.value.kind === "CATEGORICAL") return `\`${short(s.value.value)}\``;
  if (s.value.kind === "SET") return s.value.values.map((v) => `\`${short(v)}\``).join(" ");
  return `${s.value.value} ${s.value.unit}`;
}

function table(cmp: SubjectComparison): string {
  const lines = [
    `| feature | ${cmp.leftSubjectRef} | ${cmp.rightSubjectRef} | verdict | motif | plancher |`,
    "|---|---|---|---|---|---|",
  ];
  for (const r of cmp.results) {
    lines.push(
      `| \`${r.basis.featureKey}\` | ${renderValue(r, "left")} | ${renderValue(r, "right")} | ` +
        `**${r.verdict}** | \`${r.basis.reasonCode}\` | ${r.basis.resultIsFloor ? "oui" : "—"} |`,
    );
  }
  return lines.join("\n");
}

function tally(cmp: SubjectComparison) {
  const byVerdict = new Map<string, number>();
  const byReason = new Map<string, number>();
  const byLeftState = new Map<string, number>();
  const byRightState = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of cmp.results) {
    bump(byVerdict, r.verdict);
    bump(byReason, r.basis.reasonCode);
    bump(byLeftState, r.basis.left.state);
    bump(byRightState, r.basis.right.state);
  }
  return { byVerdict, byReason, byLeftState, byRightState };
}

function counts(label: string, m: Map<string, number>): string {
  return `${label} : ` + [...m.entries()].sort().map(([k, n]) => `${k}=${n}`).join(", ");
}

function section(title: string, cmp: SubjectComparison) {
  console.log(`\n## ${title}\n`);
  console.log(table(cmp));
  const t = tally(cmp);
  console.log("");
  console.log(counts("Verdicts", t.byVerdict));
  console.log(counts("Motifs", t.byReason));
  console.log(counts(`États ${cmp.leftSubjectRef}`, t.byLeftState));
  console.log(counts(`États ${cmp.rightSubjectRef}`, t.byRightState));
}

// ── Le gel, vérifié AVANT de comparer quoi que ce soit ────────────────────
const resolved = resolveMethodRef(SIMILARITY_COMPARE_RULE_VERSION);
if (!isKnownMethodRef(SIMILARITY_COMPARE_RULE_VERSION) || !resolved) {
  throw new Error(
    "[s3-run] la méthode n'est pas gelée — le run est refusé. Un résultat produit " +
      "sous une méthode non citable ne serait opposable à personne.",
  );
}
console.log("# RUN S3 — Similarity V2");
console.log("");
console.log(`méthode   ${SIMILARITY_COMPARE_RULE_VERSION} (gelé, sha ${SIMILARITY_V1_SHA256.slice(0, 16)}…)`);
console.log(`corpus    ${S3_CORPUS_SOURCE}`);
console.log(`features  ${SIMILARITY_FEATURE_KEYS.length} déclarées`);
console.log(`familles  ${[...new Set(SIMILARITY_FEATURE_KEYS.map((k) => specFor(k).family))].join(", ")}`);

section("VINE ↔ BOTIFY (le run demandé)", compareSubjects(vineSubject(), botifySubject()));
section(
  "CONTRÔLE intra-VINE — groupe @1737595696 ↔ groupe @1737597101",
  compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737597101")),
);
section(
  "CONTRÔLE intra-VINE — groupe @1737595696 ↔ groupe @1737607946",
  compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737607946")),
);
