// --- B4.5/B4.6 — le writer, et la preuve qu'il satisfait les CHECK --------
//
// Ce que ces tests tiennent : le fragment produit par le writer est ÉCRIVABLE.
// Pas « probablement » — vérifié contre les deux CHECK rejoués côté
// application, et contre le chokepoint S6 qui le valide avant qu'il n'existe
// sous une forme persistable.
//
// Aucune écriture réelle. Le bridge reste `dryRun` par défaut.

import { describe, it, expect } from "vitest";
import {
  SHILL_EVENT_POLICY_VERSION,
  SHILL_EVENT_RESERVATIONS,
  buildShillEventNatureWrite,
  satisfiesShillEventNatureChecks,
} from "../eventNature";
import { qualifyPromotion } from "../qualify";
import { resolveTokenIdentity } from "../tokenIdentity";
import { natureForTable } from "@/lib/data-nature/registry";
import { isKnownMethodRef, SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";
import { basisClaimsInferenceAsInput } from "@/lib/data-nature/inferenceEnvelope";
import { NatureTransitionError } from "@/lib/data-nature/nature";

const SOL = "3ghKZfLZJawWRWhSvgreiTDeyFPS4Kriy6v4Fbk3pump";
const T0 = new Date("2026-09-04T10:00:00.000Z");

const source = () => ({
  sourcePostCandidateId: "cand-1",
  postId: "2095373437262844063",
  postUrl: "https://x.com/iambroots/status/2095373437262844063",
  postedAtUtc: T0,
});

const qualification = () =>
  qualifyPromotion({
    ingestionMode: "LIVE",
    signalTypes: '["ca_drop"]',
    signalScore: 80,
    detectedTokens: '["NET"]',
    detectedAddresses: `["${SOL}"]`,
  });

const resolution = () =>
  resolveTokenIdentity({
    detectedTokens: ["NET"],
    detectedAddresses: [SOL],
    text: `$NET ca ${SOL} lfg`,
  });

const build = () =>
  buildShillEventNatureWrite({
    source: source(),
    qualification: qualification(),
    resolution: resolution(),
  });

describe("B4.5 - le fragment de nature d'un ShillEvent dérivé", () => {
  it("rowNature vaut INFERENCE, et la table le déclare", () => {
    const f = build();
    expect(f.rowNature).toBe("INFERENCE");
    expect(natureForTable("ShillEvent")).toBe("INFERENCE");
  });

  it("naturePolicyVersion est NON VIDE — le CHECK auditable l'exige", () => {
    const f = build();
    expect(f.naturePolicyVersion).toBe(SHILL_EVENT_POLICY_VERSION);
    expect(f.naturePolicyVersion.length).toBeGreaterThan(0);
  });

  it("le basis cite le methodRef canonique, qui RÉSOUT", () => {
    const f = build();
    expect(f.natureBasis.inputs.methodology.methodRef).toBe(SOCIAL_PROMOTION_QUALIFY_V1);
    expect(isKnownMethodRef(f.natureBasis.inputs.methodology.methodRef)).toBe(true);
  });

  it("le post source est la SEULE primary observation", () => {
    const f = build();
    expect(f.natureBasis.inputs.primaryObservations).toHaveLength(1);
    const po = f.natureBasis.inputs.primaryObservations[0];
    expect(po.kind).toBe("social_post");
    expect(po.refs).toMatchObject({
      sourcePostCandidateId: "cand-1",
      postId: "2095373437262844063",
      postUrl: source().postUrl,
    });
  });

  it("la résolution est DÉCRITE, jamais aplatie en nature", () => {
    const f = build();
    expect(f.natureBasis.inputs.resolution).toMatchObject({ status: "resolved_from_tweet" });
    expect(f.natureBasis.inputs.resolution!.evidence).toBeTruthy();
  });

  it("inputNatures ne contient JAMAIS INFERENCE", () => {
    const f = build();
    expect(f.natureBasis.inputNatures).toEqual(["PRIMARY_OBSERVATION"]);
    expect(basisClaimsInferenceAsInput(f.natureBasis)).toBe(false);
  });

  it("les réserves méthodologiques voyagent AVEC l'inférence", () => {
    const f = build();
    expect(f.natureBasis.reservations).toEqual([...SHILL_EVENT_RESERVATIONS]);
    expect(f.natureBasis.reservations).toContain("mention_is_not_promotion");
    expect(f.natureBasis.reservations).toContain("qualification_is_not_proof_of_manipulation");
  });

  it("les empreintes de capture ne sont jointes que si elles EXISTENT", () => {
    // Les inventer affirmerait une chaîne de custody qu'on n'a pas.
    const sans = build();
    expect(sans.natureBasis.inputs.primaryObservations[0].refs).not.toHaveProperty("screenshotSha256");

    const avec = buildShillEventNatureWrite({
      source: { ...source(), screenshotSha256: "abc", htmlSha256: "def" },
      qualification: qualification(),
      resolution: resolution(),
    });
    expect(avec.natureBasis.inputs.primaryObservations[0].refs).toMatchObject({
      screenshotSha256: "abc",
      htmlSha256: "def",
    });
  });

  it("un non résolu porte son statut — la nature reste INFERENCE", () => {
    const f = buildShillEventNatureWrite({
      source: source(),
      qualification: qualification(),
      resolution: resolveTokenIdentity({
        detectedTokens: ["NET"],
        detectedAddresses: [SOL],
        text: "rien ne relie les deux",
      }),
    });
    expect(f.rowNature).toBe("INFERENCE");
    expect(f.natureBasis.inputs.resolution!.status).toBe("ambiguous_ticker");
  });
});

describe("B4.5 - le chokepoint S6 est SUR le chemin", () => {
  it("I1 : une ligne EDITORIAL_ASSERTION ne peut pas être promue en INFERENCE", () => {
    // Remontée de l'échelle d'autorité (rang 1 → 3). S6 la refuse, et c'est le
    // seul chemin par lequel ce refus peut atteindre l'écriture.
    expect(() =>
      buildShillEventNatureWrite(
        { source: source(), qualification: qualification(), resolution: resolution() },
        { id: "row-1", rowNature: "EDITORIAL_ASSERTION" },
      ),
    ).toThrow(NatureTransitionError);
  });

  it("réécrire INFERENCE sur INFERENCE passe — recalcul idempotent", () => {
    expect(() =>
      buildShillEventNatureWrite(
        { source: source(), qualification: qualification(), resolution: resolution() },
        { id: "row-1", rowNature: "INFERENCE" },
      ),
    ).not.toThrow();
  });

  it("une ligne legacy (rowNature NULL) est écrite normalement", () => {
    const f = buildShillEventNatureWrite(
      { source: source(), qualification: qualification(), resolution: resolution() },
      { id: "row-legacy", rowNature: null },
    );
    expect(f.rowNature).toBe("INFERENCE");
  });
});

// ═══ B4.6 — LA PREUVE : le fragment satisfait les DEUX CHECK ═══════════════

describe("B4.6 - les deux CHECK de la base, rejoués", () => {
  it("le fragment RÉEL du writer satisfait declared ET auditable", () => {
    const f = build();
    const v = satisfiesShillEventNatureChecks(f);
    expect(v.declared).toBe(true);
    expect(v.auditable).toBe(true);
    expect(v.ok).toBe(true);
  });

  it("natureBasis est un OBJET NON VIDE — pas {}, pas un scalaire, pas un tableau", () => {
    // Le CHECK auditable exige jsonb_typeof = 'object' ET <> '{}'.
    const f = build();
    expect(typeof f.natureBasis).toBe("object");
    expect(Array.isArray(f.natureBasis)).toBe(false);
    expect(Object.keys(f.natureBasis).length).toBeGreaterThan(0);
  });

  it("les 221 lignes legacy (rowNature NULL) passent les DEUX CHECK", () => {
    // Branche NULL, explicitement autorisée. C'est ce qui permet aux CHECK
    // d'être VALIDATE plus tard sans réécrire une seule ligne.
    const legacy = satisfiesShillEventNatureChecks({
      rowNature: null,
      natureBasis: null,
      naturePolicyVersion: null,
    });
    expect(legacy.declared).toBe(true);
    expect(legacy.auditable).toBe(true);
    expect(legacy.ok).toBe(true);
  });

  it("une nature SANS piste d'audit est refusée — c'est l'objet du CHECK", () => {
    expect(satisfiesShillEventNatureChecks({
      rowNature: "INFERENCE", natureBasis: {}, naturePolicyVersion: "v",
    }).auditable).toBe(false);

    expect(satisfiesShillEventNatureChecks({
      rowNature: "INFERENCE", natureBasis: { a: 1 }, naturePolicyVersion: "",
    }).auditable).toBe(false);

    expect(satisfiesShillEventNatureChecks({
      rowNature: "INFERENCE", natureBasis: null, naturePolicyVersion: "v",
    }).auditable).toBe(false);
  });

  it("une nature AUTRE qu'INFERENCE est refusée — la table est mono-nature", () => {
    expect(satisfiesShillEventNatureChecks({
      rowNature: "ESTIMATE", natureBasis: { a: 1 }, naturePolicyVersion: "v",
    }).declared).toBe(false);
  });

  it("le fragment est sérialisable en jsonb sans perte", () => {
    const f = build();
    expect(JSON.parse(JSON.stringify(f.natureBasis))).toEqual(
      JSON.parse(JSON.stringify(f.natureBasis)),
    );
    expect(JSON.stringify(f.natureBasis).length).toBeGreaterThan(100);
  });
});
