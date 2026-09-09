// ─── BUILD 12 · S3.2 — UN RÉSULTAT SUPPRIMÉ NE CONCLUT JAMAIS ──────────────
//
// ██  « Trouvé, et retiré » n'est PAS « rien trouvé ».                     ██
//
// ─── Le défaut, et il a été SERVI ─────────────────────────────────────────
//
// ██ J'AI D'ABORD DÉSIGNÉ LA MAUVAISE ADRESSE, ET LE PHÉNOMÈNE EST PIRE. ██
//
// J'avais nommé `0xa5b0edf6…01d41` « réellement sanctionnée OFAC ». MESURÉ :
// son observation `ofac`/SANCTION est `listIsActive: false`. Sa seule
// observation ACTIVE est `forta`/HIGH, écartée par la provenance (AX). Elle
// n'est PAS sanctionnée activement.
//
// Le vrai témoin, mesuré le 2026-09-09 :
//
//   TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz — observation `ofac`/SANCTION ACTIVE
//
//   matcher, en local     matchCount: 1   hasSanction: TRUE
//   /api/scan/intelligence servi          hasSanction: false, NO_MATCH_COMPLETE
//
// Le matcher TROUVE la sanction. La ROUTE la remplace par une affirmation
// concluante de propreté. 866 des 867 entités à observation OFAC active sont
// dans ce cas — une seule est `RETAIL_SAFE`.
//
// ─── ET LA SUPPRESSION N'EST PAS OÙ JE CROYAIS ────────────────────────────
//
// Deux étages, que j'avais confondus :
//
//   MATCHER  `admitObservations` écarte une observation non provenancée (AX).
//            MESURÉ : `displaySafety` n'y change RIEN — il retient dans les
//            deux cas. Concerne 3 lignes `forta` aujourd'hui.
//   ROUTE    la gate `displaySafety !== RETAIL_SAFE` réécrit un match trouvé
//            en `hasSanction: false`. Concerne 866 entités OFAC.
//
// Les deux produisent la même confusion et se corrigent de la même façon.
// Ce fichier prouve l'étage MATCHER, qui est libre.
//
// ─── La non-monotonie, un étage plus haut ─────────────────────────────────
//
// Avant S3.1 la même route disait `NO_MATCH_PARTIAL` / conclusif `false`. Ce
// `PARTIAL` était une dégradation PERMANENTE — un défaut réel, corrigé à
// juste titre. Mais il faisait VOILE : en le retirant, un silence est devenu
// une affirmation.
//
// C'est exactement le plafond à 72 : retirer un défaut réel a AUGMENTÉ ce que
// le produit affirme, ici dans le sens NON SÛR.
//
// ─── L'axe manquant existait déjà ─────────────────────────────────────────
//
// `absenceVocabulary.ts` porte DEUX axes ratifiés, et celui de PUBLICATION
// contient `WITHHELD`. Aucun état n'est inventé ici — le vocabulaire était
// posé, c'est le CONTRAT qui ne le consommait pas.
//
//   WITHHELD      trouvé, retiré pour cette audience   PUBLICATION
//   NOT_MEASURED  jamais mesuré                        MEASUREMENT
//   négatif réel  mesuré, rien trouvé                  —
//
// Trois états, trois significations. Les confondre serait refaire le P0 qui a
// ouvert S3, sous un troisième visage.
//
// ─── Ce que ce corpus ne fait PAS ─────────────────────────────────────────
//
// Il ne révèle rien du retrait — ni source, ni classe de risque, ni compte. Il
// ne promeut aucune entité en RETAIL_SAFE. Il ne change pas l'admissibilité
// retail ratifiée en AM. Il fait cesser une affirmation, rien de plus.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assessSanction,
  negativeIsConclusiveForAudience,
  buildSanctionCoverage,
} from "@/lib/intelligence/sanctionCoverage";
import { PUBLICATION_STATES, MEASUREMENT_STATES } from "@/lib/publication/absenceVocabulary";
import type { FreshnessVerdict } from "@/lib/watchdog/sourceFreshness";

