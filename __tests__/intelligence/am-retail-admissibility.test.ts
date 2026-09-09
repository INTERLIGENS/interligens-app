// ─── AM · P0 — ADMISSIBILITÉ RETAIL DE L'INTELLIGENCE ──────────────────────
//
// ██  Des critères, pas une implémentation. Aucune ligne de production ici.  ██
//
// La règle ratifiée :
//
//   « Une entité inactive ou INTERNAL_ONLY ne doit pas influencer une décision
//     retail/partenaire au seul motif qu'une observation active subsiste. »
//
// Trois axes, INDÉPENDAMMENT :
//   entity.isActive === true
//   entity.displaySafety === RETAIL_SAFE
//   l'observation / la liste pertinente reste active
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
// TODO(AM · VOIE EN ARBITRAGE) — LA SEULE CONDITION NON TRANCHÉE.
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
// Les trois voies nommées, en arbitrage, AUCUNE choisie ici :
//   1. promouvoir les sources réglementaires gouvernées en RETAIL_SAFE (write) ;
//   2. rendre l'admissibilité gouvernée par la SOURCE et non par l'entité ;
//   3. gater tout sauf la contribution sanction (change le scoring).
//
// La FORME est figée ci-dessous ; la CONDITION reste ouverte. Aucune liste de
// sources en dur, aucun seuil, aucune anticipation.
// ─────────────────────────────────────────────────────────────────────────
type ConditionDeVoie = (o: Observation) => boolean;

/**
 * Le comportement par défaut du témoin en attendant l'arbitrage : AUCUNE
 * exemption. C'est le cas conservateur pour tout ce qui n'est pas une sanction,
 * et c'est précisément pourquoi les cas SANCTION sont marqués `it.todo` plus
 * bas plutôt que tranchés ici.
 */
const AUCUNE_EXEMPTION: ConditionDeVoie = () => false;

// ═══ LE TÉMOIN — indépendant, satisfiabilité seule ═══════════════════════

function fabriquerTemoin(exempte: ConditionDeVoie): Impl {
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

    const exemptees = actives.filter(exempte);
    if (e.displaySafety !== "RETAIL_SAFE") {
      return exemptees.length > 0
        ? { admissible: true, retenues: exemptees, refus: null }
        : { admissible: false, retenues: [], refus: "NOT_RETAIL_SAFE" };
    }
    if (actives.length === 0) {
      return { admissible: false, retenues: [], refus: "NO_ACTIVE_OBSERVATION" };
    }
    return { admissible: true, retenues: actives, refus: null };
  };
}

const TEMOIN = fabriquerTemoin(AUCUNE_EXEMPTION);

// ═══ FABRIQUES ═══════════════════════════════════════════════════════════

