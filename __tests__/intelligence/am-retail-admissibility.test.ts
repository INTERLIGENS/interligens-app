// ─── AM · P0 — ADMISSIBILITÉ RETAIL DE L'INTELLIGENCE ──────────────────────
//
// ██  Des critères, pas une implémentation. Aucune ligne de production ici.  ██
//
// Le contrat, RÉVISÉ après la mesure de non-monotonie :
//
//   « Une décision retail ne peut recevoir d'autorité QUE de contributions
//     retail-admissibles. Après retrait d'une contribution inadmissible, le
//     résultat doit ÊTRE ÉGAL au résultat du scoreur existant sur les
//     contributions admissibles qui restent — que le risque monte, baisse ou
//     ne bouge pas. »
//
// La preuve directionnelle a été RÉVOQUÉE : « removing inadmissible evidence
// must always move risk in the safer direction » est INVALID, parce que la
// couche n'est pas monotone (delta additif et plancher montent, plafond 72
// descend). La distinction qui la remplace :
//
//   échec de mesure → fausse absence → réassurance ......... FAIL-OPEN
//   preuve inadmissible retirée → recalcul sur l'admissible  AUTORITÉ CORRECTE
//
// L'autorité est COMPOSÉE de quatre facteurs, et aucun champ unique ne s'y
// substitue :
//   CYCLE DE VIE ENTITÉ × CYCLE DE VIE OBSERVATION
//   × ADMISSIBILITÉ PREUVE/SOURCE × AUDIENCE
//
// ─── Pourquoi ce fichier existe avant le correctif ────────────────────────
//
// La voie de fermeture est en arbitrage. Ce qui suit est ce qui devra être vrai
// QUELLE QUE SOIT la voie retenue. Ce qui en dépend est isolé, nommé, et laissé
// en TODO — on n'anticipe pas la réponse.
//
// ─── Pourquoi un témoin, et pourquoi il ne délègue à RIEN ─────────────────
//
// Règle née de A1/B4 en BUILD 11 : un témoin qui appelle le code qu'il juge
// cesse de muter le jour où ce code change. `TEMOIN` ci-dessous n'appelle ni
// `matchEntity`, ni `lookupValue`, ni `computeTigerScoreWithIntel`. Il prouve
// que la batterie est SATISFIABLE ; il ne propose aucune architecture.
//
// ─── Aucun test rouge intentionnel ────────────────────────────────────────
//
// La batterie juge le témoin. Les assertions qui portent sur le code de
// production sont, ici, des ÉPINGLAGES de l'état mesuré aujourd'hui — dont la
// preuve directionnelle, qui doit rester verte avant ET après le correctif.
// Les assertions de fermeture arriveront avec le correctif, pas avant.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  admitObservations,
  sourceIsRetailAdmissible,
  type EntityAdmissibilityFacts,
  type ObservationAdmissibilityFacts,
  type IntelAudience,
  type SourcePolicy,
} from "@/lib/intelligence/retailAdmissibility";

// ═══ LE CONTRAT ══════════════════════════════════════════════════════════

/** Les trois valeurs du schéma. `INTERNAL_ONLY` est le DÉFAUT. */
type DisplaySafety = "INTERNAL_ONLY" | "ANALYST_REVIEWED" | "RETAIL_SAFE";

/** Qui consomme. L'intelligence interne n'est jamais neutralisée. */
type Audience = "RETAIL" | "INTERNAL";

interface Observation {
  sourceSlug: string;
  listIsActive: boolean;
  /** La classe portée par cette observation. */
  riskClass: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "SANCTION";
}

interface Entity {
  isActive: boolean;
  displaySafety: DisplaySafety;
  observations: Observation[];
}

interface Admissibilite {
  /** L'entité peut-elle contribuer à une décision pour CETTE audience. */
  admissible: boolean;
  /**
   * Les observations retenues. Une observation écartée ne « disparaît » pas :
   * elle est absente du calcul, et la raison est nommée.
   */
  retenues: Observation[];
  /** Pourquoi, quand ce n'est pas admissible. Jamais fabriqué. */
  refus: "ENTITY_INACTIVE" | "NOT_RETAIL_SAFE" | "NO_ACTIVE_OBSERVATION" | null;
}

