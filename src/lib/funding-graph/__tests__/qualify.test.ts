// --- Q2 — LES GATES MUTATION DE LA QUALIFICATION ---------------------------

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUST_FLOOR_LAMPORTS,
  RENT_EXEMPT_MINIMUM_LAMPORTS,
  FUNDING_RELATIONSHIP_METHOD_REF,
  qualifyFundingRelationship,
  type AddressLabelInput,
  type FundingEdge,
  type QualifyFundingRelationshipInput,
} from "../index";
import { resolveMethodRef } from "@/lib/methodology/registry";
import {
  FUNDING_RELATIONSHIP_V1,
  FUNDING_RELATIONSHIP_V1_SHA256,
  serializeArtifactBody,
} from "@/lib/methodology/artifact";

const S1 = "Subject1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const S2 = "Subject2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FUNDER = "Funder1cccccccccccccccccccccccccccccccccccc";

const edge = (to: string, lamports: number, sig: string, ts = 1_737_590_000): FundingEdge => ({
  fromWallet: FUNDER, toWallet: to, asset: "SOL",
  amountLamports: lamports, txSignature: sig, blockTimeSeconds: ts,
  rowNature: "PRIMARY_OBSERVATION",
});
const COMPLETE = { complete: true } as const;
const BIG = 3_000_000_000;

const exchangeLabel: AddressLabelInput = {
  address: FUNDER, label: "Coinbase (hot)", isExchange: true,
  auditable: true, provenance: "vine-insider-network.json funding_sources",
};

describe("Q1 - l'artefact est gelé et la référence résout", () => {
  it("funding-relationship/qualify@v1 résout — plus null", () => {
    const r = resolveMethodRef(FUNDING_RELATIONSHIP_METHOD_REF);
    expect(r).not.toBeNull();
    expect(r!.componentId).toBe("qualify");
    expect(r!.artifact.version).toBe("v1");
  });

  it("trois sha concordants : frontmatter, corps du .md, miroir TypeScript", () => {
    const md = readFileSync(
      join(process.cwd(), "content/methodologies/funding-relationship/v1.md"), "utf8");
    const frozen = md.slice(md.indexOf("## qualify ")).replace(/\n+$/, "");
    const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    const declared = /contentSha256: ([0-9a-f]{64})/.exec(md)?.[1];
    expect(declared).toBe(sha(frozen));
    expect(sha(serializeArtifactBody(FUNDING_RELATIONSHIP_V1))).toBe(declared);
    expect(FUNDING_RELATIONSHIP_V1_SHA256).toBe(declared);
    expect(md).toContain("status: FROZEN");
  });

  it("le seuil DUST du code est celui que l'artefact démontre", () => {
    expect(RENT_EXEMPT_MINIMUM_LAMPORTS).toBe(128 * 3_480 * 2);
    expect(RENT_EXEMPT_MINIMUM_LAMPORTS).toBe(890_880);
    expect(DUST_FLOOR_LAMPORTS).toBe(895_880);
    const md = readFileSync(
      join(process.cwd(), "content/methodologies/funding-relationship/v1.md"), "utf8");
    expect(md).toContain("890,880 lamports");
    expect(md).toContain("895,880 lamports");
  });
});

