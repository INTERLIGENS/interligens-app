// --- BUILD 7 / @v2 — LE DELTA, VERROUILLÉ ---------------------------------
//
// Il rejoue le MÊME benchmark que S3 sous @v1 PUIS sous @v2, sur le MÊME corpus,
// et fixe les deux résultats. Une dérive de l'une des deux versions se voit ici.
//
// ██ ET IL PROUVE QUE @v1 EST INTACT. ██ C'est la condition de tout le reste :
// un delta mesuré contre une référence qu'on aurait retouchée ne mesurerait
// plus rien.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isKnownMethodRef, resolveMethodRef } from "@/lib/methodology/registry";
import {
  SIMILARITY_V1,
  SIMILARITY_V1_SHA256,
  SIMILARITY_V2_SHA256,
  serializeArtifactBody,
} from "@/lib/methodology/artifact";
import {
  SIMILARITY_FEATURE_KEYS,
  compareSubjects,
  specFor,
  type SubjectComparison,
} from "../..";
import { botifySubject, vineGroupSubject, vineSubject } from "../../__fixtures__/s3-extract";
import {
  SIMILARITY_FEATURE_KEYS_V2,
  compareSubjectsV2,
  specForV2,
  type SubjectComparisonV2,
} from "..";
import { botifySubjectV2, vineGroupSubjectV2, vineSubjectV2 } from "../__fixtures__/s3-extract-v2";

type AnyCmp = SubjectComparison | SubjectComparisonV2;
const tally = (c: AnyCmp, pick: (r: AnyCmp["results"][number]) => string) => {
  const m: Record<string, number> = {};
  for (const r of c.results) m[pick(r)] = (m[pick(r)] ?? 0) + 1;
  return m;
};
const find = <C extends AnyCmp>(c: C, key: string) => {
  const r = c.results.find((x) => x.basis.featureKey === key);
  if (!r) throw new Error(`résultat absent : ${key}`);
  return r as C["results"][number];
};

// ═══ @v1 EST INTACT ═══════════════════════════════════════════════════════

describe("@v1 n'a pas bougé", () => {
  it("son artefact est toujours gelé sur le même sha", () => {
    expect(SIMILARITY_V1_SHA256).toBe(
      "4395fddbd6336a240278c3214938a48a1697a610bd3b4d2e306550d4e3155d94",
    );
    const md = readFileSync("content/methodologies/similarity/v1.md", "utf8");
    const frozen = md
      .slice(md.indexOf("## compare — Case Similarity Comparison (V1)"))
      .replace(/\n+$/, "");
    expect(createHash("sha256").update(frozen, "utf8").digest("hex")).toBe(SIMILARITY_V1_SHA256);
    expect(serializeArtifactBody(SIMILARITY_V1)).toBe(frozen);
  });

  it("les deux versions résolvent, chacune sur la sienne", () => {
    expect(isKnownMethodRef("similarity/compare@v1")).toBe(true);
    expect(isKnownMethodRef("similarity/compare@v2")).toBe(true);
    expect(resolveMethodRef("similarity/compare@v1")!.artifact.version).toBe("v1");
    expect(resolveMethodRef("similarity/compare@v2")!.artifact.version).toBe("v2");
    expect(SIMILARITY_V2_SHA256).not.toBe(SIMILARITY_V1_SHA256);
  });

  it("son run S3 rend EXACTEMENT ce que le rapport S3 a publié", () => {
    const v1 = compareSubjects(vineSubject(), botifySubject());
    expect(tally(v1, (r) => r.verdict)).toEqual({ MATCH: 1, NOT_COMPARABLE: 16 });
    expect(tally(v1, (r) => r.basis.reasonCode)).toEqual({
      EQUAL_VALUE: 1, SIDE_NOT_OBSERVABLE: 16,
    });
  });
});

// ═══ LE CONTRAT : MÊMES 17 CLÉS ═══════════════════════════════════════════

