// ─── BUILD 12 · S3.1 — L'ACCORD ENTRE LES DEUX FORMES : CORPUS ADVERSE ────
//
// ██  Deux périmètres légitimement différents. Deux verdicts qui ne          ██
// ██  peuvent pas se contredire.                                            ██
//
// ─── LA CONTRADICTION, MESURÉE ────────────────────────────────────────────
//
// Exercé le 2026-09-09 sur `sanctionCoverage.ts`, avec la même entrée
// (`ofac` FRESH, le reste jamais armé) :
//
//   buildSanctionCoverage(reel)      → { state: "PARTIAL",  conclusif: false }
//   buildIntelligenceCoverage(reel)  → { state: "COMPLETE", conclusif: true  }
//
// Deux surfaces servies, une adresse, deux affirmations épistémiques
// OPPOSÉES. La cause n'est pas le périmètre commun — sur `{ofac}` les deux
// s'accordent — c'est `EXPECTED` : la forme sanctions le lit dans une liste
// FIGÉE de trois, la forme intelligence le DÉRIVE de la capacité armée.
//
// ██ ET LE TROU DU PÉRIMÈTRE VIDE N'EST PRÉSENT QUE D'UN CÔTÉ. Mesuré :
//
//   buildSanctionCoverage(v, [])     → { state: "COMPLETE", conclusif: TRUE }
//   buildIntelligenceCoverage(v, []) → { state: "PARTIAL",  conclusif: false }
//
// La cinquième garde — `expected.length > 0` — existe dans la forme
// intelligence (l. 246) et MANQUE dans la forme sanctions (l. 85). Un
// périmètre vide y conclut : personne n'a regardé, et le contrat dit
// « complet ».
//
// ─── Calibrage ────────────────────────────────────────────────────────────
//
// `PARTIAL/false` est le côté CONSERVATEUR : ce corpus ne le traite pas comme
// un fail-open. Ce qu'il tient est double, et les deux bornes comptent
// autant : l'alerte cesse d'être allumée en régime nominal SANS devenir muette
// dans le régime où elle doit parler.
//
// ─── ATTRIBUABILITÉ — largeur mesurée, jamais supposée ────────────────────
//
//   PRÉCIS (1)   K4 · L2 · M1 · M1b
//   COUPLÉS (2)  K3 — aplatir les deux formes détruit AUSSI le périmètre
//                propre à la forme sanctions · L1 — une dérivation recopiée
//                conclut faux sur la couverture périmée
//   LARGES       K1 et K2 (4) · M2 et M2b (3)
//
// K1 est LE DÉFAUT ACTUEL, et sa largeur est la mesure de ce qu'une liste
// figée détruit — pas un mutant à resserrer, règle posée sur I2 en S3.
// M2/M2b tuent K1 et K2 parce que refuser de conclure d'un seul côté CRÉE la
// contradiction : c'est la même famille, pas un critère étranger.
//
// UNE FIXTURE CONSTRUITE a dû être ajoutée pour séparer K3 de L2 : une
// SECONDE capacité technique armée. Sans elle, « aplatir les deux formes » et
// « élargir la forme sanctions d'une source » étaient la MÊME opération sur ce
// périmètre — les deux mutants mouraient l'un sur l'autre, et le couplage
// venait de la DONNÉE, pas des propriétés. C'est le doublon d'AW et de I3/I4,
// dans sa troisième forme : cette fois il ne venait pas d'un copier-coller.
//
// ─── Trous de preuve déclarés, inchangés ──────────────────────────────────
//
//   1. Les routes partenaires exigent `X-Partner-Key` : non mesurables ici.
//      Un 401 n'est jamais une mesure. On prouve le mécanisme, pas la prod.
//   2. Aucun accès base : les capacités sont INJECTÉES. Ce qui est prouvé est
//      le prédicat d'accord, pas l'état des collecteurs.

import { describe, it, expect } from "vitest";
import {
  buildSanctionCoverage,
  buildIntelligenceCoverage,
} from "@/lib/intelligence/sanctionCoverage";

// ═══ LE CONTRAT ══════════════════════════════════════════════════════════

type EtatFraicheur = "FRESH" | "STALE" | "UNKNOWN" | "NOT_ARMED";

interface Capacite {
  slug: string;
  /** Déclarée pour la forme SANCTIONS (régulatrices). */
  regulatrice: boolean;
  fraicheur: EtatFraicheur;
}

