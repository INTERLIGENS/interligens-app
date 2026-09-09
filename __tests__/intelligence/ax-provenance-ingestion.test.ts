// ─── AX — PROVENANCE D'INGESTION : LE CINQUIÈME FACTEUR ────────────────────
//
// ██  Une source enregistrée ne prouve pas qu'une observation a été ingérée. ██
//
// Le modèle d'autorité passe de quatre facteurs à cinq :
//   AUTORITÉ DE SOURCE × PROVENANCE D'INGESTION × CYCLE DE VIE OBSERVATION
//   × CYCLE DE VIE ENTITÉ × AUDIENCE
//
// Fait mesuré : `forta` porte 3 observations du 2026-04-08 avec ZÉRO lot
// d'ingestion — écriture hors pipeline — et `forta` est présent au registre,
// donc le prédicat actuel les laisse passer. Le facteur manquant n'est pas la
// source : c'est la preuve que l'observation est PASSÉE PAR LE PIPELINE.
//
// ─── Une contrainte de schéma à connaître avant de coder ──────────────────
//
// Mesuré dans `prisma/schema.prod.prisma` : `SourceObservation` n'a AUCUNE
// clé étrangère vers `IngestionBatch`. Le lien est indirect —
// `IngestionBatch.sourceId → SourceRegistry.id`, et `SourceObservation.sourceSlug`
// rejoint `SourceRegistry.handle` par une CHAÎNE. La provenance ne peut donc
// pas être lue sur la ligne d'observation : elle doit être ÉTABLIE EN AMONT et
// passée au prédicat comme un fait. La batterie juge le prédicat, pas la façon
// dont ce fait est calculé.
//
// ─── Le témoin ────────────────────────────────────────────────────────────
//
// `TEMOIN` implémente le prédicat. Il ne délègue à aucun prédicat réel : le
// but est de juger la propriété, pas l'implémentation d'aujourd'hui.

// ─── ATTRIBUABILITÉ — largeur mesurée avant de compter un mutant ──────────
//
//   PRÉCIS (1)   X3 · X4 · X5 · X6
//   COUPLÉS (2)  X1 · X1b · X5b — laisser passer une observation non prouvée
//                EST un jugement de niveau source (X4) ; émettre `MEASURED`
//                sort NÉCESSAIREMENT du cycle ratifié (X5). Le second critère
//                est le sous-critère du premier.
//   LARGE        X2 (4) — refuser tout casse aussi l'audience interne et les
//                motifs, et c'est correct
//
// Aucun mutant ne meurt par accident.

import { describe, it, expect } from "vitest";

// ═══ VOCABULAIRE RATIFIÉ ═════════════════════════════════════════════════

/**
 * Le cycle de vie d'une source, dans l'ordre. `MEASURED` n'en fait PAS partie :
 * c'est un état de requête ou d'exécution, jamais une identité de source.
 */
const CYCLE_DE_VIE_SOURCE = [
  "DECLARED", "SCHEDULED", "REGISTERED", "EXECUTED", "PROVENANCED", "ADMISSIBLE",
] as const;
type EtatSource = (typeof CYCLE_DE_VIE_SOURCE)[number];

type Audience = "INTERNAL" | "RETAIL";

type Refus =
  | "OBSERVATION_INACTIVE"
  | "ENTITY_INACTIVE"
  | "SOURCE_NOT_ADMISSIBLE"
  | "UNPROVEN_INGESTION_PROVENANCE";

interface Observation {
  id: string;
  sourceSlug: string;
  listIsActive: boolean;
  /** Établi en amont : cette observation vient-elle d'un lot gouverné ? */
  ingestionProvenance: "PROVENANCED" | "UNPROVEN";
}

interface Entite { isActive: boolean; displaySafety: string }

interface Politique { registered: boolean; publiable: boolean }

interface Resultat {
  retenues: string[];
  refusees: Array<{ id: string; refus: Refus }>;
  /** L'état de source atteint. Doit venir du vocabulaire ratifié. */
  etatSource: Record<string, EtatSource>;
}

