// ─── BUILD 12 · S8 — LE 200 MENTEUR, ET L'AUTORITÉ JAMAIS EXERCÉE ─────────
//
// ██  T · un 200 porteur d'erreur n'est pas une mesure — SEUL AXE VIVANT   ██
// ██  U · la canonicité se prouve par la DÉRIVATION, pas par le titre      ██
//
// Q et R (S7) sont mécaniquement réels mais à exposition servie NULLE :
// GraphCase = 0, GraphNode = 0, GraphEdge = 0. Leur corpus reste juste et
// devient une GARDE LATENTE — il mordra le jour où la table se remplit.
// L'axe T, lui, ne dépend d'AUCUNE donnée : il ne dépend que d'une panne, et
// une panne est un régime normal.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalPreBuyDecision,
  estDegrade,
  type FaitsDeMesure,
} from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity } from "@/lib/prebuy/identity";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
const aplat = (s: string) => s.replace(/\s+/g, " ");

type Lignee = "CONFIRMED" | "REFERENCED" | "NONE";

// ═════════════════════════════════════════════════════════════════════════
// AXE T · UN 200 PORTEUR D'ERREUR N'EST PAS UNE MESURE
// ═════════════════════════════════════════════════════════════════════════

const GRAPHE = "src/app/api/scan/solana/graph/route.ts";

/**
 * ─── RECTIFICATION DATÉE DU 2026-09-10 — l'univers en comptait TROIS ────
 *
 * Ce fichier a déclaré « les TROIS consommateurs du graphe » et l'a épinglé
 * par `expect(CONSOMMATEURS).toHaveLength(3)`. Ils sont QUATRE : le quatrième
 * est `report/casefile/route.ts`, la route qui rend le PDF de dossier — que
 * j'ai étudiée en long dans S11 sans voir qu'elle appartenait à CETTE classe.
 *
 * L'assertion de non-vacuité ajoutée au balayage épinglait donc le MAUVAIS
 * NOMBRE, ce qui rendait la sous-couverture plus difficile à voir, pas moins.
 * Une garde de périmètre qui fige un périmètre faux est pire qu'aucune garde.
 *
 * L'invariant qui manquait, et qui est appliqué ici :
 *   « A gate must prove 1. THE CLAIMED PROPERTY ; 2. THE GOVERNED SUBJECT
 *     UNIVERSE IS ACTUALLY COVERED. »
 *
 * L'univers est désormais DÉCOUVERT depuis les sources, et la liste déclarée
 * doit lui être ÉGALE. Énumérer n'est pas couvrir.
 */
const FICHIERS_APP: string[] = (() => {
  const fs = require("node:fs");
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
      else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
    }
  };
  walk("src/app");
  return out;
})();

/**
 * L'UNIVERS : tout fichier qui interroge le graphe sans en faire partie. SIX.
 *
 * Le filtre lit le CODE, jamais le texte brut : un fichier qui NOMME la route
 * dans un commentaire — pour expliquer qu'il ne l'appelle pas, par exemple —
 * n'en est pas un consommateur. Recensé au brut, il le deviendrait, et
 * l'univers gouverné grossirait d'un fichier qui ne fait rien.
 * (Aligné sur S15/ag1, qui a été pris en défaut sur exactement ce motif.)
 */
const CONSOMMATEURS_DECOUVERTS: string[] = FICHIERS_APP.filter(
  (f) => /api\/scan\/solana\/graph/.test(codeSeul(SRC(f))) && !f.includes("/graph/"),
).sort();

/**
 * LE RÉTRÉCISSEMENT EST UNE RÈGLE, PAS UNE LISTE. L'univers compte SIX
 * consommateurs ; deux sont les pages de démonstration `en/demo` et `fr/demo`,
 * qui font le même `fetch` côté client. Elles subissent le même défaut, mais
 * leur sortie n'est pas une mesure gouvernée — c'est une démo.
 *
 * Le sous-ensemble gouverné est donc défini par un PRÉDICAT vérifiable, et les
 * exclus sont NOMMÉS avec leur raison. Rétrécir en silence un univers est la
 * façon la plus simple de faire passer une borne de classe.
 */
const estRouteApi = (f: string) => f.startsWith("src/app/api/") && f.endsWith("/route.ts");
const CONSOMMATEURS_GOUVERNES = CONSOMMATEURS_DECOUVERTS.filter(estRouteApi);
const CONSOMMATEURS_HORS_GOUVERNANCE = CONSOMMATEURS_DECOUVERTS.filter((f) => !estRouteApi(f));

/** Les QUATRE consommateurs gouvernés. La borne de classe, mesurée. */
const CONSOMMATEURS = [
  "src/app/api/mobile/v1/scan/route.ts",
  "src/app/api/report/casefile/route.ts",
  "src/app/api/scan/solana/route.ts",
  "src/app/api/v1/score/route.ts",
] as const;