interface Forme {
  /** Dérivé de la capacité ARMÉE, jamais d'une liste figée. */
  expected: string[];
  consulted: string[];
  state: "COMPLETE" | "PARTIAL";
  negativeConclusive: boolean;
}

interface DeuxFormes { sanctions: Forme; intelligence: Forme }
type Servir = (caps: readonly Capacite[]) => DeuxFormes;

/** LA dérivation, commune. Consommée deux fois, jamais recopiée. */
function deriver(caps: readonly Capacite[]): Forme {
  // Une capacité jamais armée n'entre pas au dénominateur — elle ne dégrade
  // rien. `STALE` et `UNKNOWN`, si : elles sont armées mais n'ont pas répondu.
  const armees = caps.filter((c) => c.fraicheur !== "NOT_ARMED");
  const expected = armees.map((c) => c.slug);
  const consulted = armees.filter((c) => c.fraicheur === "FRESH").map((c) => c.slug);
  const complet = expected.length > 0 && consulted.length === expected.length;
  return {
    expected, consulted,
    state: complet ? "COMPLETE" : "PARTIAL",
    // La cinquième garde, sur LES DEUX formes : un périmètre vide ne conclut
    // rien. Personne n'a regardé.
    negativeConclusive: complet,
  };
}

const TEMOIN: Servir = (caps) => ({
  // Les deux formes DÉRIVENT pareil et ATTENDENT différemment : la forme
  // sanctions se restreint aux régulatrices, l'autre voit tout le registre.
  sanctions: deriver(caps.filter((c) => c.regulatrice)),
  intelligence: deriver(caps),
});

// ═══ FIXTURES ════════════════════════════════════════════════════════════

const C = (slug: string, o: Partial<Capacite> = {}): Capacite =>
  ({ slug, regulatrice: false, fraicheur: "NOT_ARMED", ...o });

/** MESURÉ — `ofac` et `scamsniffer` tournent ; amf, fca, forta, goplus non. */
const REEL: Capacite[] = [
  C("ofac", { regulatrice: true, fraicheur: "FRESH" }),
  C("amf", { regulatrice: true }),
  C("fca", { regulatrice: true }),
  C("scamsniffer", { fraicheur: "FRESH" }),
  // CONSTRUITE — une SECONDE capacité technique armée. Aucune n'existe
  // aujourd'hui : `scamsniffer` est la seule. Sans elle, « aplatir les deux
  // formes » et « élargir la forme sanctions d'une source » étaient la MÊME
  // opération sur ce périmètre — K3 et L2 mouraient l'un sur l'autre, et le
  // couplage venait de la donnée, pas des propriétés.
  C("technique-construite", { fraicheur: "FRESH" }),
  C("forta"), C("goplus"),
];

/**
 * CONSTRUITE — une régulatrice ARMÉE mais PÉRIMÉE. Aucune n'est dans cet état
 * aujourd'hui ; elle existe pour discriminer la dérivation canonique d'une
 * copie écrite `state !== "NOT_ARMED"`, qui compterait `STALE` comme consultée.
 */
const AVEC_PERIMEE: Capacite[] = [
  C("ofac", { regulatrice: true, fraicheur: "FRESH" }),
  C("amf", { regulatrice: true, fraicheur: "STALE" }),
  C("scamsniffer", { fraicheur: "FRESH" }),
];

/** CONSTRUITE — aucune capacité armée. Le cas du périmètre vide. */
const AUCUNE_ARMEE: Capacite[] = [
  C("ofac", { regulatrice: true }), C("amf", { regulatrice: true }),
];

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

