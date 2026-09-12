// src/lib/storage/registre/__tests__/reconciliation.test.ts
import { describe, it, expect } from "vitest";
import type { LigneDeRegistre } from "../contrat";
import {
  DELAI_RECONCILIATION_MS,
  classer,
  estIncident,
  type ObjetObserve,
} from "../reconciliation";

const MAINTENANT = new Date("2026-09-12T12:00:00.000Z");
const SHA = "a".repeat(64);

function ligne(p: Partial<LigneDeRegistre> = {}): LigneDeRegistre {
  return {
    id: "f".repeat(32),
    bucket: "interligens-rawdocs",
    cle: `reports/production/2026/09/${"f".repeat(32)}.pdf`,
    natureObjet: "CASEFILE_RENDER",
    provenance: "GOVERNED_PIPELINE",
    etatDAutorite: "REGISTERED",
    etatDInvalidation: "NONE",
    classeDeRetention: "EVIDENTIARY_INDEFINITE",
    sujet: "So11111111111111111111111111111111111111112",
    lot: "casefile",
    sha256: SHA,
    tailleOctets: 169_014,
    typeContenu: "application/pdf",
    producteur: "pdfStorage.uploadPdf",
    alloueLe: new Date(MAINTENANT.getTime() - 30_000),
    enregistreLe: MAINTENANT,
    invalideLe: null,
    motifInvalidation: null,
    ...p,
  };
}

function objet(p: Partial<ObjetObserve> = {}): ObjetObserve {
  return {
    cle: `reports/production/2026/09/${"f".repeat(32)}.pdf`,
    tailleOctets: 169_014,
    derniereModification: MAINTENANT,
    sha256Metadonnee: SHA,
    ...p,
  };
}

describe("T1 — l'orphelin d'INTENTION (direction DB→R2, zéro objet)", () => {
  it("dans la fenêtre : en attente, aucune transition, non publiable", () => {
    const c = classer(ligne({ etatDAutorite: "INTENDED", enregistreLe: null }), null, MAINTENANT);
    expect(c.verdict).toBe("INTENTION_EN_ATTENTE");
    expect(c.transitionProposee).toBeNull();
  });

  it("au-delà de T : ABANDON — et la transition ne SUPPRIME rien", () => {
    const vieille = ligne({
      etatDAutorite: "INTENDED",
      enregistreLe: null,
      alloueLe: new Date(MAINTENANT.getTime() - DELAI_RECONCILIATION_MS - 1),
    });
    const c = classer(vieille, null, MAINTENANT);
    expect(c.verdict).toBe("ABANDON");
    expect(c.transitionProposee).toBe("ABANDONED");
  });

  it("est IDEMPOTENT — rejouer ne change pas le verdict (P4)", () => {
    const vieille = ligne({
      etatDAutorite: "ABANDONED",
      enregistreLe: null,
      alloueLe: new Date(MAINTENANT.getTime() - DELAI_RECONCILIATION_MS - 1),
    });
    const a = classer(vieille, null, MAINTENANT);
    const b = classer(vieille, null, MAINTENANT);
    expect(a).toEqual(b);
  });
});

