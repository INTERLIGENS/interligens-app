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
import { contenirGraphe, type DecisionDeSujet } from "@/lib/governance/surfaces/networkGraph";
import { parseNetworkGraph } from "@/lib/network/schema";
import { admettreAnonyme, repondre } from "@/lib/governance/audienceProjection";
import { projeterWatchlist } from "@/lib/governance/surfaces/watchlist";
import rawGraphe from "@/data/scamUniverse.json";

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
  // ─── LE VOCABULAIRE, ET LA LACUNE QU'IL AVAIT ──────────────────────────
  //
  // ⚠ « withheld » N'Y ÉTAIT PAS. C'est exactement par ce mot que les deux
  // substituts sont passés — « Summary withheld … » sur treize dossiers de
  // l'Explorer, « Source metadata withheld … » sur le graphe — pendant que la
  // garde rendait vert.
  //
  // Une garde dont le vocabulaire est fermé ne couvre que ce qu'on a déjà vu.
  // On l'élargit à la FORME du message (« no publication decision », « does
  // not cover »), pas seulement à ses mots, parce que c'est la forme qui
  // affirme l'existence.
  const SUBSTITUTS = [
    "Under review", "under review", "N/A", "n/a", "redacted", "Redacted",
    "Not available", "Non disponible", "En cours de revue", "retiree", "retirée",
    "masqué", "masked", "hidden", "Hidden",
    "withheld", "Withheld", "no publication decision", "No publication decision",
    "not covered by", "non couvert", "information retenue", "content withheld",
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

  it("██ IL N'Y A PLUS D'EXCEPTION — `summary` a rejoint les non-émis", () => {
    // CE TÉMOIN A ÉTÉ INVERSÉ. Il exigeait
    // `expect(RESUME_NON_GOUVERNE).toContain("withheld")` — il EXIGEAIT le
    // substitut, et c'est ainsi qu'une garde peut tenir en place la chose
    // qu'elle est censée interdire.
    //
    // L'exception était motivée par un différentiel de PRÉSENCE réel : les
    // quatorze portaient un `summary`, en retirer treize l'aurait rendu
    // lisible. La prémisse tient. La sortie choisie, non — treize dossiers
    // ANNONÇAIENT le retrait, un portait un vrai résumé, et la partition 13/1
    // devenait explicite au lieu d'être effacée.
    //
    // La sortie correcte est celle des huit : la clé part POUR LES QUATORZE.
    expect(CHAMPS_NON_EMIS).toContain("summary");
    // Et le module de surface n'exporte plus de quoi en fabriquer un.
    const surface = readFileSync("src/lib/governance/surfaces/explorer.ts", "utf8");
    expect(codeSeul(surface)).not.toContain("RESUME_NON_GOUVERNE");
    expect(codeSeul(surface)).not.toContain("resumeGouverne");
  });
});

