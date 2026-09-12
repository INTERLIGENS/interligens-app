// ─── LE VERROU DE REQUALIFICATION DES REPLIS ─────────────────────────────
//
//   « A non-emitted governed field cannot regain publication capability
//     without requalifying every fallback value associated with that field. »
//
// ─── LE DÉFAUT QU'IL EMPÊCHE DE SE RÉVEILLER SEUL ───────────────────────
//
// `PROFONDEUR_INDECIDABLE = "indecidable"` est une valeur de repli SERVABLE.
// Elle est rendue quand l'agrégation de profondeur échoue — fail-closed, et
// c'est correct. Elle n'atteint aucune charge AUJOURD'HUI, pour une seule
// raison : ses deux porteurs, `evidenceDepth` et `documentationStatus`, sont
// dans `CHAMPS_NON_EMIS`.
//
// Cette protection est INDIRECTE, et c'est ce qui la rend fragile. Le jour où
// quelqu'un réémet `evidenceDepth` — parce qu'une décision le fonde enfin —
// il émettra AUSSI « indecidable » comme valeur publique, sans jamais avoir
// décidé ce que ce mot affirme d'un dossier. Un repli non qualifié se
// réveillerait dans le même commit que la qualification d'un CHAMP, et
// personne ne l'aurait vu.
//
// ─── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ───────────────────────
//
// C'est UN TEST, pas un chantier. Il ne répare rien : « indecidable » reste
// exactement ce qu'il est. Il rend simplement impossible de réémettre l'un de
// ces champs SANS passer par ici — et passer par ici, c'est écrire à la main
// que le repli a reçu une sémantique gouvernée, devant quelqu'un.
//
// Classé P1 HARDENING / LATENT PROPAGATION RISK. Le verrou est P0 parce qu'il
// ne coûte rien et qu'il empêche le P1 de devenir un P0 par surprise.

import { describe, it, expect } from "vitest";
import { CHAMPS_NON_EMIS, projeterDossierServi } from "@/lib/explorer/explorerItems";
import { PROFONDEUR_INDECIDABLE } from "@/lib/governance/invariants/evidenceDepth";

/**
 * LE REGISTRE DES REPLIS NON QUALIFIÉS.
 *
 * Une entrée dit : « ce champ, s'il était émis, publierait CETTE valeur de
 * repli, et cette valeur n'a reçu aucune sémantique gouvernée ».
 *
 * On ne RETIRE une entrée qu'après avoir qualifié le repli — c'est-à-dire
 * après avoir écrit ce qu'il affirme d'un dossier, et quelle décision le
 * fonde. Le retirer pour faire passer un test serait le geste que ce fichier
 * existe pour rendre visible.
 */
const REPLIS_NON_QUALIFIES: ReadonlyArray<{
  readonly champ: (typeof CHAMPS_NON_EMIS)[number];
  readonly repli: string;
  readonly pourquoiNonQualifie: string;
}> = [
  {
    champ: "evidenceDepth",
    repli: PROFONDEUR_INDECIDABLE,
    pourquoiNonQualifie:
      "rendu quand l'agregation de profondeur echoue. Aucune decision ne dit ce que « indecidable » affirme d'un dossier publie.",
  },
  {
    champ: "documentationStatus",
    repli: PROFONDEUR_INDECIDABLE,
    pourquoiNonQualifie:
      "derive du RANG de profondeur : un rang illisible rend le meme marqueur. Meme lacune, second porteur.",
  },
];

describe("VERROU — un repli non qualifié ne se réveille pas avec son champ", () => {
  it("le registre n'est pas vide — sinon le verrou serait vert par vacuité", () => {
    expect(REPLIS_NON_QUALIFIES.length).toBeGreaterThan(0);
    for (const e of REPLIS_NON_QUALIFIES) {
      expect(e.repli.length).toBeGreaterThan(0);
      expect(e.pourquoiNonQualifie.length).toBeGreaterThan(20);
    }
  });

  /**
   * ██ LE VERROU LUI-MÊME.
   *
   * Tant qu'un repli est au registre, son champ DOIT rester non émis. Réémettre
   * le champ fait tomber ce test, et le seul moyen de le faire passer est de
   * retirer l'entrée — donc de qualifier le repli.
   */
  it("██ tout champ portant un repli non qualifié est encore dans CHAMPS_NON_EMIS", () => {
    for (const { champ, repli, pourquoiNonQualifie } of REPLIS_NON_QUALIFIES) {
      expect(
        (CHAMPS_NON_EMIS as readonly string[]).includes(champ),
        `« ${champ} » est redevenu émissible, mais son repli « ${repli} » n'a pas été requalifié.\n` +
          `  Raison enregistrée : ${pourquoiNonQualifie}\n` +
          `  Pour lever ce verrou : écrire ce que « ${repli} » affirme d'un dossier publié,\n` +
          `  nommer la décision qui le fonde, PUIS retirer l'entrée de ce registre.`,
      ).toBe(true);
    }
  });

  it("et aucun de ces replis n'atteint la projection servie aujourd'hui", () => {
    // Le verrou porte sur l'AVENIR ; ce témoin mesure le présent, pour que
    // « protégé » ne soit pas confondu avec « déjà fuité ».
    const interne = {
      id: "case-X", kind: "case", title: "X", summary: null, primaryDate: "2026-05-01",
      linkedActors: [], linkedActorsCount: 0, proceedsObservedTotal: null,
      proceedsCoverage: "partial", evidenceDepth: PROFONDEUR_INDECIDABLE,
      strongestFlags: [], documentationStatus: PROFONDEUR_INDECIDABLE, href: "/h",
      sharedActorGroup: false, multiLaunchRecurrence: false, snapshotCount: 0,
    } as never;
    expect(JSON.stringify(projeterDossierServi(interne))).not.toContain(PROFONDEUR_INDECIDABLE);
  });

  it("██ MUTATION DISCRIMINANTE — un champ réémis avec un repli au registre fait ROUGIR", () => {
    // Sans ce cas, « le verrou tient » et « le verrou ne regarde rien » rendent
    // le même vert. On rejoue la vérification sur une liste d'où le champ a été
    // retiré, exactement ce que ferait la réémission.
    const sansEvidenceDepth = (CHAMPS_NON_EMIS as readonly string[]).filter(
      (c) => c !== "evidenceDepth",
    );
    const verrou = (liste: readonly string[]) => {
      for (const { champ } of REPLIS_NON_QUALIFIES) {
        if (!liste.includes(champ)) throw new Error(`repli non requalifié : ${champ}`);
      }
    };
    expect(() => verrou(sansEvidenceDepth)).toThrow(/evidenceDepth/);
    // CONTRE-TÉMOIN — la liste réelle passe.
    expect(() => verrou(CHAMPS_NON_EMIS as readonly string[])).not.toThrow();
  });
});