describe("Q2 - chaque reclassement vers PRIVATE est un échec", () => {
  // ═══ MUTATION 1 — EXCHANGE → PRIVATE ═══════════════════════════════════
  it("MUTATION : un exchange auditable atteignant 2 sujets n'est PAS privé", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      addressLabel: exchangeLabel, coverage: COMPLETE,
    });
    expect(q.category).toBe("KNOWN_EXCHANGE");
    expect(q.category).not.toBe("PRIVATE_SHARED_FUNDER"); // 🔴
    expect(q.reason).toContain("valeur probante faible");
  });

  // ═══ MUTATION 2 — SELF → PRIVATE ═══════════════════════════════════════
  it("MUTATION : un bailleur qui est lui-même un sujet n'est PAS privé", () => {
    const q = qualifyFundingRelationship({
      funder: S1, subjectsReached: [S1, S2],
      edges: [{ ...edge(S1, BIG, "sigA"), fromWallet: S1 }, { ...edge(S2, BIG, "sigB"), fromWallet: S1 }],
      coverage: COMPLETE,
    });
    expect(q.category).toBe("SELF_OR_KNOWN_ACTOR");
    expect(q.category).not.toBe("PRIVATE_SHARED_FUNDER"); // 🔴
  });

  it("un acteur déjà identifié tombe aussi en SELF_OR_KNOWN_ACTOR", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      knownActors: [FUNDER], coverage: COMPLETE,
    });
    expect(q.category).toBe("SELF_OR_KNOWN_ACTOR");
  });

  // ═══ MUTATION 3 — DUST → PRIVATE ═══════════════════════════════════════
  it("MUTATION : sous le plancher d'opération, 2 sujets ne font pas un signal", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, 10_000, "sigA"), edge(S2, 10_000, "sigB")],
      coverage: COMPLETE,
    });
    expect(q.category).toBe("DUST");
    expect(q.category).not.toBe("PRIVATE_SHARED_FUNDER"); // 🔴
    expect(q.evidence.totalLamports).toBe(20_000);
    expect(q.evidence.totalLamports).toBeLessThan(DUST_FLOOR_LAMPORTS);
  });

  it("le plancher est INCLUSIF vers le haut : exactement 895 880 n'est pas de la poussière", () => {
    const at = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, DUST_FLOOR_LAMPORTS, "sigA"), edge(S2, 0, "sigB")],
      coverage: COMPLETE,
    });
    expect(at.category).toBe("PRIVATE_SHARED_FUNDER");
    const below = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, DUST_FLOOR_LAMPORTS - 1, "sigA")],
      coverage: COMPLETE,
    });
    expect(below.category).toBe("DUST");
  });

  // ═══ MUTATION 4 — ÉTIQUETTE NON AUDITABLE TRAITÉE COMME EXCHANGE ═══════
  it("MUTATION : une étiquette non auditable ne fait PAS un KNOWN_EXCHANGE", () => {
    for (const bad of [
      { ...exchangeLabel, auditable: false },
      { ...exchangeLabel, provenance: undefined },
    ] as AddressLabelInput[]) {
      const q = qualifyFundingRelationship({
        funder: FUNDER, subjectsReached: [S1, S2],
        edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
        addressLabel: bad, coverage: COMPLETE,
      });
      expect(q.category).not.toBe("KNOWN_EXCHANGE"); // 🔴
      expect(q.category).toBe("PRIVATE_SHARED_FUNDER");
      expect(q.reason).toContain("pas auditable");
      // …et l'étiquette écartée n'entre PAS au basis.
      expect(JSON.stringify(q.natureBasis)).not.toContain("Coinbase");
      expect(q.natureBasis.basis.reservations.join(" ")).toContain("LABEL DISCARDED");
    }
  });

  it("une étiquette auditable NON-exchange ne classe pas en exchange", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      addressLabel: { ...exchangeLabel, isExchange: false, label: "Jupiter router" },
      coverage: COMPLETE,
    });
    expect(q.category).toBe("PRIVATE_SHARED_FUNDER");
  });

  // ═══ MUTATION 5 — CENSURE RENDUE COMME « PAS DE RELATION » ═════════════
  it("MUTATION : une couverture censurée rend un PLANCHER, jamais une absence", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1],
      edges: [edge(S1, BIG, "sigA")],
      coverage: { complete: false, censoredBy: "page_cap", subjectsAttempted: 15, subjectsCovered: 9 },
    });
    expect(q.coverage.resultIsFloor).toBe(true);
    const s = JSON.stringify(q).toLowerCase();
    for (const forbidden of ["no_relationship", "no relationship", "absent", "aucune relation"]) {
      expect(s).not.toContain(forbidden); // 🔴
    }
    expect(q.natureBasis.basis.reservations.join(" ")).toContain("COVERAGE CENSORED");
    expect(q.natureBasis.basis.reservations.join(" ")).toContain("FLOOR");
  });

  it("couverture complète → le résultat n'est pas marqué plancher", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")], coverage: COMPLETE,
    });
    expect(q.coverage.resultIsFloor).toBe(false);
  });

  // ═══ MUTATION 6 — UN VERDICT SÉRIALISÉ ════════════════════════════════
  it("MUTATION : aucun label ni score de coordination ne sort du qualifieur", () => {
    const cases: QualifyFundingRelationshipInput[] = [
      { funder: FUNDER, subjectsReached: [S1, S2], edges: [edge(S1, BIG, "a"), edge(S2, BIG, "b")], coverage: COMPLETE },
      { funder: FUNDER, subjectsReached: [S1, S2], edges: [edge(S1, 1, "a")], coverage: COMPLETE },
      { funder: FUNDER, subjectsReached: [S1, S2], edges: [edge(S1, BIG, "a"), edge(S2, BIG, "b")], addressLabel: exchangeLabel, coverage: COMPLETE },
    ];
    for (const input of cases) {
      const q = qualifyFundingRelationship(input);
      // On scanne ce que LE MODULE écrit. Deux exclusions, et chacune se
      // justifie : les réserves NOMMENT ce qu'elles refusent, et l'étiquette
      // et sa provenance sont les mots de l'APPELANT, recopiés sans jugement.
      // Sans ces exclusions, le test attraperait la phrase qui nie le verdict,
      // ou un nom de fichier — jamais un verdict.
      const denials = q.natureBasis.basis.reservations;
      const echoed = [input.addressLabel?.label, input.addressLabel?.provenance].filter(Boolean) as string[];
      let s = JSON.stringify(q).toLowerCase();
      for (const d of [...denials, ...echoed]) s = s.split(d.toLowerCase()).join("");
      for (const forbidden of ["scam", "insider", "fraud", "culpab", "guilt", "coordination", "riskscore", "suspici"]) {
        expect(s).not.toContain(forbidden); // 🔴
      }
      // Et la réserve de non-interprétation est TOUJOURS présente.
      expect(denials.join(" ")).toContain("QUALIFICATION IS NOT INTERPRETATION");
    }
  });

  it("un seul sujet atteint → UNKNOWN, pas un signal partagé", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1], edges: [edge(S1, BIG, "sigA")], coverage: COMPLETE,
    });
    expect(q.category).toBe("UNKNOWN");
  });

  it("aucune arête → UNKNOWN, sans qualification fabriquée", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2], edges: [], coverage: COMPLETE,
    });
    expect(q.category).toBe("UNKNOWN");
    expect(q.evidence.earliestBlockTimeSeconds).toBeNull();
  });

  it("la nature est INFERENCE, et INFERENCE n'est jamais sa propre base", () => {
    const q = qualifyFundingRelationship({
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")],
      addressLabel: exchangeLabel, coverage: COMPLETE,
    });
    expect(q.natureBasis.nature).toBe("INFERENCE");
    expect(q.natureBasis.basis.inputNatures).not.toContain("INFERENCE");
    expect(q.natureBasis.basis.inputNatures).toContain("PRIMARY_OBSERVATION");
    // L'étiquette entre comme donnée de TIERS — jamais comme notre observation.
    expect(q.natureBasis.basis.inputNatures).toContain("THIRD_PARTY_DATA");
    expect(q.natureBasis.basis.inputs.methodology.methodRef).toBe(FUNDING_RELATIONSHIP_METHOD_REF);
    // Les preuves voyagent avec la qualification.
    expect(q.evidence.txSignatures).toEqual(["sigA", "sigB"]);
  });

  it("l'ordre d'évaluation privilégie toujours la lecture la plus FAIBLE", () => {
    // Poussière ET exchange ET sujet : la poussière l'emporte.
    const q = qualifyFundingRelationship({
      funder: S1, subjectsReached: [S1, S2],
      edges: [{ ...edge(S2, 1_000, "sigA"), fromWallet: S1 }],
      addressLabel: { ...exchangeLabel, address: S1 }, coverage: COMPLETE,
    });
    expect(q.category).toBe("DUST");
  });

  it("la qualification est déterministe", () => {
    const input = {
      funder: FUNDER, subjectsReached: [S1, S2],
      edges: [edge(S1, BIG, "sigA"), edge(S2, BIG, "sigB")], coverage: COMPLETE,
    };
    expect(qualifyFundingRelationship(input)).toEqual(qualifyFundingRelationship(input));
  });
});
