// ─── BUILD 12 · S3 — LE CONTAINMENT DE ROUTE : CORPUS ADVERSE ─────────────
//
// ██  « Contract truth first, projection second. »                         ██
//
// Mandat GPT : « checked/measured scope must be distinguishable from
// not operational / not executed / unavailable ».
//
// `sanctionCoverage.ts` est l'autorité. Elle couvre aujourd'hui DEUX routes —
// `/api/intelligence/match` et `/api/scan/intelligence`, mesuré. Il en manque
// DEUX : `/api/v1/score` et `/api/partner/v1/*`.
//
// ─── ATTRIBUABILITÉ — largeur mesurée avant de compter un mutant ──────────
//
// Table MESURÉE — ma version pré-écrite était une supposition, elle est
// remplacée par le relevé. 14 mutants.
//
//   PRÉCIS (1)   D1 · D1b · E2 · E3 · F2 · F3 · F4 · G2
//   COUPLÉS (2)  D2 et G3 — servir un périmètre qui n'est pas celui de
//                l'autorité tombe aussi sur D1, qui mesure la même chose sur
//                l'état STALE · E1 — projeter sans consulter l'état SERT la
//                phrase sur un périmètre partiel · F1 — conclure NO_MATCH sur
//                une source jamais exécutée conclut aussi faux sur une source
//                périmée · F2b — remplacer les états par NOT_APPLICABLE efface
//                d'abord NOT_ARMED
//   LARGE        G1 (7) — annuler le contrat sur deux routes casse la
//                conclusion, la phrase, les états d'absence et le jeton
//                partenaire d'un seul geste. C'est le défaut exact, et son
//                étendue est la mesure de ce qu'il laisse ouvert.
//
// Aucune mort par critère étranger : toutes les couplages restent dans la
// famille du critère visé.
//
// ─── AXES H · I · J, largeur MESURÉE ──────────────────────────────────────
//
//   PRÉCIS (1)   H5b · I5 · J1 · J2
//   COUPLÉS (2)  H2 · H3 · H4 · H5 — toucher un des quatre états fait tomber
//                celui qui en dépend, jamais celui d'un voisin
//   LARGES       H1 · I1 · I3 · I4 (3) — EXPECTED est le pivot du contrat :
//                le fausser casse mécaniquement la dérivation, le seuil et la
//                distinction avec DECLARED
//                I2 (7) — c'est le DÉFAUT ACTUEL, et sa largeur EST la mesure
//                de ce qu'une liste figée détruit : la dérivation, les quatre
//                états, le motif d'absence et la conclusion.
//
// Un mutant a dû être RÉÉCRIT : I4 était I3 à l'identique — `expected.slice(0,1)`
// des deux côtés. Deux mutants identiques ne prouvent pas deux propriétés. I4
// porte désormais un quorum choisi, qui est un vrai seuil inventé.
//
// ─── Trous de preuve déclarés ─────────────────────────────────────────────
//
//   1. Les routes partenaires ne sont PAS mesurables sans clé : `X-Partner-Key`
//      est exigé, et il n'y a aucun `.env.local` ici. Un 401 n'est JAMAIS une
//      mesure — il prouve que la gate d'auth fonctionne, rien d'autre. Tout ce
//      qui suit prouve donc le MÉCANISME, jamais la production.
//   2. Aucun accès base : les verdicts de fraîcheur sont INJECTÉS. Ce qui est
//      prouvé est le prédicat de containment, pas l'état des collecteurs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildSanctionCoverage,
  buildIntelligenceCoverage,
  assessSanction,
  DECLARED_SANCTION_SOURCES,
  type SanctionCoverage,
} from "@/lib/intelligence/sanctionCoverage";

// ═══ FIXTURES DE FRAÎCHEUR ═══════════════════════════════════════════════
//
// `FreshnessState` = FRESH | STALE | UNKNOWN | NOT_ARMED — mesuré dans
// `sourceFreshness.ts`. `NOT_ARMED` est l'état d'un collecteur jamais exécuté.

type Etat = "FRESH" | "STALE" | "UNKNOWN" | "NOT_ARMED";
const vf = (sourceSlug: string, state: Etat) =>
  ({ sourceSlug, state, ageDays: state === "FRESH" ? 1 : null }) as never;

/** MESURÉ — ofac tourne, amf et fca n'ont jamais exécuté de lot. */
const REEL = [vf("ofac", "FRESH"), vf("amf", "NOT_ARMED"), vf("fca", "NOT_ARMED")];
/** Toutes fraîches — le seul cas où un négatif conclut. */
const COMPLET = DECLARED_SANCTION_SOURCES.map((s) => vf(s, "FRESH"));
/** Une source périmée : ni fraîche, ni jamais exécutée. */
const PERIME = [vf("ofac", "FRESH"), vf("amf", "STALE"), vf("fca", "FRESH")];

const COUV_REELLE = buildSanctionCoverage(REEL);
const COUV_COMPLETE = buildSanctionCoverage(COMPLET);
const COUV_PERIMEE = buildSanctionCoverage(PERIME);

// ═══ LE CONTRAT DE ROUTE ═════════════════════════════════════════════════

type Route = "v1/score" | "partner/v1" | "intelligence/match" | "scan/intelligence";
const LES_QUATRE: Route[] = ["v1/score", "partner/v1", "intelligence/match", "scan/intelligence"];