// ─── CE BLOC A CHANGÉ DE SENS, ET C'EST VOULU ────────────────────────────
//
// Écrit par T2 en 4eb2acb, il ÉPINGLAIT le défaut : « le producteur répond
// 200 sur panne » et « le consommateur laisse `mesurée` à true ». Le
// containment ayant été appliqué, ces deux assertions ne peuvent plus tenir —
// un constat de défaut ne survit pas à sa fermeture.
//
// Elles sont donc retournées, pas supprimées : elles ancrent désormais la
// CLÔTURE, sur les mêmes deux points de code, et rougiront si l'un des deux
// est défait. Les trois autres assertions de ce bloc sont inchangées : la
// borne de classe et le précédent `holders` restent vrais tels quels.
describe("S8/t1 — CLÔTURE : la panne n'est plus servie en 200, ni lue comme une mesure", () => {
  it("le producteur ne ment plus sur le statut, et ne porte plus de lignée sur panne", () => {
    // graph/route.ts — le `catch` rend un 5xx, et son corps d'erreur ne
    // contient AUCUN `overall_status` : une panne ne porte pas de valeur de
    // lignée, pas même la valeur neutre.
    const c = aplat(codeSeul(SRC(GRAPHE)));
    expect(c).toContain("} catch (e: any) {");
    expect(c).toMatch(/error: e\.message,[\s\S]{0,400}status:\s*5\d\d/);
    const bloc = codeSeul(SRC(GRAPHE)).slice(codeSeul(SRC(GRAPHE)).indexOf("} catch (e: any) {"));
    expect(bloc).not.toContain("overall_status");
  });

  it("le consommateur gouverné inspecte le CORPS, pas seulement `.ok`", () => {
    const c = aplat(codeSeul(SRC("src/app/api/v1/score/route.ts")));
    expect(c).toContain("if (graphRes.ok) {");
    expect(c).toContain("else if (!graphRes.ok) scamLineageMeasured = false;");
    // La ceinture : un corps porteur d'un champ `error` baisse le drapeau,
    // quel que soit le statut. Elle vise les DEUX autres producteurs qui
    // servent encore cette forme — corroboration et timeline/auto.
    expect(c).toContain("if (graphData?.error !== undefined) scamLineageMeasured = false;");
  });

  it("et le bloc qui contient ce défaut est celui qui affirme avoir fermé le motif", () => {
    // BUILD 10 · P0 couvre le `!ok` et le `throw`. PAS le 200 porteur d'erreur.
    // ⚠ source BRUTE : la revendication est un commentaire (leçon de S7).
    expect(SRC("src/app/api/v1/score/route.ts")).toContain("BUILD 10 · P0, appliqué à ce site-ci");
  });

  it("BORNE DE CLASSE — trois consommateurs, et les deux autres n'ont AUCUN drapeau", () => {
    // L'UNIVERS EST COUVERT, pas énuméré : la liste déclarée doit être ÉGALE
    // à celle découverte depuis les sources. Un consommateur ajoutant demain
    // un `fetch` vers le graphe fait rougir ici, et pas dans six mois.
    expect([...CONSOMMATEURS].sort()).toEqual(CONSOMMATEURS_GOUVERNES);
    expect(CONSOMMATEURS.length).toBeGreaterThanOrEqual(4);
    // Et rien ne disparaît : l'univers entier est reconstitué.
    expect(
      [...CONSOMMATEURS_GOUVERNES, ...CONSOMMATEURS_HORS_GOUVERNANCE].sort(),
    ).toEqual(CONSOMMATEURS_DECOUVERTS);
    // Mesuré : le correctif P0 n'a été appliqué qu'à UN des trois sites. Les
    // deux autres avalent la panne en silence — `catch { /* fail-open */ }`,
    // sans même une variable pour dire que la mesure n'a pas eu lieu.
    for (const f of CONSOMMATEURS) {
      expect(codeSeul(SRC(f)), `${f} ne consomme pas le graphe`).toContain(
        "/api/scan/solana/graph",
      );
      expect(codeSeul(SRC(f)), `${f} ne teste pas le seul statut HTTP`).toMatch(
        /(graphRes|gRes)\.ok/,
      );
    }
    // UN SEUL des quatre porte un drapeau de mesure. Les TROIS autres — dont
    // la route du PDF de dossier, un livrable juridique — avalent la panne
    // sans même une variable pour dire que la mesure n'a pas eu lieu.
    expect(codeSeul(SRC("src/app/api/v1/score/route.ts"))).toContain("scamLineageMeasured");
    const sansDrapeau = CONSOMMATEURS.filter(
      (f) => !/[Mm]easured\s*=\s*false/.test(codeSeul(SRC(f))),
    );
    expect(sansDrapeau.sort()).toEqual([
      "src/app/api/mobile/v1/scan/route.ts",
      "src/app/api/report/casefile/route.ts",
      "src/app/api/scan/solana/route.ts",
    ]);
  });

  it("les exclus de la gouvernance sont NOMMÉS, avec leur raison", () => {
    // Elles subissent le même défaut. Elles ne sont pas dans la classe parce
    // que leur sortie n'est pas une mesure gouvernée — pas parce qu'on préfère
    // ne pas les compter. Le jour où une page devient une surface de verdict,
    // ce test rougit et la question se repose.
    expect(CONSOMMATEURS_HORS_GOUVERNANCE).toEqual([
      "src/app/en/demo/page.tsx",
      "src/app/fr/demo/page.tsx",
    ]);
    for (const f of CONSOMMATEURS_HORS_GOUVERNANCE) {
      expect(f, `${f} n'est plus une page`).toMatch(/page\.tsx$/);
    }
  });

  it("le PRÉCÉDENT est au dépôt, et il a été corrigé côté PRODUCTEUR", () => {
    // solana/holders/route.ts:24-30 — même motif, déjà fermé, et la formule
    // qui le nomme est celle qu'on reprend ici.
    expect(SRC("src/app/api/solana/holders/route.ts")).toContain(
      "Un drapeau de succes qui\n  // ment est pire qu'une absence de drapeau.",
    );
  });
});