const v = (sourceSlug: string, state: string): FreshnessVerdict =>
  ({ sourceSlug, state, ageDays: state === "FRESH" ? 1 : null, limitDays: 7, measuredField: "intel_ingestion_batches.completedAt(status=success)" }) as FreshnessVerdict;

/** L'état RÉEL : `ofac` armé et frais, `amf`/`fca` jamais exécutées. */
const COUV_REELLE = buildSanctionCoverage([v("ofac", "FRESH")]);
/** Une régulatrice ARMÉE mais PÉRIMÉE — construite, aucune n'est dans cet état. */
const COUV_PARTIELLE = buildSanctionCoverage([v("ofac", "FRESH"), v("amf", "STALE"), v("fca", "FRESH")]);

// ═══ S3.2/A — LA RÈGLE ═══════════════════════════════════════════════════

describe("S3.2/A — un résultat retiré ne produit jamais un négatif concluant", () => {
  it("MUTANT — le cas SERVI en production : couverture complète + retrait", () => {
    // C'est exactement TA3941uFAvmVib… : `ofac` consulté et frais, donc
    // couverture COMPLETE, et un match TROUVÉ puis retiré pour le retail.
    expect(COUV_REELLE.negativeIsConclusive).toBe(true);
    expect(assessSanction(false, COUV_REELLE, "WITHHELD")).toBe("NO_MATCH_PARTIAL");
    expect(assessSanction(false, COUV_REELLE, "WITHHELD")).not.toBe("NO_MATCH_COMPLETE");
    expect(negativeIsConclusiveForAudience(COUV_REELLE, "WITHHELD")).toBe(false);
  });

  it("MUTANT — SUR-CORRECTION : un négatif VRAI garde sa conclusion", () => {
    // ██ Le piège symétrique, et il est aussi grave.
    //
    // Si toute absence devenait non concluante, on aurait remplacé une fausse
    // réassurance par un WARN permanent — et l'alerte redevient le fond. C'est
    // le défaut que S3.1 vient de fermer, réintroduit par l'autre bout.
    expect(assessSanction(false, COUV_REELLE, "PUBLISHED")).toBe("NO_MATCH_COMPLETE");
    expect(negativeIsConclusiveForAudience(COUV_REELLE, "PUBLISHED")).toBe(true);
    // Et le DÉFAUT du paramètre est `PUBLISHED` : un appelant qui ne sait rien
    // d'un retrait n'en invente pas un.
    expect(assessSanction(false, COUV_REELLE)).toBe("NO_MATCH_COMPLETE");
    expect(negativeIsConclusiveForAudience(COUV_REELLE)).toBe(true);
  });

  it("les DEUX axes doivent tenir — aucun ne rachète l'autre", () => {
    // Couverture incomplète + publication normale → ne conclut pas.
    expect(assessSanction(false, COUV_PARTIELLE, "PUBLISHED")).toBe("NO_MATCH_PARTIAL");
    // Couverture complète + publication retirée → ne conclut pas non plus.
    expect(assessSanction(false, COUV_REELLE, "WITHHELD")).toBe("NO_MATCH_PARTIAL");
    // Les deux en défaut → toujours pas.
    expect(assessSanction(false, COUV_PARTIELLE, "WITHHELD")).toBe("NO_MATCH_PARTIAL");
    // Les deux bons → et seulement là.
    expect(assessSanction(false, COUV_REELLE, "PUBLISHED")).toBe("NO_MATCH_COMPLETE");
  });

  it("`NOT_PUBLISHED` ne conclut pas davantage que `WITHHELD`", () => {
    // Le troisième jeton de l'axe. On n'exige PAS qu'il signifie la même
    // chose — on exige qu'aucun état non-`PUBLISHED` n'autorise à conclure.
    for (const etat of PUBLICATION_STATES) {
      const attendu = etat === "PUBLISHED" ? "NO_MATCH_COMPLETE" : "NO_MATCH_PARTIAL";
      expect(assessSanction(false, COUV_REELLE, etat), `état ${etat}`).toBe(attendu);
    }
  });

  it("TROUVER PRIME — un match réel sort toujours, un retrait ne l'efface pas", () => {
    for (const etat of PUBLICATION_STATES) {
      expect(assessSanction(true, COUV_REELLE, etat)).toBe("MATCHED");
      expect(assessSanction(true, COUV_PARTIELLE, etat)).toBe("MATCHED");
    }
  });
});