interface Reponse {
  route: Route;
  /** Le champ qui qualifie `hasSanction`. Jamais absent. */
  sanctionAssessment: "MATCHED" | "NO_MATCH_COMPLETE" | "NO_MATCH_PARTIAL" | null;
  /** Le périmètre RÉELLEMENT vérifié, tel que servi. */
  consulted: readonly string[];
  notConsulted: readonly { source: string; state: string }[];
  /** La phrase de réassurance, ou `null`. */
  reassurance: string | null;
  /**
   * S3.1 — les déclarées JAMAIS armées, nommées avec leur motif typé. Elles
   * sortent du dénominateur mais PAS de la réponse.
   */
  declaredNotArmed: readonly { source: string; reason: string }[];
  /** Le jeton structuré servi aux partenaires. */
  verdictJeton: "SAFE" | "WARNING" | "AVOID" | null;
  /** Le floor réglementaire est-il annoncé comme adossé à une source ? */
  floorAdosseA: string[] | null;
}

type Servir = (route: Route, hasSanction: boolean, couverture: SanctionCoverage) => Reponse;

const PHRASE = "No major risk signals detected.";

const TEMOIN: Servir = (route, hasSanction, couverture) => {
  const a = assessSanction(hasSanction, couverture);
  const conclusif = couverture.negativeIsConclusive;
  return {
    route,
    sanctionAssessment: a,
    consulted: couverture.consulted,
    notConsulted: couverture.notConsulted,
    declaredNotArmed: couverture.declaredNotArmed,
    // La phrase ne dépend PAS du verdict seul : elle exige un périmètre
    // complet. C'est la famille fermée deux fois — buildReason(score, count)
    // et la projection legacy.
    reassurance: a === "NO_MATCH_COMPLETE" ? PHRASE : null,
    verdictJeton: hasSanction ? "AVOID" : conclusif ? "SAFE" : "WARNING",
    // Un floor ne s'adosse qu'aux sources RÉELLEMENT consultées.
    floorAdosseA: couverture.consulted.length > 0 ? [...couverture.consulted] : null,
  };
};

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

