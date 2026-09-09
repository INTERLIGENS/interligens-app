// ─── BUILD 12 · S3.2 — LA SUPPRESSION PAR AUDIENCE : CORPUS ADVERSE ───────
//
// ██  Un résultat SUPPRIMÉ n'est pas un résultat ABSENT.                    ██
//
// Mesuré : 866 des 867 entités OFAC actives sont `INTERNAL_ONLY`. Sur une
// adresse réellement sanctionnée, les surfaces intelligence servent
// `hasSanction: false` avec un négatif CONCLUANT — pendant que `/api/v1/score`
// rend 100/RED/BLOCK sur la même adresse.
//
// S3.1 n'a pas créé la suppression. Mais le `PARTIAL` permanent la COUVRAIT :
// en retirant le voile, il a transformé un silence en affirmation concluante
// de propreté. Non-monotonie, dans le sens NON SÛR.
//
// ─── LE VOCABULAIRE EXISTE — aucun état nouveau ───────────────────────────
//
// `absenceVocabulary.ts` porte deux axes typés. La suppression est un fait de
// PUBLICATION (`WITHHELD`), jamais de MESURE. On a cherché, on a trouvé, et on
// ne publie pas : ce n'est ni « pas mesuré » ni « rien trouvé ».
//
// ─── ██ LA TENSION ENTRE O ET P, ET COMMENT ELLE SE TRANCHE ───────────────
//
// L'axe O exige que les trois états restent DISTINGUABLES. L'axe P exige que
// la suppression ne soit pas DÉDUCTIBLE. Sur une surface retail, les deux se
// contredisent : distinguer `WITHHELD` de `NOT_MEASURED` EST la fuite.
//
// La tranche — et ma première rédaction la formulait MAL. J'avais écrit
// « en interne les trois états sont distincts » : c'est faux, parce que côté
// INTERNE il n'y a AUCUNE suppression. La même entité y est simplement
// visible, donc c'est un MATCH. La suppression n'existe que RELATIVEMENT à une
// audience.
//
// La séparation est donc ailleurs, et elle est plus nette :
//   OBJET DE CONTRAT  porte les deux axes, distincts — O est tenu là
//   CHARGE UTILE      retail : identique dans les trois cas — P est tenu là
//
// C'est une DÉCISION, pas une évidence : elle repose sur le fait que la
// surface retail n'expose AUCUN champ de motif. Le trou de preuve associé est
// déclaré plus bas, avec sa condition de rupture.
//
// ─── Cadre respecté ───────────────────────────────────────────────────────
//
// ALLOW reste ALLOW. Aucun critère n'exige de basculer un verdict : une
// couverture incomplète interdit une affirmation rassurante non soutenue, elle
// ne convertit pas un risque. Et aucune promotion d'entité — les 866 lignes
// `INTERNAL_ONLY` ne sont pas dans ce périmètre.
//
// ─── ATTRIBUABILITÉ — largeur mesurée, et une lecture à nuancer ───────────
//
//   PRÉCIS (2)   N4 · N6 · N7 · P2
//   MOYENS (3-4) N2 · N5 · O3 · P1
//   LARGES (5-6) N1 · N3 · O2 · P3
//
// ██ UNE RÉSERVE SUR CETTE TABLE, et elle est de moi : `O1 trois-etats-collapses`
// tombe sur les DOUZE mutants. Ce n'est pas une fausse attribution — chacun
// meurt bien de SON critère — mais O1 est un critère de CONSÉQUENCE, pas de
// discrimination : dès que l'état de suppression cesse d'être unique, il
// tombe. Il gonfle donc toutes les largeurs sans rien discriminer. Je le garde
// — la propriété qu'il exprime est exigée — et je signale que les largeurs de
// ce fichier doivent se lire « moins un ».
//
// ─── Trous de preuve déclarés ─────────────────────────────────────────────
//
//   1. Aucun accès base : les entités et leur `displaySafety` sont INJECTÉES.
//      Ce qui est prouvé est le prédicat, pas l'état des 867 lignes.
//   2. ██ P2 n'est satisfiable QUE parce que la sortie retail ne porte aucun
//      champ de motif. Le jour où l'on y ajoutera un motif — même typé, même
//      prudent — la suppression redeviendra déductible par différence, et
//      l'axe P deviendra insatisfiable en l'état. C'est une vraie contrainte
//      d'architecture, pas une formalité : elle interdit d'« expliquer » un
//      négatif non concluant au retail.