describe("@v2 corrige la MÉTHODE, il n'élargit pas le CONTRAT", () => {
  it("mêmes 17 clés, même ordre, mêmes natures et mêmes sortes", () => {
    expect(SIMILARITY_FEATURE_KEYS_V2).toEqual(SIMILARITY_FEATURE_KEYS);
    for (const k of SIMILARITY_FEATURE_KEYS) {
      expect(specForV2(k).nature).toBe(specFor(k).nature);
      expect(specForV2(k).kind).toBe(specFor(k).kind);
      expect(specForV2(k).family).toBe(specFor(k).family);
    }
  });

  it("une seule feature voit son vocabulaire étendu, et c'est C1", () => {
    const changed = SIMILARITY_FEATURE_KEYS.filter(
      (k) => JSON.stringify(specForV2(k).allowedValues) !== JSON.stringify(specFor(k).allowedValues),
    );
    expect(changed).toEqual(["temporal.anchor_provenance"]);
    expect(specForV2("temporal.anchor_provenance").allowedValues).toEqual([
      "snowflake", "source_timestamp", "date_only",
    ]);
  });

  it("chaque feature déclare sa règle d'agrégation, et son motif", () => {
    for (const k of SIMILARITY_FEATURE_KEYS) {
      expect(specForV2(k).aggregationRationale.length).toBeGreaterThan(30);
    }
    expect(specForV2("exit.demonstrated_venue").aggregation).toBe("DEMONSTRATED_BY_ANY");
    expect(specForV2("exit.cluster_category").aggregation).toBe("ALL_OR_NOTHING");
    expect(specForV2("exit.composition_profile").aggregation).toBe("ALL_OR_NOTHING");
    expect(specForV2("exit.distinct_subjects").aggregation).toBe("PER_GROUP_MAGNITUDE");
    expect(specForV2("funding.shared_funder_addresses").aggregation).toBe("SUBJECT_LEVEL");
  });
});

// ═══ LE DELTA — VINE ↔ BOTIFY ═════════════════════════════════════════════

describe("delta @v1→@v2 · VINE ↔ BOTIFY", () => {
  const v1 = compareSubjects(vineSubject(), botifySubject());
  const v2 = compareSubjectsV2(vineSubjectV2(), botifySubjectV2());

  it("les VERDICTS sont inchangés — @v2 change ce qu'on SAIT, pas ce qu'on CONCLUT", () => {
    expect(tally(v1, (r) => r.verdict)).toEqual({ MATCH: 1, NOT_COMPARABLE: 16 });
    expect(tally(v2, (r) => r.verdict)).toEqual({ MATCH: 1, NOT_COMPARABLE: 16 });
  });

  it("C2 — trois refus passent d'une absence à une INADMISSIBILITÉ nommée", () => {
    expect(tally(v2, (r) => r.basis.reasonCode)).toEqual({
      EQUAL_VALUE: 1, SIDE_INADMISSIBLE: 3, SIDE_NOT_OBSERVABLE: 13,
    });
    for (const k of [
      "identity.token_resolution_status",
      "temporal.anchor_provenance",
      "shill.kol_handles",
    ]) {
      expect(find(v1, k).basis.right.state).toBe("NOT_OBSERVED");
      const r = find(v2, k);
      expect(r.basis.right.state).toBe("INADMISSIBLE");
      expect(r.basis.reasonCode).toBe("SIDE_INADMISSIBLE");
      expect(r.basis.right.inadmissibility!.found).toBeTruthy();
      expect(r.basis.right.inadmissibility!.required).toBeTruthy();
    }
    expect(find(v2, "shill.kol_handles").basis.right.inadmissibility!.cause).toBe(
      "DATA_NATURE_MISMATCH",
    );
    expect(find(v2, "identity.token_resolution_status").basis.right.inadmissibility!.cause).toBe(
      "DATA_NATURE_MISSING",
    );
  });

  it("C3 — deux faits que @v1 détruisait sont rendus, AVEC leur portée", () => {
    for (const [k, value] of [
      ["exit.demonstrated_venue", "RAYDIUM"],
      ["exit.demonstrated_destination", "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"],
    ] as const) {
      expect(find(v1, k).basis.left.state).toBe("NOT_OBSERVED");
      const r = find(v2, k);
      expect(r.basis.left.state).toBe("OBSERVED");
      expect(r.basis.left.value).toEqual({ kind: "CATEGORICAL", value });
      // ██ ET LA PORTÉE VOYAGE AVEC : 3 groupes sur 6, jamais « le sujet ». ██
      expect(r.basis.left.aggregation!.scope).toBe("SOME_GROUPS");
      expect(r.basis.left.aggregation!.groupsWithValue).toBe(3);
      expect(r.basis.left.aggregation!.groupsConsidered).toBe(6);
      expect(r.basis.left.aggregation!.perGroup).toHaveLength(6);
    }
    // VINE gagne deux features observées ; BOTIFY n'en gagne aucune.
    expect(tally(v1, (r) => r.basis.left.state).OBSERVED).toBe(5);
    expect(tally(v2, (r) => r.basis.left.state).OBSERVED).toBe(7);
  });

  it("le conflit de composition est NOMMÉ au lieu d'être une absence muette", () => {
    const r = find(v2, "exit.composition_profile");
    expect(r.basis.left.state).toBe("NOT_OBSERVED");
    expect(r.basis.left.aggregation!.scope).toBe("CONFLICTING_GROUPS");
    expect(r.basis.left.aggregation!.distinctValues).toEqual(["MIXED", "SELL_ONLY"]);
    expect(r.basis.left.stateReason).toContain("vote majoritaire");
  });

  it("P3 — la destination reste comparable, et se déclare NON ATTRIBUÉE", () => {
    const r = find(v2, "exit.demonstrated_destination");
    expect(r.basis.left.attribution).toEqual({
      status: "UNATTRIBUTED", label: null, provenance: null,
    });
    expect(r.basis.unattributedIdentifier).toBe(true);
    expect(r.reservations.some((x) => x.startsWith("UNATTRIBUTED IDENTIFIER"))).toBe(true);
    // Le venue, lui, porte un nom DÉCLARÉ par la source — jamais vérifié.
    expect(find(v2, "exit.demonstrated_venue").basis.left.attribution).toEqual({
      status: "DECLARED_BY_SOURCE", label: "RAYDIUM", provenance: null,
    });
  });

  it("aucune DIFFÉRENCE n'est affirmée, et aucun agrégat n'apparaît", () => {
    expect(v2.results.some((r) => r.verdict === "DIFFERENT")).toBe(false);
    const json = JSON.stringify(v2);
    expect(json).not.toMatch(/"(score|similarity|confidence|weight|ratio|percent)"/i);
    expect(json).not.toMatch(/\d+\s?%/);
  });
});