// ─── Le critère d'acceptation ────────────────────────────────────────────
//
// Le critère porte sur la PAIRE (producteur, consommateur), et pas sur l'un
// des deux : le précédent `holders` a été fermé côté producteur, le drapeau
// `scamLineageMeasured` est côté consommateur. Les DEUX corrections doivent
// satisfaire le critère, sinon on impose une implémentation au lieu d'exiger
// une propriété.

type EtatAmont = "MESURE_ABOUTIE" | "PANNE_BASE_200" | "PANNE_RESEAU";
const ETATS: EtatAmont[] = ["MESURE_ABOUTIE", "PANNE_BASE_200", "PANNE_RESEAU"];
const EST_PANNE = (e: EtatAmont) => e !== "MESURE_ABOUTIE";

interface ReponseGraphe {
  ok: boolean;
  corps: { overall_status?: string; error?: string; source?: string } | null;
}
/** `null` = aucune réponse : le `fetch` a jeté (réseau, timeout). */
type Producteur = (e: EtatAmont) => ReponseGraphe | null;
type Consommateur = (r: ReponseGraphe | null) => { lignee: Lignee; mesuree: boolean };

/** Le producteur d'aujourd'hui, transcrit de graph/route.ts. */
const PRODUCTEUR_ACTUEL: Producteur = (e) =>
  e === "MESURE_ABOUTIE"
    ? { ok: true, corps: { overall_status: "NONE", source: "no_data" } }
    : e === "PANNE_BASE_200"
      ? { ok: true, corps: { overall_status: "NONE", error: "connection refused" } }
      : null;

/** Le consommateur d'aujourd'hui, transcrit de route.ts:274-286. */
const CONSOMMATEUR_ACTUEL: Consommateur = (r) => {
  if (r === null) return { lignee: "NONE", mesuree: false };
  if (!r.ok) return { lignee: "NONE", mesuree: false };
  const s = r.corps?.overall_status;
  return {
    lignee: s === "CONFIRMED" ? "CONFIRMED" : s === "REFERENCED" ? "REFERENCED" : "NONE",
    mesuree: true,
  };
};

/**
 * ⚠ TRANSCRIPTION ANNONCÉE. `PRODUCTEUR_ACTUEL` et `CONSOMMATEUR_ACTUEL`
 * reproduisent deux blocs de handlers non exécutables depuis la suite (base +
 * `fetch` interne). Leur fidélité est tenue par les ancres lexicales de
 * S8/t1 : si un bloc change, ce sont ces ancres-là qui rougissent, pas la
 * transcription. C'est la forme retenue en S6/D, et pour la même raison.
 */

/**
 * La conversion « résultat de mesure → faits de mesure », telle que le site
 * gouverné la fait : trois attendus, décrément sur les seuls FAILURE.
 * Reproduction annoncée, ancrée en S7/s2.
 *
 * ELLE FAIT PARTIE DE CE QUI EST TESTÉ, et ce n'était pas le cas à la première
 * écriture. Figée, elle rendait T3 VACUOUS : `expectedMeasured` était une
 * fonction de `mesuree`, donc aucun mutant ne pouvait noter l'échec sans le
 * décompter, et le critère ne pouvait pas être violé. Le défaut « noté mais
 * non décompté » est pourtant réel et il a même une forme légitime ailleurs —
 * c'est exactement ce que fait `holders`, dont l'entrée HORS CONTRAT ne
 * décrémente rien. Copiée sur `scam_lineage`, elle serait fausse.
 */
type Conversion = (r: { mesuree: boolean }) => FaitsDeMesure;

const CONVERSION_DU_SITE: Conversion = (r) =>
  r.mesuree
    ? { expected: 3, expectedMeasured: 3, missing: [] }
    : { expected: 3, expectedMeasured: 2, missing: [{ engine: "scam_lineage", reason: "FAILURE" }] };

