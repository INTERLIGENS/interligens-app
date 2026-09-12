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
import { admettreAnonyme, repondre } from "@/lib/governance/audienceProjection";
import {
  REFUS_WATCHLIST,
  appartenanceSansFondation,
  projeterWatchlist,
} from "@/lib/governance/surfaces/watchlist";
import {
  RESUME_NON_GOUVERNE,
  resumeGouverne,
} from "@/lib/governance/surfaces/explorer";
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
// EXPLORER — le refus est une chaîne identique
// ═══════════════════════════════════════════════════════════════════════════

/** Les verbatim RÉELLEMENT servis, mesurés en base ep-square-band. */
const NOTES_SERVIES: ReadonlyArray<[string, string]> = [
  ["TOESCOIN", "Auto-draft from Watcher V2 bridge. Internal review pending — not public, not legal-reviewed."],
  ["BOTIFY", "Co-founder BOTIFY. Family wallets received pre-launch supply per leaked doc. | Co-developer BOTIFY. Dad wallet received full supply allocation and dumped."],
  ["SERIAL-12RUGS", "12+ confirmed rug-linked promotions. Source: mariaqueennft Feb 2026. | aucune CA attestée en base, reste non résolu (ne pas deviner)."],
  ["OVPP", "OpenVPP on Ethereum. CEO = Parth Kapadia, concurrently Dione's Head of Energy. SPARK grant cohort recipient — conflict-of-interest flag."],
  ["BULLISH", '{"firstPromotionAt":"2026-02-11T00:00:00.000Z","mentionCount":11,"seededFrom":"bullish_seed_2026-05-14"}'],
];

describe("EXPLORER — identique, pas équivalent, comparé sur le JSON sérialisé", () => {
  it("TÉMOIN POSITIF — les notes brutes portent bien le contenu interne", () => {
    // « Dad wallet » est servi par KolTokenLink.note, PAS par KolCase.evidence.
    const botify = NOTES_SERVIES.find(([t]) => t === "BOTIFY")![1];
    expect(botify).toContain("Dad wallet");
    expect(NOTES_SERVIES.find(([t]) => t === "TOESCOIN")![1]).toContain("not public");
    expect(NOTES_SERVIES.find(([t]) => t === "SERIAL-12RUGS")![1]).toContain("ne pas deviner");
    expect(NOTES_SERVIES.find(([t]) => t === "OVPP")![1]).toContain("Parth Kapadia");
    expect(NOTES_SERVIES.find(([t]) => t === "BULLISH")![1]).toContain("seededFrom");
  });

  it("██ MUTANT DE BYPASS BRUT — les cinq notes sont refusées, à l'identique", () => {
    const sorties = NOTES_SERVIES.map(([, brut]) =>
      resumeGouverne("KolTokenLink.note", brut, null),
    );
    for (const s of sorties) expect(s).toBe(RESUME_NON_GOUVERNE);
    // IDENTIQUE, comparé sur le JSON sérialisé — pas « équivalent ».
    expect(new Set(sorties.map((s) => JSON.stringify({ summary: s }))).size).toBe(1);
    // Et rien du brut ne survit.
    const serialise = JSON.stringify(sorties);
    for (const motif of ["Dad wallet", "Parth Kapadia", "mariaqueennft", "seededFrom", "not public"]) {
      expect(serialise).not.toContain(motif);
    }
  });

  it("██ LE BYPASS LE PLUS SUBTIL — présenter une décision d'un AUTRE référentiel ne suffit pas", () => {
    // Un appelant qui aurait lu `visibility='public'` sur le LIEN pourrait
    // croire qu'il tient une fondation pour la NOTE. La table dit non : le
    // chemin `KolTokenLink.note` n'a aucune fondation possible, et aucune
    // valeur passée en troisième argument ne la lui donne.
    for (const valeur of ["public", "published", "approved", ""]) {
      expect(resumeGouverne("KolTokenLink.note", "Dad wallet …", valeur)).toBe(RESUME_NON_GOUVERNE);
    }
  });

  it("`KolCase.evidence` est refusé par le même chemin", () => {
    const evidence = "GHOST overlap with BK/SAM cluster. Under investigation. | cross-ref @lynk0x ongoing.";
    expect(resumeGouverne("KolCase.evidence", evidence, null)).toBe(RESUME_NON_GOUVERNE);
    expect(resumeGouverne("KolCase.evidence", evidence, "published")).toBe(RESUME_NON_GOUVERNE);
  });

  it("MUTATION DISCRIMINANTE — le SEUL résumé gouverné du corpus passe intact", () => {
    // CBEX, `PlatformCaseFile.publishStatus = 'published'`. Une garde qui
    // refuserait tout serait désarmée.
    const cbex = "The $12M Ponzi That Never Stopped";
    expect(resumeGouverne("PlatformCaseFile.summary", cbex, "published")).toBe(cbex);
    // Et la même donnée SANS décision lue retombe sur le refus.
    expect(resumeGouverne("PlatformCaseFile.summary", cbex, null)).toBe(RESUME_NON_GOUVERNE);
  });

  it("LA CLÉ RESTE PRÉSENTE — c'est ce qui distingue ce refus de celui du modèle", () => {
    // Sur l'Explorer, quatorze dossiers sont servis côte à côte et les
    // quatorze portent un `summary`. Supprimer la clé pour treize créerait un
    // différentiel de PRÉSENCE. Dans le pack du modèle, où il n'y a pas
    // d'ensemble de comparaison, c'est l'inverse qui est juste.
    const dossier = { title: "BOTIFY", summary: resumeGouverne("KolTokenLink.note", "…", null) };
    expect(Object.keys(dossier)).toContain("summary");
    expect(JSON.stringify(dossier)).toContain('"summary"');
  });
});