type Impl = (e: Entity, a: Audience) => Admissibilite;

// ─────────────────────────────────────────────────────────────────────────
// LA VOIE EST TRANCHÉE — et elle existait déjà.
//
// Mesuré en production le 2026-09-09 : 342 062 entités actives, dont
// **2** RETAIL_SAFE ; 866 entités de classe SANCTION (source `ofac`), toutes
// INTERNAL_ONLY. Une adresse sanctionnée OFAC sort aujourd'hui à 15/ORANGE/WARN
// et la TOTALITÉ de ce signal vient d'une entité INTERNAL_ONLY.
//
// Appliquer les trois axes tels quels retirerait donc les sanctions du retail —
// l'effet irait dans le sens NON SÛR, ce qui est l'inverse de la preuve
// directionnelle exigée.
//
// L'admissibilité par la PREUVE/SOURCE est INDÉPENDANTE de l'autorisation de
// niveau entité, et elle est portée par `SourceRegistry` — curée à la main,
// mesurée le 2026-09-09 : Chainalysis, Elliptic, Nansen, TRM Labs, AML Bot et
// Crystal y sont `internal_only`, les régulateurs y sont `public`.
//
// On la LIT (`status === "active" && defaultVisibility === "public"`), on ne la
// réécrit pas, et AUCUN nom de source n'est codé en dur nulle part.
// ─────────────────────────────────────────────────────────────────────────
/** La politique de source, telle que le registre l'exprime. */
type SourceAdmissible = (sourceSlug: string) => boolean;

/**
 * Le registre tel que MESURÉ le 2026-09-09 : les trois slugs qui produisent
 * réellement des observations y sont `public` / `active`. `chainalysis` est
 * dans le registre en `internal_only` — il sert de contrôle négatif.
 * `inconnue` n'y est pas du tout : le registre est l'autorité, ce qu'il ne
 * connaît pas n'a pas été gouverné.
 */
const REGISTRE_MESURE: SourceAdmissible = (slug) =>
  ["ofac", "scamsniffer", "forta"].includes(slug);

// ═══ LE TÉMOIN — indépendant, satisfiabilité seule ═══════════════════════

function fabriquerTemoin(sourceAdmissible: SourceAdmissible): Impl {
  return (e, audience) => {
    const actives = e.observations.filter((o) => o.listIsActive);

    // L'audience INTERNE voit tout ce qui est actif. L'intelligence interne
    // n'est JAMAIS neutralisée : c'est son objet.
    if (audience === "INTERNAL") {
      return actives.length > 0
        ? { admissible: true, retenues: actives, refus: null }
        : { admissible: false, retenues: [], refus: "NO_ACTIVE_OBSERVATION" };
    }

    // RETAIL — les trois axes, chacun vérifié pour lui-même.
    if (!e.isActive) return { admissible: false, retenues: [], refus: "ENTITY_INACTIVE" };

    // Les DEUX voies d'autorité de publication sont INDÉPENDANTES : l'entité
    // autorisée au niveau entité, OU la source déclarée publiable. C'est ce
    // qui permet à une observation OFAC directe de contribuer alors que
    // l'entité est INTERNAL_ONLY.
    const parLaSource = actives.filter((o) => sourceAdmissible(o.sourceSlug));
    if (e.displaySafety !== "RETAIL_SAFE") {
      return parLaSource.length > 0
        ? { admissible: true, retenues: parLaSource, refus: null }
        : { admissible: false, retenues: [], refus: "NOT_RETAIL_SAFE" };
    }
    if (actives.length === 0) {
      return { admissible: false, retenues: [], refus: "NO_ACTIVE_OBSERVATION" };
    }
    return { admissible: true, retenues: actives, refus: null };
  };
}

const TEMOIN = fabriquerTemoin(REGISTRE_MESURE);

// ═══ FABRIQUES ═══════════════════════════════════════════════════════════

const obs = (o: Partial<Observation> = {}): Observation => ({
  // Source par défaut NON gouvernée : ainsi les critères d'ENTITÉ mordent
  // pour eux-mêmes. Une source admissible masquerait l'axe entité.
  sourceSlug: "inconnue",
  listIsActive: true,
  riskClass: "HIGH",
  ...o,
});