describe("T2 — l'orphelin d'OBJET : le témoin « avant » n'a pas à être fabriqué", () => {
  it("un objet du périmètre gouverné sans ligne est nommé ORPHELIN", () => {
    // 169 014 octets, sujet wSOL, aucun dossier gouverné. Il est réel, il est
    // en production, et il EST le cas de test de la direction R2→DB.
    const c = classer(null, objet({ tailleOctets: 169_014 }), MAINTENANT);
    expect(c.verdict).toBe("ORPHELIN");
    expect(c.transitionProposee).toBe("ORPHAN_CONFIRMED");
    expect(estIncident(c.verdict)).toBe(true);
  });

  it("les archives d'engine.ts sont des orphelins à cause NOMMÉE", () => {
    // Sans la cause probable, le producteur non câblé (chemin GELÉ) noierait
    // le seul objet qui compte dans un rapport illisible.
    const c = classer(null, objet({ cle: "reports/GordonGekko/CASE_GordonGekko_2026-08-16.pdf" }), MAINTENANT);
    expect(c.verdict).toBe("ORPHELIN");
    expect(c.causeProbable).toBe("PRODUCTEUR_NON_CABLE_ENGINE");
  });

  it("un objet antérieur à la borne est LEGACY — et n'affirme rien sur son passé", () => {
    const c = classer(null, objet({ derniereModification: new Date("2026-07-19T00:00:00Z") }), MAINTENANT);
    expect(c.verdict).toBe("LEGACY_NON_ENREGISTRE");
    expect(c.detail).toMatch(/Aucune conclusion sur ce qu'il a été/);
  });

  it("hors périmètre : PASSE, mais COMPTE — dette E", () => {
    const c = classer(null, objet({ cle: "pointers/GordonGekko/latest.pdf" }), MAINTENANT);
    expect(c.verdict).toBe("HORS_PERIMETRE");
    expect(estIncident(c.verdict)).toBe(false);
  });
});

describe("le PUT à faux négatif — ce que l'allocation préalable achète", () => {
  it("objet présent sous une INTENTION vérifiée : l'opération se CLÔT", () => {
    const c = classer(ligne({ etatDAutorite: "INTENDED", enregistreLe: null }), objet(), MAINTENANT);
    expect(c.verdict).toBe("PROMOTION_POSSIBLE");
    expect(c.transitionProposee).toBe("REGISTERED");
  });

  it("objet apparu APRÈS l'abandon : incident, aucune transition automatique", () => {
    const c = classer(ligne({ etatDAutorite: "ABANDONED", enregistreLe: null }), objet(), MAINTENANT);
    expect(c.verdict).toBe("ABANDONNE_MAIS_PRESENT");
    expect(c.transitionProposee).toBeNull();
    expect(estIncident(c.verdict)).toBe(true);
  });
});

describe("l'intégrité — sur taille + empreinte, JAMAIS sur l'ETag", () => {
  it("conforme quand les deux concordent", () => {
    expect(classer(ligne(), objet(), MAINTENANT).verdict).toBe("CONFORME");
  });

  it("divergence de taille → INCIDENT, aucune transition", () => {
    const c = classer(ligne(), objet({ tailleOctets: 169_015 }), MAINTENANT);
    expect(c.verdict).toBe("INCOHERENCE_INTEGRITE");
    expect(c.transitionProposee).toBeNull();
  });

  it("divergence d'empreinte → INCIDENT", () => {
    expect(classer(ligne(), objet({ sha256Metadonnee: "b".repeat(64) }), MAINTENANT).verdict)
      .toBe("INCOHERENCE_INTEGRITE");
  });

  it("empreinte absente DES DEUX CÔTÉS → pas une divergence, un fait non établi", () => {
    // Une ligne née de l'OBSERVATION (un orphelin qu'on qualifie) ne porte pas
    // d'empreinte : l'établir exigerait de lire les octets. Traiter
    // null vs null comme une divergence signalerait un incident d'intégrité
    // là où il n'y a qu'une comparaison qui n'existe pas.
    const c = classer(
      ligne({ etatDAutorite: "ORPHAN_CONFIRMED", sha256: null, typeContenu: null }),
      objet({ sha256Metadonnee: null }),
      MAINTENANT,
    );
    expect(c.verdict).not.toBe("INCOHERENCE_INTEGRITE");
    expect(c.verdict).toBe("PRESENT_NON_VERIFIABLE");
  });

  it("métadonnée absente → présent NON VÉRIFIABLE, et donc non publiable", () => {
    // « Présent » n'est pas « vérifié ». La seule alternative serait un
    // GetObject, qui ferait SORTIR les octets pour les comparer.
    const c = classer(ligne({ etatDAutorite: "INTENDED" }), objet({ sha256Metadonnee: null }), MAINTENANT);
    expect(c.verdict).toBe("PRESENT_NON_VERIFIABLE");
    expect(c.transitionProposee).toBe("STORED_UNCONFIRMED");
  });
});

describe("F1 — la direction que l'autre sens ne voit jamais", () => {
  it("autorité ENREGISTRÉE sans octets : l'incident le plus grave", () => {
    const c = classer(ligne({ etatDAutorite: "REGISTERED" }), null, MAINTENANT);
    expect(c.verdict).toBe("LIGNE_SANS_OBJET");
    expect(c.transitionProposee).toBeNull();
    expect(estIncident(c.verdict)).toBe(true);
  });
});

describe("le classificateur ne propose JAMAIS de destruction", () => {
  it("aucune transition proposée n'est une suppression ou un déplacement", () => {
    const cas = [
      classer(ligne({ etatDAutorite: "INTENDED" }), null, new Date(MAINTENANT.getTime() + 1e9)),
      classer(null, objet(), MAINTENANT),
      classer(ligne(), objet({ tailleOctets: 1 }), MAINTENANT),
      classer(ligne({ etatDAutorite: "REGISTERED" }), null, MAINTENANT),
    ];
    for (const c of cas) {
      expect(["ABANDONED", "ORPHAN_CONFIRMED", "REGISTERED", "STORED_UNCONFIRMED", "LEGACY_UNREGISTERED", null])
        .toContain(c.transitionProposee);
    }
  });
});
