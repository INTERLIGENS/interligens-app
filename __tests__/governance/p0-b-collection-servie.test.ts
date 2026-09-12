// ─── P0 · B — LA COLLECTION SERVIE : WATCHLIST ET EXPLORER ───────────────
//
// Deux surfaces, deux formes de refus, et c'est le TEST D'ORACLE qui décide
// de la forme — pas une préférence.
//
//   WATCHLIST  oracle = NON. Six différentiels indépendants reconstruisent
//              déjà la partition 11 / 96. Le refus est donc au niveau de la
//              COLLECTION, et il ne porte aucun compte.
//   EXPLORER   oracle = OUI. Les quatorze dossiers portent tous un `summary`
//              non nul. Le refus est une chaîne IDENTIQUE, pas une absence.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { admettreAnonyme, repondre } from "@/lib/governance/audienceProjection";
import {
  REFUS_WATCHLIST,
  appartenanceSansFondation,
  projeterWatchlist,
} from "@/lib/governance/surfaces/watchlist";
import {
  constaterDecision,
  gouverner,
  type EnregistrementGouverne,
} from "@/lib/governance/uniteGouvernee";

const admission = admettreAnonyme("test");
const decision = () => constaterDecision("KolProfile.publishStatus", "s", "published", true)!;

/** 107 membres, chacun irréprochable — et chacun portant les six différentiels. */
const membres = (n: number): EnregistrementGouverne[] =>
  Array.from({ length: n }, (_, i) => ({
    handle: gouverner("OBSERVATION", `sujet_${i}`, decision()),
    tier: gouverner("ASSERTION", i < 11 ? "CRITICAL" : "", decision()),
  }));

const corpsServi = async (membresDuTour: EnregistrementGouverne[]): Promise<string> => {
  const reponse = repondre(projeterWatchlist(admission, membresDuTour));
  return reponse.text();
};

// ═══════════════════════════════════════════════════════════════════════════
// WATCHLIST — le refus est au niveau de la collection
// ═══════════════════════════════════════════════════════════════════════════