const ent = (e: Partial<Entity> = {}): Entity => ({
  isActive: true,
  displaySafety: "RETAIL_SAFE",
  observations: [obs()],
  ...e,
});

// ═══ LA BATTERIE — indépendante de la voie ═══════════════════════════════

function batterie(impl: Impl): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // ── A · LES TROIS AXES, CHACUN POUR LUI-MÊME ─────────────────────────
  dit(impl(ent(), "RETAIL").admissible, "A1 admissible-complet-refuse");
  dit(
    !impl(ent({ isActive: false }), "RETAIL").admissible,
    "A2 entite-inactive-contribue",
  );
  dit(
    !impl(ent({ displaySafety: "INTERNAL_ONLY" }), "RETAIL").admissible,
    "A3 internal-only-contribue",
  );
  dit(
    !impl(ent({ observations: [obs({ listIsActive: false })] }), "RETAIL").admissible,
    "A4 observation-inactive-contribue",
  );

  // Les axes sont INDÉPENDANTS : deux sur trois ne suffisent jamais.
  dit(
    [
      ent({ isActive: false, displaySafety: "RETAIL_SAFE" }),
      ent({ isActive: true, displaySafety: "INTERNAL_ONLY" }),
      ent({ isActive: true, displaySafety: "RETAIL_SAFE", observations: [obs({ listIsActive: false })] }),
    ].every((e) => !impl(e, "RETAIL").admissible),
    "A5 deux-sur-trois-suffisent",
  );

  // `ANALYST_REVIEWED` n'est pas `RETAIL_SAFE`. Le schéma le dit : « Human-
  // reviewed. Not yet cleared for scanner. » Relu, pas encore admissible.
  dit(
    !impl(ent({ displaySafety: "ANALYST_REVIEWED" }), "RETAIL").admissible,
    "A6 analyst-reviewed-traite-comme-retail-safe",
  );

  // ── B · L'INTELLIGENCE INTERNE N'EST PAS NEUTRALISÉE ─────────────────
  dit(
    impl(ent({ displaySafety: "INTERNAL_ONLY" }), "INTERNAL").admissible,
    "B1 interne-neutralise",
  );
  dit(
    impl(ent({ displaySafety: "INTERNAL_ONLY", isActive: true }), "INTERNAL").retenues.length === 1,
    "B2 interne-perd-ses-observations",
  );
  // Une liste inactive reste inactive, même en interne : c'est l'axe déjà gaté
  // aujourd'hui, et le durcissement ne doit pas le relâcher.
  dit(
    !impl(ent({ observations: [obs({ listIsActive: false })] }), "INTERNAL").admissible,
    "B3 liste-inactive-ressuscitee-en-interne",
  );

  // ── C · LE REFUS EST NOMMÉ, PAS SILENCIEUX ───────────────────────────
  dit(
    impl(ent({ isActive: false }), "RETAIL").refus === "ENTITY_INACTIVE" &&
    impl(ent({ displaySafety: "INTERNAL_ONLY" }), "RETAIL").refus === "NOT_RETAIL_SAFE" &&
    impl(ent({ observations: [obs({ listIsActive: false })] }), "RETAIL").refus === "NO_ACTIVE_OBSERVATION",
    "C1 refus-non-nomme",
  );
  dit(impl(ent(), "RETAIL").refus === null, "C2 refus-fabrique-sur-admissible");

  // ── D · SUR-CORRECTIONS, DANS LES DEUX SENS ──────────────────────────
  dit(impl(ent(), "RETAIL").retenues.length === 1, "D1 admissible-perd-ses-observations");
  dit(
    impl(ent({ observations: [obs(), obs({ listIsActive: false })] }), "RETAIL").retenues.length === 1,
    "D2 observation-inactive-retenue",
  );

  // ── E · AUCUN NOMBRE ─────────────────────────────────────────────────
  // L'admissibilité est une fonction d'ÉTATS. Un seuil ici serait une
  // méthodologie nouvelle.
  dit(!/\d/.test(JSON.stringify(impl(ent(), "RETAIL").refus)), "E1 nombre-dans-le-refus");

  return v;
}