// ═══ LE DELTA — CONTRÔLES INTRA-VINE ══════════════════════════════════════

describe("delta @v1→@v2 · contrôles intra-VINE", () => {
  const near1 = compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737597101"));
  const near2 = compareSubjectsV2(vineGroupSubjectV2("@1737595696"), vineGroupSubjectV2("@1737597101"));
  const far1 = compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737607946"));
  const far2 = compareSubjectsV2(vineGroupSubjectV2("@1737595696"), vineGroupSubjectV2("@1737607946"));

  it("AUCUNE RÉGRESSION : verdicts et motifs identiques sous les deux versions", () => {
    for (const [a, b] of [[near1, near2], [far1, far2]] as const) {
      expect(tally(b, (r) => r.verdict)).toEqual(tally(a, (r) => r.verdict));
      expect(tally(b, (r) => r.basis.reasonCode)).toEqual(tally(a, (r) => r.basis.reasonCode));
    }
    expect(tally(near2, (r) => r.verdict)).toEqual({ MATCH: 5, PARTIAL_MATCH: 1, NOT_COMPARABLE: 11 });
    expect(tally(far2, (r) => r.verdict)).toEqual({ MATCH: 1, DIFFERENT: 1, NOT_COMPARABLE: 15 });
  });

  it("les grandeurs restent TRANSPORTÉES quand le sujet EST le groupe", () => {
    // C'est la régression que le rejeu a révélée, et qu'il a fallu refermer :
    // sous une première écriture de @v2, ces valeurs devenaient NOT_MEASURABLE
    // et le lecteur perdait ce que @v1 lui montrait.
    for (const [k, l, r] of [
      ["temporal.exit_cluster_span_seconds", 191, 49],
      ["temporal.exit_cluster_min_gap_seconds", 0, 3],
      ["exit.distinct_subjects", 9, 5],
    ] as const) {
      const res = find(near2, k);
      expect(res.verdict).toBe("NOT_COMPARABLE");
      expect(res.basis.reasonCode).toBe("ORDINAL_REQUIRES_UNDECLARED_THRESHOLD");
      expect((res.basis.left.value as { value: number }).value).toBe(l);
      expect((res.basis.right.value as { value: number }).value).toBe(r);
      expect(res.basis.left.aggregation!.perGroup).toHaveLength(1);
    }
  });

  it("la DIFFÉRENCE réelle survit, et reste sous couverture complète", () => {
    const c = find(far2, "exit.composition_profile");
    expect(c.verdict).toBe("DIFFERENT");
    expect(c.basis.left.value).toEqual({ kind: "CATEGORICAL", value: "SELL_ONLY" });
    expect(c.basis.right.value).toEqual({ kind: "CATEGORICAL", value: "MIXED" });
    expect(c.basis.resultIsFloor).toBe(false);
  });

  it("le PARTIAL_MATCH de bailleurs survit, et se déclare désormais non attribué", () => {
    const f1 = find(near1, "funding.shared_funder_addresses");
    const f2 = find(near2, "funding.shared_funder_addresses");
    expect(f1.verdict).toBe("PARTIAL_MATCH");
    expect(f2.verdict).toBe("PARTIAL_MATCH");
    expect(f2.basis.overlap).toEqual(f1.basis.overlap);
    expect(f2.basis.unattributedIdentifier).toBe(true);
    expect(f2.basis.resultIsFloor).toBe(true);
  });
});
