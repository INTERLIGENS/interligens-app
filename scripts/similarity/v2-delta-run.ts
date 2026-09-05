#!/usr/bin/env node
// --- BUILD 7 / @v2 — LE RUN DELTA, EN MÉMOIRE -----------------------------
//
// Il rejoue le MÊME benchmark que S3 — VINE↔BOTIFY, plus les deux contrôles
// intra-VINE — sous @v1 PUIS sous @v2, sur le MÊME corpus relevé en lecture
// seule. Aucune base, aucun réseau, aucune persistance.
//
// Usage : npx tsx scripts/similarity/v2-delta-run.ts

import { isKnownMethodRef, resolveMethodRef } from "@/lib/methodology/registry";
import { SIMILARITY_V1_SHA256, SIMILARITY_V2_SHA256 } from "@/lib/methodology/artifact";
import {
  SIMILARITY_COMPARE_RULE_VERSION,
  compareSubjects,
  type SubjectComparison,
} from "@/lib/similarity";
import {
  SIMILARITY_COMPARE_V2_RULE_VERSION,
  compareSubjectsV2,
  type SubjectComparisonV2,
} from "@/lib/similarity/v2";
import { botifySubject, vineGroupSubject, vineSubject } from "@/lib/similarity/__fixtures__/s3-extract";
import {
  botifySubjectV2,
  vineGroupSubjectV2,
  vineSubjectV2,
} from "@/lib/similarity/v2/__fixtures__/s3-extract-v2";
import { S3_CORPUS_SOURCE } from "@/lib/similarity/__fixtures__/s3-corpus";

const short = (s: string) => (s.length > 20 ? `${s.slice(0, 9)}…${s.slice(-5)}` : s);

type AnyResult =
  | SubjectComparison["results"][number]
  | SubjectComparisonV2["results"][number];

function cell(r: AnyResult, side: "left" | "right"): string {
  const s = r.basis[side];
  if (s.state !== "OBSERVED" || !s.value) return `_${s.state}_`;
  if (s.value.kind === "CATEGORICAL") return `\`${short(s.value.value)}\``;
  if (s.value.kind === "SET") return s.value.values.map((v) => `\`${short(v)}\``).join(" ");
  return `${s.value.value} ${s.value.unit}`;
}

/** Ce qui a changé pour cette feature entre les deux versions. */
function delta(a: AnyResult, b: AnyResult): string {
  const bits: string[] = [];
  if (a.verdict !== b.verdict) bits.push(`verdict ${a.verdict} → **${b.verdict}**`);
  if (a.basis.reasonCode !== b.basis.reasonCode) {
    bits.push(`motif \`${a.basis.reasonCode}\` → \`${b.basis.reasonCode}\``);
  }
  for (const side of ["left", "right"] as const) {
    if (a.basis[side].state !== b.basis[side].state) {
      bits.push(`${side} ${a.basis[side].state} → **${b.basis[side].state}**`);
    }
  }
  return bits.length ? bits.join(" · ") : "—";
}

function scopeNote(r: AnyResult): string {
  const b = r.basis as { left?: { aggregation?: { scope: string; groupsWithValue: number; groupsConsidered: number } | null } };
  const a = b.left?.aggregation;
  if (!a || a.scope === "NOT_AGGREGATED" || a.scope === "PER_GROUP_ONLY") return "";
  if (a.scope === "SOME_GROUPS") return ` (${a.groupsWithValue}/${a.groupsConsidered})`;
  if (a.scope === "CONFLICTING_GROUPS") return " (conflit)";
  if (a.scope === "ALL_GROUPS") return ` (${a.groupsConsidered}/${a.groupsConsidered})`;
  return "";
}

function pairTable(v1: SubjectComparison, v2: SubjectComparisonV2): string {
  const lines = [
    "| feature | @v1 gauche | @v1 droite | @v1 | @v2 gauche | @v2 droite | @v2 | delta |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (let i = 0; i < v1.results.length; i++) {
    const a = v1.results[i];
    const b = v2.results[i];
    lines.push(
      `| \`${a.basis.featureKey}\` | ${cell(a, "left")} | ${cell(a, "right")} | ${a.verdict} | ` +
        `${cell(b, "left")}${scopeNote(b)} | ${cell(b, "right")} | **${b.verdict}** | ${delta(a, b)} |`,
    );
  }
  return lines.join("\n");
}

function tally(results: readonly AnyResult[], pick: (r: AnyResult) => string) {
  const m = new Map<string, number>();
  for (const r of results) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
  return [...m.entries()].sort().map(([k, n]) => `${k}=${n}`).join(", ");
}

function section(title: string, v1: SubjectComparison, v2: SubjectComparisonV2) {
  console.log(`\n## ${title}\n`);
  console.log(pairTable(v1, v2));
  console.log("");
  console.log(`@v1 verdicts : ${tally(v1.results, (r) => r.verdict)}`);
  console.log(`@v2 verdicts : ${tally(v2.results, (r) => r.verdict)}`);
  console.log(`@v1 motifs   : ${tally(v1.results, (r) => r.basis.reasonCode)}`);
  console.log(`@v2 motifs   : ${tally(v2.results, (r) => r.basis.reasonCode)}`);
  console.log(`@v1 états G  : ${tally(v1.results, (r) => r.basis.left.state)}`);
  console.log(`@v2 états G  : ${tally(v2.results, (r) => r.basis.left.state)}`);
  console.log(`@v1 états D  : ${tally(v1.results, (r) => r.basis.right.state)}`);
  console.log(`@v2 états D  : ${tally(v2.results, (r) => r.basis.right.state)}`);
}

for (const ref of [SIMILARITY_COMPARE_RULE_VERSION, SIMILARITY_COMPARE_V2_RULE_VERSION]) {
  if (!isKnownMethodRef(ref) || !resolveMethodRef(ref)) {
    throw new Error(`[v2-delta-run] « ${ref} » ne résout sur aucun artefact gelé — run refusé.`);
  }
}

console.log("# RUN DELTA @v1 → @v2 — Similarity V2");
console.log("");
console.log(`@v1      ${SIMILARITY_COMPARE_RULE_VERSION} (gelé, sha ${SIMILARITY_V1_SHA256.slice(0, 16)}…)`);
console.log(`@v2      ${SIMILARITY_COMPARE_V2_RULE_VERSION} (gelé, sha ${SIMILARITY_V2_SHA256.slice(0, 16)}…)`);
console.log(`corpus   ${S3_CORPUS_SOURCE} — IDENTIQUE pour les deux versions`);

section(
  "VINE ↔ BOTIFY",
  compareSubjects(vineSubject(), botifySubject()),
  compareSubjectsV2(vineSubjectV2(), botifySubjectV2()),
);
section(
  "CONTRÔLE intra-VINE — @1737595696 ↔ @1737597101",
  compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737597101")),
  compareSubjectsV2(vineGroupSubjectV2("@1737595696"), vineGroupSubjectV2("@1737597101")),
);
section(
  "CONTRÔLE intra-VINE — @1737595696 ↔ @1737607946",
  compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737607946")),
  compareSubjectsV2(vineGroupSubjectV2("@1737595696"), vineGroupSubjectV2("@1737607946")),
);