import { describe, it, expect } from "vitest";
import { MEASUREMENT_STATES, PUBLICATION_STATES } from "@/lib/publication/absenceVocabulary";

// ═══ LE CONTRAT ══════════════════════════════════════════════════════════

type Audience = "RETAIL" | "INTERNAL";
type DisplaySafety = "INTERNAL_ONLY" | "ANALYST_REVIEWED" | "RETAIL_SAFE";

interface EntiteAppariee {
  id: string;
  displaySafety: DisplaySafety;
  riskClass: string;
  sourceSlug: string;
}

interface Resultat {
  hasSanction: boolean;
  assessment: "MATCHED" | "NO_MATCH_COMPLETE" | "NO_MATCH_PARTIAL";
  negativeConclusive: boolean;
  /** Axe PUBLICATION. `null` quand rien n'est retenu. */
  publication: "WITHHELD" | "NOT_PUBLISHED" | null;
  /** Axe MESURE. La suppression ne s'y écrit JAMAIS. */
  measurement: "MEASURED" | "NOT_MEASURED";
  /** Le niveau produit. La suppression ne le fait pas basculer. */
  niveau: "ALLOW" | "WARN" | "BLOCK";
  /** Ce qui sort réellement. Rien de l'entité n'y entre côté retail. */
  payload: Record<string, unknown>;
}

type Servir = (
  matches: readonly EntiteAppariee[],
  audience: Audience,
  couvertureComplete: boolean,
  /** La recherche a-t-elle seulement eu lieu ? */
  mesuree?: boolean,
) => Resultat;

const visiblePour = (e: EntiteAppariee, a: Audience) =>
  a === "INTERNAL" || e.displaySafety === "RETAIL_SAFE";

const TEMOIN: Servir = (matches, audience, couvertureComplete, mesuree = true) => {
  // Jamais cherché : axe MESURE, et rien d'autre.
  if (!mesuree) {
    return {
      hasSanction: false, assessment: "NO_MATCH_PARTIAL", negativeConclusive: false,
      publication: null, measurement: "NOT_MEASURED", niveau: "ALLOW", payload: {},
    };
  }
  const visibles = matches.filter((e) => visiblePour(e, audience));
  const supprimes = matches.length > 0 && visibles.length === 0;

  if (visibles.length > 0) {
    return {
      hasSanction: true, assessment: "MATCHED", negativeConclusive: false,
      publication: null, measurement: "MEASURED", niveau: "BLOCK",
      payload: audience === "INTERNAL"
        ? { entites: visibles.map((e) => e.id) }
        : { matched: true },
    };
  }

  if (supprimes) {
    // On a cherché, on a TROUVÉ, et on ne publie pas. Le négatif ne conclut
    // rien : il n'est même pas un négatif.
    return {
      hasSanction: false,
      assessment: "NO_MATCH_PARTIAL",
      negativeConclusive: false,
      publication: "WITHHELD",
      measurement: "MEASURED",
      // ALLOW reste ALLOW : la suppression interdit d'affirmer, elle ne
      // convertit pas un risque en verdict.
      niveau: "ALLOW",
      // ██ RETAIL : aucun motif. La sortie est identique à celle d'un négatif
      // non concluant pour toute autre cause — c'est ce qui rend la
      // suppression non déductible.
      payload: audience === "INTERNAL"
        ? { publication: "WITHHELD", retenus: matches.length }
        : {},
    };
  }

  // Aucun match du tout : le négatif est RÉEL, et il conclut si la couverture
  // est complète. Ne pas le lui rendre serait remplacer une fausse réassurance
  // par un WARN permanent.
  return {
    hasSanction: false,
    assessment: couvertureComplete ? "NO_MATCH_COMPLETE" : "NO_MATCH_PARTIAL",
    negativeConclusive: couvertureComplete,
    publication: null,
    measurement: "MEASURED",
    niveau: "ALLOW",
    payload: {},
  };
};

