// src/lib/storage/registre/__tests__/identite.test.ts
import { describe, it, expect } from "vitest";
import {
  BORNE_LEGACY,
  PREFIXES_PROBATOIRES,
  allouerIdentite,
  causeProbable,
  estAnterieurALaBorneLegacy,
  estDansPerimetreGouverne,
  estFormeAllouee,
  lireFormeDeCle,
} from "../identite";

const LE_9_MARS = new Date("2026-03-09T12:00:00.000Z");

describe("allouerIdentite — la forme allouée", () => {
  it("place l'identifiant de registre, et RIEN d'autre, dans le nom du fichier", () => {
    const { cle, identifiant } = allouerIdentite("production", LE_9_MARS);
    expect(cle).toBe(`reports/production/2026/03/${identifiant}.pdf`);
    expect(identifiant).toMatch(/^[0-9a-f]{32}$/);
    expect(estFormeAllouee(cle)).toBe(true);
  });

  it("n'encode NI le sujet NI l'empreinte des octets", () => {
    // La régression que ce test empêche est nommée : l'ancienne clé portait
    // `slugify(subject)` — donc le mint en clair — et `sha256(octets)` tronqué.
    // Une clé est le chemin d'une URL signée remise à un tiers : ce qu'elle
    // encode est rendu, même si aucune interface ne l'affiche.
    const mint = "So11111111111111111111111111111111111111112";
    const { cle, identifiant } = allouerIdentite("production", LE_9_MARS);
    expect(cle).not.toContain(mint);
    expect(cle.toLowerCase()).not.toContain(mint.toLowerCase().slice(0, 12));
    // Le nom du fichier est l'identifiant de registre, et RIEN d'autre : ni
    // horodatage en millisecondes, ni slug, ni empreinte tronquée.
    //
    // (Une assertion `not.toMatch(/\d{13}/)` a été essayée ici et s'est
    // révélée FLAKY : 32 caractères hexadécimaux contiennent 13 chiffres
    // consécutifs environ une fois sur mille. Un test qui échoue une fois sur
    // mille est pire qu'absent — il apprend à ignorer le rouge.)
    expect(cle.split("/").pop()).toBe(`${identifiant}.pdf`);
  });

  it("deux allocations du même instant ne collident pas", () => {
    // F6 — sous l'ancienne forme, deux tirages des MÊMES octets dans la MÊME
    // milliseconde produisaient la même clé, et le second écrasait le premier
    // en silence, sur un préfixe dit immuable.
    const a = allouerIdentite("production", LE_9_MARS);
    const b = allouerIdentite("production", LE_9_MARS);
    expect(a.cle).not.toBe(b.cle);
  });

  it("refuse un environnement hors domaine", () => {
    expect(() => allouerIdentite("prod" as never, LE_9_MARS)).toThrow(/hors domaine/);
  });
});

describe("lireFormeDeCle — LIRE le passé sans écrire l'avenir", () => {
  it("reconnaît la forme historique d'uploadPdf sans en déduire le sujet", () => {
    const cle = "reports/production/2026/03/casefile-1772020800000-so1111-aabbccdd.pdf";
    const forme = lireFormeDeCle(cle);
    expect(forme.forme).toBe("UPLOADPDF_HISTORIQUE");
    // `slugify` met en minuscules et un mint base58 est sensible à la casse :
    // aucun sujet n'est rendu, parce qu'aucun ne peut l'être sans le fabriquer.
    expect(forme).not.toHaveProperty("sujet");
  });

  it("reconnaît une archive engine.ts — le producteur non câblé", () => {
    const forme = lireFormeDeCle("reports/GordonGekko/CASE_GordonGekko_2026-08-16T10-00-00.pdf");
    expect(forme).toEqual({ forme: "ARCHIVE_ENGINE", handle: "GordonGekko" });
    expect(causeProbable("reports/GordonGekko/CASE_GordonGekko_2026-08-16T10-00-00.pdf"))
      .toBe("PRODUCTEUR_NON_CABLE_ENGINE");
  });

  it("ne confond pas une forme allouée avec une forme historique", () => {
    const { cle } = allouerIdentite("preview", LE_9_MARS);
    expect(lireFormeDeCle(cle).forme).toBe("ALLOUEE");
  });

  it("rend INCONNUE pour tout le reste, sans deviner", () => {
    expect(lireFormeDeCle("casefiles/IL-PON-CBEX-001/IL-PON-CBEX-001_2026.pdf").forme)
      .toBe("INCONNUE");
    expect(causeProbable("pointers/abc/latest.pdf")).toBe("ORIGINE_NON_ETABLIE");
  });
});

describe("le périmètre gouverné — D3, reports/ et rien d'autre", () => {
  it.each([
    ["reports/production/2026/03/x.pdf", true],
    ["reports/GordonGekko/CASE_GordonGekko_x.pdf", true],
    ["pointers/GordonGekko/latest.pdf", false],
    ["admin-documents/2026-03-09/abc-nda.pdf", false],
    ["evidence/casefiles/x/y/casefile.html", false],
  ])("%s → dans le périmètre: %s", (cle, attendu) => {
    expect(estDansPerimetreGouverne(cle)).toBe(attendu);
  });
});

describe("la borne legacy — D4, une RÈGLE reproductible", () => {
  it("sépare sur la date, pas sur une liste de clés", () => {
    expect(estAnterieurALaBorneLegacy(new Date("2026-07-19T23:59:59.999Z"))).toBe(true);
    expect(estAnterieurALaBorneLegacy(BORNE_LEGACY)).toBe(false);
    expect(estAnterieurALaBorneLegacy(new Date("2026-07-20T00:00:00.001Z"))).toBe(false);
  });
});

describe("les préfixes probatoires — D2", () => {
  it("excluent pointers/, qui est RÉÉCRIT à chaque génération", () => {
    // Un préfixe mutable par conception ne peut pas être conservé
    // « indéfiniment » au sens probatoire : il n'a jamais deux fois le même
    // contenu. L'y inclure promettrait une conservation impossible.
    expect(PREFIXES_PROBATOIRES).toContain("reports/");
    expect(PREFIXES_PROBATOIRES).toContain("evidence/");
    expect(PREFIXES_PROBATOIRES).not.toContain("pointers/");
  });
});
