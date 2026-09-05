// --- BUILD 7 / S3 — LE RUN, VERROUILLÉ ------------------------------------
//
// Le run S3 est un ARTEFACT DE TEST : il tourne en mémoire, sur le corpus relevé
// en lecture seule, sous la méthode gelée. Ce fichier le rejoue et fixe son
// résultat — pour qu'une dérive du contrat, de l'extraction ou du comparateur
// se voie ici plutôt que dans un rapport que plus personne ne relit.

import { describe, expect, it } from "vitest";
import { isKnownMethodRef } from "@/lib/methodology/registry";
import {
  MalformedObservationError,
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_FEATURE_KEYS,
  SyntheticMintError,
  assertCanonicalMint,
  buildFeatureObservation,
  compareSubjects,
  completeCoverage,
  specFor,
  subjectIdentity,
  type ComparisonResult,
  type SubjectComparison,
} from "..";
import {
  botifySubject,
  vineGroupSubject,
  vineSubject,
} from "../__fixtures__/s3-extract";
import {
  BOTIFY_KOL_TOKEN_LINKS,
  BOTIFY_ROUTE_KEY_ROW_COUNTS,
  BOTIFY_SHILL_EVENTS,
  VINE_COEXIT_GROUPS,
  VINE_FUNDING_EDGES,
} from "../__fixtures__/s3-corpus";

const tally = (cmp: SubjectComparison, pick: (r: ComparisonResult) => string) => {
  const m: Record<string, number> = {};
  for (const r of cmp.results) m[pick(r)] = (m[pick(r)] ?? 0) + 1;
  return m;
};
const find = (cmp: SubjectComparison, key: string) => {
  const r = cmp.results.find((x) => x.basis.featureKey === key);
  if (!r) throw new Error(`résultat absent : ${key}`);
  return r;
};

// ═══ G1 — L'IDENTITÉ, AVANT TOUT LE RESTE ═════════════════════════════════

describe("G1 · l'identité canonique, et le refus de la clé synthétique", () => {
  it("BOTIFY est le mint « avec i », VINE est le mint pump.fun", () => {
    expect(subjectIdentity("CASE-2024-BOTIFY-001").canonicalMint).toBe(
      "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
    );
    expect(subjectIdentity("CASE-2025-VINE-001").canonicalMint).toBe(
      "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump",
    );
  });

  it("la clé de route est REFUSÉE — et rien dans sa FORME ne l'aurait arrêtée", () => {
    const route = BOTIFY_ROUTE_KEY_ROW_COUNTS.key;
    expect(() => assertCanonicalMint(route)).toThrow(SyntheticMintError);
    // Elle est base58 valide et se décode en 32 octets, comme un vrai pubkey :
    // seule une AUTORITÉ pouvait trancher, pas un validateur de forme.
    expect(route).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    // Et la mesure qui clôt le débat : elle n'est l'identité de rien.
    expect(BOTIFY_ROUTE_KEY_ROW_COUNTS.exitEvent).toBe(0);
    expect(BOTIFY_ROUTE_KEY_ROW_COUNTS.shillEvent).toBe(0);
    expect(BOTIFY_ROUTE_KEY_ROW_COUNTS.kolTokenLink).toBe(0);
  });

  it("les deux clés ne diffèrent QUE d'un caractère", () => {
    const a = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
    const b = BOTIFY_ROUTE_KEY_ROW_COUNTS.key;
    expect(a.replace("i", "")).toBe(b.replace("i", ""));
    expect(a.length - b.length).toBe(1);
  });
});

// ═══ G2 — LE GEL, AVANT D'AVOIR VU LE MOINDRE RÉSULTAT ════════════════════

describe("G2 · le run n'a lieu que sous méthode gelée", () => {
  it("similarity/compare@v1 résout, sinon le run se refuse lui-même", () => {
    expect(isKnownMethodRef(SIMILARITY_COMPARE_RULE_VERSION)).toBe(true);
  });
});

// ═══ G3 — LE RUN ══════════════════════════════════════════════════════════

