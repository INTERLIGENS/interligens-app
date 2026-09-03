// --- B4.2/B4.3 — l'inférence n'est jamais sa propre preuve ----------------
//
// Le défaut fermé ici : `natureBasis = ["PRIMARY_OBSERVATION","INFERENCE"]`,
// écrit dès que le résolveur de token avait tranché. Le raisonnement semblait
// juste — une étape amont était un calcul — mais la ligne obtenue disait
// « cette inférence est fondée, entre autres, sur une inférence », sans dire
// laquelle. Un basis existe précisément pour dire laquelle.

import { describe, it, expect } from "vitest";
import {
  INFERENCE_ENVELOPE_VERSION,
  InferenceAsOwnBasisError,
  UnresolvableMethodRefError,
  basisClaimsInferenceAsInput,
  buildInferenceEnvelope,
} from "../inferenceEnvelope";
import { isKnownMethodRef, SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";
import { natureForTable, NATURE_REGISTRY } from "../registry";

const base = () => ({
  primaryObservations: [
    { kind: "social_post", refs: { postId: "p1", postUrl: "https://x.com/a/status/1" }, count: 1 },
  ],
  methodology: { methodRef: SOCIAL_PROMOTION_QUALIFY_V1 },
});

describe("B4.2 - la forme canonique", () => {
  it("la nature est INFERENCE et le basis décrit les ENTRÉES", () => {
    const e = buildInferenceEnvelope(base());
    expect(e.nature).toBe("INFERENCE");
    expect(e.basis.inputs.primaryObservations).toHaveLength(1);
    expect(e.basis.inputs.methodology.methodRef).toBe(SOCIAL_PROMOTION_QUALIFY_V1);
    expect(e.basis.envelopeVersion).toBe(INFERENCE_ENVELOPE_VERSION);
  });

  it("inputNatures ne contient JAMAIS INFERENCE", () => {
    const e = buildInferenceEnvelope({
      ...base(),
      resolution: { status: "resolved_from_tweet", evidence: "appariement démontré" },
    });
    expect(e.basis.inputNatures).toEqual(["PRIMARY_OBSERVATION"]);
    expect(e.basis.inputNatures).not.toContain("INFERENCE");
    expect(basisClaimsInferenceAsInput(e.basis)).toBe(false);
  });

  it("une étape dérivée est DÉCRITE sous son nom, pas aplatie en nature", () => {
    // C'est la moitié constructive de la correction : le fait n'est pas tu,
    // il est nommé, avec son statut et sa preuve.
    const e = buildInferenceEnvelope({
      ...base(),
      resolution: { status: "resolved_from_ca_map", evidence: "CA_MAP" },
    });
    expect(e.basis.inputs.resolution).toEqual({
      status: "resolved_from_ca_map",
      evidence: "CA_MAP",
    });
    expect(e.basis.inputNatures).not.toContain("INFERENCE");
  });

  it("un non résolu porte son statut dans le basis", () => {
    const e = buildInferenceEnvelope({
      ...base(),
      resolution: { status: "unresolved_ticker", evidence: "ticker sans CA_MAP ni CA" },
    });
    expect(e.basis.inputs.resolution!.status).toBe("unresolved_ticker");
  });

  it("THIRD_PARTY_DATA n'apparaît QUE si une source externe a participé", () => {
    const sans = buildInferenceEnvelope(base());
    expect(sans.basis.inputNatures).not.toContain("THIRD_PARTY_DATA");

    const avec = buildInferenceEnvelope({
      ...base(),
      additionalInputs: [{ nature: "THIRD_PARTY_DATA", kind: "price_feed", refs: { src: "dexscreener" } }],
    });
    expect(avec.basis.inputNatures).toContain("THIRD_PARTY_DATA");
  });
});

describe("B4.2 - les deux refus sont dans le CODE, pas dans un commentaire", () => {
  it("INFERENCE en input additionnel est REFUSÉ, même via un cast", () => {
    // Le type l'interdit déjà ; une valeur venue d'un `any` passerait sans
    // cette garde. C'est l'anti-régression demandée.
    expect(() =>
      buildInferenceEnvelope({
        ...base(),
        additionalInputs: [{ nature: "INFERENCE" as never, kind: "upstream" }],
      }),
    ).toThrow(InferenceAsOwnBasisError);
  });

  it("un methodRef hors grammaire est REFUSÉ", () => {
    // `promotion-qualify@v1` — le slug nu posé en B2 — ne résout pas.
    expect(() =>
      buildInferenceEnvelope({ ...base(), methodology: { methodRef: "promotion-qualify@v1" } }),
    ).toThrow(UnresolvableMethodRefError);
  });

  it("basisClaimsInferenceAsInput détecte l'ANCIEN format aussi", () => {
    // Une ligne écrite avant B4.2 porte `natureBasis: [...]`. Le détecteur la
    // voit — c'est ce qui permettra de les distinguer sans les réécrire.
    expect(basisClaimsInferenceAsInput({ natureBasis: ["PRIMARY_OBSERVATION", "INFERENCE"] })).toBe(true);
    expect(basisClaimsInferenceAsInput({ natureBasis: ["PRIMARY_OBSERVATION"] })).toBe(false);
    expect(basisClaimsInferenceAsInput(null)).toBe(false);
  });
});

describe("B4.1 - le methodRef canonique résout", () => {
  it("social-promotion/qualify@v1 résout sur un artefact gelé", () => {
    expect(isKnownMethodRef(SOCIAL_PROMOTION_QUALIFY_V1)).toBe(true);
  });

  it("le slug nu de B2 ne résout pas — un seul identifiant désormais", async () => {
    const { PROMOTION_QUALIFY_RULE_VERSION } = await import("@/lib/shill-correlation/qualify");
    expect(PROMOTION_QUALIFY_RULE_VERSION).toBe(SOCIAL_PROMOTION_QUALIFY_V1);
    expect(isKnownMethodRef("promotion-qualify@v1")).toBe(false);
  });
});

describe("B4.3 - ShillEvent est déclarée au registre", () => {
  it("natureForTable('ShillEvent') rend INFERENCE, pas UNCLASSIFIED", () => {
    // Sans cette entrée, le chokepoint S6 aurait refusé toute écriture de
    // nature sur la table : la déclaration précède l'écriture.
    expect(natureForTable("ShillEvent")).toBe("INFERENCE");
    expect(natureForTable("ShillEvent")).not.toBe("UNCLASSIFIED");
  });

  it("le régime est DECLARED — la table est mono-nature", () => {
    const d = NATURE_REGISTRY.ShillEvent;
    expect(d.regime).toBe("DECLARED");
    expect(d.basis).toContain("PRIMARY_OBSERVATION");
    // Q3 : la nature est celle de la dernière opération, pas des entrées.
    expect(d.nature).toBe("INFERENCE");
  });
});
