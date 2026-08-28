import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DN_C1_CALCULATION_IS_NOT_CLAIM,
  DN_C2_MONETARY_SEMANTIC_IDENTITY,
  MONETARY_SEMANTIC_KINDS,
  W2_LAB_CASE,
} from "@/lib/data-nature/claims";

describe("DN-C1 · un calcul juste n'est pas une affirmation juste", () => {
  it("le cas fondateur porte un montant EXACT sous une identité FAUSSE", () => {
    // C'est tout l'invariant : l'arithmétique se reproduit, et pourtant la
    // publication était fausse.
    expect(100_000_000 * 4.82).toBeCloseTo(W2_LAB_CASE.amountUsd, -5);
    expect(W2_LAB_CASE.actualKind).toBe("NOTIONAL_VALUE");
    expect(W2_LAB_CASE.publishedAsKind).toBe("RETAIL_HARM");
    expect(W2_LAB_CASE.actualKind).not.toBe(W2_LAB_CASE.publishedAsKind);
  });

  it("l'invariant est énoncé, pas seulement nommé", () => {
    expect(DN_C1_CALCULATION_IS_NOT_CLAIM).toMatch(/arithmetic/i);
    expect(DN_C1_CALCULATION_IS_NOT_CLAIM).toMatch(/asserted/i);
  });
});

describe("DN-C2 · un montant seul n'a pas d'identité", () => {
  it("les huit grandeurs monétaires sont distinctes et fermées", () => {
    expect(new Set(MONETARY_SEMANTIC_KINDS).size).toBe(MONETARY_SEMANTIC_KINDS.length);
    for (const k of [
      "MARKET_CAP", "FDV", "NOTIONAL_VALUE", "REALIZED_PROCEEDS",
      "DOCUMENTED_TRANSFERS", "INVESTOR_LOSSES", "RETAIL_HARM", "ESTIMATE",
    ]) {
      expect(MONETARY_SEMANTIC_KINDS).toContain(k);
    }
  });

  it("aucune méthodologie gelée ne couvre la valeur notionnelle", () => {
    // Ni est-proceeds (non réalisé) ni est-investor-losses (autre population).
    // Le null est le résultat, pas un oubli.
    expect(W2_LAB_CASE.applicableMethodRef).toBeNull();
  });

  it("les deux étages de nature sont distincts", () => {
    // La quantité vient d'un tiers ; la valorisation est notre opération.
    expect(W2_LAB_CASE.quantityNature).toBe("THIRD_PARTY_DATA");
    expect(W2_LAB_CASE.quantityAttributedTo).toBe("ZachXBT");
    expect(W2_LAB_CASE.valuationNature).toBe("ESTIMATE");
  });

  it("l'invariant énumère les grandeurs, il ne se contente pas de les évoquer", () => {
    for (const w of ["market cap", "FDV", "notional", "realized proceeds", "retail harm"]) {
      expect(DN_C2_MONETARY_SEMANTIC_IDENTITY.toLowerCase()).toContain(w.toLowerCase());
    }
  });
});

describe("W2 · la surface publique ne dit plus « les particuliers ont perdu 482 M$ »", () => {
  const view = readFileSync(
    join(process.cwd(), "src/components/cases/TokenCasefileView.tsx"),
    "utf8",
  );

  it("le label « Estimated retail harm » a disparu du composant", () => {
    expect(view).not.toContain("Estimated retail harm");
    expect(view).not.toContain("Préjudice retail estimé");
  });

  it("le nouveau label nomme la grandeur réelle", () => {
    expect(view).toContain("Insider exit notional value");
  });

  it("le caveat de flottant est présent et chiffré", () => {
    expect(view).toMatch(/131%/);
    expect(view.toLowerCase()).toContain("could not have been liquidated");
  });

  it("l'échelle est rapportée à la market cap circulante, jamais au FDV", () => {
    expect(view).toContain("circulating market capitalization");
    // Le FDV reste une métrique de marché, mais il n'est jamais le
    // dénominateur qui donnerait au 482 M$ l'air modeste.
    const scaleLine = view.split("\n").find((l) => l.includes("144%")) ?? "";
    expect(scaleLine).not.toMatch(/fdv/i);
  });

  it("la valeur notionnelle est explicitement dite non réalisée et non retail", () => {
    expect(view).toContain("not realized proceeds or estimated retail losses");
  });
});
