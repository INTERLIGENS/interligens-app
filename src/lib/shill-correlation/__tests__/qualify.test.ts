// --- B2 — le prédicat, et ce qu'il refuse ---------------------------------
//
// Ce que ces tests tiennent : CHAQUE critère est une porte, seul et
// indépendamment. Un critère qu'on peut retirer sans qu'un test tombe n'est
// pas une garde, c'est une décoration.
//
// La méthode est la même partout : on part d'un candidat qualifié, on casse UN
// critère, et le verdict doit basculer en nommant celui-là.

import { describe, it, expect } from "vitest";
import {
  MIN_SIGNAL_SCORE,
  PROMOTION_QUALIFY_RULE_VERSION,
  QUALIFY_CRITERIA,
  qualifyPromotion,
  type PromotionCandidateInput,
} from "../qualify";

const SOL = "3ghKZfLZJawWRWhSvgreiTDeyFPS4Kriy6v4Fbk3pump";

/** Un candidat qui franchit les cinq portes. Le point de départ de tout test. */
const qualifie = (): PromotionCandidateInput => ({
  ingestionMode: "LIVE",
  signalTypes: '["ca_drop","nice_pump"]',
  signalScore: 65,
  detectedTokens: '["NET"]',
  detectedAddresses: `["${SOL}"]`,
});

describe("B2 - le candidat de référence est qualifié", () => {
  it("les cinq critères franchis → qualified", () => {
    const r = qualifyPromotion(qualifie());
    expect(r.qualified).toBe(true);
    expect(r.failedCriterion).toBeNull();
    expect(Object.values(r.criteria).every(Boolean)).toBe(true);
  });

  it("la règle est NOMMÉE et déclarée conservatrice", () => {
    // B4 citera cette version dans le natureBasis. Une qualification dont on
    // ne peut pas relire la règle n'est pas auditable.
    const r = qualifyPromotion(qualifie());
    expect(r.ruleVersion).toBe(PROMOTION_QUALIFY_RULE_VERSION);
    // B4.1 : le ref canonique, qui RESOUT sur un artefact gele. Le slug nu
    // « promotion-qualify@v1 » etait refuse par la grammaire.
    expect(r.ruleVersion).toBe("social-promotion/qualify@v1");
    expect(r.conservative).toBe(true);
  });

  it("le motif d'une qualification dit CE QUI l'a qualifiée", () => {
    const r = qualifyPromotion(qualifie());
    expect(r.reason).toContain("LIVE");
    expect(r.reason).toContain("ca_drop");
    expect(r.reason).toContain("ticker unique");
  });
});

describe("B2 - chaque critère est une porte, seul", () => {
  it("ingestionMode ≠ LIVE → rejeté, et le motif le nomme", () => {
    const r = qualifyPromotion({ ...qualifie(), ingestionMode: "BACKFILL" });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("ingestion_mode_live");
    expect(r.reason).toContain("BACKFILL");
  });

  it("ingestionMode absent → rejeté", () => {
    const r = qualifyPromotion({ ...qualifie(), ingestionMode: null });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("ingestion_mode_live");
  });

  it("pas de ca_drop → rejeté : une mention n'est pas un largage de contrat", () => {
    const r = qualifyPromotion({ ...qualifie(), signalTypes: '["nice_pump"]' });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("signal_type_ca_drop");
    expect(r.reason).toContain("nice_pump");
  });

  it("signalTypes vide → rejeté", () => {
    const r = qualifyPromotion({ ...qualifie(), signalTypes: "[]" });
    expect(r.failedCriterion).toBe("signal_type_ca_drop");
  });

  it("detectedAddresses vide → rejeté : sans contrat, rien à corréler", () => {
    const r = qualifyPromotion({ ...qualifie(), detectedAddresses: "[]" });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("detected_addresses_present");
  });

  it("detectedAddresses absent → rejeté", () => {
    const r = qualifyPromotion({ ...qualifie(), detectedAddresses: null });
    expect(r.failedCriterion).toBe("detected_addresses_present");
  });

  it("multi-ticker → rejeté : l'appariement serait sans preuve", () => {
    const r = qualifyPromotion({ ...qualifie(), detectedTokens: '["NET","CETS"]' });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("single_ticker");
    expect(r.reason).toContain("2 tickers");
  });

  it("zéro ticker → rejeté, sous le même critère mais un motif distinct", () => {
    const r = qualifyPromotion({ ...qualifie(), detectedTokens: "[]" });
    expect(r.failedCriterion).toBe("single_ticker");
    expect(r.reason).toContain("aucun ticker");
  });
});

describe("B2 - la borne de score est INCLUSIVE", () => {
  it("50 passe", () => {
    expect(qualifyPromotion({ ...qualifie(), signalScore: MIN_SIGNAL_SCORE }).qualified).toBe(true);
  });

  it("49 ne passe pas", () => {
    const r = qualifyPromotion({ ...qualifie(), signalScore: MIN_SIGNAL_SCORE - 1 });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("signal_score_above_floor");
    expect(r.reason).toContain("49");
  });

  it("score absent compte pour 0, pas pour « inconnu donc on passe »", () => {
    const r = qualifyPromotion({ ...qualifie(), signalScore: null });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("signal_score_above_floor");
  });
});