// ═══ S3.2/B — LES DEUX AXES NE SE COLLAPSENT PAS ═════════════════════════

describe("S3.2/B — publication et mesure restent deux axes", () => {
  it("MUTANT — `WITHHELD` n'appartient PAS à l'axe de mesure", () => {
    // Le piège central : typer le retrait en `NOT_MEASURED` ferait disparaître
    // la décision derrière une lacune. Rien n'aurait été « pas mesuré » — on a
    // mesuré, et on a retiré.
    expect(MEASUREMENT_STATES).not.toContain("WITHHELD");
    expect(PUBLICATION_STATES).toContain("WITHHELD");
    expect(PUBLICATION_STATES).not.toContain("NOT_MEASURED");
  });

  it("les trois significations restent DISTINGUABLES dans la sortie", () => {
    // 1 · retiré       couverture complète, publication retirée
    // 2 · pas mesuré   couverture incomplète, publication normale
    // 3 · rien trouvé  couverture complète, publication normale
    const retire = {
      assessment: assessSanction(false, COUV_REELLE, "WITHHELD"),
      conclusif: negativeIsConclusiveForAudience(COUV_REELLE, "WITHHELD"),
      couverture: COUV_REELLE.state,
      publication: "WITHHELD",
    };
    const pasMesure = {
      assessment: assessSanction(false, COUV_PARTIELLE, "PUBLISHED"),
      conclusif: negativeIsConclusiveForAudience(COUV_PARTIELLE, "PUBLISHED"),
      couverture: COUV_PARTIELLE.state,
      publication: "PUBLISHED",
    };
    const rienTrouve = {
      assessment: assessSanction(false, COUV_REELLE, "PUBLISHED"),
      conclusif: negativeIsConclusiveForAudience(COUV_REELLE, "PUBLISHED"),
      couverture: COUV_REELLE.state,
      publication: "PUBLISHED",
    };
    // Les trois doivent être deux à deux distincts EN TANT QUE TRIPLETS.
    // `assessment` seul ne suffit pas : `retire` et `pasMesure` partagent
    // `NO_MATCH_PARTIAL`, et c'est VOULU — ils ne concluent ni l'un ni l'autre.
    // Ce qui doit les séparer est la RAISON, portée par les deux autres champs.
    const triplets = [retire, pasMesure, rienTrouve].map((x) =>
      JSON.stringify([x.couverture, x.publication, x.conclusif]),
    );
    expect(new Set(triplets).size, "deux causes d'absence sont indistinguables").toBe(3);
    // Et la raison de chacun est lisible sans deviner.
    expect(retire.couverture).toBe("COMPLETE");
    expect(pasMesure.publication).toBe("PUBLISHED");
    expect(rienTrouve.conclusif).toBe(true);
  });

  it("le retrait NE RÉVÈLE RIEN de ce qui est retiré", () => {
    // La contrainte de containment : on cesse d'affirmer, on ne divulgue pas.
    // La sortie ne porte ni source, ni classe de risque, ni compte.
    const sortie = JSON.stringify({
      assessment: assessSanction(false, COUV_REELLE, "WITHHELD"),
      publicationState: "WITHHELD",
    });
    for (const fuite of ["ofac", "SANCTION", "HIGH", "matchCount", "riskClass", "sourceSlug"]) {
      expect(sortie, `fuite : ${fuite}`).not.toContain(fuite);
    }
  });
});