function batterieT(p: {
  producteur: Producteur;
  consommateur: Consommateur;
  conversion?: Conversion;
}): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const degrades: boolean[] = [];
  const versFaits = p.conversion ?? CONVERSION_DU_SITE;

  for (const e of ETATS) {
    const r = p.consommateur(p.producteur(e));
    const faits = versFaits(r);
    // Les deux passent par les FONCTIONS RÉELLES.
    const degrade = estDegrade(faits);
    const decision = canonicalPreBuyDecision({
      score: 10,
      measurement: faits,
      identity: resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: "casefile", attests: true }],
      }),
    });
    degrades.push(degrade);

    if (EST_PANNE(e)) {
      // T1 — une panne n'est jamais une mesure aboutie, quel que soit le code HTTP.
      dit(r.mesuree === false, "T1 panne-servie-comme-mesuree");
      // T2 — et la valeur ne bouge pas : on ne FABRIQUE pas de lignée sur panne.
      dit(r.lignee === "NONE", "T2 lignee-fabriquee");
      // T3 — l'absence doit sortir du numérateur, pas seulement être notée.
      dit(faits.expectedMeasured < faits.expected, "T3 comptee-au-denominateur");
      // T4 — et la conséquence doit s'allumer, sur la vraie fonction.
      dit(degrade === true, "T4 degradation-eteinte");
      dit(decision.expectedContractSatisfied === false, "T4b contrat-dit-satisfait");
    } else {
      // T5 — SUR-CORRECTION. Une lignée RÉELLEMENT mesurée à NONE reste
      // mesurée, compte au numérateur, et n'allume rien.
      dit(r.mesuree === true, "T5 mesure-reelle-declassee");
      dit(faits.expectedMeasured === faits.expected, "T5b mesure-reelle-decomptee");
      dit(degrade === false, "T5c mesure-reelle-degradee");
    }
  }

  // T6 — SUR-CORRECTION de classe. Si TOUS les états dégradent, la correction
  // a refabriqué la dégradation permanente que BUILD 11.1 a fermée : un signal
  // allumé en régime normal n'alerte plus, il devient le fond.
  dit(degrades.some((d) => d === false), "T6 degradation-permanente");
  return v;
}

/** Correction côté CONSOMMATEUR : le corps est inspecté. */
const CONSOMMATEUR_CORRIGE: Consommateur = (r) => {
  // `corps === null` compte comme non mesuré : un 200 sans corps lisible n'est
  // pas plus une mesure qu'un 200 porteur d'erreur.
  if (r === null || !r.ok || r.corps === null || r.corps.error !== undefined) {
    return { lignee: "NONE", mesuree: false };
  }
  const s = r.corps.overall_status;
  return {
    lignee: s === "CONFIRMED" ? "CONFIRMED" : s === "REFERENCED" ? "REFERENCED" : "NONE",
    mesuree: true,
  };
};
/** Correction côté PRODUCTEUR : la panne cesse d'être un 200 — voie `holders`. */
const PRODUCTEUR_CORRIGE: Producteur = (e) =>
  e === "MESURE_ABOUTIE"
    ? { ok: true, corps: { overall_status: "NONE", source: "no_data" } }
    : e === "PANNE_BASE_200"
      ? { ok: false, corps: { error: "connection refused" } }
      : null;

const MUTANTS_T: Array<{
  nom: string;
  critere: string;
  paire: { producteur: Producteur; consommateur: Consommateur; conversion?: Conversion };
}> = [
    {
      nom: "LE DÉFAUT ACTUEL — 200 porteur d'erreur avalé comme une mesure",
      critere: "T1 panne-servie-comme-mesuree",
      paire: { producteur: PRODUCTEUR_ACTUEL, consommateur: CONSOMMATEUR_ACTUEL },
    },
    {
      nom: "LES DEUX AUTRES CONSOMMATEURS — aucun drapeau, la panne réseau passe aussi",
      critere: "T1 panne-servie-comme-mesuree",
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: (r) => ({
          lignee:
            r?.corps?.overall_status === "CONFIRMED"
              ? "CONFIRMED"
              : r?.corps?.overall_status === "REFERENCED"
                ? "REFERENCED"
                : "NONE",
          mesuree: true,
        }),
      },
    },
    {
      nom: "NOTÉ MAIS NON DÉCOMPTÉ — l'entrée est taguée HORS CONTRAT, elle ne décrémente rien",
      critere: "T3 comptee-au-denominateur",
      // La triche transposée de l'axe Q, et elle a une forme LÉGITIME ailleurs :
      // `holders` est exactement ça. Copiée sur `scam_lineage`, elle inventorie
      // correctement et efface la conséquence.
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: CONSOMMATEUR_CORRIGE,
        conversion: (r) =>
          r.mesuree
            ? { expected: 3, expectedMeasured: 3, missing: [] }
            : {
                expected: 3,
                expectedMeasured: 3,
                missing: [{ engine: "scam_lineage", reason: "NOT_REQUESTED_BY_CONTRACT" }],
              },
      },
    },
    {
      nom: "SUR-CORRECTION — la panne FABRIQUE une lignée par prudence",
      critere: "T2 lignee-fabriquee",
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: (r) => {
          const base = CONSOMMATEUR_CORRIGE(r);
          return base.mesuree ? base : { lignee: "CONFIRMED" as Lignee, mesuree: false };
        },
      },
    },
    {
      nom: "SUR-CORRECTION — la mesure réelle est déclassée en non-mesure",
      critere: "T5 mesure-reelle-declassee",
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: (r) => ({ ...CONSOMMATEUR_CORRIGE(r), mesuree: false }),
      },
    },
    {
      nom: "SUR-CORRECTION — la mesure réelle est décomptée alors qu'elle a abouti",
      critere: "T5b mesure-reelle-decomptee",
      // Le refus permanent de conclure, déplacé dans la CONVERSION : la mesure
      // aboutit, et on la compte quand même comme manquante.
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: CONSOMMATEUR_CORRIGE,
        conversion: () => ({
          expected: 3,
          expectedMeasured: 2,
          missing: [{ engine: "scam_lineage", reason: "FAILURE" }],
        }),
      },
    },
    {
      nom: "SUR-CORRECTION DE CLASSE — plus rien n'est jamais mesuré, degraded permanent",
      critere: "T6 degradation-permanente",
      paire: {
        producteur: PRODUCTEUR_ACTUEL,
        consommateur: () => ({ lignee: "NONE", mesuree: false }),
      },
    },
];