describe("B2 - le cas comparatif, mesuré le 2026-09-03", () => {
  it("« $CETS didn't get the listing, went to $FLORK » est REJETÉ", () => {
    // Post réel. Deux tickers, aucune adresse : ce n'est pas une promotion,
    // c'est un commentaire de marché. C'est la forme ordinaire du bruit.
    const comparatif: PromotionCandidateInput = {
      ingestionMode: "LIVE",
      signalTypes: "[]",
      signalScore: 30,
      detectedTokens: '["CETS","FLORK"]',
      detectedAddresses: "[]",
    };
    const r = qualifyPromotion(comparatif);
    expect(r.qualified).toBe(false);
    // Il échoue au critère le plus AMONT — celui à lever en premier.
    expect(r.failedCriterion).toBe("signal_type_ca_drop");
  });

  it("même avec ca_drop et un bon score, le multi-ticker le retient", () => {
    // La garde ticker-unique est la dernière ligne : un comparatif enrichi
    // d'une CA ne doit pas passer pour autant.
    const r = qualifyPromotion({
      ingestionMode: "LIVE",
      signalTypes: '["ca_drop"]',
      signalScore: 100,
      detectedTokens: '["CETS","FLORK"]',
      detectedAddresses: `["${SOL}"]`,
    });
    expect(r.qualified).toBe(false);
    expect(r.failedCriterion).toBe("single_ticker");
  });
});

describe("B2 - l'ordre des refus va du plus amont au plus aval", () => {
  it("un candidat qui casse TOUT est rapporté sur le critère le plus amont", () => {
    // Le motif doit désigner ce qu'il faut lever EN PREMIER : un BACKFILL n'a
    // pas à être rapporté « score insuffisant », il n'aurait pas dû être
    // examiné.
    const r = qualifyPromotion({
      ingestionMode: "BACKFILL",
      signalTypes: "[]",
      signalScore: 0,
      detectedTokens: "[]",
      detectedAddresses: "[]",
    });
    expect(r.failedCriterion).toBe(QUALIFY_CRITERIA[0]);
  });

  it("`criteria` rapporte CHAQUE porte, pas seulement la première fermée", () => {
    // L'observabilité doit pouvoir compter les refus par cause, pas seulement
    // par première cause.
    const r = qualifyPromotion({
      ingestionMode: "BACKFILL",
      signalTypes: '["ca_drop"]',
      signalScore: 80,
      detectedTokens: '["NET"]',
      detectedAddresses: `["${SOL}"]`,
    });
    expect(r.criteria.ingestion_mode_live).toBe(false);
    expect(r.criteria.signal_type_ca_drop).toBe(true);
    expect(r.criteria.signal_score_above_floor).toBe(true);
    expect(r.criteria.single_ticker).toBe(true);
  });
});

describe("B2 - les formes réelles des colonnes sont acceptées", () => {
  it("tableau déjà parsé et chaîne JSON donnent le même verdict", () => {
    // `detectedTokens` est jsonb, `detectedAddresses` et `signalTypes` sont du
    // texte : le client pooled coerce l'un, pas les autres.
    const asString = qualifyPromotion(qualifie());
    const asArray = qualifyPromotion({
      ingestionMode: "LIVE",
      signalTypes: ["ca_drop", "nice_pump"],
      signalScore: 65,
      detectedTokens: ["NET"],
      detectedAddresses: [SOL],
    });
    expect(asArray.qualified).toBe(asString.qualified);
    expect(asArray.qualified).toBe(true);
  });

  it("une entrée illisible ne qualifie pas — elle ne lève pas non plus", () => {
    const r = qualifyPromotion({
      ingestionMode: "LIVE",
      signalTypes: "{pas du json",
      signalScore: 90,
      detectedTokens: "aussi cassé",
      detectedAddresses: undefined,
    });
    expect(r.qualified).toBe(false);
  });
});

describe("B2 - sélectivité sur un échantillon FIXTURE", () => {
  // ⚠ Cet échantillon reproduit la DISTRIBUTION mesurée le 2026-09-03 sur
  // 30 jours (1 366 posts), pas les données elles-mêmes. Il vérifie que le
  // prédicat est bien restrictif — il ne DÉMONTRE aucun volume de production.
  // Le chiffre de production est mesuré séparément, hors suite de tests.
  const echantillon: PromotionCandidateInput[] = [
    ...Array.from({ length: 259 }, () => ({ ...qualifie(), ingestionMode: "BACKFILL" })),
    ...Array.from({ length: 619 }, () => ({ ...qualifie(), signalTypes: '["nice_pump"]' })),
    ...Array.from({ length: 88 }, () => ({ ...qualifie(), detectedAddresses: "[]" })),
    ...Array.from({ length: 181 }, () => ({ ...qualifie(), signalScore: 30 })),
    ...Array.from({ length: 122 }, () => ({ ...qualifie(), detectedTokens: '["A","B"]' })),
    ...Array.from({ length: 97 }, () => qualifie()),
  ];

  it("le prédicat retient une petite minorité de l'échantillon", () => {
    const retenus = echantillon.filter((c) => qualifyPromotion(c).qualified).length;
    expect(retenus).toBe(97);
    expect(retenus / echantillon.length).toBeLessThan(0.15);
  });

  it("chaque refus porte un motif — aucun rejet muet", () => {
    for (const c of echantillon) {
      const r = qualifyPromotion(c);
      if (!r.qualified) {
        expect(r.failedCriterion).not.toBeNull();
        expect(r.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