function batterie(impl: Servir): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // ── AXE D — UNE SEULE AUTORITÉ, JAMAIS UNE COPIE ─────────────────────
  //
  // Le discriminant est `STALE` : la canonique ne le compte pas comme
  // consulté — trois états distincts, pas « absent ». Une copie écrite
  // `state !== "NOT_ARMED"` le compterait.
  const perime = impl("v1/score", false, COUV_PERIMEE);
  dit(!perime.consulted.includes("amf"), "D1 autorite-reimplementee");
  dit(perime.sanctionAssessment === "NO_MATCH_PARTIAL", "D1b conclusion-de-la-copie");

  // D2 — la gate VOISINE répond à une autre question. `intelligence/match`
  // rend `true` au PREMIER RETAIL_SAFE trouvé : « UNE entité de cette valeur
  // est sûre », pas « CELLE-CI l'est ». La consommer recopierait un contrat
  // faux. On exige donc que le périmètre servi soit CELUI de la couverture.
  const reel = impl("v1/score", false, COUV_REELLE);
  dit(
    JSON.stringify([...reel.consulted].sort()) ===
      JSON.stringify([...COUV_REELLE.consulted].sort()),
    "D2 gate-voisine-consommee",
  );

  // ── AXE E — LA PROJECTION CONSOMME L'ÉTAT DE MESURE ──────────────────
  //
  // ⚠ S3.1 — LA FIXTURE DÉGRADÉE A CHANGÉ, ET C'EST LE CŒUR DE LA CORRECTION.
  //
  // `REEL` — ofac frais, amf et fca JAMAIS exécutées — n'est PLUS le cas
  // dégradé : c'est le régime NOMINAL. Une déclarée jamais armée sort du
  // dénominateur et va dans `declaredNotArmed`. Le seul cas qui dégrade est
  // désormais une source ARMÉE et MANQUANTE, c'est-à-dire `PERIME`.
  //
  // Écrit autrement : ce corpus mesurait la dégradation sur la fixture qui
  // la produisait EN PERMANENCE. C'est précisément ce que S3.1 ferme.
  const degrade = impl("v1/score", false, COUV_PERIMEE);
  dit(degrade.reassurance === null, "E1 reassurance-sans-etat-de-couverture");
  dit(impl("v1/score", false, COUV_PERIMEE).reassurance === null, "E2 phrase-sur-perimetre-partiel");
  // SUR-CORRECTION : un périmètre COMPLET garde sa phrase. Une gate qui
  // éteint tout n'est pas une gate.
  dit(impl("v1/score", false, COUV_COMPLETE).reassurance === PHRASE, "E3 gate-qui-eteint-tout");
  // SUR-CORRECTION S3.1 : le régime NOMINAL garde sa phrase. Si `REEL` sortait
  // encore sans réassurance, l'alerte serait le fond — le précédent `holders`.
  dit(reel.reassurance === PHRASE, "E4 nominal-degrade-en-permanence");

  // ── AXE F — NEVER_EXECUTED NE PROJETTE JAMAIS EN NO_MATCH ────────────
  //
  // La doctrine ne change pas d'un mot : une source jamais exécutée ne se lit
  // JAMAIS comme « vérifiée, rien trouvé ». Ce qui change, c'est le MOYEN de le
  // garantir. Avant : la compter au dénominateur et dégrader tout le scan.
  // Maintenant : la sortir du dénominateur et la NOMMER dans `declaredNotArmed`.
  // Le lecteur voit qu'elle existe et qu'elle n'a jamais tourné — la première
  // méthode le lui disait aussi, mais en criant sur chaque scan.
  const motifs = reel.declaredNotArmed.map((x) => x.reason);
  dit(degrade.sanctionAssessment !== "NO_MATCH_COMPLETE", "F1 never-executed-en-no-match");
  dit(motifs.includes("NOT_MEASURED"), "F2 never-executed-aplati");
  dit(!motifs.includes("NOT_APPLICABLE"), "F2b never-executed-en-not-applicable");
  // F2c — elles sont NOMMÉES, pas seulement comptées. Une jamais exécutée qui
  // disparaît de la réponse serait pire que le défaut d'origine.
  dit(
    reel.declaredNotArmed.map((x) => x.source).includes("amf") &&
      reel.declaredNotArmed.map((x) => x.source).includes("fca"),
    "F2c never-executed-effacee",
  );
  // F3 — un floor ne s'adosse pas à une source jamais exécutée : c'est une
  // CAPACITÉ INDISPONIBLE, pas un « vérifié, rien trouvé ».
  dit(
    (reel.floorAdosseA ?? []).every((s) => COUV_REELLE.consulted.includes(s)),
    "F3 floor-adosse-a-une-source-jamais-executee",
  );
  // SUR-CORRECTION : une source réellement fraîche projette normalement.
  dit(
    impl("v1/score", false, COUV_COMPLETE).sanctionAssessment === "NO_MATCH_COMPLETE",
    "F4 source-executee-refusee",
  );

  // ── AXE G — LES QUATRE SURFACES, PAS DEUX ────────────────────────────
  const toutes = LES_QUATRE.map((r) => impl(r, false, COUV_REELLE));
  dit(toutes.every((x) => x.sanctionAssessment !== null), "G1 routes-non-couvertes");
  // G2 — le chemin PARTENAIRE ne reste pas ouvert quand le public est fermé.
  // `verdict: "SAFE"` est une réassurance STRUCTURÉE : une absence de phrase
  // n'est pas une absence de réassurance.
  const partenaire = impl("partner/v1", false, COUV_PERIMEE);
  dit(partenaire.verdictJeton !== "SAFE", "G2 jeton-SAFE-sur-perimetre-partiel");
  // G3 — les quatre servent le MÊME périmètre pour la même couverture.
  dit(
    new Set(toutes.map((x) => JSON.stringify([...x.consulted].sort()))).size === 1,
    "G3 perimetre-divergent-entre-routes",
  );

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("S3/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe", () => expect(batterie(TEMOIN)).toEqual([]));

  it("l'autorité consommée est bien la canonique, et elle distingue trois absences", () => {
    // ⚠ S3.1 — CES DEUX PREMIÈRES LIGNES ONT ÉTÉ RETOURNÉES, et il faut dire
    // pourquoi plutôt que de les corriger en silence.
    //
    // Elles épinglaient `PARTIAL` / `false` sur la fixture RÉELLE. C'était un
    // constat exact du DÉFAUT, écrit comme s'il était la propriété. Le même
    // fichier, plus bas, exige l'inverse par son critère I2 :
    //
    //   ligne ~205 (avant)   COUV_REELLE.negativeIsConclusive === false
    //   critère I2           r.negativeConclusive === true, même état réel
    //
    // Deux exigences contradictoires dans un seul corpus. Le modèle de l'axe I
    // décrivait la correction, la mesure épinglée des axes D–G décrivait le
    // défaut, et les deux ne se rencontraient jamais — ce qui est exactement
    // la raison pour laquelle le défaut a survécu à S3.
    //
    // C'est le modèle qui avait raison. La mesure suit.
    expect(COUV_REELLE.state).toBe("COMPLETE");
    expect(COUV_REELLE.negativeIsConclusive).toBe(true);
    // Les jamais armées ne DISPARAISSENT pas : elles changent de champ.
    expect(COUV_REELLE.notConsulted).toEqual([]);
    expect(COUV_REELLE.declaredNotArmed.map((x) => x.source)).toEqual(["amf", "fca"]);
    expect(COUV_REELLE.declaredNotArmed.map((x) => x.reason)).toEqual([
      "NOT_MEASURED",
      "NOT_MEASURED",
    ]);
    // Si `buildSanctionCoverage` cessait de distinguer STALE de NOT_ARMED, le
    // mutant D1 ne prouverait plus rien. STALE reste ARMÉE et manquante.
    expect(COUV_PERIMEE.notConsulted.map((x) => x.state)).toEqual(["STALE"]);
    expect(COUV_PERIMEE.negativeIsConclusive).toBe(false);
    expect(COUV_COMPLETE.negativeIsConclusive).toBe(true);
  });

  it("S3.1 — LES DEUX BORNES, sur l'autorité RÉELLE et non sur un modèle", () => {
    // Le corpus d'origine prouvait les bornes sur `TEMOIN_CONTRAT`, un modèle.
    // Un modèle correct à côté d'un code faux, c'est la configuration qui a
    // laissé passer le défaut. On les rejoue donc sur `buildSanctionCoverage`.
    //
    // Borne 1 — une déclarée jamais armée n'entre pas au dénominateur.
    expect(COUV_REELLE.expected).toEqual(["ofac"]);
    // Borne 2 — SYMÉTRIQUE : un périmètre armé VIDE ne conclut rien. Sans
    // elle, `notConsulted.length === 0` rendrait « complet » vrai du néant.
    const vide = buildSanctionCoverage([vf("amf", "NOT_ARMED"), vf("fca", "NOT_ARMED")]);
    expect(vide.expected).toEqual([]);
    expect(vide.state).toBe("PARTIAL");
    expect(vide.negativeIsConclusive).toBe(false);
    expect(assessSanction(false, vide)).toBe("NO_MATCH_PARTIAL");
    // Aucun quorum : EXPECTED suit la capacité armée UN POUR UN.
    for (const n of [1, 2, 3]) {
      const caps = DECLARED_SANCTION_SOURCES.slice(0, n).map((s) => vf(s, "FRESH"));
      expect(buildSanctionCoverage([...caps]).expected).toHaveLength(n);
    }
  });

  it("S3.1 — LE FLOOR OFAC RESTE, et c'est la sur-correction à ne pas commettre", () => {
    // `amf` et `fca` ne contribuent rien ; ne pas généraliser à `ofac`, qui
    // porte 869 observations et déclenche le floor à lui seul.
    expect(COUV_REELLE.consulted).toContain("ofac");
    expect(COUV_REELLE.expected).toContain("ofac");
    // Et un floor ne s'adosse JAMAIS à une source jamais exécutée.
    expect(COUV_REELLE.consulted).not.toContain("amf");
    expect(COUV_REELLE.consulted).not.toContain("fca");
    // `ofac` périmé DÉGRADE — il est armé, donc attendu, donc manquant.
    const ofacPerime = buildSanctionCoverage([vf("ofac", "STALE")]);
    expect(ofacPerime.expected).toEqual(["ofac"]);
    expect(ofacPerime.negativeIsConclusive).toBe(false);
  });

  it("S3.1 — LES DEUX FORMES S'ACCORDENT SUR LE VERDICT, pas seulement sur le périmètre commun", () => {
    // ██ LE TEST QUI MANQUAIT, ET IL MESURAIT AU MAUVAIS ENDROIT.
    //
    // L'ancien comparait `consultedMeasured` à `consulted` — le périmètre
    // COMMUN, {ofac}, sur lequel les deux formes s'accordaient effectivement.
    // Ce qui divergeait était EXPECTED, donc le VERDICT. Il mesurait la bonne
    // chose au mauvais endroit, et son commentaire justifiait la divergence
    // comme volontaire.
    //
    // Mesuré en production le 2026-09-09, AVANT correction, même adresse :
    //   /api/scan/intelligence  PARTIAL   negativeIsConclusive false
    //   /api/v1/score           COMPLETE  negativeConclusive   true
    for (const etat of ["FRESH", "STALE", "UNKNOWN", "NOT_ARMED"] as const) {
      const verdicts = [vf("ofac", etat)];
      const s = buildSanctionCoverage(verdicts, ["ofac"]);
      const i = buildIntelligenceCoverage(verdicts, ["ofac"]);
      expect(
        s.negativeIsConclusive,
        `sur ofac ${etat}, les deux surfaces servent des verdicts contradictoires`,
      ).toBe(i.negativeConclusive);
      expect(s.state, `sur ofac ${etat}, les deux surfaces servent des états contradictoires`).toBe(
        i.state,
      );
      expect([...s.expected]).toEqual([...i.expected]);
    }
  });

  it("MÉCANISME, PAS PRODUCTION — les QUATRE routes consomment l'autorité", () => {
    // ⚠ Preuve LEXICALE, annoncée : les routes partenaires exigent
    // `X-Partner-Key` et ne sont pas exécutables ici. On prouve qu'elles ne
    // consomment PAS l'autorité, pas ce qu'elles renvoient en production.
    const couvre = (f: string) =>
      readFileSync(f, "utf8").includes("sanctionCoverage");
    expect(couvre("src/app/api/intelligence/match/route.ts")).toBe(true);
    expect(couvre("src/app/api/scan/intelligence/route.ts")).toBe(true);
    // ⚠ S3.1 — CETTE ASSERTION A ÉTÉ RETOURNÉE. Elle exigeait qu'il RESTE des
    // routes non couvertes : c'était le constat daté de l'écriture du corpus,
    // pas une propriété. S3 a câblé les quatre, mesuré en production le
    // 2026-09-09. Un constat qui reste vert après sa correction ne mesure plus
    // rien — il fige l'état qu'on vient de quitter.
    //
    // Retournée, elle devient permanente : plus aucune route du chemin
    // pré-achat ne peut cesser de consommer l'autorité sans faire rougir.
    const manquantes = [
      "src/app/api/v1/score/route.ts",
      "src/app/api/partner/v1/score-lite/route.ts",
      "src/app/api/partner/v1/batch-score/route.ts",
      "src/app/api/partner/v1/transaction-check/route.ts",
    ].filter((f) => !couvre(f));
    expect(manquantes, "routes sans autorité de couverture").toEqual([]);
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Servir }

const MUTANTS: Mutant[] = [
  {
    nom: "██ D1 — la sémantique de couverture est RÉIMPLÉMENTÉE dans la route",
    critere: "D1 autorite-reimplementee",
    impl: (r, h, c) => {
      // La copie : « tout ce qui n'est pas NOT_ARMED compte comme consulté ».
      // Elle diverge sur STALE, un état que la canonique gère et qu'elle non.
      const consulted = [...c.consulted, ...c.notConsulted.filter((x) => x.state !== "NOT_ARMED").map((x) => x.source)];
      return { ...TEMOIN(r, h, c), consulted };
    },
  },
  {
    nom: "la copie conclut « complet » sur une couverture périmée",
    critere: "D1b conclusion-de-la-copie",
    impl: (r, h, c) => ({
      ...TEMOIN(r, h, c),
      sanctionAssessment: c.notConsulted.every((x) => x.state === "STALE")
        ? "NO_MATCH_COMPLETE" : TEMOIN(r, h, c).sanctionAssessment,
    }),
  },
  {
    nom: "██ D2 — une gate VOISINE est consommée : « une entité sûre » au lieu de « celle-ci »",
    critere: "D2 gate-voisine-consommee",
    impl: (r, h, c) => ({
      ...TEMOIN(r, h, c),
      // Le premier RETAIL_SAFE trouvé suffit — sémantique d'existence, pas
      // d'individu. Le périmètre servi n'est plus celui de la couverture.
      consulted: [...DECLARED_SANCTION_SOURCES],
    }),
  },
  {
    nom: "██ E1 — la phrase est projetée sans consulter l'état de couverture",
    critere: "E1 reassurance-sans-etat-de-couverture",
    impl: (r, h, c) => ({ ...TEMOIN(r, h, c), reassurance: h ? null : PHRASE }),
  },
  {
    nom: "E2 — la phrase est servie sur un périmètre PARTIEL",
    critere: "E2 phrase-sur-perimetre-partiel",
    impl: (r, h, c) => {
      const t = TEMOIN(r, h, c);
      return c.state === "PARTIAL" && c.notConsulted.every((x) => x.state === "STALE")
        ? { ...t, reassurance: PHRASE } : t;
    },
  },
  {
    nom: "SUR-CORRECTION — la gate éteint la phrase même sur périmètre complet",
    critere: "E3 gate-qui-eteint-tout",
    impl: (r, h, c) => ({ ...TEMOIN(r, h, c), reassurance: null }),
  },
  {
    nom: "██ F1 — NEVER_EXECUTED projette en NO_MATCH_COMPLETE",
    critere: "F1 never-executed-en-no-match",
    impl: (r, h, c) => ({
      ...TEMOIN(r, h, c),
      sanctionAssessment: h ? "MATCHED" : "NO_MATCH_COMPLETE",
    }),
  },
  {
    nom: "F2 — les trois causes d'absence sont APLATIES en un seul mot",
    critere: "F2 never-executed-aplati",
    impl: (r, h, c) => ({
      ...TEMOIN(r, h, c),
      // S3.1 — le motif des JAMAIS ARMÉES a changé de champ : il vit dans
      // `declaredNotArmed`. Le mutant l'aplatit là où il est.
      declaredNotArmed: c.declaredNotArmed.map((x) => ({ source: x.source, reason: "ABSENT" })),
    }),
  },
  {
    nom: "F2b — NEVER_EXECUTED est rendu NOT_APPLICABLE",
    critere: "F2b never-executed-en-not-applicable",
    impl: (r, h, c) => ({
      ...TEMOIN(r, h, c),
      declaredNotArmed: c.declaredNotArmed.map((x) => ({
        source: x.source,
        reason: "NOT_APPLICABLE",
      })),
    }),
  },
  {
    nom: "██ F3 — le floor est annoncé comme adossé à une source jamais exécutée",
    critere: "F3 floor-adosse-a-une-source-jamais-executee",
    impl: (r, h, c) => ({ ...TEMOIN(r, h, c), floorAdosseA: [...DECLARED_SANCTION_SOURCES] }),
  },
  {
    nom: "SUR-CORRECTION — une source réellement exécutée est refusée elle aussi",
    critere: "F4 source-executee-refusee",
    impl: (r, h, c) => ({ ...TEMOIN(r, h, c), sanctionAssessment: "NO_MATCH_PARTIAL" }),
  },
  {
    nom: "██ G1 — deux routes sur quatre seulement sont fermées",
    critere: "G1 routes-non-couvertes",
    impl: (r, h, c) => {
      const t = TEMOIN(r, h, c);
      return r === "intelligence/match" || r === "scan/intelligence"
        ? t
        : { ...t, sanctionAssessment: null, notConsulted: [], reassurance: PHRASE, verdictJeton: "SAFE" };
    },
  },
  {
    nom: "██ G2 — le chemin public est fermé, le chemin PARTENAIRE reste ouvert",
    critere: "G2 jeton-SAFE-sur-perimetre-partiel",
    impl: (r, h, c) => {
      const t = TEMOIN(r, h, c);
      return r === "partner/v1" ? { ...t, verdictJeton: h ? "AVOID" : "SAFE" } : t;
    },
  },
  {
    nom: "G3 — les routes servent des périmètres DIVERGENTS pour la même couverture",
    critere: "G3 perimetre-divergent-entre-routes",
    impl: (r, h, c) => {
      const t = TEMOIN(r, h, c);
      return r === "v1/score" ? { ...t, consulted: [...t.consulted, "fca"] } : t;
    },
  },
];

describe("S3/1 — chaque mutant meurt sur sa propriété", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterie(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }


  it("les 14 mutants sont déclarés", () => {
    expect(MUTANTS).toHaveLength(14);
    expect(MUTANTS.every((m) => m.critere.length > 0)).toBe(true);
  });
});

