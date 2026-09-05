// ─────────────────────────────────────────────────────────────────────────────
// DN-F4 — Le régime ROW, enfin exercé.
//
// Les régimes DECLARED, DECLARED_PREDICATE et FIELD étaient couverts. ROW ne
// l'était par AUCUN test, et c'est exactement là que le lecteur lisait la
// mauvaise colonne : `row.nature` au lieu de `row.rowNature`. Mesuré le
// 2026-09-05 sur ep-square-band, aucune table de la base ne porte de colonne
// `nature` nue — la lecture ne pouvait jamais aboutir, et les cinq tables du
// régime rendaient UNCLASSIFIED quoi qu'il y ait en base.
//
// Ces tests fixent les quatre comportements attendus. Le premier aurait échoué
// avant le correctif ; les trois autres verrouillent ce qu'il ne doit PAS faire.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { NATURE_REGISTRY, natureForRow, natureForField } from "@/lib/data-nature/registry";
import { UNCLASSIFIED, UnpublishableNatureError, DATA_NATURES } from "@/lib/data-nature/nature";
import { decorate } from "@/lib/data-nature/dto";

/** Les cinq tables déclarées en régime ROW. */
const ROW_TABLES = ["EvidenceItem", "KolTokenInvolvement", "KolWallet", "KolCase", "MmClaim"];

