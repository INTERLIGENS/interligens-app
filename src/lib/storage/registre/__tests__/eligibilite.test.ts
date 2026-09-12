// src/lib/storage/registre/__tests__/eligibilite.test.ts
import { describe, it, expect } from "vitest";
import {
  CLASSES_RETENTION,
  DOCTRINE,
  ETATS_AUTORITE,
  ETATS_INVALIDATION,
  type FacesDAutorite,
} from "../contrat";
import { deriverEligibilite, expliquerRefus } from "../eligibilite";

const ENREGISTRE: FacesDAutorite = {
  natureObjet: "CASEFILE_RENDER",
  provenance: "GOVERNED_PIPELINE",
  etatDAutorite: "REGISTERED",
  etatDInvalidation: "NONE",
  classeDeRetention: "EVIDENTIARY_INDEFINITE",
};

describe("deriverEligibilite — liste blanche, fail-closed", () => {
  it("le SEUL couple qui publie est REGISTERED + NONE", () => {
    expect(deriverEligibilite(ENREGISTRE)).toEqual({ publiable: true });
  });

  it("aucun autre état d'autorité ne publie — y compris ceux ajoutés plus tard", () => {
    // Le point de ce test n'est pas d'énumérer cinq refus : c'est qu'il
    // PARCOURT le domaine. Un sixième état ajouté au contrat sans être admis
    // ici rendra ce test rouge, au lieu d'être publiable par défaut. C'est
    // exactement ce qu'un `!== 'ABANDONED'` n'aurait pas fait.
    for (const etat of ETATS_AUTORITE) {
      const r = deriverEligibilite({ ...ENREGISTRE, etatDAutorite: etat });
      if (etat === "REGISTERED") expect(r.publiable).toBe(true);
      else expect(r).toEqual({ publiable: false, raison: "NON_ENREGISTRE" });
    }
  });

  it("toute invalidation retient, quel que soit l'état d'autorité", () => {
    for (const inval of ETATS_INVALIDATION) {
      const r = deriverEligibilite({ ...ENREGISTRE, etatDInvalidation: inval });
      if (inval === "NONE") expect(r.publiable).toBe(true);
      else expect(r).toEqual({ publiable: false, raison: "AUTORITE_INVALIDEE" });
    }
  });

  it("le JUGEMENT prime sur le PROCESSUS dans le motif rendu", () => {
    // Un artefact non enregistré ET invalidé doit dire « invalidé ». L'ordre
    // inverse rendrait un motif vrai mais trompeur : le vrai motif est une
    // décision, pas une opération inachevée.
    const r = deriverEligibilite({
      ...ENREGISTRE,
      etatDAutorite: "ORPHAN_CONFIRMED",
      etatDInvalidation: "INVALID_AUTHORITY",
    });
    expect(r).toEqual({ publiable: false, raison: "AUTORITE_INVALIDEE" });
  });

  it("une valeur hors domaine ne publie pas — elle n'est pas une valeur basse", () => {
    for (const face of ["natureObjet", "provenance", "etatDAutorite", "etatDInvalidation", "classeDeRetention"] as const) {
      const r = deriverEligibilite({ ...ENREGISTRE, [face]: "VALEUR_INVENTEE" } as FacesDAutorite);
      expect(r, face).toEqual({ publiable: false, raison: "ETAT_HORS_DOMAINE" });
    }
  });

  it("aucune classe de rétention n'ACCORDE la publication", () => {
    // Conserver n'est pas autoriser. « Preservation of an invalid artifact
    // does not preserve its publication authority », pris dans l'autre sens.
    for (const classe of CLASSES_RETENTION) {
      const r = deriverEligibilite({
        ...ENREGISTRE,
        etatDAutorite: "ORPHAN_CONFIRMED",
        classeDeRetention: classe,
      });
      expect(r.publiable, classe).toBe(false);
    }
  });
});

describe("expliquerRefus — la doctrine A des lecteurs", () => {
  // Ce bloc est l'anti-`evidentiaryStatus`. Une doctrine qu'aucun chemin ne
  // rend est « une déclaration sans effet » : S4 a prononcé l'exclusion de
  // 7 artefacts, la colonne n'était lue NULLE PART, et le manifeste de chaîne
  // de conservation a continué d'inventorier un .DS_Store comme pièce.

  it("un refus pour invalidation PORTE le caractère prospectif de la quarantaine", () => {
    const texte = expliquerRefus("AUTORITE_INVALIDEE");
    expect(texte).toContain(DOCTRINE.QUARANTAINE_PROSPECTIVE);
    expect(texte).toContain(DOCTRINE.PRESERVATION_SANS_AUTORITE);
  });

  it("un refus pour absence de ligne PORTE l'exigence d'identité allouée", () => {
    expect(expliquerRefus("AUCUNE_LIGNE_DE_REGISTRE")).toContain(DOCTRINE.IDENTITE_ALLOUEE);
  });

  it("aucun refus n'est anonyme", () => {
    // Les quatre 401 du lot F étaient indiscernables au seul statut et
    // venaient de deux couches différentes. Un refus sans motif est
    // indiscernable d'une panne.
    for (const raison of [
      "NON_ENREGISTRE", "AUTORITE_INVALIDEE", "ETAT_HORS_DOMAINE",
      "AUCUNE_LIGNE_DE_REGISTRE", "REGISTRE_INDISPONIBLE",
    ] as const) {
      expect(expliquerRefus(raison).length, raison).toBeGreaterThan(60);
    }
  });
});

describe("le contrat ne promet pas ce qu'il ne tient pas", () => {
  it("aucune doctrine ne prétend « immutable » ni « WORM »", () => {
    // D2, borne explicite : ce compartiment n'est pas WORM, aucun object lock
    // n'est en vigueur, et la préservation est obtenue par ABSENCE de
    // politique de cycle de vie. Le contrat dit ce qui est vrai, rien de plus.
    const tout = Object.values(DOCTRINE).join(" ");
    expect(tout).not.toMatch(/\bimmutable\b/i);
    expect(tout).toMatch(/not WORM/);
    expect(DOCTRINE.RETENTION_EST_UN_PROCESSUS).toMatch(
      /Absence of a lifecycle policy is not a retention policy/,
    );
  });
});