// ═══ AXE H — LES QUATRE ÉTATS DU CONTRAT, RATIFIÉS NOMMÉMENT ═════════════
//
//   EXPECTED · CONSULTED/MEASURED · NOT_CONSULTED(reason) · NEGATIVE_CONCLUSIVE
//   et : DECLARED ≠ EXPECTED ≠ CONSULTED
//
// Les quatre ne se collapsent pas — même règle que les deux axes
// d'absenceVocabulary. `NOT_CONSULTED` est un état À CHARGE UTILE : sans son
// motif, ce n'est plus qu'un drapeau, et les trois causes redeviennent une.
//
// ═══ AXE I — ⚠ LE PIÈGE : LA DÉGRADATION PERMANENTE ══════════════════════
//
// « Expected coverage comes from actually ARMED / GOVERNED capability. »
//
// ██ CE N'EST PAS UN RISQUE À VENIR, C'EST L'ÉTAT ACTUEL. Mesuré :
//     DECLARED_SANCTION_SOURCES = ["ofac", "amf", "fca"]  — liste FIGÉE
// et avec les données réelles — `ofac` FRESH, `amf` et `fca` NOT_ARMED —
// `buildSanctionCoverage` rend :
//     { state: "PARTIAL", negativeIsConclusive: false, consulted: ["ofac"] }
// sur TOUT scan, en permanence. Une alerte allumée en régime nominal cesse
// d'alerter : c'est le précédent `holders` de la phase 2, à l'identique.
//
// Les DEUX bornes doivent tenir. Ne tenir que la première viderait EXPECTED,
// et « périmètre complet » deviendrait vrai de n'importe quoi.