const obs = (o: Partial<Observation> = {}): Observation => ({
  sourceSlug: "scamsniffer",
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

// ═══ LA PREUVE DIRECTIONNELLE ════════════════════════════════════════════
//
// La plus importante : un retrait d'admissibilité doit produire un EFFET, et
// l'effet doit aller dans le sens SÛR.
//
// Elle est écrite en deux moitiés, et les deux comptent :
//   · sens SÛR   — retirer RETAIL_SAFE d'une entité qui ATTÉNUE le risque doit
//                  faire remonter la sévérité, jamais la conserver ;
//   · sens NON SÛR — retirer RETAIL_SAFE d'une entité qui AGGRAVE le risque
//                  ferait redescendre la sévérité. C'est le piège mesuré en
//                  production sur les sanctions OFAC, et le test le nomme.

/** Sévérité ordonnée. Aucun score : des rangs, pour comparer un SENS. */
const RANG = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, SANCTION: 4 } as const;

function severiteRetail(e: Entity, impl: Impl): number {
  const r = impl(e, "RETAIL");
  if (!r.admissible) return RANG.NONE;
  return Math.max(RANG.NONE, ...r.retenues.map((o) => RANG[o.riskClass as keyof typeof RANG] ?? 0));
}

describe("AM/2 — preuve directionnelle", () => {
  it("le retrait de RETAIL_SAFE produit un EFFET — il ne conserve jamais la contribution", () => {
    const avant = ent({ displaySafety: "RETAIL_SAFE" });
    const apres = ent({ displaySafety: "INTERNAL_ONLY" });
    expect(TEMOIN(avant, "RETAIL").admissible).toBe(true);
    expect(TEMOIN(apres, "RETAIL").admissible).toBe(false);
    expect(TEMOIN(avant, "RETAIL").retenues).not.toEqual(TEMOIN(apres, "RETAIL").retenues);
  });

  it("seul `displaySafety` change entre les deux — c'est bien lui qui produit l'effet", () => {
    const avant = ent({ displaySafety: "RETAIL_SAFE" });
    const apres = { ...avant, displaySafety: "INTERNAL_ONLY" as DisplaySafety };
    expect({ ...avant, displaySafety: null }).toEqual({ ...apres, displaySafety: null });
    expect(TEMOIN(avant, "RETAIL").admissible).not.toBe(TEMOIN(apres, "RETAIL").admissible);
  });

  /**
   * LE SENS, ET POURQUOI IL N'EST PAS ACQUIS.
   *
   * Mesuré dans `src/lib/intelligence/scorer.ts` : la couche d'intelligence
   * agit sur le score par TROIS mécanismes, et ils ne vont pas dans le même
   * sens quand on retire une contribution.
   *
   *   · delta additif  `adjustedScore = base + cappedDelta`, cappedDelta ≥ 0
   *                    → retirer FAIT BAISSER le risque  (sens NON SÛR)
   *   · plancher 15    sanction active et score < 15 → 15
   *                    → retirer FAIT BAISSER le risque  (sens NON SÛR)
   *   · plafond 72     totalIms > 20 ET maxIcs > 0,40 ET score > 72 → 72
   *                    → retirer FAIT REMONTER le risque (sens SÛR)
   *
   * Donc la preuve 5 n'est satisfaisable que pour les entités qui pilotent le
   * PLAFOND. Pour toutes les autres, le retrait rassure.
   *
   * NON MESURÉ, et dit plutôt que supposé : je ne sais pas si le plafond se
   * déclenche en production. `ims` et `ics` ne sont pas des colonnes — ils sont
   * calculés à la lecture (`matcher.ts:34`). Les mesurer en SQL demanderait de
   * réimplémenter le scoreur, ce qui serait inventer de la méthodologie.
   */
  it("CONSTAT — le retrait d'admissibilité RETIRE la contribution, il ne la conserve jamais", () => {
    // C'est la moitié de la preuve 5 qui est acquise quelle que soit la voie :
    // l'effet EXISTE. Le SENS de l'effet dépend du mécanisme, ci-dessus.
    for (const classe of ["LOW", "MEDIUM", "HIGH", "SANCTION"] as const) {
      const e = ent({ observations: [obs({ riskClass: classe })] });
      const retire = { ...e, displaySafety: "INTERNAL_ONLY" as DisplaySafety };
      expect(TEMOIN(e, "RETAIL").retenues, classe).toHaveLength(1);
      expect(TEMOIN(retire, "RETAIL").retenues, classe).toHaveLength(0);
    }
  });

  it("CONSTAT — sur un delta additif, le retrait va dans le sens NON SÛR", () => {
    // Ce test ne demande pas que ce soit acceptable. Il épingle que ça l'est,
    // pour qu'on ne puisse pas fermer la fuite en croyant le contraire.
    const e = ent({ displaySafety: "RETAIL_SAFE", observations: [obs({ riskClass: "HIGH" })] });
    const retire = { ...e, displaySafety: "INTERNAL_ONLY" as DisplaySafety };
    expect(severiteRetail(retire, TEMOIN)).toBeLessThan(severiteRetail(e, TEMOIN));
  });

  it.todo(
    "SENS SÛR sur le PLAFOND — retirer une entité qui plafonne à 72 doit faire REMONTER le score " +
      "[BLOQUÉ : exige de savoir si le plafond se déclenche, non mesurable sans réimplémenter le scoreur]",
  );

  it.todo(
    "SENS NON SÛR sur les SANCTIONS — une entité SANCTION ne doit PAS perdre sa sévérité " +
      "[BLOQUÉ : voie en arbitrage — voir TODO(AM · VOIE EN ARBITRAGE)]",
  );

  // ── LA FIXTURE DE PRODUCTION ─────────────────────────────────────────
  //
  // Mesurée le 2026-09-09 sur le déploiement servi `interligens-b65i0gatb`,
  // via GET /api/v1/score. Adresse listée OFAC — donnée publique par nature.
  // Elle est épinglée ICI pour qu'une régression qui la ferait sortir du WARN
  // casse un test au lieu de passer inaperçue.
  const FIXTURE_OFAC_PROD = {
    mint: "1Df883c96LVauVsx9FEgnsourD8DELwCUQ",
    score: 15, // le plancher sanction — engine.ts:545
    verdict: "ORANGE",
    phantom_warning_level: "WARN",
    sources: ["ofac"],
    signals: ["intelligence_overlay"],
    // L'entité derrière ce signal, mesurée en base :
    entite: { isActive: true, displaySafety: "INTERNAL_ONLY", riskClass: "SANCTION" },
  } as const;

  it("FIXTURE — l'adresse OFAC mesurée doit rester au-dessus de NONE", () => {
    // Le test ne rejoue pas la production : il épingle le fait que l'entité
    // derrière ce WARN est INTERNAL_ONLY, donc que la fermeture naïve la
    // ferait tomber à zéro. C'est le cas qui a produit l'arrêt.
    const e = ent({
      isActive: FIXTURE_OFAC_PROD.entite.isActive,
      displaySafety: FIXTURE_OFAC_PROD.entite.displaySafety,
      observations: [obs({ sourceSlug: "ofac", riskClass: "SANCTION" })],
    });
    expect(severiteRetail(e, TEMOIN)).toBe(RANG.NONE);
    expect(FIXTURE_OFAC_PROD.phantom_warning_level).toBe("WARN");
    expect(FIXTURE_OFAC_PROD.score).toBe(15);
  });

  it("et la voie retenue devra faire remonter cette fixture à SANCTION", () => {
    // La FORME de la vérification est figée ; la CONDITION est en arbitrage.
    // Ce test montre que la batterie SAIT exprimer la réponse attendue, sans
    // la choisir : on injecte une condition de voie hypothétique et on vérifie
    // que le témoin la respecte. Aucune liste en dur n'entre en production.
    const voieHypothetique: ConditionDeVoie = (o) => o.riskClass === "SANCTION";
    const temoinAvecVoie = fabriquerTemoin(voieHypothetique);
    const e = ent({
      displaySafety: "INTERNAL_ONLY",
      observations: [obs({ sourceSlug: "ofac", riskClass: "SANCTION" })],
    });
    expect(severiteRetail(e, temoinAvecVoie)).toBe(RANG.SANCTION);
    // Et la voie ne doit rien relâcher d'autre : un HIGH INTERNAL_ONLY reste
    // inadmissible même sous cette hypothèse.
    expect(
      severiteRetail(ent({ displaySafety: "INTERNAL_ONLY" }), temoinAvecVoie),
    ).toBe(RANG.NONE);
    // Et la batterie complète reste satisfaite sous cette voie.
    expect(batterie(temoinAvecVoie)).toEqual([]);
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