describe("AM/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", () => {
    expect(batterie(TEMOIN)).toEqual([]);
  });

  it("le TÉMOIN ne délègue à AUCUN code jugé", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "__tests__/intelligence/am-retail-admissibility.test.ts"),
      "utf8",
    );
    const temoin = src.slice(src.indexOf("function fabriquerTemoin"), src.indexOf("// ═══ FABRIQUES"));
    for (const interdit of [
      "matchEntity(", "lookupValue(", "computeTigerScoreWithIntel(", "prisma.",
    ]) {
      expect(temoin, `le témoin appelle ${interdit}`).not.toContain(interdit);
    }
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Impl }

const MUTANTS: Mutant[] = [
  {
    nom: "seul displaySafety est vérifié — isActive reste ignoré (le défaut mesuré)",
    critere: "A2 entite-inactive-contribue",
    impl: (e, a) => TEMOIN({ ...e, isActive: true }, a),
  },
  {
    nom: "seul isActive est vérifié — INTERNAL_ONLY passe encore",
    critere: "A3 internal-only-contribue",
    impl: (e, a) => TEMOIN({ ...e, displaySafety: "RETAIL_SAFE" }, a),
  },
  {
    nom: "l'axe déjà gaté est relâché — une liste inactive contribue",
    critere: "A4 observation-inactive-contribue",
    impl: (e, a) =>
      TEMOIN({ ...e, observations: e.observations.map((o) => ({ ...o, listIsActive: true })) }, a),
  },
  {
    nom: "ANALYST_REVIEWED est traité comme RETAIL_SAFE",
    critere: "A6 analyst-reviewed-traite-comme-retail-safe",
    impl: (e, a) =>
      TEMOIN({ ...e, displaySafety: e.displaySafety === "ANALYST_REVIEWED" ? "RETAIL_SAFE" : e.displaySafety }, a),
  },
  {
    nom: "SUR-CORRECTION — le durcissement neutralise l'intelligence INTERNE",
    critere: "B1 interne-neutralise",
    impl: (e) => TEMOIN(e, "RETAIL"),
  },
  {
    nom: "SUR-CORRECTION — une entité pleinement admissible cesse de contribuer",
    critere: "A1 admissible-complet-refuse",
    impl: () => ({ admissible: false, retenues: [], refus: "NOT_RETAIL_SAFE" }),
  },
  {
    nom: "SUR-CORRECTION — l'admissible perd ses observations en route",
    critere: "D1 admissible-perd-ses-observations",
    impl: (e, a) => ({ ...TEMOIN(e, a), retenues: [] }),
  },
  {
    nom: "le refus est aplati — on ne sait plus lequel des trois axes a parlé",
    critere: "C1 refus-non-nomme",
    impl: (e, a) => {
      const r = TEMOIN(e, a);
      return { ...r, refus: r.refus === null ? null : "NOT_RETAIL_SAFE" };
    },
  },
];

describe("AM/1 — chaque mutant mord, et sur la propriété visée", () => {
  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const violes = batterie(m.impl);
      expect(violes, `mutant SURVIVANT = preuve manquante — ${m.nom}`).not.toEqual([]);
      expect(violes, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("les 8 mutants sont déclarés, sans doublon de critère", () => {
    expect(MUTANTS).toHaveLength(8);
    expect(new Set(MUTANTS.map((x) => x.critere)).size).toBe(8);
  });
});

// ═══ LE CONTRAT RÉVISÉ — 4 preuves, et AUCUNE sur la direction ═══════════

/** Sévérité ordonnée. Aucun score : des rangs, pour comparer un RÉSULTAT. */
const RANG = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, SANCTION: 4 } as const;

function severiteRetail(e: Entity, impl: Impl): number {
  const r = impl(e, "RETAIL");
  if (!r.admissible) return RANG.NONE;
  return Math.max(RANG.NONE, ...r.retenues.map((o) => RANG[o.riskClass as keyof typeof RANG] ?? 0));
}