describe("G3 · VINE ↔ BOTIFY", () => {
  const cmp = compareSubjects(vineSubject(), botifySubject());

  it("rend une entrée par feature déclarée", () => {
    expect(cmp.results).toHaveLength(SIMILARITY_FEATURE_KEYS.length);
    expect(SIMILARITY_FEATURE_KEYS).toHaveLength(17);
  });

  it("comptes par VERDICT — 1 MATCH, 16 NOT_COMPARABLE", () => {
    expect(tally(cmp, (r) => r.verdict)).toEqual({ MATCH: 1, NOT_COMPARABLE: 16 });
  });

  it("comptes par MOTIF — un seul motif de refus, et il est le bon", () => {
    expect(tally(cmp, (r) => r.basis.reasonCode)).toEqual({
      EQUAL_VALUE: 1,
      SIDE_NOT_OBSERVABLE: 16,
    });
  });

  it("comptes par ÉTAT — les cinq états sont réellement distingués", () => {
    expect(tally(cmp, (r) => r.basis.left.state)).toEqual({
      OBSERVED: 5, NOT_OBSERVED: 3, NOT_MEASURABLE: 4, MISSING: 5,
    });
    expect(tally(cmp, (r) => r.basis.right.state)).toEqual({
      OBSERVED: 1, NOT_OBSERVED: 3, MISSING: 13,
    });
  });

  it("le SEUL match est celui qui ne discrimine rien", () => {
    const m = cmp.results.filter((r) => r.verdict === "MATCH");
    expect(m).toHaveLength(1);
    expect(m[0].basis.featureKey).toBe("identity.chain_demonstrated");
    expect(m[0].basis.left.value).toEqual({ kind: "CATEGORICAL", value: "solana" });
    // Sur un produit Solana-only, cette feature ne peut RIEN rendre d'autre
    // qu'un MATCH. C'est une ressemblance vraie et sans pouvoir discriminant.
  });

  it("aucune DIFFÉRENCE n'est affirmée — et c'est correct", () => {
    // BOTIFY n'a ni sortie, ni financement, ni promotion exploitable dans les
    // tables. Rendre cela comme « les deux affaires diffèrent » convertirait
    // une absence de collecte en fait sur le monde.
    expect(cmp.results.some((r) => r.verdict === "DIFFERENT")).toBe(false);
  });

  it("chaque refus NOMME les deux états — le lecteur ne peut pas se tromper de cause", () => {
    for (const r of cmp.results.filter((x) => x.verdict === "NOT_COMPARABLE")) {
      expect(r.basis.reason).toContain(r.basis.left.state);
      expect(r.basis.reason).toContain(r.basis.right.state);
    }
  });

  it("VINE porte ses preuves ; BOTIFY porte ses motifs de refus", () => {
    const funders = find(cmp, "funding.shared_funder_addresses");
    expect(funders.basis.left.state).toBe("OBSERVED");
    expect(funders.basis.left.evidence.find((e) => e.kind === "tx_signature")!.refs.length)
      .toBeGreaterThan(0);
    // La photo de financement est PARTIELLE PAR CONSTRUCTION : le résultat est
    // un plancher, et il le dit.
    expect(funders.basis.resultIsFloor).toBe(true);
    expect(funders.basis.left.coverage!.censoredBy).toContain("cadrée sur le mint");

    const handles = find(cmp, "shill.kol_handles");
    expect(handles.basis.right.state).toBe("NOT_OBSERVED");
    expect(handles.basis.right.stateReason).toContain("EDITORIAL_ASSERTION");
    expect(handles.basis.right.stateReason).toContain("UNCLASSIFIED");
  });

  it("la matérialité reste NON MESURABLE et ne se compare pas à elle-même", () => {
    const m = find(cmp, "exit.materiality");
    expect(m.basis.left.state).toBe("NOT_MEASURABLE");
    expect(m.verdict).toBe("NOT_COMPARABLE");
  });

  it("aucun agrégat, aucun pourcentage nulle part dans la sortie", () => {
    const json = JSON.stringify(cmp);
    expect(json).not.toMatch(/"(score|similarity|confidence|weight|ratio|percent)"/i);
    expect(json).not.toMatch(/\d+\s?%/);
  });
});

// ═══ CONTRÔLE — le comparateur n'est pas mort, il est prudent ═════════════