// ═══ FIXTURES ════════════════════════════════════════════════════════════

const E = (id: string, displaySafety: DisplaySafety): EntiteAppariee =>
  ({ id, displaySafety, riskClass: "SANCTION", sourceSlug: "ofac" });

/** MESURÉ — le régime des 866/867 : appariée, et invisible pour le retail. */
const SUPPRIMEE = [E("0xa5b0edf6", "INTERNAL_ONLY")];
/** Le 867e — la seule visible. */
const VISIBLE = [E("0xvisible", "RETAIL_SAFE")];
/** Aucun match : le négatif réel. */
const AUCUN: EntiteAppariee[] = [];
/**
 * CONSTRUITE — `ANALYST_REVIEWED`, ni interne pur ni retail. Aucune ligne
 * connue ne la porte sur ce chemin ; elle existe pour vérifier que la règle
 * de visibilité n'est pas écrite « != INTERNAL_ONLY ».
 */
const REVUE = [E("0xrevue", "ANALYST_REVIEWED")];

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

const CHAMPS_INTERDITS = ["id", "riskClass", "sourceSlug", "displaySafety", "score", "entites"];

function batterie(impl: Servir): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  const supprRetail = impl(SUPPRIMEE, "RETAIL", true);
  // Côté INTERNE la même entité n'est PAS supprimée : elle est visible, donc
  // c'est un MATCH. La suppression n'existe que relativement à une audience —
  // ma première rédaction cherchait un état `WITHHELD` en interne, où il n'y
  // en a jamais.
  const memeInterne = impl(SUPPRIMEE, "INTERNAL", true);
  const reel = impl(AUCUN, "RETAIL", true);
  const reelPartiel = impl(AUCUN, "RETAIL", false);
  const jamaisMesure = impl(AUCUN, "RETAIL", true, false);
  const visible = impl(VISIBLE, "RETAIL", true);
  const revue = impl(REVUE, "RETAIL", true);

  // ── N · UN RÉSULTAT SUPPRIMÉ NE PRODUIT PAS DE NÉGATIF CONCLUANT ─────
  dit(supprRetail.negativeConclusive === false, "N1 supprime-conclut");
  dit(supprRetail.assessment !== "NO_MATCH_COMPLETE", "N2 supprime-en-no-match-complete");
  // La suppression est MARQUÉE dans l'objet de contrat, sur l'axe publication.
  dit(supprRetail.publication === "WITHHELD", "N3 suppression-non-marquee");
  // Et côté interne, la même entité est simplement un MATCH.
  dit(memeInterne.hasSanction === true, "N3b interne-prive-du-match");
  // SUR-CORRECTION indispensable : un vrai négatif garde son conclusif.
  dit(reel.negativeConclusive === true && reel.assessment === "NO_MATCH_COMPLETE",
      "N4 vrai-negatif-degrade");
  // Et une entité RETAIL_SAFE est bien un match, pas une suppression.
  dit(visible.hasSanction === true && visible.publication === null, "N5 visible-traitee-en-supprimee");
  // La règle de visibilité n'est pas « != INTERNAL_ONLY ».
  dit(revue.negativeConclusive === false && revue.publication === "WITHHELD",
      "N6 analyst-reviewed-traitee-comme-publiable");
  // ALLOW reste ALLOW — aucun basculement de verdict.
  dit(supprRetail.niveau === "ALLOW", "N7 suppression-bascule-le-verdict");

  // ── O · TROIS ÉTATS, TROIS SIGNIFICATIONS, AUCUN COLLAPSE ────────────
  const trois = [supprRetail, reel, jamaisMesure].map((x) =>
    JSON.stringify({ p: x.publication, m: x.measurement }));
  dit(new Set(trois).size === 3, "O1 trois-etats-collapses");
  // La suppression ne se type PAS sur l'axe mesure : on a bien mesuré.
  dit(supprRetail.measurement === "MEASURED", "O2 suppression-typee-sur-la-mesure");
  dit(
    supprRetail.publication !== null &&
      (PUBLICATION_STATES as readonly string[]).includes(supprRetail.publication),
    "O3 etat-hors-vocabulaire",
  );
  dit((MEASUREMENT_STATES as readonly string[]).includes(jamaisMesure.measurement),
      "O3b mesure-hors-vocabulaire");

  // ── P · NE PAS FUITER EN VOULANT ÊTRE HONNÊTE ────────────────────────
  const fuite = Object.keys(supprRetail.payload).some((k) => CHAMPS_INTERDITS.includes(k));
  dit(!fuite, "P1 fuite-de-l-entite-en-retail");
  dit(
    !JSON.stringify(supprRetail.payload).includes("0xa5b0edf6"),
    "P1b identifiant-de-l-entite-en-retail",
  );
  // ██ NON DÉDUCTIBLE PAR DIFFÉRENCE : la sortie retail d'une suppression est
  // IDENTIQUE à celle d'un négatif non concluant pour une autre cause.
  dit(
    JSON.stringify(supprRetail.payload) === JSON.stringify(reelPartiel.payload) &&
      supprRetail.negativeConclusive === reelPartiel.negativeConclusive &&
      supprRetail.assessment === reelPartiel.assessment,
    "P2 suppression-deductible-par-difference",
  );
  // ██ P ne détruit pas O : la charge utile retail est IDENTIQUE dans les
  // trois cas, et l'OBJET DE CONTRAT les distingue toujours. C'est là que la
  // distinction survit — pas dans une autre audience.
  dit(supprRetail.publication !== reelPartiel.publication, "P3 distinction-perdue-dans-le-contrat");

  return v;
}