type Predicat = (a: {
  entite: Entite;
  observations: readonly Observation[];
  audience: Audience;
  politique: Map<string, Politique>;
}) => Resultat;

// ═══ FIXTURES ════════════════════════════════════════════════════════════
//
// Toutes MESURÉES, sauf mention. Les volumes viennent de la campagne AM.

const ENTITE_VIVANTE: Entite = { isActive: true, displaySafety: "INTERNAL_ONLY" };

const POLITIQUE = new Map<string, Politique>([
  // `forta` EST au registre et publiable — c'est tout le problème : le
  // prédicat de source seul les laisse passer.
  ["forta", { registered: true, publiable: true }],
  ["ofac", { registered: true, publiable: true }],
  ["scamsniffer", { registered: true, publiable: true }],
  ["goplus", { registered: false, publiable: false }],
]);

/** MESURÉE — les 3 observations `forta` du 2026-04-08, zéro lot d'ingestion. */
const FORTA_SANS_LOT: Observation[] = [1, 2, 3].map((n) => ({
  id: `forta-${n}`, sourceSlug: "forta", listIsActive: true,
  ingestionProvenance: "UNPROVEN",
}));

/** MESURÉE — `ofac` : 29 lots, 869 observations. Échantillon représentatif. */
const OFAC_AVEC_LOT: Observation[] = [1, 2].map((n) => ({
  id: `ofac-${n}`, sourceSlug: "ofac", listIsActive: true,
  ingestionProvenance: "PROVENANCED",
}));

/** MESURÉE — `scamsniffer` : 32 lots, 341 195 observations. */
const SCAMSNIFFER_AVEC_LOT: Observation[] = [{
  id: "ss-1", sourceSlug: "scamsniffer", listIsActive: true,
  ingestionProvenance: "PROVENANCED" as const,
}];

/**
 * CONSTRUITE — deux observations de la MÊME source, l'une prouvée, l'autre non.
 * Aucune source connue ne présente aujourd'hui ce mélange : `forta` est
 * intégralement sans lot, `ofac` et `scamsniffer` intégralement avec. Elle
 * existe pour discriminer un jugement d'INSTANCE d'un jugement de SOURCE —
 * sans elle, un prédicat de niveau source survivrait à tous les autres tests.
 */
const MIXTE_MEME_SOURCE: Observation[] = [
  { id: "mix-ok", sourceSlug: "ofac", listIsActive: true, ingestionProvenance: "PROVENANCED" },
  { id: "mix-ko", sourceSlug: "ofac", listIsActive: true, ingestionProvenance: "UNPROVEN" },
];

// ═══ LE TÉMOIN ═══════════════════════════════════════════════════════════

const TEMOIN: Predicat = ({ entite, observations, audience, politique }) => {
  const retenues: string[] = [];
  const refusees: Array<{ id: string; refus: Refus }> = [];
  const etatSource: Record<string, EtatSource> = {};

  for (const o of observations) {
    const pol = politique.get(o.sourceSlug);
    etatSource[o.sourceSlug] =
      !pol?.registered ? "DECLARED"
        : o.ingestionProvenance === "UNPROVEN" ? "REGISTERED"
          : pol.publiable ? "ADMISSIBLE" : "PROVENANCED";

    if (!o.listIsActive) { refusees.push({ id: o.id, refus: "OBSERVATION_INACTIVE" }); continue; }

    // INTERNE — la provenance non prouvée ne masque RIEN à un analyste. Le
    // durcissement vise le retail ; neutraliser l'audience interne serait la
    // sur-correction, et c'est la première chose qu'un analyste veut voir.
    if (audience === "INTERNAL") { retenues.push(o.id); continue; }

    if (!entite.isActive) { refusees.push({ id: o.id, refus: "ENTITY_INACTIVE" }); continue; }

    // ██ LE CINQUIÈME FACTEUR — jugé sur L'INSTANCE, pas sur la source.
    if (o.ingestionProvenance !== "PROVENANCED") {
      refusees.push({ id: o.id, refus: "UNPROVEN_INGESTION_PROVENANCE" });
      continue;
    }
    if (!pol?.publiable) { refusees.push({ id: o.id, refus: "SOURCE_NOT_ADMISSIBLE" }); continue; }
    retenues.push(o.id);
  }
  return { retenues, refusees, etatSource };
};

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