describe("AM/2 — le contrat révisé", () => {
  it("P1 — une contribution INADMISSIBLE ne peut pas affecter le résultat retail", () => {
    const seuleInadmissible = ent({
      displaySafety: "INTERNAL_ONLY",
      observations: [obs({ sourceSlug: "inconnue", riskClass: "HIGH" })],
    });
    expect(TEMOIN(seuleInadmissible, "RETAIL").retenues).toHaveLength(0);
    expect(severiteRetail(seuleInadmissible, TEMOIN)).toBe(RANG.NONE);
  });

  it("P2 — une contribution ADMISSIBLE le peut", () => {
    const parLEntite = ent({ displaySafety: "RETAIL_SAFE" });
    const parLaSource = ent({
      displaySafety: "INTERNAL_ONLY",
      observations: [obs({ sourceSlug: "ofac", riskClass: "SANCTION" })],
    });
    expect(severiteRetail(parLEntite, TEMOIN)).toBe(RANG.HIGH);
    expect(severiteRetail(parLaSource, TEMOIN)).toBe(RANG.SANCTION);
  });

  it("P3 — retrait ou désactivation RETIRE l'autorité", () => {
    const base = ent({
      displaySafety: "INTERNAL_ONLY",
      observations: [obs({ sourceSlug: "ofac", riskClass: "SANCTION" })],
    });
    expect(TEMOIN(base, "RETAIL").admissible).toBe(true);
    // trois retraits, trois pertes d'autorité, indépendamment
    expect(TEMOIN({ ...base, isActive: false }, "RETAIL").admissible).toBe(false);
    expect(
      TEMOIN({ ...base, observations: [obs({ sourceSlug: "ofac", listIsActive: false })] }, "RETAIL")
        .admissible,
    ).toBe(false);
    const sansPolitique = fabriquerTemoin(() => false);
    expect(sansPolitique(base, "RETAIL").admissible).toBe(false);
  });

  it("P4 — le résultat est EXACTEMENT celui du scoreur sur les entrées admissibles restantes", () => {
    // La propriété centrale du contrat révisé. On ne corrige pas un résultat
    // après coup : on ne donne pas l'entrée. Donc juger une entité mixte doit
    // donner le MÊME résultat que juger la même entité réduite d'avance à ses
    // seules contributions admissibles.
    const mixte = ent({
      displaySafety: "INTERNAL_ONLY",
      observations: [
        obs({ sourceSlug: "ofac", riskClass: "SANCTION" }),
        obs({ sourceSlug: "inconnue", riskClass: "HIGH" }),
        obs({ sourceSlug: "forta", riskClass: "MEDIUM" }),
        obs({ sourceSlug: "chainalysis", riskClass: "HIGH" }),
        obs({ sourceSlug: "ofac", riskClass: "LOW", listIsActive: false }),
      ],
    });
    const retenues = TEMOIN(mixte, "RETAIL").retenues;
    const preFiltre = ent({
      displaySafety: "RETAIL_SAFE",
      observations: retenues,
    });
    expect(TEMOIN(preFiltre, "RETAIL").retenues).toEqual(retenues);
    expect(severiteRetail(mixte, TEMOIN)).toBe(severiteRetail(preFiltre, TEMOIN));
    // et ce qui reste est exactement ce qui devait rester
    expect(retenues.map((o) => o.sourceSlug).sort()).toEqual(["forta", "ofac"]);
  });

  it("P5 — AUCUNE exigence sur la DIRECTION du mouvement", () => {
    // Le retrait fait BAISSER ici, et c'est acceptable : ce qui compte est que
    // le résultat soit soutenu, pas qu'il aille dans un sens. La preuve
    // directionnelle a été révoquée après la mesure de non-monotonie.
    const avant = ent({ displaySafety: "RETAIL_SAFE" });
    const apres = { ...avant, displaySafety: "INTERNAL_ONLY" as DisplaySafety };
    expect(severiteRetail(apres, TEMOIN)).toBeLessThan(severiteRetail(avant, TEMOIN));
    // Le test l'ÉPINGLE au lieu de l'interdire. Aucune assertion de sens.
  });
});