type EtatFraicheur = "FRESH" | "STALE" | "UNKNOWN" | "NOT_ARMED";

interface Capacite {
  slug: string;
  /** DECLARED — présente en code, avec un poids. */
  declaree: boolean;
  /** ARMÉE ET GOUVERNÉE — cron, entrée au registre, pipeline. */
  armee: boolean;
  fraicheur: EtatFraicheur;
}

interface Contrat {
  declared: string[];
  expected: string[];
  consulted: string[];
  /** À CHARGE UTILE : chaque entrée porte SON motif. */
  notConsulted: { source: string; reason: string }[];
  negativeConclusive: boolean;
  /** Les sources qui adossent réellement le floor réglementaire. */
  floor: string[];
}

type Contracteur = (caps: readonly Capacite[]) => Contrat;

const REGULATRICES = new Set(["ofac", "amf", "fca"]);

const TEMOIN_CONTRAT: Contracteur = (caps) => {
  const declared = caps.filter((c) => c.declaree).map((c) => c.slug);
  // ██ EXPECTED SE DÉRIVE de la capacité ARMÉE. Il ne se choisit pas, et
  // aucun nombre n'intervient : pas de seuil, pas de plafond.
  const expected = caps.filter((c) => c.armee).map((c) => c.slug);
  const armees = caps.filter((c) => c.armee);
  const consulted = armees.filter((c) => c.fraicheur === "FRESH").map((c) => c.slug);
  const notConsulted = armees
    .filter((c) => c.fraicheur !== "FRESH")
    .map((c) => ({ source: c.slug, reason: c.fraicheur }));
  return {
    declared, expected, consulted, notConsulted,
    // `expected.length > 0` : un contrat vide ne promet rien, donc il ne
    // conclut rien. Sans cette borne, tout deviendrait « complet ».
    negativeConclusive: expected.length > 0 && notConsulted.length === 0,
    floor: consulted.filter((s) => REGULATRICES.has(s)),
  };
};

