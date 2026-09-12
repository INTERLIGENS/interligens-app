// ─── LE TERMINAL EXPLORER — TROIS CHAMPS QUALIFIÉS, PUIS LE PORTAIL ──────
//
// ██  Le portail n'a pas été posé sur un producteur sain.                  ██
// ██  Il a commencé par démontrer que le producteur ne l'était pas.        ██
//
// Câbler `gouverner(...)` a exigé que CHAQUE champ présente sa décision. Trois
// n'ont pas pu, et les trois étaient déclarés fondés dans la table :
//
//   proceedsCoverage       LITTÉRAL — 'partial' (case), 'none' (launch),
//                          'documented' (platform). Aucune lecture, aucune
//                          décision consommée. La table déclarait pourtant
//                          `KolProfile.proceedsPublication`.
//   proceedsObservedTotal  fondé sur les CASE (redactProceeds consomme
//                          `proceedsPublication`) ; `null` EN DUR sur les neuf
//                          launch ; sur les platform, `confirmedLossUsd` n'a
//                          aucune colonne de décision dans le schéma.
//   snapshotCount          fondé QUAND la clé est dans la map mesurée ; le
//                          `?? 0` donnait un zéro indiscernable d'un zéro
//                          mesuré à tous les autres.
//
// ─── L'ORACLE DE FERMETURE, QUI REMPLACE « PAYLOAD IDENTIQUE » ──────────
//
//   NOUVELLE CHARGE = SOUS-ENSEMBLE SÉMANTIQUEMENT AUTORISÉ DE L'ANCIENNE,
//   SANS NOUVELLE ASSERTION ET SANS SUBSTITUT.
//
//   « Uniform payload shape must never be purchased by manufacturing semantic
//     values for unmeasured or unauthorized properties. »
//
// Une clé peut disparaître ; aucune ne doit apparaître, et aucune valeur ne
// doit changer de sens.

import { describe, it, expect } from "vitest";
import { CHAMPS_DU_DOSSIER, fondationPossiblePour } from "@/lib/governance/fondations";
import { CHAMPS_NON_EMIS } from "@/lib/explorer/explorerItems";
import { declarerCollection, projeterCollection } from "@/lib/governance/appartenance";
import {
  constaterDecision,
  devoilerEnregistrement,
  estRefus,
  gouverner,
  type EnregistrementGouverne,
} from "@/lib/governance/uniteGouvernee";

const decision = () =>
  constaterDecision("KolProfile.publishStatus", "case-X", "published", true)!;

const COLLECTION = () => declarerCollection("ExplorerDossiers", "NON_ASSERTIVE", null);

// ═══════════════════════════════════════════════════════════════════════════
// ① LES TROIS QUALIFICATIONS — lecture → décision → valeur émissible
// ═══════════════════════════════════════════════════════════════════════════