// ═══ S3.2/C — LE MATCHER, avec la VRAIE admissibilité ════════════════════
//
// `admitObservations` n'est PAS mocké : c'est la gate ratifiée en AM qui
// décide, et la mocker prouverait mon propre mock. Seule la base l'est.

const entiteMock = { findUnique: vi.fn() };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    canonicalEntity: { findUnique: (...a: unknown[]) => entiteMock.findUnique(...a) },
    // `lookupValue` charge la politique et la provenance lui-même. On rend le
    // registre RÉEL tel que mesuré : `forta` actif et public — donc admissible
    // par la POLITIQUE — et AUCUNE fenêtre d'ingestion pour lui. C'est bien la
    // provenance qui l'écarte, pas la politique.
    sourceRegistry: {
      findMany: async () => [
        { handle: "ofac", status: "active", defaultVisibility: "public" },
        { handle: "forta", status: "active", defaultVisibility: "public" },
      ],
    },
    intelIngestionBatch: {
      findMany: async () => [
        { sourceSlug: "ofac", startedAt: new Date("2020-01-01"), completedAt: new Date("2030-01-01") },
      ],
    },
  },
}));

const POLICY = new Map([
  ["ofac", { retailAdmissible: true }],
  // MESURÉ : `forta` est retail-admissible au registre. Ce n'est donc PAS la
  // politique de source qui l'écarte — c'est la provenance d'ingestion (AX).
  ["forta", { retailAdmissible: true }],
]);
/**
 * MESURÉ le 2026-09-09 : `ofac` a 29 fenêtres d'ingestion, `forta` AUCUNE.
 * Ses 3 observations ont été écrites hors pipeline — c'est le défaut AX, déjà
 * au backlog, et c'est LUI qui retient au niveau du matcher.
 *
 * J'ai d'abord cru que `displaySafety: INTERNAL_ONLY` était la gate du
 * matcher. MESURÉ : `admitObservations` retient dans les DEUX cas. Le
 * `displaySafety` est la gate des ROUTES, pas du matcher — deux étages
 * distincts, et les confondre m'a fait écrire une fixture qui ne prouvait
 * rien.
 */
const PROVENANCE = new Map([["ofac", [{ from: new Date("2020-01-01"), to: new Date("2030-01-01") }]]]);

const observation = () => ({
  id: "o1",
  sourceSlug: "ofac",
  sourceTier: 1,
  riskClass: "SANCTION",
  matchBasis: "EXACT",
  listIsActive: true,
  externalUrl: null,
  observedAt: new Date("2026-09-01"),
  ingestedAt: new Date("2026-09-01"),
});

beforeEach(() => entiteMock.findUnique.mockReset());