describe("③ LA PROJECTION SERVIE — un seul point de passage", () => {
  it("les DIX clés partent, et il n'en reste aucune", () => {
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
    for (const garde of ["id", "title", "href", "primaryDate",
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

// ═══════════════════════════════════════════════════════════════════════════
// ④ LA GARDE S'APPLIQUE AUX VALEURS DE CHAMP, PAS SEULEMENT AUX BADGES
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ CECI EST L'EXTENSION QU'UNE MESURE SUR LA PROD A RENDUE NÉCESSAIRE.
//
// Les blocs ① à ③ ne regardaient que le JSX des quatre pages : un substitut de
// BADGE. Ils ont rendu vert pendant que DEUX substituts de VALEUR partaient
// dans la charge servie :
//
//   summary       « Summary withheld — no publication decision covers this
//                   content. »            × 13 dossiers sur 14
//   sourceOfTruth « Source metadata withheld — no publication decision covers
//                   this content. »       × 1, sur le graphe
//
// Aucun des deux n'est un badge. Aucun des deux n'est dans une page. Les deux
// sont des VALEURS DE CHAMP produites par un module de surface — et les deux
// affirment qu'une information existe et a été retenue.
//
// La garde descend donc d'un cran : elle lit ce que les projections SERVENT,
// en les exécutant, et non ce que les pages affichent.

describe("④ AUCUN SUBSTITUT DANS LES VALEURS DES TROIS CHARGES", () => {
  const VOCABULAIRE = [
    "withheld", "Withheld", "no publication decision", "No publication decision",
    "Under review", "under review", "N/A", "redacted", "Redacted",
    "Not available", "Non disponible", "retirée", "retiree", "masqué", "masked",
    "not covered", "non couvert", "information retenue", "unavailable",
  ];

  /** Toute valeur chaîne d'une charge, à n'importe quelle profondeur. */
  const valeursChaine = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) valeursChaine(x, out);
    else if (v && typeof v === "object") for (const x of Object.values(v)) valeursChaine(x, out);
    return out;
  };

  const aucunSubstitut = (valeurs: string[], ou: string) => {
    for (const val of valeurs) {
      for (const mot of VOCABULAIRE) {
        expect(val.includes(mot), `${ou} sert « ${val} » — substitut « ${mot} »`).toBe(false);
      }
    }
  };

  const dossierInterne = (titre: string, resume: string | null) =>
    ({
      id: `launch-${titre}`, kind: "launch", title: titre, summary: resume,
      primaryDate: "2026-05-01", linkedActors: [], linkedActorsCount: 0,
      proceedsObservedTotal: null, proceedsCoverage: "none", evidenceDepth: "none",
      strongestFlags: [], documentationStatus: "partial", href: `/h/${titre}`,
      sharedActorGroup: false, multiLaunchRecurrence: false, snapshotCount: 0,
    }) as never;

  it("CHARGE 1 · watchlist — le corps de refus ne porte aucun substitut", async () => {
    const res = await repondre(projeterWatchlist(admettreAnonyme("temoin"), []));
    const corps = await res.json();
    aucunSubstitut(valeursChaine(corps), "/api/watchlist");
  });

  it("CHARGE 2 · explorer — aucun dossier servi ne porte de substitut", () => {
    const servis = [
      dossierInterne("BOTIFY", "Dad wallet received full supply allocation and dumped."),
      dossierInterne("CBEX", "The $12M Ponzi That Never Stopped"),
      dossierInterne("VIDE", null),
    ].map((d) => projeterDossierServi(d));
    aucunSubstitut(valeursChaine(servis), "/api/explorer");
  });

  it("CHARGE 3 · network-graph — le graphe contenu ne porte aucun substitut", () => {
    // Magasin VIDE : tous les nœuds nominatifs sont retirés. C'est le cas
    // maximal de containment, donc celui qui aurait le plus « besoin » d'un
    // texte explicatif.
    const { graphe } = contenirGraphe(
      parseNetworkGraph(rawGraphe as unknown),
      new Map<string, DecisionDeSujet>(),
    );
    aucunSubstitut(valeursChaine(graphe), "/api/investigators/network-graph");
  });

  it("██ MUTATION DISCRIMINANTE — un substitut de VALEUR fait rougir la garde", () => {
    // Sans ce cas, « la garde ne trouve rien » et « la garde ne regarde rien »
    // rendent le même vert. Ce sont les DEUX chaînes réellement servies en
    // production le 2026-09-12, rejouées.
    for (const mutant of [
      { summary: "Summary withheld — no publication decision covers this content." },
      { sourceOfTruth: "Source metadata withheld — no publication decision covers this content." },
      { etat: "Under review" },
      { note: { profond: ["ok", "information retenue"] } },
    ]) {
      expect(() => aucunSubstitut(valeursChaine(mutant), "mutant")).toThrow();
    }
    // CONTRE-TÉMOINS — du contenu légitime ne rougit pas.
    expect(() =>
      aucunSubstitut(["The $12M Ponzi That Never Stopped", "TOESCOIN (solana)", "2026-04-17"], "ok"),
    ).not.toThrow();
  });

  it("██ ET AUCUN MODULE DE SURFACE N'EN FABRIQUE UN, MÊME SUR UNE BRANCHE NON ATTEINTE", () => {
    // Les trois cas ci-dessus passent par des fixtures. Une branche qu'aucune
    // fixture n'atteint échapperait à la mesure — on lit donc aussi le CODE.
    for (const f of [
      "src/lib/governance/surfaces/explorer.ts",
      "src/lib/governance/surfaces/networkGraph.ts",
      "src/lib/governance/surfaces/watchlist.ts",
      "src/lib/explorer/explorerItems.ts",
      "src/app/api/explorer/route.ts",
      "src/app/api/watchlist/route.ts",
      "src/app/api/investigators/network-graph/route.ts",
    ]) {
      // ⚠ LE MOTIF D'ADMISSION EST ÉCARTÉ, ET IL FAUT SAVOIR POURQUOI.
      //
      // `admettreAnonyme("watchlist retiree de la projection servie — …")`
      // porte le mot « retiree », et la première écriture de cette garde a
      // rougi dessus. C'était un FAUX POSITIF : le motif d'admission ne
      // voyage pas dans la charge — il dit POURQUOI on admet, pas ce qu'on
      // sert. Le corps servi fait 75 octets et ne le contient pas.
      //
      // Une garde qui rougit sur du code irréprochable est désarmée ; c'est
      // la leçon déjà inscrite au bloc ①. On écarte donc l'ARGUMENT de la
      // porte d'admission, et rien d'autre — et le témoin ci-dessous prouve,
      // À L'EXÉCUTION, que ce motif n'atteint pas la charge.
      const code = codeSeul(readFileSync(f, "utf8"))
        .replace(/admettre(?:Anonyme|Operateur|Partenaire)\s*\(/g, "admettre(")
        .replace(/admettre\(\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,?\s*\)/gs, "admettre()");
      const litteraux = [...code.matchAll(/"([^"\\]{4,})"|'([^'\\]{4,})'/g)]
        .map((m) => m[1] ?? m[2] ?? "");
      aucunSubstitut(litteraux, f);
    }
  });

  it("██ ET LE MOTIF D'ADMISSION N'ATTEINT PAS LA CHARGE — prouvé, pas supposé", async () => {
    // C'est le contre-témoin de l'exclusion ci-dessus. Sans lui, « on écarte
    // le motif » serait un trou déclaré au lieu d'un trou mesuré.
    const motif = "watchlist retiree de la projection servie — motif de temoin";
    const res = await repondre(projeterWatchlist(admettreAnonyme(motif), []));
    const brut = await res.text();
    expect(brut).not.toContain("retiree");
    expect(brut).not.toContain("projection servie");
    expect(brut.length).toBe(75);
  });
});