function batterie(impl: Servir): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  const r = impl(REEL);
  const p = impl(AVEC_PERIMEE);
  const vide = impl(AUCUNE_ARMEE);

  // ── K · LES DEUX FORMES NE SE CONTREDISENT PAS ───────────────────────
  dit(r.sanctions.state === r.intelligence.state, "K1 formes-contradictoires-sur-etat");
  dit(
    r.sanctions.negativeConclusive === r.intelligence.negativeConclusive,
    "K2 formes-contradictoires-sur-conclusif",
  );
  // ██ LA BORNE QUI INTERDIT DE RÉSOUDRE PAR SUPPRESSION. Leurs PÉRIMÈTRES
  // diffèrent LÉGITIMEMENT — sanctions n'attend que des régulatrices. Aplatir
  // l'une sur l'autre ferait « s'accorder » les deux en détruisant une forme.
  dit(
    JSON.stringify(r.sanctions.expected) !== JSON.stringify(r.intelligence.expected),
    "K3 formes-aplaties",
  );
  // L'accord tient aussi sur la couverture périmée.
  dit(
    p.sanctions.negativeConclusive === false && p.intelligence.negativeConclusive === false,
    "K4 accord-rompu-sur-perimee",
  );

  // ── L · UNE SEULE DÉRIVATION, CONSOMMÉE DEUX FOIS ────────────────────
  //
  // Discriminant : `STALE`. La dérivation canonique la compte ATTENDUE et NON
  // consultée. Une copie `state !== "NOT_ARMED"` la compterait consultée.
  dit(
    p.sanctions.expected.includes("amf") && !p.sanctions.consulted.includes("amf"),
    "L1 derivation-reimplementee",
  );
  // Dériver de la même façon ≠ attendre les mêmes sources. La relation est
  // STRUCTURELLE, pas une simple inégalité : la forme sanctions n'attend QUE
  // des régulatrices, et son périmètre est un sous-ensemble de l'autre.
  // Première rédaction : une comparaison de LONGUEURS — elle recouvrait K3,
  // et les deux mutants mouraient l'un sur l'autre.
  const REG = new Set(REEL.filter((c) => c.regulatrice).map((c) => c.slug));
  dit(
    r.sanctions.expected.every((s2) => REG.has(s2)) &&
      r.sanctions.expected.every((s2) => r.intelligence.expected.includes(s2)),
    "L2 meme-perimetre-impose",
  );

  // ── M · LA SUR-CORRECTION PAR LE VIDE, SUR LES DEUX FORMES ───────────
  dit(vide.sanctions.negativeConclusive === false, "M1 perimetre-vide-conclut-sanctions");
  dit(vide.intelligence.negativeConclusive === false, "M1b perimetre-vide-conclut-intelligence");
  // BORNE SYMÉTRIQUE — tout mesuré, la garde conclut. Une garde qui refuse de
  // conclure même quand tout est mesuré est un WARN permanent sous un autre nom.
  dit(r.sanctions.negativeConclusive === true, "M2 garde-qui-refuse-de-conclure-sanctions");
  dit(r.intelligence.negativeConclusive === true, "M2b garde-qui-refuse-de-conclure-intelligence");

  return v;
}

// ═══ SATISFIABILITÉ ET MESURES ÉPINGLÉES ═════════════════════════════════