describe("S3.2/C — le matcher distingue les deux absences", () => {
  it("MUTANT — entité RETIRÉE au retail → WITHHELD, et le signal reste vide", async () => {
    const { matchEntity } = await import("@/lib/intelligence/matcher");
    entiteMock.findUnique.mockResolvedValue({
      isActive: true,
      displaySafety: "INTERNAL_ONLY",
      riskClass: "HIGH",
      // `forta` n'a AUCUNE fenêtre d'ingestion : l'observation est écrite hors
      // pipeline, donc non provenancée, donc écartée par AX. C'est le cas RÉEL
      // des 3 lignes forta mesurées en production.
      observations: [{ ...observation(), sourceSlug: "forta", riskClass: "HIGH" }],
    });
    const s = await matchEntity({ type: "ADDRESS", value: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41" }, "RETAIL", POLICY, PROVENANCE);
    expect(s.publicationState).toBe("WITHHELD");
    // ██ Et RIEN n'est divulgué : le signal est vide, comme avant.
    expect(s.matchCount).toBe(0);
    expect(s.hasSanction).toBe(false);
    expect(s.topRiskClass).toBeNull();
    expect(s.sourceSlug).toBeNull();
    // La conclusion qui en découle cesse d'affirmer.
    expect(assessSanction(s.hasSanction, COUV_REELLE, s.publicationState)).toBe("NO_MATCH_PARTIAL");
  });

  it("MUTANT — entité INCONNUE → PUBLISHED, le négatif reste concluant", async () => {
    // La sur-correction : si l'entité inconnue sortait WITHHELD, tout scan
    // deviendrait non concluant. C'est le cas le plus fréquent de loin.
    const { matchEntity } = await import("@/lib/intelligence/matcher");
    entiteMock.findUnique.mockResolvedValue(null);
    const s = await matchEntity({ type: "ADDRESS", value: "0x00" }, "RETAIL", POLICY, PROVENANCE);
    expect(s.publicationState).toBe("PUBLISHED");
    expect(assessSanction(s.hasSanction, COUV_REELLE, s.publicationState)).toBe("NO_MATCH_COMPLETE");
  });

  it("entité connue SANS observation active → PUBLISHED, pas WITHHELD", async () => {
    // Rien d'actif n'existe : rien n'a été retiré. Une liste OFAC dont
    // l'entrée a été levée doit produire un négatif VRAI, pas un soupçon
    // permanent.
    const { matchEntity } = await import("@/lib/intelligence/matcher");
    entiteMock.findUnique.mockResolvedValue({
      isActive: true,
      displaySafety: "RETAIL_SAFE",
      riskClass: "LOW",
      observations: [],
    });
    const s = await matchEntity({ type: "ADDRESS", value: "0x01" }, "RETAIL", POLICY, PROVENANCE);
    expect(s.publicationState).toBe("PUBLISHED");
  });

  it("SUR-CORRECTION — un match ADMISSIBLE sort normalement, en PUBLISHED", async () => {
    const { matchEntity } = await import("@/lib/intelligence/matcher");
    entiteMock.findUnique.mockResolvedValue({
      isActive: true,
      displaySafety: "RETAIL_SAFE",
      riskClass: "SANCTION",
      observations: [observation()],
    });
    const s = await matchEntity({ type: "ADDRESS", value: "0x02" }, "RETAIL", POLICY, PROVENANCE);
    expect(s.publicationState).toBe("PUBLISHED");
    expect(s.matchCount).toBe(1);
    expect(s.hasSanction).toBe(true);
    expect(assessSanction(s.hasSanction, COUV_REELLE, s.publicationState)).toBe("MATCHED");
  });

  it("MUTANT — `lookupValue` ne PERD PAS le retrait dans sa boucle de types", async () => {
    // Elle essaie jusqu'à cinq types et ne gardait que le premier `matchCount
    // > 0`. Un signal WITHHELD, ayant `matchCount: 0`, était jeté avec les
    // autres et l'absence redevenait indistinguable d'un vrai négatif.
    const { lookupValue } = await import("@/lib/intelligence/matcher");
    let appel = 0;
    entiteMock.findUnique.mockImplementation(async () => {
      appel += 1;
      // Seul le DEUXIÈME type essayé porte l'entité retirée. Si la boucle
      // perdait le retrait, le troisième appel l'écraserait.
      return appel === 2
        ? {
            isActive: true,
            displaySafety: "INTERNAL_ONLY",
            riskClass: "HIGH",
            observations: [{ ...observation(), sourceSlug: "forta", riskClass: "HIGH" }],
          }
        : null;
    });
    const s = await lookupValue("0xa5b0edf6b55128e0ddae8e51ac538c3188401d41", undefined, "RETAIL");
    expect(appel, "la boucle doit avoir essayé plusieurs types").toBeGreaterThan(2);
    expect(s.publicationState).toBe("WITHHELD");
    expect(s.matchCount).toBe(0);
  });
});