describe("① LES TROIS CHAMPS, QUALIFIÉS UN PAR UN", () => {
  it("`proceedsCoverage` — NON FONDÉE → clé absente pour les quatorze", () => {
    // Aucune lecture ne le produit : c'est un littéral. La table le dit
    // désormais, et la liste des non émis le tient.
    expect(fondationPossiblePour("DossierItem.proceedsCoverage")).toBeNull();
    expect(CHAMPS_NON_EMIS).toContain("proceedsCoverage");
  });

  it("`proceedsObservedTotal` — FONDÉE là où une décision est lue, absente ailleurs", () => {
    // La table garde sa fondation : elle est RÉELLEMENT consommée sur les
    // dossiers « case », via `redactProceeds(profile, …)` qui lit
    // `profile.proceedsPublication`. Ce qui change est que l'absence de
    // lecture rend désormais la clé absente au lieu de `null`.
    expect(fondationPossiblePour("DossierItem.proceedsObservedTotal")).toBe(
      "KolProfile.proceedsPublication",
    );
    expect(CHAMPS_NON_EMIS).not.toContain("proceedsObservedTotal");
  });

  it("`snapshotCount` — FONDÉE dans la map, absente hors de la map", () => {
    expect(fondationPossiblePour("DossierItem.snapshotCount")).toBe(
      "EvidenceSnapshot.isPublic+reviewStatus",
    );
    expect(CHAMPS_NON_EMIS).not.toContain("snapshotCount");
  });

  it("██ LE `?? 0` A DISPARU DU PRODUCTEUR — mesuré sur le code", async () => {
    // C'est la troisième occurrence de la famille RAVE-DUMP, et celle-ci
    // tombait sur le champ dont le zéro venait d'être ratifié. Un témoin qui
    // ne lirait que le comportement ne verrait pas le repli revenir.
    const { readFileSync } = await import("node:fs");
    const code = readFileSync("src/lib/explorer/explorerItems.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(code).not.toContain("snapCounts.get(item.title) ?? 0");
    expect(code).not.toMatch(/snapshotCount\s*=\s*[^\n]*\?\?\s*0/);
  });

  it("la table reste l'unique autorité — trois fondés, neuf sans", () => {
    const avec = CHAMPS_DU_DOSSIER.filter((c) => fondationPossiblePour(c) !== null);
    expect(avec).toHaveLength(3);
    expect(CHAMPS_DU_DOSSIER.length - avec.length).toBe(9);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ② LE MUTANT OBLIGATOIRE — collection NON_ASSERTIVE + champ nu
// ═══════════════════════════════════════════════════════════════════════════

describe("② UNE COLLECTION DISPENSÉE NE TRANSPORTE PAS UN CHAMP NU", () => {
  it("██ MUTANT — un champ nu dans un membre NE COMPILE PAS", () => {
    // `@ts-expect-error` est un mutant de COMPILATION, et il est
    // discriminant dans les deux sens : si le champ nu venait à compiler, la
    // directive deviendrait inutilisée et `tsc` échouerait sur ELLE. Il n'y a
    // donc pas de version « verte pour rien » de ce cas.
    //
    // C'est la dispense d'APPARTENANCE qui est accordée ici — jamais une
    // dispense de gouvernance du CONTENU :
    //   « non-assertive membership cannot waive governance of contained
    //     semantic units »
    projeterCollection(COLLECTION(), [
      // @ts-expect-error — `id` est une chaîne nue : aucun chemin de type ne
      // mène de là à `EnregistrementGouverne`.
      { id: "launch-BOTIFY" },
    ]);
  });

  it("CONTRE-TÉMOIN — le MÊME membre, gouverné, passe", () => {
    // Sans lui, « le mutant est refusé » serait indiscernable de « tout est
    // refusé », et le portail serait une porte murée.
    const membre: EnregistrementGouverne = {
      id: gouverner("STATE", "launch-BOTIFY", decision()),
    };
    const projection = projeterCollection(COLLECTION(), [membre]);
    expect(estRefus(projection)).toBe(false);
    if (estRefus(projection)) return;
    expect(devoilerEnregistrement(projection.membres[0])).toEqual({ id: "launch-BOTIFY" });
  });

  it("et le dévoilement ne laisse AUCUNE trace de la marque sur le fil", () => {
    const membre: EnregistrementGouverne = {
      id: gouverner("STATE", "case-X", decision()),
      title: gouverner("OBSERVATION", "X", decision()),
    };
    const serialise = JSON.stringify(devoilerEnregistrement(membre));
    for (const fuite of ["nature", "fondeePar", "referentiel", "valeurConstatee", "publishStatus"]) {
      expect(serialise, `la marque fuit : ${fuite}`).not.toContain(fuite);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ③ L'ORACLE DE FERMETURE — sous-ensemble, sans nouvelle assertion
// ═══════════════════════════════════════════════════════════════════════════

describe("③ LA NOUVELLE CHARGE EST UN SOUS-ENSEMBLE DE L'ANCIENNE", () => {
  /** Le jeu de clés servi à `5fd6611`, mesuré sur la prod, huit clés. */
  const AVANT = [
    "href", "id", "linkedActors", "primaryDate", "proceedsCoverage",
    "proceedsObservedTotal", "snapshotCount", "title",
  ] as const;

  /** Ce que le portail peut émettre au maximum : cinq toujours, deux si fondés. */
  const TOUJOURS = ["id", "title", "href", "primaryDate", "linkedActors"] as const;
  const CONDITIONNELS = ["proceedsObservedTotal", "snapshotCount"] as const;

  it("██ AUCUNE CLÉ N'APPARAÎT — tout ce qui peut sortir sortait déjà", () => {
    for (const cle of [...TOUJOURS, ...CONDITIONNELS]) {
      expect(AVANT as readonly string[], `« ${cle} » est NOUVELLE`).toContain(cle);
    }
  });

  it("une seule clé disparaît inconditionnellement, et elle est nommée", () => {
    const emissibles = new Set<string>([...TOUJOURS, ...CONDITIONNELS]);
    const disparues = AVANT.filter((c) => !emissibles.has(c));
    expect(disparues).toEqual(["proceedsCoverage"]);
  });

  it("██ AUCUN SUBSTITUT N'A PRIS LA PLACE DES CLÉS RETIRÉES", () => {
    // Le geste déjà appliqué au `summary` : la clé part, rien ne la remplace.
    const membre: EnregistrementGouverne = {
      id: gouverner("STATE", "case-X", decision()),
      title: gouverner("OBSERVATION", "X", decision()),
      linkedActors: gouverner("ASSERTION", [], decision()),
    };
    const charge = JSON.stringify(devoilerEnregistrement(membre));
    for (const substitut of [
      "proceedsCoverage", "withheld", "no publication decision", "N/A",
      "Under review", "not measured", "unknown", "none",
    ]) {
      expect(charge, `substitut « ${substitut} »`).not.toContain(substitut);
    }
  });

  it("et un champ conditionnel absent n'est pas `null` — il n'est pas là", () => {
    // La distinction est TOUT le lot : `null` se lit « mesuré, rien trouvé ».
    const sansProceeds: EnregistrementGouverne = {
      id: gouverner("STATE", "launch-BOTIFY", decision()),
    };
    const devoile = devoilerEnregistrement(sansProceeds) as Record<string, unknown>;
    expect("proceedsObservedTotal" in devoile).toBe(false);
    expect(JSON.stringify(devoile)).not.toContain("null");
  });
});