// ═══ SATISFIABILITÉ ET « LA MUTATION MUTE VRAIMENT » ═════════════════════

describe("S3.2/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe", () => expect(batterie(TEMOIN)).toEqual([]));

  it("le vocabulaire employé est celui d'absenceVocabulary, sans état neuf", () => {
    expect(PUBLICATION_STATES as readonly string[]).toContain("WITHHELD");
    expect(PUBLICATION_STATES as readonly string[]).toContain("NOT_PUBLISHED");
    expect(MEASUREMENT_STATES as readonly string[]).toContain("MEASURED");
    expect(MEASUREMENT_STATES as readonly string[]).toContain("NOT_MEASURED");
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Servir }

const MUTANTS: Mutant[] = [
  {
    nom: "██ LE DÉFAUT MESURÉ — un match supprimé rend un négatif CONCLUANT",
    critere: "N1 supprime-conclut",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD"
        ? { ...t, negativeConclusive: c, assessment: c ? "NO_MATCH_COMPLETE" : "NO_MATCH_PARTIAL" }
        : t;
    },
  },
  {
    nom: "la suppression sort en NO_MATCH_COMPLETE sans toucher au conclusif",
    critere: "N2 supprime-en-no-match-complete",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD" ? { ...t, assessment: "NO_MATCH_COMPLETE" } : t;
    },
  },
  {
    nom: "`hasSanction: false` est rendu SANS marquer la suppression",
    critere: "N3 suppression-non-marquee",
    impl: (m, a, c) => ({ ...TEMOIN(m, a, c), publication: null }),
  },
  {
    nom: "██ SUR-CORRECTION — un VRAI négatif perd son conclusif",
    critere: "N4 vrai-negatif-degrade",
    impl: (m, a, c) => ({
      ...TEMOIN(m, a, c), negativeConclusive: false, assessment: "NO_MATCH_PARTIAL",
    }),
  },
  {
    nom: "une entité RETAIL_SAFE est traitée comme supprimée",
    critere: "N5 visible-traitee-en-supprimee",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return m.length > 0
        ? { ...t, hasSanction: false, publication: "WITHHELD", assessment: "NO_MATCH_PARTIAL", negativeConclusive: false }
        : t;
    },
  },
  {
    nom: "la visibilité est écrite `!= INTERNAL_ONLY` — ANALYST_REVIEWED passe au retail",
    critere: "N6 analyst-reviewed-traitee-comme-publiable",
    impl: (m, a, c) => {
      const visibles = m.filter((e) => a === "INTERNAL" || e.displaySafety !== "INTERNAL_ONLY");
      return visibles.length > 0
        ? { ...TEMOIN(m, "INTERNAL", c), payload: { matched: true } }
        : TEMOIN(m, a, c);
    },
  },
  {
    nom: "la suppression fait BASCULER le verdict — ALLOW devient WARN",
    critere: "N7 suppression-bascule-le-verdict",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD" ? { ...t, niveau: "WARN" } : t;
    },
  },
  {
    nom: "██ la suppression est typée sur l'axe MESURE — les deux axes s'aplatissent",
    critere: "O2 suppression-typee-sur-la-mesure",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD"
        ? { ...t, publication: null, measurement: "NOT_MEASURED" } : t;
    },
  },
  {
    nom: "un QUATRIÈME état est inventé alors que le vocabulaire existe",
    critere: "O3 etat-hors-vocabulaire",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD"
        ? { ...t, publication: "SUPPRESSED_FOR_AUDIENCE" as never } : t;
    },
  },
  {
    nom: "██ FUITE — l'entité supprimée est exposée en retail",
    critere: "P1 fuite-de-l-entite-en-retail",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      return t.publication === "WITHHELD"
        ? { ...t, payload: { ...t.payload, id: m[0]?.id, riskClass: m[0]?.riskClass } } : t;
    },
  },
  {
    nom: "██ DÉDUCTIBLE PAR DIFFÉRENCE — un champ n'apparaît QUE sur suppression",
    critere: "P2 suppression-deductible-par-difference",
    impl: (m, a, c) => {
      const t = TEMOIN(m, a, c);
      // Honnête en intention, fuyant en pratique : la présence du champ
      // révèle qu'il y a quelque chose à cacher.
      return t.publication === "WITHHELD" && a === "RETAIL"
        ? { ...t, payload: { ...t.payload, coverageNote: "withheld_for_audience" } } : t;
    },
  },
  {
    nom: "SUR-CORRECTION — la distinction est perdue DANS L'OBJET DE CONTRAT aussi",
    critere: "P3 distinction-perdue-dans-le-contrat",
    impl: (m, a, c) => ({ ...TEMOIN(m, a, c), publication: null }),
  },
];