// ─── Fixtures — état MESURÉ des six sources ───────────────────────────────

const CAP = (slug: string, o: Partial<Capacite> = {}): Capacite =>
  ({ slug, declaree: true, armee: false, fraicheur: "NOT_ARMED", ...o });

/** MESURÉ — seul `ofac` est armé, gouverné, et tourne. */
const REEL_CAPS: Capacite[] = [
  CAP("ofac", { armee: true, fraicheur: "FRESH" }),
  CAP("amf"), CAP("fca"), CAP("goplus"),
  CAP("forta", { declaree: true }),
];

/**
 * CONSTRUITE — une seconde régulatrice ARMÉE mais PÉRIMÉE. Aucune n'est dans
 * cet état aujourd'hui ; elle existe pour séparer EXPECTED de CONSULTED, que
 * le corpus réel ne distinguerait pas — `ofac` seul étant armé ET frais.
 */
const CAPS_AVEC_PERIMEE: Capacite[] = [
  CAP("ofac", { armee: true, fraicheur: "FRESH" }),
  CAP("amf", { armee: true, fraicheur: "STALE" }),
];

/** CONSTRUITE — deux régulatrices armées et fraîches. */
const CAPS_DEUX_ARMEES: Capacite[] = [
  CAP("ofac", { armee: true, fraicheur: "FRESH" }),
  CAP("amf", { armee: true, fraicheur: "FRESH" }),
];