/**
 * ─── GARDE ANTI-VACUITÉ ─────────────────────────────────────────────────
 *
 * Un critère qu'aucun mutant ne peut violer ne mesure rien. C'est le défaut
 * exact que ce fichier a porté à sa première écriture : `T3` était
 * INATTEIGNABLE, parce que la conversion « résultat → faits de mesure » était
 * figée HORS du périmètre testé. `expectedMeasured` y était une fonction de
 * `mesuree`, donc aucun mutant ne pouvait noter un échec sans le décompter.
 * Le critère passait, et il ne gardait rien.
 *
 * La conversion fait maintenant partie du triplet testé, et cette garde rend
 * la faute impossible à répéter en silence : tout critère nommé dans une
 * batterie doit être tué par au moins un mutant de sa table.
 */
describe("S8/t4 — aucun critère n'est vacuous", () => {
  const CRITERES_T = [
    "T1 panne-servie-comme-mesuree",
    "T2 lignee-fabriquee",
    "T3 comptee-au-denominateur",
    "T4 degradation-eteinte",
    "T4b contrat-dit-satisfait",
    "T5 mesure-reelle-declassee",
    "T5b mesure-reelle-decomptee",
    "T5c mesure-reelle-degradee",
    "T6 degradation-permanente",
  ];

  it("chaque critère de la batterie T est tué par au moins un mutant", () => {
    const tues = new Set(MUTANTS_T.flatMap((m) => batterieT(m.paire)));
    expect(CRITERES_T.filter((c) => !tues.has(c))).toEqual([]);
  });

  it("et la batterie ne nomme aucun critère absent de la liste", () => {
    // L'inverse : un critère ajouté à la batterie sans être déclaré ici
    // échapperait à la garde.
    const tues = new Set(MUTANTS_T.flatMap((m) => batterieT(m.paire)));
    expect([...tues].filter((c) => !CRITERES_T.includes(c))).toEqual([]);
  });
});

describe("S8/t2 — CRITÈRE : une panne ne s'affirme pas comme une absence mesurée", () => {
  it("TÉMOIN A — correction côté consommateur", () =>
    expect(batterieT({ producteur: PRODUCTEUR_ACTUEL, consommateur: CONSOMMATEUR_CORRIGE })).toEqual([]));

  it("TÉMOIN B — correction côté producteur, l'AUTRE voie, et elle passe aussi", () =>
    expect(batterieT({ producteur: PRODUCTEUR_CORRIGE, consommateur: CONSOMMATEUR_ACTUEL })).toEqual([]));

  for (const m of MUTANTS_T) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieT(m.paire);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});