describe("WATCHLIST — retrait causal, et rien ne reconstruit la partition", () => {
  it("le lien avec la table des fondations est PORTANT, pas décoratif", () => {
    expect(appartenanceSansFondation()).toBe(true);
  });

  it("TÉMOIN POSITIF — le phénomène interdit existe : 107 membres gouvernés, prêts à sortir", () => {
    // Sans ce préalable, « rien ne sort » et « il n'y avait rien » rendent le
    // même vert. Les 107 sont bien là, bien formés, et onze portent le
    // marqueur qui les distingue des quatre-vingt-seize autres.
    const m = membres(107);
    expect(m).toHaveLength(107);
    expect(m.filter((x) => x.tier.valeur === "CRITICAL")).toHaveLength(11);
    for (const x of m) expect(x.handle.fondeePar.valeurConstatee).toBe("published");
  });

  it("██ LE MUTANT QUI COMPTE — 107 membres irréprochables, et rien ne sort", async () => {
    const corps = await corpsServi(membres(107));
    expect(JSON.parse(corps)).toEqual({
      refus: true,
      code: "COLLECTION_AUTHORITY_REQUIRED",
      surface: "watchlist",
    });
    // Aucun handle, aucun tier, aucun fragment de membre.
    expect(corps).not.toContain("sujet_");
    expect(corps).not.toContain("CRITICAL");
  });

  it("██ MUTANT D'ORACLE — ne servir QUE les onze fondées rend la MÊME suite d'octets", async () => {
    // C'est l'option A, refusée par le ruling : publier seulement les 11
    // continuerait de faire de l'appartenance une assertion. Ici elle ne peut
    // même pas s'exprimer — la sortie ne bouge pas.
    const cent_sept = await corpsServi(membres(107));
    const onze = await corpsServi(membres(11));
    const une = await corpsServi(membres(1));
    const zero = await corpsServi(membres(0));
    expect(onze).toBe(cent_sept);
    expect(une).toBe(cent_sept);
    expect(zero).toBe(cent_sept);
  });

  it("██ MUTANT D'ORACLE — changer l'ORDRE ne change rien non plus", async () => {
    const droit = membres(107);
    const inverse = [...droit].reverse();
    // Les deux tableaux sont bien DIFFÉRENTS — c'est la prémisse, vérifiée.
    expect(JSON.stringify(droit.map((m) => m.handle.valeur))).not.toBe(
      JSON.stringify(inverse.map((m) => m.handle.valeur)),
    );
    expect(await corpsServi(inverse)).toBe(await corpsServi(droit));
  });

  it("le corps ne peut porter AUCUN compte — ni aujourd'hui, ni par ajout", async () => {
    const corps = await corpsServi(membres(107));
    // Trois clés, pas une de plus.
    expect(Object.keys(JSON.parse(corps)).sort()).toEqual(["code", "refus", "surface"]);
    // Et aucun chiffre nulle part : ni 107, ni 11, ni 96, ni une longueur.
    expect(corps).not.toMatch(/[0-9]/);
  });

  it("le corps est GELÉ — une mutation accidentelle lève au lieu de fuir", () => {
    expect(Object.isFrozen(REFUS_WATCHLIST)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE TÉMOIN AUTHENTIFIÉ — ce que la charge API servait RÉELLEMENT
// ═══════════════════════════════════════════════════════════════════════════
//
// Mesuré en session authentifiée sur les 107 entrées. Il comble la lacune n°4
// de l'inventaire : le chemin jusqu'aux octets n'avait été établi que par
// lecture de code. Il est PLUS DUR que l'inventaire.

/**
 * LES QUATRE SÉPARATEURS PARFAITS, mesurés : 11 / 0 sans exception.
 *
 *   riskFlag            non nul pour les 11 publiés, nul pour les 96
 *   rugCount            11 / 0
 *   totalProceeds        7 / 0
 *   behaviorFlagsCount   5 / 0
 *
 * CHACUN SEUL partitionne. Ce n'est pas une conjonction à casser : c'est
 * quatre oracles indépendants, et en laisser UN suffit.
 */
const SEPARATEURS = ["riskFlag", "rugCount", "totalProceeds", "behaviorFlagsCount"] as const;

/** Le champ qui DÉCLARE la partition, au lieu de la laisser reconstruire. */
const DECLARATION_DE_PARTITION = "isPublished";

/** Les notes internes de `handlesV2`, servies telles quelles sur la Watchlist. */
const NOTES_INTERNES = [
  "Wallet 8deJ9xe...XhU6 reported via public Solscan label",
  "alias of lynk0x",
  "dual-sourced with zachxbt_leak",
  "TOES campaign — draft KolProfile, 7 OSINT captures 2026-06-20; low until reviewed",
];

/** La propriété, sur les OCTETS : la charge permet-elle de reconstruire 11/96 ? */
const reconstruitLaPartition = (corps: string): boolean =>
  corps.includes(DECLARATION_DE_PARTITION) || SEPARATEURS.some((c) => corps.includes(c));

describe("LA CHARGE API — c'est elle qu'il faut fermer, pas le rendu", () => {
  it("`isPublished` était SERVI — la partition n'était pas reconstructible, elle était DÉCLARÉE", async () => {
    // Un containment qui nettoie le rendu et laisse la charge intacte ne ferme
    // rien : le champ dit la réponse, il ne la laisse pas déduire.
    const corps = await corpsServi(membres(107));
    expect(corps).not.toContain(DECLARATION_DE_PARTITION);
  });

  it("██ LES QUATRE SÉPARATEURS — la charge n'en porte aucun", async () => {
    const corps = await corpsServi(membres(107));
    for (const champ of SEPARATEURS) expect(corps, champ).not.toContain(champ);
    expect(reconstruitLaPartition(corps)).toBe(false);
  });

  it("██ MUTATION DISCRIMINANTE — laisser UN SEUL séparateur suffit à rougir", () => {
    // C'est le mutant qui compte : chacun de ces quatre champs, SEUL, partitionne
    // les 107 en 11 et 96. Une garde qui n'attraperait que la conjonction
    // laisserait passer trois fuites sur quatre.
    for (const champ of SEPARATEURS) {
      const charge = JSON.stringify({ entries: [{ handle: "x", [champ]: 1 }] });
      expect(reconstruitLaPartition(charge), `${champ} seul doit rougir`).toBe(true);
    }
    // Et `isPublished` seul, évidemment.
    expect(reconstruitLaPartition(JSON.stringify({ entries: [{ isPublished: true }] }))).toBe(true);

    // CONTRE-TÉMOIN — une charge sans aucun des cinq ne rougit pas. Sans lui,
    // la propriété rendrait `true` sur n'importe quoi et ne mesurerait rien.
    expect(reconstruitLaPartition(JSON.stringify({ entries: [{ handle: "x" }] }))).toBe(false);
  });

  it("les notes INTERNES de handlesV2 ne sortent plus — dont un lien nominatif", () => {
    // « alias of lynk0x » relie NOMINATIVEMENT un handle non publié à un
    // publié. C'est du C1 sur une surface où l'inventaire ne l'avait pas
    // cherché — les trois autres sont des notes d'ingénierie et d'OSINT.
    const source = readFileSync("src/lib/watcher/handles.ts", "utf8");
    for (const note of NOTES_INTERNES) {
      expect(source, "le témoin positif a disparu de la source").toContain(note);
    }
  });

  it("██ et aucune d'elles n'atteint la charge", async () => {
    const corps = await corpsServi(membres(107));
    for (const note of NOTES_INTERNES) expect(corps, note.slice(0, 30)).not.toContain(note);
    expect(corps).not.toContain("lynk0x");
    expect(corps).not.toContain("Solscan");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPLORER — LE REFUS EST UNE ABSENCE DE CLÉ, PAS UNE CHAÎNE
// ═══════════════════════════════════════════════════════════════════════════

/** Les verbatim RÉELLEMENT servis, mesurés en base ep-square-band. */
const NOTES_SERVIES: ReadonlyArray<[string, string]> = [
  ["TOESCOIN", "Auto-draft from Watcher V2 bridge. Internal review pending — not public, not legal-reviewed."],
  ["BOTIFY", "Co-founder BOTIFY. Family wallets received pre-launch supply per leaked doc. | Co-developer BOTIFY. Dad wallet received full supply allocation and dumped."],
  ["SERIAL-12RUGS", "12+ confirmed rug-linked promotions. Source: mariaqueennft Feb 2026. | aucune CA attestée en base, reste non résolu (ne pas deviner)."],
  ["OVPP", "OpenVPP on Ethereum. CEO = Parth Kapadia, concurrently Dione's Head of Energy. SPARK grant cohort recipient — conflict-of-interest flag."],
  ["BULLISH", '{"firstPromotionAt":"2026-02-11T00:00:00.000Z","mentionCount":11,"seededFrom":"bullish_seed_2026-05-14"}'],
];

import { CHAMPS_NON_EMIS, projeterDossierServi } from "@/lib/explorer/explorerItems";

describe("EXPLORER — la clé `summary` ne survit pour AUCUN des quatorze", () => {
  it("TÉMOIN POSITIF — les notes brutes portent bien le contenu interne", () => {
    // Sans lui, « rien ne fuit » serait indiscernable de « il n'y avait rien ».
    // « Dad wallet » est servi par KolTokenLink.note, PAS par KolCase.evidence.
    const botify = NOTES_SERVIES.find(([t]) => t === "BOTIFY")![1];
    expect(botify).toContain("Dad wallet");
    expect(NOTES_SERVIES.find(([t]) => t === "TOESCOIN")![1]).toContain("not public");
    expect(NOTES_SERVIES.find(([t]) => t === "SERIAL-12RUGS")![1]).toContain("ne pas deviner");
    expect(NOTES_SERVIES.find(([t]) => t === "OVPP")![1]).toContain("Parth Kapadia");
    expect(NOTES_SERVIES.find(([t]) => t === "BULLISH")![1]).toContain("seededFrom");
  });

  /**
   * ── CE BLOC A CHANGÉ DE PROPRIÉTÉ, ET C'EST UNE CORRECTION ──────────────
   *
   * Il attestait que le refus était une CHAÎNE IDENTIQUE servie à la place des
   * treize résumés sans fondation, et que la CLÉ RESTAIT — au motif que la
   * retirer pour treize et la garder pour un créerait un différentiel de
   * PRÉSENCE.
   *
   * La prémisse était juste. La sortie ne l'était pas. Mesuré sur la charge :
   * treize dossiers ANNONÇAIENT un retrait, un portait un vrai résumé. La
   * partition 13/1 devenait EXPLICITE au lieu d'être effacée, et le texte
   * affirmait qu'un contenu existait et avait été retenu.
   *
   * La sortie du différentiel de présence est de retirer la clé POUR LES
   * QUATORZE — y compris le seul réellement gouverné.
   */
  const dossierInterne = (titre: string, resume: string | null) =>
    ({
      id: `launch-${titre}`, kind: "launch", title: titre, summary: resume,
      primaryDate: "2026-05-01", linkedActors: [], linkedActorsCount: 0,
      proceedsObservedTotal: null, proceedsCoverage: "none", evidenceDepth: "none",
      strongestFlags: [], documentationStatus: "partial", href: `/h/${titre}`,
      sharedActorGroup: false, multiLaunchRecurrence: false, snapshotCount: 0,
    }) as never;

  it("`summary` est dans CHAMPS_NON_EMIS — la liste est l'unique autorité", () => {
    expect(CHAMPS_NON_EMIS).toContain("summary");
  });

  it("██ LES CINQ NOTES INTERNES — la clé ne survit à la projection pour aucune", () => {
    for (const [titre, brut] of NOTES_SERVIES) {
      const servi = projeterDossierServi(dossierInterne(titre, brut)) as Record<string, unknown>;
      expect("summary" in servi, `${titre} garde la clé`).toBe(false);
      const serialise = JSON.stringify(servi);
      expect(serialise).not.toContain('"summary"');
      for (const motif of ["Dad wallet", "Parth Kapadia", "mariaqueennft", "seededFrom", "not public"]) {
        expect(serialise, `${titre} laisse passer « ${motif} »`).not.toContain(motif);
      }
    }
  });

  it("██ LE SEUL RÉSUMÉ GOUVERNÉ DU CORPUS PART AVEC LES AUTRES", () => {
    // CBEX, `PlatformCaseFile.publishStatus = 'published'`. C'est LUI le
    // quatorzième, et c'est lui qui rendait la partition 13/1 lisible. Le
    // garder, c'était publier que les treize ne sont pas fondés.
    const cbex = "The $12M Ponzi That Never Stopped";
    const servi = projeterDossierServi(dossierInterne("CBEX", cbex)) as Record<string, unknown>;
    expect("summary" in servi).toBe(false);
    expect(JSON.stringify(servi)).not.toContain("Ponzi");
  });

  it("██ AUCUNE PRÉSENCE À COMPARER — les quatorze rendent le MÊME jeu de clés", () => {
    // C'est la propriété qui remplace « chaîne identique ». Un dossier fondé et
    // un dossier non fondé ne se distinguent plus par la forme de leur objet.
    const clefs = [
      ...NOTES_SERVIES.map(([t, b]) => dossierInterne(t, b)),
      dossierInterne("CBEX", "The $12M Ponzi That Never Stopped"),
      dossierInterne("VIDE", null),
    ].map((d) => JSON.stringify(Object.keys(projeterDossierServi(d)).sort()));
    expect(new Set(clefs).size).toBe(1);
  });

  it("██ AUCUN SUBSTITUT N'A PRIS LA PLACE — ni chaîne, ni clé vide", () => {
    const servi = JSON.stringify(
      NOTES_SERVIES.map(([t, b]) => projeterDossierServi(dossierInterne(t, b))),
    );
    for (const substitut of ["withheld", "no publication decision", "redacted", "N/A", "Under review"]) {
      expect(servi, `substitut « ${substitut} » réintroduit`).not.toContain(substitut);
    }
  });
});