function batterieContrat(impl: Contracteur): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };
  const r = impl(REEL_CAPS);
  const p = impl(CAPS_AVEC_PERIMEE);

  // ── H · LES QUATRE ÉTATS ─────────────────────────────────────────────
  dit(r.declared.length === 5 && r.expected.length === 1, "H1 declared-confondu-avec-expected");
  dit(p.expected.length === 2 && p.consulted.length === 1, "H2 expected-confondu-avec-consulted");
  dit(p.negativeConclusive === false, "H3 negative-conclusive-sur-perimetre-incomplet");
  dit(
    ["declared", "expected", "consulted", "notConsulted"].every((k) => k in r),
    "H4 etats-fusionnes",
  );
  // Les deux suivants tolèrent l'ABSENCE du champ : sa disparition est ce que
  // H4 mesure. Un critère qui planterait sur ce qu'un autre mesure ferait
  // mourir le mutant par exception, pas par propriété.
  const nc = p.notConsulted ?? [];
  dit(
    nc.length > 0 && nc.every((x) => typeof x.reason === "string" && x.reason.length > 0),
    "H5 not-consulted-sans-reason",
  );
  dit(nc.length === 0 || nc[0].reason === "STALE", "H5b reason-aplati");

  // ── I · LA DÉGRADATION PERMANENTE, LES DEUX BORNES ───────────────────
  dit(!r.expected.includes("amf") && !r.expected.includes("fca"), "I1 declaree-non-armee-dans-expected");
  // ██ Le scan nominal N'EST PAS dégradé : `ofac` seul armé et frais suffit.
  dit(r.negativeConclusive === true, "I2 degradation-permanente");
  // ██ BORNE SYMÉTRIQUE — une source réellement armée reste dans EXPECTED,
  // sinon EXPECTED se vide et « complet » devient vrai de n'importe quoi.
  dit(impl(CAPS_DEUX_ARMEES).expected.length === 2, "I3 armee-exclue-d-expected");
  // Aucun seuil : EXPECTED suit la capacité armée, un pour un.
  dit(
    [REEL_CAPS, CAPS_AVEC_PERIMEE, CAPS_DEUX_ARMEES].every(
      (c) => impl(c).expected.length === c.filter((x) => x.armee).length),
    "I4 seuil-invente",
  );
  // Un contrat sans aucune capacité armée ne conclut rien.
  dit(impl([CAP("amf"), CAP("fca")]).negativeConclusive === false, "I5 contrat-vide-conclut");

  // ── J · LE FLOOR OFAC ────────────────────────────────────────────────
  dit(r.floor.includes("ofac"), "J1 floor-ofac-retire");
  dit(!r.floor.includes("amf") && !r.floor.includes("fca"), "J2 floor-adosse-a-une-non-consultee");

  return v;
}

const MUTANTS_CONTRAT: Array<{ nom: string; critere: string; impl: Contracteur }> = [
  {
    nom: "DECLARED est confondu avec EXPECTED",
    critere: "H1 declared-confondu-avec-expected",
    impl: (c) => ({ ...TEMOIN_CONTRAT(c), expected: c.filter((x) => x.declaree).map((x) => x.slug) }),
  },
  {
    nom: "EXPECTED est confondu avec CONSULTED",
    critere: "H2 expected-confondu-avec-consulted",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      return { ...t, expected: t.consulted };
    },
  },
  {
    nom: "NEGATIVE_CONCLUSIVE est vrai sur un périmètre incomplet",
    critere: "H3 negative-conclusive-sur-perimetre-incomplet",
    impl: (c) => ({ ...TEMOIN_CONTRAT(c), negativeConclusive: true }),
  },
  {
    nom: "deux des quatre états sont FUSIONNÉS — notConsulted disparaît",
    critere: "H4 etats-fusionnes",
    impl: (c) => {
      const { declared, expected, consulted, negativeConclusive, floor } = TEMOIN_CONTRAT(c);
      return { declared, expected, consulted, negativeConclusive, floor } as unknown as Contrat;
    },
  },
  {
    nom: "NOT_CONSULTED devient un DRAPEAU — son motif est vidé",
    critere: "H5 not-consulted-sans-reason",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      return { ...t, notConsulted: t.notConsulted.map((x) => ({ source: x.source, reason: "" })) };
    },
  },
  {
    nom: "les trois causes de non-consultation sont aplaties en une",
    critere: "H5b reason-aplati",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      return { ...t, notConsulted: t.notConsulted.map((x) => ({ ...x, reason: "ABSENT" })) };
    },
  },
  {
    nom: "██ une source DECLARED mais NON ARMÉE entre dans EXPECTED",
    critere: "I1 declaree-non-armee-dans-expected",
    impl: (c) => ({
      ...TEMOIN_CONTRAT(c),
      expected: c.filter((x) => x.declaree || x.armee).map((x) => x.slug),
    }),
  },
  {
    nom: "██ LE DÉFAUT ACTUEL — le scan nominal sort DÉGRADÉ en permanence",
    critere: "I2 degradation-permanente",
    impl: (c) => {
      // `EXPECTED` figé à trois : `amf` et `fca` non armées y restent, donc
      // `notConsulted` n'est jamais vide et rien ne conclut jamais.
      const t = TEMOIN_CONTRAT(c);
      const fige = ["ofac", "amf", "fca"];
      const nc = fige
        .filter((s) => !t.consulted.includes(s))
        .map((s) => ({ source: s, reason: "NOT_ARMED" }));
      return { ...t, expected: fige, notConsulted: nc, negativeConclusive: nc.length === 0 };
    },
  },
  {
    nom: "██ BORNE SYMÉTRIQUE — une source réellement ARMÉE est exclue d'EXPECTED",
    critere: "I3 armee-exclue-d-expected",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      return { ...t, expected: t.expected.slice(0, 1) };
    },
  },
  {
    // Première rédaction : `expected.slice(0, 1)` — soit EXACTEMENT le mutant
    // I3. Deux mutants identiques ne prouvent pas deux propriétés. Celui-ci
    // porte désormais un VRAI seuil inventé : un quorum de deux capacités
    // armées, choisi et non dérivé.
    nom: "un SEUIL est inventé — quorum de deux capacités armées pour qu'EXPECTED existe",
    critere: "I4 seuil-invente",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      const QUORUM = 2;
      return t.expected.length >= QUORUM ? t : { ...t, expected: [], negativeConclusive: false };
    },
  },
  {
    nom: "SUR-CORRECTION — un contrat SANS capacité armée conclut quand même",
    critere: "I5 contrat-vide-conclut",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      return { ...t, negativeConclusive: t.notConsulted.length === 0 };
    },
  },
  {
    nom: "██ le floor OFAC est retiré au motif qu'amf et fca ne contribuent rien",
    critere: "J1 floor-ofac-retire",
    impl: (c) => {
      const t = TEMOIN_CONTRAT(c);
      // Une règle correcte pour amf/fca, inversée pour ofac : le STOP de AM
      // sous une autre forme. `ofac` porte 869 observations.
      return { ...t, floor: t.expected.length === REGULATRICES.size ? t.floor : [] };
    },
  },
  {
    nom: "le floor s'adosse à une régulatrice NON consultée",
    critere: "J2 floor-adosse-a-une-non-consultee",
    impl: (c) => ({ ...TEMOIN_CONTRAT(c), floor: [...REGULATRICES] }),
  },
];