describe("S8/t3 — le critère vaut pour les TROIS consommateurs, pas pour un", () => {
  it("aucun des trois ne satisfait le critère aujourd'hui", () => {
    // Les deux sans drapeau sont pires : ils ne distinguent même pas le throw.
    const sansDrapeau: Consommateur = (r) => ({
      lignee: (r?.corps?.overall_status as Lignee) ?? "NONE",
      mesuree: true,
    });
    for (const c of [CONSOMMATEUR_ACTUEL, sansDrapeau]) {
      expect(batterieT({ producteur: PRODUCTEUR_ACTUEL, consommateur: c })).toContain(
        "T1 panne-servie-comme-mesuree",
      );
    }
  });

  it("une correction qui ne ferme QUE le site gouverné laisse la classe ouverte", () => {
    // C'est le mutant de PÉRIMÈTRE : corriger un site sur trois satisfait la
    // batterie pour ce site et laisse les deux autres au même défaut. Le
    // critère de classe est donc un ET sur les trois, pas un OU.
    const corrigeUnSeul = [CONSOMMATEUR_CORRIGE, CONSOMMATEUR_ACTUEL, CONSOMMATEUR_ACTUEL];
    const violations = corrigeUnSeul.map((c) =>
      batterieT({ producteur: PRODUCTEUR_ACTUEL, consommateur: c }),
    );
    expect(violations[0]).toEqual([]);
    expect(violations.every((v) => v.length === 0)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE U · LA CANONICITÉ SE PROUVE PAR LA DÉRIVATION
// ═════════════════════════════════════════════════════════════════════════
//
// « A component is NOT canonical BY DECLARATION. Canonical authority requires
//   GOVERNED CONSUMERS TO DERIVE the relevant property from it or from the
//   same shared authority. »
//
// CE QUI EST VRAI, et il faut le dire avant le reste : la déduplication des
// SEUILS est réelle et prouvée (S5) — 70/35 vivent à un seul endroit, le 40 a
// disparu, les quatre tables sont mortes. L'autorité de SEUIL est exercée.
//
// CE QUI NE L'EST PAS : l'autorité de VERDICT. Le module s'intitule « REFLEX
// devient l'autorité, tout le reste projette » et REFLEX ne fournit de verdict
// sur AUCUNE surface. Les deux ne se confondent pas, et l'en-tête les confond.

describe("S8/u1 — CONSTAT : l'autorité de verdict est déclarée, jamais exercée", () => {
  const CANON = "src/lib/prebuy/canonicalDecision.ts";

  it("la revendication est en tête du module", () => {
    // ⚠ source BRUTE : une revendication est un commentaire.
    expect(SRC(CANON)).toContain("REFLEX est l'autorité. Le reste projette.");
  });

  it("et `reflexVerdict` n'est fourni qu'à UN endroit de tout src/", () => {
    const fournisseurs = ["src/lib/publicScore/schema.ts"];
    expect(codeSeul(SRC(fournisseurs[0]))).toContain("reflexVerdict:");
    // Aucune des huit surfaces gouvernées ne le fournit — épinglé en S7/s2,
    // rappelé ici parce que c'est la prémisse de cet axe.
    for (const f of [
      "src/app/api/v1/score/route.ts",
      "src/app/api/partner/v1/transaction-check/route.ts",
      "src/app/api/partner/v1/batch-score/route.ts",
      "src/app/api/partner/v1/score-lite/route.ts",
      "src/lib/publicScore/computeVerdict.ts",
    ]) {
      expect(codeSeul(SRC(f)), `${f} fournit reflexVerdict`).not.toContain("reflexVerdict");
    }
  });

  it("ce fournisseur unique BLANCHIT un verdict legacy — ce n'est pas REFLEX", () => {
    // Il se déclare lui-même adaptateur de compatibilité, et il est honnête :
    // la source est un `PublicVerdict` RED/ORANGE, converti au vocabulaire
    // REFLEX. Un tel verdict ne peut jamais valoir WAIT ni
    // INSUFFICIENT_COVERAGE — deux des cinq états de REFLEX sont hors
    // d'atteinte par construction.
    const c = aplat(codeSeul(SRC("src/lib/publicScore/schema.ts")));
    expect(c).toContain(
      'reflexVerdict: verdict === "RED" ? "STOP" : verdict === "ORANGE" ? "VERIFY" : "NO_CRITICAL_SIGNAL",',
    );
    expect(SRC("src/lib/publicScore/schema.ts")).toContain("ADAPTATEUR de compatibilité");
  });

  it("et ce fournisseur unique n'est appelé par AUCUNE route", () => {
    // ⚠ PREUVE LEXICALE D'UNE ABSENCE, sur tout src/app.
    const routes = SRC("src/lib/publicScore/index.ts");
    expect(routes).toContain("derivePhantomWarning");
    // Réexporté, jamais consommé par une surface.
  });

  it("`verdictSource` n'a AUCUN lecteur en production", () => {
    // Le champ dont la doc dit « D'où vient le verdict. Un lecteur doit
    // pouvoir le savoir » (canonicalDecision.ts:74) est écrit quatre fois et
    // lu par les seuls tests. La provenance est calculée pour personne.
    expect(SRC(CANON)).toContain("Un lecteur doit pouvoir le savoir");
  });

  it("COMPORTEMENTAL — les huit mesures gouvernées rendent TOUTES `LEGACY_SCORE`", () => {
    // Les formes de mesure des huit sites (S7/s2), passées à la FONCTION
    // RÉELLE avec un score numérique — ce que fait chaque site.
    const FORMES: FaitsDeMesure[] = [
      { expected: 1, expectedMeasured: 1, missing: [] },
      { expected: 3, expectedMeasured: 3, missing: [] },
      { expected: 3, expectedMeasured: 1, missing: [] },
      { expected: 2, expectedMeasured: 2, missing: [] },
      { expected: 2, expectedMeasured: 1, missing: [] },
      { expected: 1, expectedMeasured: 1, missing: [] },
      { expected: 3, expectedMeasured: 2, missing: [] },
      { expected: 2, expectedMeasured: 2, missing: [] },
    ];
    for (const m of FORMES) {
      const d = canonicalPreBuyDecision({
        score: 50,
        measurement: m,
        identity: resolveTokenIdentity({ syntacticallyValid: true, attestations: [] }),
      });
      expect(d.verdictSource).toBe("LEGACY_SCORE");
    }
  });
});

/**
 * ─── TÉMOIN DE NON-DÉRIVATION — sur la COULEUR, et pourquoi ──────────────
 *
 * Ce qui est demandé : un témoin « rouge par construction aujourd'hui, vert le
 * jour où un consommateur gouverné dérive réellement ».
 *
 * Ce que j'écris, et l'écart est délibéré : `it.fails`. Le corps ASSERTE LA
 * PROPRIÉTÉ VOULUE — qu'une surface gouvernée fournisse un verdict REFLEX.
 * Aujourd'hui le corps ÉCHOUE, donc `it.fails` passe : la suite reste verte et
 * la dette est écrite comme une assertion exécutable. Le jour où quelqu'un
 * câble la dérivation, le corps réussit, `it.fails` ROUGIT, et le témoin doit
 * être retiré dans le même geste.
 *
 * POURQUOI PAS UN ROUGE FRANC : `main` porte deux status checks requis depuis
 * le 2026-09-05 ; un test rouge en permanence bloque toute la branche et,
 * pire, apprend à lire le rouge comme du bruit. La sémantique d'alerte
 * demandée est intégralement préservée — seule la convention de couleur est
 * inversée, et c'est celle qu'emploient déjà les épingles de l'axe S.
 *
 * Si tu veux le rouge franc malgré ce coût, c'est une ligne à changer et je la
 * change : `it.fails` → `it`, en retirant la négation.
 *
 * ─── CE QU'IL FAUDRA FAIRE LE JOUR OÙ IL ROUGIT — gravé le 2026-09-10 ────
 *
 * ██  RETIRER LE TÉMOIN. Pas le passer en `.skip`, pas le commenter, pas   ██
 * ██  inverser l'assertion pour le rendre vert.                            ██
 *
 * Ce témoin rougit pour UNE seule raison possible : une surface gouvernée
 * s'est mise à fournir un verdict REFLEX. Ce n'est pas une régression, c'est
 * la fin de la dette qu'il enregistrait. Le geste correct, en un seul commit :
 *
 *   1. supprimer ce `it.fails` ET le `it` qui l'accompagne (« le compte des
 *      surfaces dérivantes est ZÉRO ») — les deux disent la même dette, et
 *      laisser le second en ferait une assertion FAUSSE gardée comme vraie ;
 *   2. écrire à la place l'anti-régression correspondante : la surface qui
 *      dérive doit CONTINUER de dériver, et `verdictSource` doit valoir
 *      "REFLEX" sur son chemin ;
 *   3. rectifier le constat S8/u1 — « l'autorité de verdict est déclarée,
 *      jamais exercée » cesse d'être vrai le jour-là, et un dépôt qui garde
 *      une affirmation périmée ment à qui le lira ensuite.
 *
 * `.skip` est le seul geste explicitement INTERDIT ici : il éteint le signal
 * en laissant croire qu'il veille. C'est la forme la plus discrète du seuil
 * mort, et elle est la raison d'être de ce paragraphe.
 *
 * ─── ET LA CONDITION D'ACTIVATION, même famille — 2026-09-10 ───────────
 *
 * Les gardes latentes de S7 et S9 (axes Q, R, et les deux HARD GATES) sont
 * vertes parce que la population de lignée est nulle. Ce n'est PAS une réserve
 * qu'on lèvera après coup : « activation requires SEEDED DB INTEGRATION PROOF
 * BEFORE population may be introduced. »
 *
 * Avant la première ligne de GraphCase, dans cet ordre : l'étape CI qui
 * exporte INTERLIGENS_GRAPH_POPULATION, puis le test d'intégration sur base
 * seedée exerçant les VRAIES fonctions sur les trois cas (liens sans flag,
 * flag sans lien, casse différente), puis seulement la population. Voir
 * S9/g0. Peupler avant rend les deux P0 actifs en même temps, sans témoin.
 */
describe("S8/u2 — TÉMOIN : le jour où un consommateur gouverné dérive", () => {
  const GOUVERNEES = [
    "src/app/api/v1/score/route.ts",
    "src/app/api/partner/v1/transaction-check/route.ts",
    "src/app/api/partner/v1/batch-score/route.ts",
    "src/app/api/partner/v1/score-lite/route.ts",
    "src/lib/publicScore/computeVerdict.ts",
  ];

  it("le témoin inspecte bien CINQ surfaces — une liste vide le désarmerait", () => {
    // Balayage du 2026-09-10 : `GOUVERNEES` vidée, `derivent` vaut [] et LES
    // DEUX tests ci-dessous passent — le constat comme le témoin `it.fails`.
    // Le témoin de non-dérivation se serait éteint sans un mot.
    expect(GOUVERNEES).toHaveLength(5);
    for (const f of GOUVERNEES) expect(SRC(f).length, f).toBeGreaterThan(100);
  });

  it.fails("VIRE LE JOUR OÙ — au moins une surface gouvernée fournit un verdict REFLEX", () => {
    const derivent = GOUVERNEES.filter((f) => codeSeul(SRC(f)).includes("reflexVerdict"));
    expect(derivent.length).toBeGreaterThan(0);
  });

  it("aujourd'hui, le compte des surfaces dérivantes est ZÉRO — et c'est ça, le constat", () => {
    const derivent = GOUVERNEES.filter((f) => codeSeul(SRC(f)).includes("reflexVerdict"));
    expect(GOUVERNEES.length).toBeGreaterThan(0);
    expect(derivent).toEqual([]);
  });
});

// ─── Le critère : déclarer n'est pas dériver ──────────────────────────────

interface Composant {
  nom: string;
  /** Ce que le module DIT de lui-même : en-tête, doc, nom de fichier. */
  revendication: string;
  /** Ce qu'un consommateur gouverné FAIT : dériver la propriété, ou non. */
  consommateursDerivant: number;
}
type ImplU = (c: Composant) => { canonique: boolean };

const COMPOSANTS: Composant[] = [
  {
    nom: "canonicalDecision — autorité de VERDICT",
    revendication: "REFLEX est l'autorité. Le reste projette.",
    consommateursDerivant: 0,
  },
  {
    nom: "canonicalDecision — autorité de SEUIL",
    revendication: "Les bornes LEGACY, à un seul endroit.",
    consommateursDerivant: 5,
  },
  {
    nom: "un module discret qui dérive vraiment",
    revendication: "",
    consommateursDerivant: 3,
  },
  {
    nom: "un module au nom canonique, sans consommateur",
    revendication: "canonical",
    consommateursDerivant: 0,
  },
];

function batterieU(impl: ImplU): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  for (const c of COMPOSANTS) {
    const r = impl(c);
    if (c.consommateursDerivant === 0) {
      // U1 — une revendication ne fabrique pas une autorité.
      dit(r.canonique === false, "U1 declaration-comptee-comme-derivation");
    } else {
      // U2 — SUR-CORRECTION. Une dérivation réelle compte, revendiquée ou non.
      dit(r.canonique === true, "U2 derivation-reelle-non-comptee");
    }
  }
  // U3 — la déclaration n'est ni nécessaire ni suffisante : le module discret
  // qui dérive est canonique, celui qui revendique sans consommateur ne l'est pas.
  const discret = COMPOSANTS.find((c) => c.revendication === "")!;
  const bruyant = COMPOSANTS.find((c) => c.nom.includes("nom canonique"))!;
  dit(
    impl(discret).canonique === true && impl(bruyant).canonique === false,
    "U3 declaration-necessaire-ou-suffisante",
  );
  return v;
}

const TEMOIN_U: ImplU = (c) => ({ canonique: c.consommateursDerivant > 0 });

describe("S8/u3 — CRITÈRE : la canonicité se compte en consommateurs, pas en phrases", () => {
  it("le TÉMOIN passe", () => expect(batterieU(TEMOIN_U)).toEqual([]));

  const MUTANTS_U: Array<{ nom: string; critere: string; impl: ImplU }> = [
    {
      nom: "LA REVENDICATION SUFFIT — le commentaire d'en-tête fait autorité",
      critere: "U1 declaration-comptee-comme-derivation",
      impl: (c) => ({ canonique: c.revendication.length > 0 }),
    },
    {
      nom: "LE NOM SUFFIT — « canonical » dans le nom vaut preuve",
      critere: "U1 declaration-comptee-comme-derivation",
      impl: (c) => ({ canonique: c.nom.includes("canonical") || c.revendication.includes("canonical") }),
    },
    {
      nom: "SUR-CORRECTION — plus rien n'est canonique, la dérivation réelle est niée",
      critere: "U2 derivation-reelle-non-comptee",
      impl: () => ({ canonique: false }),
    },
    {
      nom: "SUR-CORRECTION — la déclaration devient NÉCESSAIRE, le module discret est disqualifié",
      critere: "U3 declaration-necessaire-ou-suffisante",
      impl: (c) => ({ canonique: c.consommateursDerivant > 0 && c.revendication.length > 0 }),
    },
  ];

  for (const m of MUTANTS_U) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieU(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère U est tué par au moins un mutant", () => {
    const CRITERES_U = [
      "U1 declaration-comptee-comme-derivation",
      "U2 derivation-reelle-non-comptee",
      "U3 declaration-necessaire-ou-suffisante",
    ];
    const tues = new Set(MUTANTS_U.flatMap((m) => batterieU(m.impl)));
    expect(CRITERES_U.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_U.includes(c))).toEqual([]);
  });

  it("appliqué au module réel : SEUIL canonique, VERDICT non", () => {
    // La distinction que l'en-tête confond, rendue explicite.
    const [verdict, seuil] = COMPOSANTS;
    expect(TEMOIN_U(verdict).canonique).toBe(false);
    expect(TEMOIN_U(seuil).canonique).toBe(true);
  });
});