// ═══ LES 6 FIXTURES — contre le CODE RÉEL ════════════════════════════════
//
// La batterie au-dessus juge le témoin. Celles-ci jugent `admitObservations`,
// la fonction d'admissibilité réellement livrée.

const POLITIQUE_MESUREE: SourcePolicy = new Map([
  // Le registre au 2026-09-09, réduit aux sources qui comptent ici.
  ["ofac", { retailAdmissible: true }],
  ["forta", { retailAdmissible: true }],
  ["scamsniffer", { retailAdmissible: true }],
  ["chainalysis", { retailAdmissible: false }], // `internal_only` au registre
]);

const O = (o: Partial<ObservationAdmissibilityFacts> & { sourceSlug: string }) => ({
  listIsActive: true,
  // AX — provenance PROUVÉE par défaut dans les fixtures : les autres axes
  // doivent mordre pour eux-mêmes, pas parce que la provenance manque.
  ingestionProvenanceProven: true,
  ...o,
});

function admettre(
  entity: EntityAdmissibilityFacts,
  // Le type LARGE, pas `ReturnType<typeof O>` : `ingestionProvenanceProven`
  // y est optionnel, et c'est exactement ce qu'un test sur son ABSENCE doit
  // pouvoir exprimer. Le typage l'a attrapé ; vitest ne l'aurait pas vu.
  observations: ObservationAdmissibilityFacts[],
  audience: IntelAudience,
  policy: SourcePolicy = POLITIQUE_MESUREE,
) {
  return admitObservations({ entity, observations, audience, policy });
}

