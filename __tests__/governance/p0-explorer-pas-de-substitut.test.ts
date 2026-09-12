// ─── LA GARDE QUI EMPÊCHE LES HUIT DE REVENIR ────────────────────────────
//
// Deux choses peuvent les ramener, et aucune n'est un `git revert` :
//
//   ① UN REPLI  `TABLE[champ] ?? TABLE.defaut`. Le champ est parti, la
//      pastille reste, et elle affirme une valeur par défaut. C'est le `?? 0`
//      qui faisait lire SIGNAL à RAVE-DUMP, et c'est ce qui aurait fait lire
//      « CASE CLUSTER » aux quatorze — dix assertions fausses.
//
//   ② UN SUBSTITUT  « Under review », « N/A », « — », « information
//      retirée ». Écrit avec les meilleures intentions, dans trois semaines,
//      par quelqu'un qui trouve la carte vide. Et il recrée un différentiel
//      sur L'EXISTENCE de l'information.
//
// Cette garde vit à côté du code parce que ni le type ni le compilateur ne
// peuvent voir l'un ni l'autre : une chaîne est une chaîne.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CHAMPS_NON_EMIS, projeterDossierServi } from "@/lib/explorer/explorerItems";
import { RESUME_NON_GOUVERNE } from "@/lib/governance/surfaces/explorer";

const PAGES = [
  "src/app/en/explorer/page.tsx",
  "src/app/fr/explorer/page.tsx",
  "src/app/en/explorer/[caseId]/page.tsx",
  "src/app/fr/explorer/[caseId]/page.tsx",
] as const;