describe("CONTRÔLE intra-VINE · les quatre verdicts sur données réelles", () => {
  const near = compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737597101"));
  const far = compareSubjects(vineGroupSubject("@1737595696"), vineGroupSubject("@1737607946"));

  it("deux groupes proches : 5 MATCH, 1 PARTIAL_MATCH, 11 refus", () => {
    expect(tally(near, (r) => r.verdict)).toEqual({
      MATCH: 5, PARTIAL_MATCH: 1, NOT_COMPARABLE: 11,
    });
  });

  it("le PARTIAL_MATCH est un recouvrement d'ADRESSES réelles, pas un ratio", () => {
    const f = find(near, "funding.shared_funder_addresses");
    expect(f.verdict).toBe("PARTIAL_MATCH");
    expect(f.basis.overlap).toEqual({
      shared: ["GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE"],
      onlyLeft: ["2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm"],
      onlyRight: [],
    });
    // Sous couverture bornée, le positif SURVIT — mais comme plancher.
    expect(f.basis.resultIsFloor).toBe(true);
  });

  it("deux groupes distincts : une DIFFÉRENCE est enfin affirmée, sous couverture complète", () => {
    const c = find(far, "exit.composition_profile");
    expect(c.verdict).toBe("DIFFERENT");
    expect(c.basis.left.value).toEqual({ kind: "CATEGORICAL", value: "SELL_ONLY" });
    expect(c.basis.right.value).toEqual({ kind: "CATEGORICAL", value: "MIXED" });
    expect(c.basis.resultIsFloor).toBe(false);
    // Un transfert DÉPLACE, une vente CÈDE. La différence est réelle.
  });

  it("les grandeurs restent transportées, jamais jugées — même 191 s contre 49 s", () => {
    for (const key of [
      "temporal.exit_cluster_span_seconds",
      "temporal.exit_cluster_min_gap_seconds",
      "exit.distinct_subjects",
      "funding.external_funder_count",
    ]) {
      const r = find(near, key);
      expect(r.verdict).toBe("NOT_COMPARABLE");
      expect(r.basis.reasonCode).toBe("ORDINAL_REQUIRES_UNDECLARED_THRESHOLD");
      expect(r.basis.left.value).not.toBeNull();
      expect(r.basis.right.value).not.toBeNull();
    }
  });

  it("le venue et la destination unanimes se retrouvent AU NIVEAU GROUPE", () => {
    // Au niveau SUJET, l'unanimité sur 6 groupes les détruit (3 groupes sur 6
    // n'en démontrent aucun). Au niveau GROUPE — celui que le registre nomme —
    // ils sont observés et se comparent.
    expect(find(near, "exit.demonstrated_venue").verdict).toBe("MATCH");
    expect(find(near, "exit.demonstrated_destination").verdict).toBe("MATCH");
    expect(find(vineSubjectCmp(), "exit.demonstrated_venue").basis.left.state).toBe("NOT_OBSERVED");
  });

  function vineSubjectCmp() {
    return compareSubjects(vineSubject(), botifySubject());
  }
});

// ═══ CE QUE @v1 NE SAIT PAS REPRÉSENTER ═══════════════════════════════════

describe("contradictions relevées par S3 sur les hypothèses S2", () => {
  it("« date_only » n'existe pas dans le vocabulaire fermé de @v1 — et le contrat REFUSE", () => {
    // Le corpus BOTIFY porte timestampSource = « date_only » sur 5 lignes sur 5.
    // @v1 ne connaît que snowflake et source_timestamp. Le contrat ne plie pas :
    // il lève. C'est la bonne réaction, et c'est une lacune de @v1 à traiter en
    // @v2 — jamais en ajustant @v1 après avoir vu le corpus.
    expect(BOTIFY_SHILL_EVENTS.every((e) => e.timestampSource === "date_only")).toBe(true);
    expect(specFor("temporal.anchor_provenance").allowedValues).toEqual([
      "snowflake",
      "source_timestamp",
    ]);
    expect(() =>
      buildFeatureObservation({
        featureKey: "temporal.anchor_provenance",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "date_only" },
        method: { methodRef: null, ruleVersion: "shill-forward-bridge@v1", parameters: {} },
        coverage: completeCoverage({}),
        evidence: [{ kind: "shill_event_id", refs: [BOTIFY_SHILL_EVENTS[0].id] }],
      }),
    ).toThrow(MalformedObservationError);
  });

  it("le registre déclare shill.kol_handles PRIMARY_OBSERVATION ; le corpus n'a qu'EDITORIAL_ASSERTION", () => {
    expect(specFor("shill.kol_handles").nature).toBe("PRIMARY_OBSERVATION");
    expect(
      BOTIFY_KOL_TOKEN_LINKS.every((l) => l.rowNature === "EDITORIAL_ASSERTION"),
    ).toBe(true);
    expect(BOTIFY_SHILL_EVENTS.every((e) => e.rowNature === null)).toBe(true);
  });

  it("le corpus est celui qu'on croit — 6 groupes, 12 arêtes, 5 + 5 lignes sociales", () => {
    expect(VINE_COEXIT_GROUPS).toHaveLength(6);
    expect(VINE_FUNDING_EDGES).toHaveLength(12);
    expect(BOTIFY_SHILL_EVENTS).toHaveLength(5);
    expect(BOTIFY_KOL_TOKEN_LINKS).toHaveLength(5);
    // Les 6 groupes se déclarent tous de couverture complète.
    expect(VINE_COEXIT_GROUPS.every((g) => !g.coverageAnyIncomplete)).toBe(true);
    // Et tous NON MESURABLES en matérialité.
    expect(VINE_COEXIT_GROUPS.every((g) => g.materialityStatus === "NOT_MEASURABLE")).toBe(true);
  });
});