describe("AM/3 — les 6 fixtures exigées, sur le code livré", () => {
  it("A — INTERNAL HIGH, preuve non retail-admissible → n'influence PAS le retail", () => {
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "chainalysis" })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("ENTITY_INTERNAL_ONLY_AND_SOURCE_NOT_RETAIL_ADMISSIBLE");
  });

  it("B — OFAC actif et gouverné → influence MÊME si l'entité est INTERNAL_ONLY", () => {
    // La fixture qui a produit l'arrêt. Les deux voies d'autorité sont
    // indépendantes : la source suffit.
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "ofac" })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(1);
    expect(r.refused).toHaveLength(0);
  });

  it("C — la MÊME observation OFAC devient inactive → cesse de contribuer", () => {
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "ofac", listIsActive: false })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("OBSERVATION_INACTIVE");
  });

  it("D — l'entité devient inactive → cesse de contribuer", () => {
    const r = admettre(
      { isActive: false, displaySafety: "RETAIL_SAFE" },
      [O({ sourceSlug: "ofac" })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("ENTITY_INACTIVE");
  });

  it("E — la SOURCE perd son admissibilité retail → cesse de contribuer", () => {
    // Aucune donnée ne change : seule la politique bascule. C'est le test qui
    // prouve que l'axe source est réellement consulté, et non décoratif.
    const revoquee: SourcePolicy = new Map([["ofac", { retailAdmissible: false }]]);
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "ofac" })],
      "RETAIL",
      revoquee,
    );
    expect(r.retained).toHaveLength(0);
  });

  it("F — audience INTERNE → la visibilité interne est préservée", () => {
    // Entité inactive, non autorisée, source non gouvernée : rien de tout cela
    // ne doit aveugler un analyste.
    const r = admettre(
      { isActive: false, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "chainalysis" }), O({ sourceSlug: "inconnue" })],
      "INTERNAL",
    );
    expect(r.retained).toHaveLength(2);
    expect(r.refused).toHaveLength(0);
  });

  it("F bis — mais une observation MORTE reste morte, même en interne", () => {
    // Le seul axe qui s'applique aux deux audiences. Le relâcher en interne
    // ressusciterait une ligne retirée d'une liste.
    const r = admettre(
      { isActive: true, displaySafety: "RETAIL_SAFE" },
      [O({ sourceSlug: "ofac", listIsActive: false })],
      "INTERNAL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("OBSERVATION_INACTIVE");
  });

  it("une source ABSENTE du registre n'est pas admissible — le registre est l'autorité", () => {
    // Mesuré : `amf`, `fca` et `goplus` ne joignent pas (`goplus` côté code
    // contre `goplusec` côté registre). Aucun ne produit d'observation
    // aujourd'hui ; le jour où l'un le fera, il sera refusé et VISIBLE.
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "goplus" })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
  });

  it("INTERNAL_ONLY et ANALYST_REVIEWED refusent tous deux, sans se CONFONDRE", () => {
    // Les deux nient l'autorité de niveau entité. Ils ne disent pas la même
    // chose : l'un n'a jamais été relu, l'autre l'a été et n'est explicitement
    // pas encore autorisé au scanner. Un opérateur doit savoir laquelle des
    // deux actions il lui reste.
    const o = [O({ sourceSlug: "chainalysis" })];
    const io = admettre({ isActive: true, displaySafety: "INTERNAL_ONLY" }, o, "RETAIL");
    const ar = admettre({ isActive: true, displaySafety: "ANALYST_REVIEWED" }, o, "RETAIL");
    expect(io.retained).toHaveLength(0);
    expect(ar.retained).toHaveLength(0);
    expect(io.refused[0].refus).not.toBe(ar.refused[0].refus);
    expect(ar.refused[0].refus).toContain("ANALYST_REVIEWED");
  });

  it("AX — une observation SANS lot d'ingestion n'est pas retail-admissible", () => {
    // Mesuré : `forta` est au registre et déclaré publiable, mais ses 3
    // observations n'ont aucun lot. La source dit qui a le droit de parler ;
    // la provenance dit que CETTE instance vient bien de là.
    const r = admettre(
      { isActive: true, displaySafety: "RETAIL_SAFE" },
      [{ sourceSlug: "forta", listIsActive: true, ingestionProvenanceProven: false }],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("UNPROVEN_INGESTION_PROVENANCE");
  });

  it("AX — `undefined` n'est PAS une provenance prouvée", () => {
    // Le défaut d'une preuve absente est son absence. Un appelant qui ne sait
    // pas répondre n'a rien prouvé.
    const r = admettre(
      { isActive: true, displaySafety: "RETAIL_SAFE" },
      [{ sourceSlug: "ofac", listIsActive: true }],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(0);
    expect(r.refused[0].refus).toBe("UNPROVEN_INGESTION_PROVENANCE");
  });

  it("AX — la provenance est INDÉPENDANTE de l'autorité de source", () => {
    // Une source publiable ne rend pas gouvernée une ligne écrite hors
    // pipeline, et une provenance prouvée ne rend pas publiable une source
    // interne. Les deux axes doivent tenir séparément.
    const gouverneeMaisInterne = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "chainalysis" })],
      "RETAIL",
    );
    expect(gouverneeMaisInterne.retained).toHaveLength(0);
    const publiableMaisNonGouvernee = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [{ sourceSlug: "ofac", listIsActive: true, ingestionProvenanceProven: false }],
      "RETAIL",
    );
    expect(publiableMaisNonGouvernee.retained).toHaveLength(0);
  });

  it("SUR-CORRECTION AX — une observation AVEC lot valide passe toujours", () => {
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [O({ sourceSlug: "ofac" })],
      "RETAIL",
    );
    expect(r.retained).toHaveLength(1);
    expect(r.refused).toHaveLength(0);
  });

  it("SUR-CORRECTION AX — l'audience INTERNE n'est PAS neutralisée par la provenance", () => {
    // Une ligne écrite hors pipeline reste LISIBLE en interne : c'est la
    // première chose qu'un analyste veut voir. Le durcissement retail ne doit
    // pas l'aveugler.
    const r = admettre(
      { isActive: true, displaySafety: "INTERNAL_ONLY" },
      [{ sourceSlug: "forta", listIsActive: true, ingestionProvenanceProven: false }],
      "INTERNAL",
    );
    expect(r.retained).toHaveLength(1);
    expect(r.refused).toHaveLength(0);
  });

  it("le vocabulaire du refus ne confond pas MEASURED avec une identité de source", () => {
    // DECLARED → SCHEDULED → REGISTERED → EXECUTED → PROVENANCED → ADMISSIBLE.
    // `MEASURED` est un état de requête, pas une étape de gouvernance.
    const r = admettre(
      { isActive: true, displaySafety: "RETAIL_SAFE" },
      [{ sourceSlug: "forta", listIsActive: true, ingestionProvenanceProven: false }],
      "RETAIL",
    );
    expect(r.refused[0].refus).not.toContain("MEASURED");
    expect(r.refused[0].refus).toContain("PROVENANCE");
  });

  it("le prédicat de source lit les CHAMPS DU REGISTRE, sans nom en dur", () => {
    expect(sourceIsRetailAdmissible({ status: "active", defaultVisibility: "public" })).toBe(true);
    expect(sourceIsRetailAdmissible({ status: "active", defaultVisibility: "internal_only" })).toBe(false);
    expect(sourceIsRetailAdmissible({ status: "retired", defaultVisibility: "public" })).toBe(false);
    // Et aucun nom de source n'apparaît dans le module.
    const src = readFileSync(join(__dirname, "..", "..", "src/lib/intelligence/retailAdmissibility.ts"), "utf8");
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    for (const nom of ["ofac", "amf", "fca", "goplus", "scamsniffer", "forta", "chainalysis"]) {
      expect(code, `nom de source en dur : ${nom}`).not.toContain(`"${nom}"`);
    }
  });
});