const codeSeul = (t: string) =>
  t.split("\n").filter((l) => {
    const x = l.trimStart();
    return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*") && !x.startsWith("{/*");
  }).join("\n");

const source = (f: string) => codeSeul(readFileSync(f, "utf8"));

/**
 * Un repli de badge SUR L'UN DES HUIT — une table indexee par un champ retire,
 * dont le defaut est une autre entree de la meme table.
 *
 * ⚠ LA PREMIERE ECRITURE DE CETTE GARDE TAXAIT UNE FORME, PAS UNE PROPRIETE :
 * elle interdisait tout `TABLE[x] ?? TABLE.y`, et rougissait donc sur
 * `SNAP_TYPE[snap.snapshotType] ?? SNAP_TYPE.other` — un repli sur un champ
 * GOUVERNE (E17, `isPublic && reviewStatus='approved'`) dont `other` est une
 * categorie residuelle legitime de l'enumeration, pas un defaut fabrique pour
 * un champ manquant.
 *
 * Une garde qui rougit sur du code irreprochable est desarmee. C'est la
 * troisieme fois sur ce chantier ; la propriete est TOUJOURS « ce champ-la »,
 * jamais « cette ecriture-la ».
 */
const porteUnRepli = (src: string): boolean =>
  CHAMPS_NON_EMIS.some((champ) =>
    new RegExp(String.raw`\b[A-Z_]+\[[^\]]*\b${champ}\b[^\]]*\]\s*\?\?\s*[A-Z_]+\.`).test(src),
  );

describe("① AUCUN REPLI DE BADGE NE SUBSISTE", () => {
  it("les quatre pages sont propres", () => {
    for (const f of PAGES) expect(porteUnRepli(source(f)), f).toBe(false);
  });

  it("██ MUTATION DISCRIMINANTE — réintroduire un repli fait ROUGIR la garde", () => {
    // Sans ce cas, « la garde ne trouve rien » et « la garde ne regarde rien »
    // rendent le même vert.
    for (const mutant of [
      "const kb = KIND_BADGE[d.kind] ?? KIND_BADGE.case",
      "const doc = DOC_BADGE[d.documentationStatus] ?? DOC_BADGE.partial",
      "const x = DEPTH[d.evidenceDepth] ?? DEPTH.weak",
    ]) {
      expect(porteUnRepli(mutant), mutant).toBe(true);
    }
    // ── LES CONTRE-TÉMOINS, ET ILS COMPTENT AUTANT QUE LES MUTANTS ──────
    expect(porteUnRepli("const n = d.snapshotCount ?? 0")).toBe(false);
    expect(porteUnRepli("const s = d.summary ?? null")).toBe(false);
    // Le repli sur un champ GOUVERNÉ ne rougit pas : `other` est une catégorie
    // résiduelle de l'énumération, pas un défaut inventé pour un champ absent.
    expect(porteUnRepli("const st = SNAP_TYPE[snap.snapshotType] ?? SNAP_TYPE.other")).toBe(false);
  });

  it("les quatre tables de libellés ont disparu — plus rien à indexer", () => {
    // Les laisser aurait été du code mort, et surtout une invitation : la table
    // dit encore quoi afficher, il ne manque qu'un champ pour rebrancher.
    for (const f of PAGES) {
      const s = source(f);
      for (const table of ["KIND_BADGE", "DOC_BADGE", "FLAG_L"]) {
        expect(s, `${f} porte encore ${table}`).not.toContain(table);
      }
    }
  });
});

describe("② AUCUN SUBSTITUT UX, NULLE PART", () => {
  const SUBSTITUTS = [
    "Under review", "under review", "N/A", "n/a", "redacted", "Redacted",
    "Not available", "Non disponible", "En cours de revue", "retiree", "retirée",
    "masqué", "masked", "hidden", "Hidden",
  ];

  /**
   * On ne cherche PAS le mot n'importe où : `overflow: 'hidden'` est du CSS, et
   * une garde qui le compterait comme un substitut d'interface serait fausse au
   * premier style. On ne lit que ce qui est DESTINÉ À ÊTRE LU.
   */
  const texteLisible = (src: string): string => {
    const labels = [...src.matchAll(/label=(?:"([^"]*)"|\{'([^']*)'\})/g)].map((m) => m[1] ?? m[2] ?? "");
    const jsx = [...src.matchAll(/>\s*([A-Za-zÀ-ÿ][^<>{}\n]{2,})\s*</g)].map((m) => m[1]);
    return [...labels, ...jsx].join("\n");
  };

  it("aucune des quatre pages n'AFFICHE un remplaçant pour les huit", () => {
    for (const f of PAGES) {
      const lisible = texteLisible(source(f));
      for (const mot of SUBSTITUTS) {
        expect(lisible, `${f} affiche « ${mot} »`).not.toContain(mot);
      }
    }
  });

  it("MUTATION DISCRIMINANTE — un substitut AJOUTÉ serait vu, le CSS non", () => {
    expect(texteLisible('<Badge label="Under review" color="#888" />')).toContain("Under review");
    expect(texteLisible("<div>Information retirée</div>")).toContain("retirée");
    expect(texteLisible("style={{ overflow: 'hidden' }}")).not.toContain("hidden");
  });

  it("LE `summary` EST L'EXCEPTION RATIFIÉE, ET IL FAUT SAVOIR POURQUOI", () => {
    // Le résumé, lui, EST remplacé par une chaîne identique — et ce n'est pas
    // une contradiction. Les quatorze dossiers portent tous un `summary` ; en
    // supprimer la CLÉ pour treize et la garder pour un créerait un
    // différentiel de PRÉSENCE que rien n'avait avant.
    //
    // Les huit, eux, disparaissent pour les quatorze. Aucune clé ne reste, donc
    // aucune présence à comparer. LA FORME DU REFUS SUIT LA FORME DE LA
    // SURFACE — c'est le test d'oracle qui tranche, pas une préférence.
    expect(RESUME_NON_GOUVERNE).toContain("withheld");
    for (const champ of CHAMPS_NON_EMIS) {
      expect(RESUME_NON_GOUVERNE).not.toContain(champ);
    }
  });
});

describe("③ LA PROJECTION SERVIE — un seul point de passage", () => {
  it("les neuf clés partent, et il n'en reste aucune", () => {
    const interne = {
      id: "x", kind: "launch", title: "T", summary: null, primaryDate: "d",
      linkedActors: [], linkedActorsCount: 5, proceedsObservedTotal: null,
      proceedsCoverage: "none", evidenceDepth: "strong", strongestFlags: ["A"],
      documentationStatus: "documented", href: "/h", sharedActorGroup: true,
      multiLaunchRecurrence: true, multiLaunchCount: 3,
      topCoordinationSignal: { labelEn: "x", labelFr: "x", strength: "strong" },
      snapshotCount: 0,
    } as never;
    const servi = projeterDossierServi(interne) as Record<string, unknown>;
    for (const champ of CHAMPS_NON_EMIS) {
      expect(champ in servi, `${champ} survit à la projection`).toBe(false);
    }
    // CONTRE-TÉMOIN — les fondés survivent. Une projection qui viderait tout
    // passerait le test précédent sans rien prouver.
    for (const garde of ["id", "title", "summary", "href", "primaryDate",
                         "linkedActors", "proceedsObservedTotal", "proceedsCoverage", "snapshotCount"]) {
      expect(garde in servi, `${garde} a disparu`).toBe(true);
    }
  });

  it("le retrait est UNIFORME — aucune clé conditionnelle", () => {
    // Deux dossiers de contenus différents rendent le MÊME jeu de clés. Une
    // clé qui n'apparaîtrait que pour certains serait le différentiel qu'on
    // vient de fermer.
    const a = projeterDossierServi({ id: "a", kind: "case", strongestFlags: [], linkedActorsCount: 0 } as never);
    const b = projeterDossierServi({ id: "b", kind: "launch", strongestFlags: ["X"], linkedActorsCount: 9 } as never);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  it("`hasFlags` ne filtre plus — un filtre est une émission par bissection", () => {
    // `?hasFlags=true` aurait continué de dire QUELS dossiers portent des
    // drapeaux, sans que le champ soit servi. Le paramètre reste accepté par la
    // route (chemin gelé) et il est INERTE.
    const src = codeSeul(readFileSync("src/lib/explorer/explorerItems.ts", "utf8"));
    expect(src).not.toContain("filters.hasFlags");
    // Et le filtre `kind` reste, lui : structurel, nommé par l'appelant, il ne
    // bissecte aucune assertion portant sur une personne.
    expect(src).toContain("filters.kind");
  });
});
