// ─── LE COÛT DU CÂBLAGE EXPLORER, RENDU EXÉCUTABLE ───────────────────────
//
// Le terminal de collection exige que CHAQUE champ d'un membre présente sa
// décision (couche 2, tenue par la signature). Câbler l'Explorer dessus n'est
// donc pas un branchement : c'est un arbitrage, parce que huit champs servis
// aujourd'hui n'ont AUCUNE fondation possible et cesseraient d'être émis.
//
// Ce fichier ne tranche rien. Il rend le coût MESURABLE au lieu de
// descriptible, pour que l'arbitrage porte sur une liste qui ne peut pas
// dériver sans rougir.
//
// Les huit sont exactement les lignes de l'inventaire §4.B dont la colonne
// « fondation gouvernée » valait 0/14 ou 0/9. Ce n'est pas une politique
// nouvelle : c'est le tableau déjà arbitré, devenu du code.

import { describe, it, expect } from "vitest";
import { CHAMPS_DU_DOSSIER, fondationPossiblePour } from "@/lib/governance/fondations";

const SANS = CHAMPS_DU_DOSSIER.filter((c) => fondationPossiblePour(c) === null);
const AVEC = CHAMPS_DU_DOSSIER.filter((c) => fondationPossiblePour(c) !== null);

describe("LE COÛT DU CÂBLAGE — douze champs, quatre fondés, huit qui tombent", () => {
  it("la table est l'unique autorité — aucun champ n'est classé ailleurs", () => {
    expect(CHAMPS_DU_DOSSIER).toHaveLength(12);
    expect(AVEC.length + SANS.length).toBe(12);
  });

  it("LES QUATRE FONDÉS — et chacun nomme la décision qui le fonde", () => {
    expect(Object.fromEntries(AVEC.map((c) => [c, fondationPossiblePour(c)]))).toEqual({
      "DossierItem.linkedActors": "KolProfile.publishStatus",
      "DossierItem.proceedsObservedTotal": "KolProfile.proceedsPublication",
      "DossierItem.proceedsCoverage": "KolProfile.proceedsPublication",
      "DossierItem.snapshotCount": "EvidenceSnapshot.isPublic+reviewStatus",
    });
  });

  it("██ LES HUIT QUI CESSERAIENT D'ÊTRE SERVIS — la liste, nommée", () => {
    // Une neuvième fait rougir ce test le jour où elle apparaît, et une
    // huitième qui disparaîtrait sans décision aussi. C'est tout ce qu'on
    // demande à un témoin de coût.
    expect(SANS).toEqual([
      "DossierItem.kind",                  // E14 — le badge « PLATFORM FRAUD » / « CASE CLUSTER »
      "DossierItem.evidenceDepth",         // E6
      "DossierItem.documentationStatus",   // E6  — le badge DOCUMENTED / PARTIAL
      "DossierItem.strongestFlags",        // E8  — propagation personne → dossier
      "DossierItem.topCoordinationSignal", // E9  — « Coordinated promotion »
      "DossierItem.sharedActorGroup",      // E10
      "DossierItem.multiLaunchRecurrence", // E10
      "DossierItem.linkedActorsCount",     // E4
    ]);
  });

  it("`linkedActorsCount` est le seul des huit à porter AUSSI un défaut de vérité", () => {
    // Mesuré : BULLISH affiche 2 pour 5 liens, SWIF 2 pour 6, TOES 2 pour 4.
    // Deux axes distincts sur la même ligne — l'AUTORITÉ (aucune décision ne
    // fonde le compte) et la CORRECTION (le compte est faux). Le second est
    // P1, et le confondre avec le premier ferait de ce boundary un moteur de
    // vérité. Ce test existe pour que la distinction reste écrite.
    expect(SANS).toContain("DossierItem.linkedActorsCount");
    expect(fondationPossiblePour("DossierItem.linkedActorsCount")).toBeNull();
  });

  it("CONTRE-TÉMOIN — la table sait rendre autre chose que `null`", () => {
    // Sans lui, une table entièrement nulle rendrait ce fichier vert en ne
    // mesurant rien.
    expect(AVEC.length).toBeGreaterThan(0);
    expect(fondationPossiblePour("DossierItem.snapshotCount")).not.toBeNull();
  });
});