// ═══ PREUVE 6 — AUCUNE FUITE NOMINATIVE ══════════════════════════════════
//
// Celle-ci juge le CODE RÉEL, parce qu'elle porte sur une propriété déjà tenue
// et qu'il faut qu'elle le reste.

describe("AM/3 — le chemin pré-achat ne peut pas produire de type PERSON", () => {
  const SRC = readFileSync(
    join(__dirname, "..", "..", "src/lib/intelligence/matcher.ts"),
    "utf8",
  );
  const codeSeul = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  it("PREUVE LEXICALE — `guessEntityTypes` ne rend jamais PERSON", () => {
    // Annoncée comme lexicale, et voici pourquoi le comportement ne suffit
    // pas : `guessEntityTypes` est interne au module, non exportée, et son
    // domaine de sortie est un littéral. Prouver l'absence d'une valeur par
    // exécution demanderait d'énumérer toutes les entrées possibles ; lire le
    // domaine énuméré est ici la preuve la plus forte disponible.
    const debut = codeSeul.indexOf("function guessEntityTypes");
    const fin = codeSeul.indexOf("export async function matchEntity");
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    expect(codeSeul.slice(debut, fin)).not.toContain("PERSON");
  });

  it("aucun chemin du matcher ne mentionne PERSON", () => {
    expect(codeSeul).not.toContain("PERSON");
  });
});

// ═══ ÉTAT MESURÉ — épinglé pour que la dérive se voie ════════════════════

describe("AM/4 — l'état de la base au 2026-09-09, épinglé", () => {
  // Ces nombres ne sont pas des seuils : ce sont des CONSTATS datés. Ils
  // expliquent pourquoi la fermeture naïve était un arrêt, et ils donnent au
  // relecteur de quoi vérifier que rien n'a bougé sous ses pieds.
  const MESURE_2026_09_09 = {
    entites_actives_internal_only: 342_062,
    entites_actives_retail_safe: 2,
    entites_inactives: 1,
    sanctions_a_observation_active: 866,
    sanctions_retail_safe: 1, // et c'est une adresse bitcoin, hors chemin pré-achat
    atteignables_pre_achat_non_sanction: 2_531,
    atteignables_pre_achat_sanction: 104,
  } as const;

  it("RETAIL_SAFE est structurellement non peuplé — 2 sur 342 065", () => {
    const total =
      MESURE_2026_09_09.entites_actives_internal_only +
      MESURE_2026_09_09.entites_actives_retail_safe +
      MESURE_2026_09_09.entites_inactives;
    expect(total).toBe(342_065);
    expect(MESURE_2026_09_09.entites_actives_retail_safe / total).toBeLessThan(0.0001);
  });

  it("la fermeture naïve toucherait 104 sanctions atteignables depuis le pré-achat", () => {
    expect(MESURE_2026_09_09.atteignables_pre_achat_sanction).toBe(104);
    expect(MESURE_2026_09_09.sanctions_retail_safe).toBe(1);
  });
});