const retail = (obs: readonly Observation[], impl: Predicat) =>
  impl({ entite: ENTITE_VIVANTE, observations: obs, audience: "RETAIL", politique: POLITIQUE });

function batterie(impl: Predicat): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // ── X1 · une observation SANS lot n'est pas retail-admissible ─────────
  const forta = retail(FORTA_SANS_LOT, impl);
  dit(forta.retenues.length === 0, "X1 source-seule-suffit");
  dit(
    forta.refusees.every((r) => r.refus === "UNPROVEN_INGESTION_PROVENANCE"),
    "X1b motif-aplati",
  );

  // ── X2 · SUR-CORRECTION — celles AVEC lot passent toutes ──────────────
  const ofac = retail(OFAC_AVEC_LOT, impl);
  const ss = retail(SCAMSNIFFER_AVEC_LOT, impl);
  dit(ofac.retenues.length === 2 && ss.retenues.length === 1, "X2 observation-prouvee-refusee");

  // ── X3 · SUR-CORRECTION — l'audience INTERNE n'est pas neutralisée ────
  const interne = impl({
    entite: ENTITE_VIVANTE, observations: FORTA_SANS_LOT,
    audience: "INTERNAL", politique: POLITIQUE,
  });
  dit(interne.retenues.length === 3, "X3 audience-interne-neutralisee");

  // ── X4 · le prédicat juge L'INSTANCE, pas la source ───────────────────
  const mixte = retail(MIXTE_MEME_SOURCE, impl);
  dit(
    mixte.retenues.includes("mix-ok") &&
      mixte.refusees.some((r) => r.id === "mix-ko" && r.refus === "UNPROVEN_INGESTION_PROVENANCE"),
    "X4 jugement-de-niveau-source",
  );

  // ── X5 · le vocabulaire ratifié, et MEASURED qui n'en fait pas partie ─
  const etats = Object.values({ ...forta.etatSource, ...ofac.etatSource, ...ss.etatSource });
  dit(
    etats.every((e) => (CYCLE_DE_VIE_SOURCE as readonly string[]).includes(e)),
    "X5 vocabulaire-hors-cycle",
  );
  dit(!etats.includes("MEASURED" as EtatSource), "X5b MEASURED-comme-etat-de-source");

  // ── X6 · une observation inactive reste refusée pour SA raison ────────
  const inactive = retail(
    [{ ...OFAC_AVEC_LOT[0], id: "off-1", listIsActive: false }], impl);
  dit(
    inactive.refusees.some((r) => r.refus === "OBSERVATION_INACTIVE"),
    "X6 cycle-de-vie-observation-ecrase",
  );

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("AX/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", () => {
    expect(batterie(TEMOIN)).toEqual([]);
  });

  it("MEASURED n'appartient pas au cycle de vie d'une source", () => {
    expect(CYCLE_DE_VIE_SOURCE as readonly string[]).not.toContain("MEASURED");
    expect(CYCLE_DE_VIE_SOURCE).toEqual([
      "DECLARED", "SCHEDULED", "REGISTERED", "EXECUTED", "PROVENANCED", "ADMISSIBLE",
    ]);
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Predicat }

const MUTANTS: Mutant[] = [
  {
    nom: "██ LE DÉFAUT ACTUEL — le prédicat juge la SOURCE seule",
    critere: "X1 source-seule-suffit",
    impl: (a) => {
      const r = TEMOIN(a);
      const rattrapees = r.refusees.filter((x) => x.refus === "UNPROVEN_INGESTION_PROVENANCE");
      return {
        ...r,
        retenues: [...r.retenues, ...rattrapees.map((x) => x.id)],
        refusees: r.refusees.filter((x) => x.refus !== "UNPROVEN_INGESTION_PROVENANCE"),
      };
    },
  },
  {
    nom: "le motif est APLATI en « source non admissible »",
    critere: "X1b motif-aplati",
    impl: (a) => {
      const r = TEMOIN(a);
      return {
        ...r,
        refusees: r.refusees.map((x) =>
          x.refus === "UNPROVEN_INGESTION_PROVENANCE"
            ? { ...x, refus: "SOURCE_NOT_ADMISSIBLE" as Refus } : x),
      };
    },
  },
  {
    nom: "SUR-CORRECTION — toute observation est refusée, lot ou pas",
    critere: "X2 observation-prouvee-refusee",
    impl: (a) => ({
      retenues: [],
      refusees: a.observations.map((o) => ({ id: o.id, refus: "UNPROVEN_INGESTION_PROVENANCE" as Refus })),
      etatSource: TEMOIN(a).etatSource,
    }),
  },
  {
    nom: "██ SUR-CORRECTION — le durcissement neutralise l'audience INTERNE",
    critere: "X3 audience-interne-neutralisee",
    impl: (a) => {
      const r = TEMOIN({ ...a, audience: "RETAIL" });
      return a.audience === "INTERNAL" ? r : TEMOIN(a);
    },
  },
  {
    nom: "██ retour à un jugement de NIVEAU SOURCE — une source « propre » couvre tout",
    critere: "X4 jugement-de-niveau-source",
    impl: (a) => {
      // La source a des lots quelque part, donc toutes ses observations
      // passent. C'est exactement l'erreur : le lot d'à côté ne prouve rien
      // sur CETTE ligne.
      const sourcesAvecLot = new Set(
        a.observations.filter((o) => o.ingestionProvenance === "PROVENANCED")
          .map((o) => o.sourceSlug),
      );
      const r = TEMOIN(a);
      const rattrapees = r.refusees.filter(
        (x) => x.refus === "UNPROVEN_INGESTION_PROVENANCE" &&
          sourcesAvecLot.has(a.observations.find((o) => o.id === x.id)!.sourceSlug));
      return {
        ...r,
        retenues: [...r.retenues, ...rattrapees.map((x) => x.id)],
        refusees: r.refusees.filter((x) => !rattrapees.includes(x)),
      };
    },
  },
  {
    nom: "un état hors du cycle de vie ratifié est émis",
    critere: "X5 vocabulaire-hors-cycle",
    impl: (a) => {
      const r = TEMOIN(a);
      return {
        ...r,
        etatSource: Object.fromEntries(
          Object.keys(r.etatSource).map((k) => [k, "INGESTED" as EtatSource])),
      };
    },
  },
  {
    nom: "██ `MEASURED` est employé comme état de SOURCE",
    critere: "X5b MEASURED-comme-etat-de-source",
    impl: (a) => {
      const r = TEMOIN(a);
      return {
        ...r,
        etatSource: Object.fromEntries(
          Object.entries(r.etatSource).map(([k, e]) =>
            [k, e === "ADMISSIBLE" ? ("MEASURED" as EtatSource) : e])),
      };
    },
  },
  {
    nom: "le cycle de vie de l'observation est écrasé par le nouveau facteur",
    critere: "X6 cycle-de-vie-observation-ecrase",
    impl: (a) => {
      const r = TEMOIN(a);
      return {
        ...r,
        refusees: r.refusees.map((x) =>
          x.refus === "OBSERVATION_INACTIVE"
            ? { ...x, refus: "UNPROVEN_INGESTION_PROVENANCE" as Refus } : x),
      };
    },
  },
];

describe("AX/1 — chaque mutant meurt, et sur la propriété visée", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterie(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }


  it("les 8 mutants sont déclarés, sans doublon de critère", () => {
    expect(MUTANTS).toHaveLength(8);
    expect(new Set(MUTANTS.map((m) => m.critere)).size).toBe(8);
  });
});