describe("DN-F4 — le régime ROW lit `rowNature`, la colonne autoritaire", () => {
  it("les cinq tables attendues sont bien en régime ROW", () => {
    for (const t of ROW_TABLES) {
      expect(NATURE_REGISTRY[t]?.regime, t).toBe("ROW");
    }
  });

  // ── 1. rowNature valide → la nature correcte ─────────────────────────────
  it("un `rowNature` valide rend la nature qu'il porte, pour chaque table et chaque nature", () => {
    for (const t of ROW_TABLES) {
      for (const n of DATA_NATURES) {
        expect(natureForRow(t, { rowNature: n }), `${t}/${n}`).toBe(n);
      }
    }
  });

  it("le cas réel : les 29 KolWallet en THIRD_PARTY_DATA cessent d'être UNCLASSIFIED", () => {
    // Mesuré le 2026-09-05 : KolWallet porte 29 lignes rowNature='THIRD_PARTY_DATA'
    // (les analyses @dethective). Avant le correctif, natureForRow les rendait
    // toutes UNCLASSIFIED — la classification écrite en base n'était jamais lue.
    expect(natureForRow("KolWallet", { rowNature: "THIRD_PARTY_DATA" })).toBe("THIRD_PARTY_DATA");
    // KolCase : 7 ESTIMATE + 3 INFERENCE mesurées le même jour.
    expect(natureForRow("KolCase", { rowNature: "ESTIMATE" })).toBe("ESTIMATE");
    expect(natureForRow("KolCase", { rowNature: "INFERENCE" })).toBe("INFERENCE");
  });

  // ── 2. absent → UNCLASSIFIED, fail-closed ────────────────────────────────
  it("`rowNature` absent, null ou undefined → UNCLASSIFIED (jamais un défaut implicite)", () => {
    for (const t of ROW_TABLES) {
      expect(natureForRow(t, {}), `${t}/absent`).toBe(UNCLASSIFIED);
      expect(natureForRow(t, { rowNature: null }), `${t}/null`).toBe(UNCLASSIFIED);
      expect(natureForRow(t, { rowNature: undefined }), `${t}/undefined`).toBe(UNCLASSIFIED);
    }
  });

  it("UNCLASSIFIED explicitement écrit en base reste refusé à la publication", () => {
    // Mesuré : 41 EvidenceItem et 15 KolTokenInvolvement portent littéralement
    // UNCLASSIFIED. Le correctif les lit maintenant — et elles restent
    // impubliables, pour la BONNE raison : elles se déclarent non classées.
    expect(natureForRow("EvidenceItem", { rowNature: UNCLASSIFIED })).toBe(UNCLASSIFIED);
    expect(() => decorate("EvidenceItem", { rowNature: UNCLASSIFIED }, "test")).toThrow(
      UnpublishableNatureError,
    );
  });

  it("une ligne sans nature ne publie rien — decorate lève", () => {
    for (const t of ROW_TABLES) {
      expect(() => decorate(t, {}, "test"), t).toThrow(UnpublishableNatureError);
    }
  });

  // ── 3. invalide → rejet ──────────────────────────────────────────────────
  it("une valeur hors énumération est REJETÉE, pas castée en nature", () => {
    // Avant : `typeof v === "string" ? (v as NatureValue) : UNCLASSIFIED` —
    // n'importe quelle chaîne ressortait comme une nature et franchissait
    // assertPublishable, qui ne refuse que le littéral UNCLASSIFIED.
    for (const bad of ["", "GARBAGE", "primary_observation", "PRIMARY OBSERVATION", "Inference"]) {
      expect(natureForRow("EvidenceItem", { rowNature: bad }), bad).toBe(UNCLASSIFIED);
    }
    expect(() => decorate("EvidenceItem", { rowNature: "GARBAGE" }, "test")).toThrow(
      UnpublishableNatureError,
    );
  });

  it("un type non-chaîne ne devient pas une nature", () => {
    for (const bad of [42, true, {}, [], { toString: () => "INFERENCE" }]) {
      expect(natureForRow("KolCase", { rowNature: bad })).toBe(UNCLASSIFIED);
    }
  });

  // ── 4. aucun repli silencieux vers `nature` ──────────────────────────────
  it("AUCUN repli sur `nature` : une ligne qui ne porte que `nature` reste UNCLASSIFIED", () => {
    // C'est le verrou du correctif. Un `row.rowNature ?? row.nature` rendrait
    // le lecteur compatible avec une colonne qui n'existe dans AUCUNE table de
    // la base, et masquerait la prochaine faute de nom.
    for (const t of ROW_TABLES) {
      expect(natureForRow(t, { nature: "PRIMARY_OBSERVATION" }), t).toBe(UNCLASSIFIED);
    }
    expect(() => decorate("EvidenceItem", { nature: "PRIMARY_OBSERVATION" }, "test")).toThrow(
      UnpublishableNatureError,
    );
  });

  it("`rowNature` gouverne même quand `nature` le contredit", () => {
    const row = { rowNature: "ESTIMATE", nature: "PRIMARY_OBSERVATION" };
    expect(natureForRow("KolCase", row)).toBe("ESTIMATE");
  });

  // ── Cohérence avec le reste du module ────────────────────────────────────
  it("natureForField retombe sur la ligne pour une table ROW — même lecture", () => {
    // Une table ROW n'a pas de `fields` : natureForField délègue à natureForRow.
    expect(natureForField("EvidenceItem", "provenanceType", { rowNature: "PRIMARY_OBSERVATION" }))
      .toBe("PRIMARY_OBSERVATION");
    expect(natureForField("EvidenceItem", "provenanceType", { nature: "PRIMARY_OBSERVATION" }))
      .toBe(UNCLASSIFIED);
  });

  it("une ligne classée traverse decorate et porte son enveloppe", () => {
    const dto = decorate("KolWallet", { rowNature: "THIRD_PARTY_DATA", address: "0xabc" }, "test");
    expect(dto._nature.nature).toBe("THIRD_PARTY_DATA");
    expect(dto.address).toBe("0xabc");
  });

  it("ESTIMATE reste soumise à Q5 — la lecture correcte n'affaiblit pas la méthode", () => {
    // KolCase porte 7 ESTIMATE. Maintenant qu'elles sont LUES, elles tombent
    // sous l'obligation de methodRef : lire correctement resserre le contrôle.
    expect(() => decorate("KolCase", { rowNature: "ESTIMATE" }, "test")).toThrow(
      /methodRef|INFALSIFIABLE/,
    );
    const ok = decorate("KolCase", { rowNature: "ESTIMATE" }, "test", {
      methodRef: "retail-harm/estimate@v1",
    });
    expect(ok._nature.nature).toBe("ESTIMATE");
  });
});