describe("S3/2 — les quatre états, la dégradation permanente, le floor", () => {
  it("le TÉMOIN passe", () => expect(batterieContrat(TEMOIN_CONTRAT)).toEqual([]));

  it("MESURE REFAITE — EXPECTED est DÉRIVÉ, et le scan nominal ne sort plus dégradé", () => {
    // ⚠ CE TEST A ÉTÉ RETOURNÉ, ET SON AUTEUR L'AVAIT PRÉVU. Sa version
    // d'origine disait, mot pour mot :
    //
    //   « Si `EXPECTED_SANCTION_SOURCES` devenait dérivé, ce test rougirait
    //     et la mesure serait à refaire. »
    //
    // C'est arrivé. La liste s'appelle désormais `DECLARED_SANCTION_SOURCES`
    // — elle reste la même liste, et c'est son RÔLE qui a changé : déclaré,
    // plus attendu. La mesure est refaite ci-dessous.
    //
    // Ce que le retournement fixe pour de bon : le régime NOMINAL n'est plus
    // dégradé. Une alerte allumée en permanence n'alerte plus, elle devient le
    // fond — précédent `holders`, phase 2.
    expect([...DECLARED_SANCTION_SOURCES]).toEqual(["ofac", "amf", "fca"]);
    expect(COUV_REELLE.state).toBe("COMPLETE");
    expect(COUV_REELLE.negativeIsConclusive).toBe(true);
    expect(COUV_REELLE.consulted).toEqual(["ofac"]);
    // ██ EXPECTED est DÉRIVÉ, et il n'est PAS la liste déclarée.
    expect(COUV_REELLE.expected).toEqual(["ofac"]);
    expect(COUV_REELLE.expected).not.toEqual([...DECLARED_SANCTION_SOURCES]);
    // Et les deux écartées ne sont pas effacées : elles sont NOMMÉES.
    expect(COUV_REELLE.declaredNotArmed.map((x) => x.source)).toEqual(["amf", "fca"]);
  });

  it("MESURE ÉPINGLÉE — ce que le défaut produisait, rejoué à la main", () => {
    // Le défaut n'est pas hypothétique : il a été servi en production jusqu'au
    // 2026-09-09. On le rejoue en passant la liste déclarée LÀ OÙ ELLE ÉTAIT
    // — comme périmètre attendu — pour que sa forme reste lisible.
    //
    // C'est la seule façon honnête de garder la trace : un test qui affirme
    // « le défaut existait » sans le reproduire n'est qu'un commentaire.
    const commeAvant = [...DECLARED_SANCTION_SOURCES].map((s) =>
      s === "ofac" ? vf(s, "FRESH") : vf(s, "STALE"),
    );
    // Les trois traitées comme ARMÉES : deux manquent, donc PARTIAL en
    // permanence — exactement ce que servait `/api/scan/intelligence`.
    const ancien = buildSanctionCoverage(commeAvant);
    expect(ancien.state).toBe("PARTIAL");
    expect(ancien.negativeIsConclusive).toBe(false);
    expect(ancien.expected).toEqual(["ofac", "amf", "fca"]);
  });

  for (const m of MUTANTS_CONTRAT) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterieContrat(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});