describe("S3.2/1 — chaque mutant meurt sur sa propriété", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterie(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  // ─── LA DISCIPLINE RATIFIÉE : une mutation qui ne mute rien ne prouve rien
  it("chaque mutant MUTE RÉELLEMENT — sortie différente du témoin", () => {
    const entrees: Array<[EntiteAppariee[], Audience, boolean, boolean]> = [
      [SUPPRIMEE, "RETAIL", true, true], [SUPPRIMEE, "INTERNAL", true, true],
      [AUCUN, "RETAIL", true, true], [AUCUN, "RETAIL", false, true],
      [AUCUN, "RETAIL", true, false],
      [VISIBLE, "RETAIL", true, true], [REVUE, "RETAIL", true, true],
    ];
    for (const mu of MUTANTS) {
      const diff = entrees.some(([m, a, c, me]) =>
        JSON.stringify(mu.impl(m, a, c, me)) !== JSON.stringify(TEMOIN(m, a, c, me)));
      expect(diff, `${mu.nom} — ne mute AUCUNE sortie`).toBe(true);
    }
  });


  it("les 12 mutants sont déclarés", () => {
    expect(MUTANTS).toHaveLength(12);
    expect(MUTANTS.every((m) => m.critere.length > 0)).toBe(true);
  });
});