describe("S3.1/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe", () => expect(batterie(TEMOIN)).toEqual([]));

  it("ANTI-RÉGRESSION — les deux formes servies S'ACCORDENT, et sur les CINQ champs", () => {
    // ─── RETOURNÉ le 2026-09-09, fermé par #355 ────────────────────────
    //
    // Sa version d'origine épinglait la CONTRADICTION et disait : « si l'une
    // des deux changeait, ce test rougirait et la mesure serait à refaire ».
    // Elle a changé. Le constat, daté, pour mémoire :
    //
    //   buildSanctionCoverage(reel)      → PARTIAL  · conclusif false
    //   buildIntelligenceCoverage(reel)  → COMPLETE · conclusif true
    //
    // Une assertion qui pin un défaut a une date de péremption ; une
    // anti-régression n'en a pas. On garantit désormais l'accord.
    //
    // ██ ET ON LE VÉRIFIE SUR LES CINQ CHAMPS, pas sur le seul ensemble
    // commun : c'est précisément parce que l'ancien test ne comparait que
    // `consulted` que la divergence d'EXPECTED — donc du VERDICT — est
    // passée. On compare expected, consulted, notConsulted AVEC leurs motifs,
    // state, et negativeConclusive.
    const reel = [{ sourceSlug: "ofac", state: "FRESH", ageDays: 1 }] as never[];
    for (const etat of ["FRESH", "STALE", "UNKNOWN", "NOT_ARMED"] as const) {
      const verdicts = [{ sourceSlug: "ofac", state: etat, ageDays: 1 }] as never[];
      const perimetre = ["ofac", "amf", "fca"];
      const s = buildSanctionCoverage(verdicts, perimetre);
      const i = buildIntelligenceCoverage(verdicts, perimetre);
      expect([...s.expected], `ofac ${etat} : expected divergent`).toEqual([...i.expected]);
      expect([...s.consulted], `ofac ${etat} : consulted divergent`).toEqual([
        ...i.consultedMeasured,
      ]);
      // notConsulted AVEC les motifs — un accord sur les seuls noms laisserait
      // deux surfaces nommer la même absence pour deux raisons différentes.
      expect(
        s.notConsulted.map((x) => [x.source, x.state]),
        `ofac ${etat} : motifs de notConsulted divergents`,
      ).toEqual(i.notConsulted.map((x) => [x.source, x.reason === "MEASURED" ? "FRESH" : x.reason]));
      expect(s.state, `ofac ${etat} : state divergent`).toBe(i.state);
      expect(s.negativeIsConclusive, `ofac ${etat} : conclusif divergent`).toBe(
        i.negativeConclusive,
      );
    }
    // Et sur l'état réel servi, l'accord est vrai aussi.
    expect(buildSanctionCoverage(reel).negativeIsConclusive).toBe(
      buildIntelligenceCoverage(reel).negativeConclusive,
    );
  });

  it("ANTI-RÉGRESSION — INVARIANT : un périmètre armé VIDE ne conclut RIEN, DES DEUX CÔTÉS", () => {
    // ─── RETOURNÉ le 2026-09-09, fermé par #355 ────────────────────────
    //
    // Sa version d'origine mesurait un trou d'UN SEUL côté et l'annonçait :
    // « ce test rougira quand la garde y sera posée — et c'est le signal que
    // le trou est fermé, pas que le test est faux ». Elle a été posée.
    //
    // ██ INVARIANT RATIFIÉ : zéro capacité armée ≠ couverture complète.
    //    `negativeConclusive` DOIT être false. Aucune exception.
    //
    // Il est vérifié ici sur SA PROPRE RAISON — un périmètre VIDE, aucun autre
    // défaut mélangé — et dans les deux formes, sans supposer laquelle le
    // porte.
    for (const [nom, s, i] of [
      ["périmètre déclaré vide", buildSanctionCoverage([] as never[], []), buildIntelligenceCoverage([] as never[], [])],
      [
        "déclaré non vide, mais RIEN d'armé",
        buildSanctionCoverage([] as never[]),
        buildIntelligenceCoverage([] as never[]),
      ],
      [
        "des verdicts existent, mais hors du périmètre déclaré",
        buildSanctionCoverage([{ sourceSlug: "ofac", state: "FRESH", ageDays: 1 }] as never[], []),
        buildIntelligenceCoverage([{ sourceSlug: "ofac", state: "FRESH", ageDays: 1 }] as never[], []),
      ],
    ] as const) {
      expect(s.expected, `${nom} — sanctions : expected non vide`).toEqual([]);
      expect(i.expected, `${nom} — intelligence : expected non vide`).toEqual([]);
      expect(s.negativeIsConclusive, `${nom} — forme SANCTIONS conclut sur le vide`).toBe(false);
      expect(i.negativeConclusive, `${nom} — forme INTELLIGENCE conclut sur le vide`).toBe(false);
      expect(s.state, `${nom} — sanctions : état`).toBe("PARTIAL");
      expect(i.state, `${nom} — intelligence : état`).toBe("PARTIAL");
    }
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Servir }

const FIGE = ["ofac", "amf", "fca"];

const MUTANTS: Mutant[] = [
  {
    nom: "██ LE DÉFAUT ACTUEL — la forme sanctions lit une liste FIGÉE",
    critere: "K1 formes-contradictoires-sur-etat",
    impl: (caps) => {
      const t = TEMOIN(caps);
      const consulted = t.sanctions.consulted;
      const complet = FIGE.every((s) => consulted.includes(s));
      return {
        ...t,
        sanctions: {
          expected: FIGE, consulted,
          state: complet ? "COMPLETE" : "PARTIAL",
          negativeConclusive: complet,
        },
      };
    },
  },
  {
    nom: "les deux formes rendent des `negativeConclusive` OPPOSÉS",
    critere: "K2 formes-contradictoires-sur-conclusif",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return {
        ...t,
        sanctions: { ...t.sanctions, negativeConclusive: !t.intelligence.negativeConclusive },
      };
    },
  },
  {
    nom: "██ la contradiction est RÉSOLUE EN APLATISSANT une forme sur l'autre",
    critere: "K3 formes-aplaties",
    impl: (caps) => {
      const t = TEMOIN(caps);
      // « Les deux s'accordent » — parce qu'une des deux a cessé d'exister.
      return { sanctions: t.intelligence, intelligence: t.intelligence };
    },
  },
  {
    nom: "l'accord se rompt dès qu'une attendue est périmée",
    critere: "K4 accord-rompu-sur-perimee",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return {
        ...t,
        sanctions: {
          ...t.sanctions,
          negativeConclusive: t.sanctions.expected.length > 0,
          state: t.sanctions.expected.length > 0 ? "COMPLETE" : "PARTIAL",
        },
      };
    },
  },
  {
    nom: "██ la dérivation est RÉIMPLÉMENTÉE — `state !== NOT_ARMED` compte comme consultée",
    critere: "L1 derivation-reimplementee",
    impl: (caps) => {
      const t = TEMOIN(caps);
      const reg = caps.filter((c) => c.regulatrice && c.fraicheur !== "NOT_ARMED");
      const tous = reg.map((c) => c.slug);
      return {
        ...t,
        // La copie diverge sur STALE : elle la compte consultée.
        sanctions: {
          expected: tous, consulted: tous,
          state: tous.length > 0 ? "COMPLETE" : "PARTIAL",
          negativeConclusive: tous.length > 0,
        },
      };
    },
  },
  {
    // Il n'APLATIT pas les deux formes — ça, c'est K3. Il donne à la forme
    // sanctions un périmètre qui n'est plus le sien : une source NON
    // régulatrice y entre. Dériver pareil ne veut pas dire attendre pareil.
    nom: "██ le périmètre de la forme sanctions cesse d'être le sien",
    critere: "L2 meme-perimetre-impose",
    impl: (caps) => {
      const t = TEMOIN(caps);
      // UNE seule source non régulatrice ajoutée : le périmètre cesse d'être
      // celui de la forme sans devenir celui de l'autre. C'est ce qui
      // distingue ce mutant de l'aplatissement (K3).
      const intrus = t.intelligence.expected.find((x) => !t.sanctions.expected.includes(x));
      const elargi = intrus ? [...t.sanctions.expected, intrus] : t.sanctions.expected;
      return {
        ...t,
        sanctions: {
          ...t.sanctions,
          expected: elargi,
          consulted: elargi.filter((x) => t.intelligence.consulted.includes(x)),
        },
      };
    },
  },
  {
    nom: "██ SUR-CORRECTION PAR LE VIDE — un périmètre vide conclut, côté sanctions",
    critere: "M1 perimetre-vide-conclut-sanctions",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return {
        ...t,
        sanctions: {
          ...t.sanctions,
          // La garde `expected.length > 0` retirée : c'est le trou mesuré
          // l. 85 de la forme servie.
          negativeConclusive: t.sanctions.consulted.length === t.sanctions.expected.length,
        },
      };
    },
  },
  {
    nom: "le même trou, côté intelligence",
    critere: "M1b perimetre-vide-conclut-intelligence",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return {
        ...t,
        intelligence: {
          ...t.intelligence,
          negativeConclusive: t.intelligence.consulted.length === t.intelligence.expected.length,
        },
      };
    },
  },
  {
    nom: "SUR-CORRECTION — la garde refuse de conclure même quand TOUT est mesuré",
    critere: "M2 garde-qui-refuse-de-conclure-sanctions",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return { ...t, sanctions: { ...t.sanctions, negativeConclusive: false, state: "PARTIAL" } };
    },
  },
  {
    nom: "la même sur-correction, côté intelligence — un WARN permanent sous un autre nom",
    critere: "M2b garde-qui-refuse-de-conclure-intelligence",
    impl: (caps) => {
      const t = TEMOIN(caps);
      return {
        ...t,
        intelligence: { ...t.intelligence, negativeConclusive: false, state: "PARTIAL" },
      };
    },
  },
];

describe("S3.1/1 — chaque mutant meurt sur sa propriété", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterie(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }


  it("les 10 mutants sont déclarés", () => {
    expect(MUTANTS).toHaveLength(10);
    expect(MUTANTS.every((m) => m.critere.length > 0)).toBe(true);
  });
});
