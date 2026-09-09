// ─── AU — LA SOURCE DÉCLARÉE ET JAMAIS EXÉCUTÉE : CORPUS ADVERSE ──────────
//
// ██  Déclarer n'est pas exécuter. Ne pas avoir cherché n'est pas n'avoir   ██
// ██  rien trouvé.                                                          ██
//
// Quatre sources intel sont NOT_ARMED — amf, fca, forta, goplus. Deux sont des
// régulateurs. Aucune n'a jamais exécuté un lot.
//
// ─── CORRECTION DE PRÉMISSE, mesurée par T1 en base ───────────────────────
//
// « Déclarées au registre » était FAUX pour trois d'entre elles. DÉCLARÉE (en
// code, avec un poids) et ENREGISTRÉE (ligne `SourceRegistry`) sont DEUX AXES
// distincts, et l'état réel les sépare :
//
//   amf       DECLARED ✅ (0,18 · TIER 1) · SCHEDULED ✅ (0 8 * * 1) · REGISTERED ❌
//   fca       DECLARED ✅ (0,18 · TIER 1) · SCHEDULED ❌ · REGISTERED ❌
//   goplus    DECLARED ✅ (0,15)          · REGISTERED ❌
//   goplusec  DECLARED ❌                 · REGISTERED ✅ 2026-03-19
//   forta     DECLARED ✅ (0,10)          · REGISTERED ✅ 2026-03-19 · hors pipeline
//
// ██ `goplus` et `goplusec` sont DEUX DEMI-SOURCES QUI NE SE RENCONTRENT
// JAMAIS : l'une déclarée sans entrée au registre, l'autre enregistrée sans
// déclaration. Le cycle doit donc supporter REGISTERED SANS DECLARED — ce
// n'est pas un ordre linéaire, ce sont des axes qui peuvent diverger.
// C'est le cas extrême de la garde permanente : ici la provenance n'est pas
// seulement incompétente pour établir la propriété, elle N'EXISTE PAS.
//
// ─── ATTRIBUABILITÉ — largeur mesurée avant de compter un mutant ──────────
//
// 16 mutants, trois axes.
//
//   PRÉCIS (1)   A2 · A3 · A3b · A4 · A4b · B5 · C1 · C3 · C4
//   COUPLÉS (2)  A1 — traiter DECLARED comme ADMISSIBLE saute aussi des états
//                B1 · B2 · B2b — toucher au jeton d'absence fait tomber le
//                critère de motif, qui en est le sous-critère
//                B4 — gonfler le dénominateur gonfle aussi le périmètre vide
//   LARGES       B3b (3) et C2 (3), à raison : annoncer un périmètre non
//                vérifié casse les trois contrôles de périmètre, et une garde
//                qui ne voit rien échoue sur les trois détections
//
// ██ LE MUTANT QUI COMPTE, ET IL EST PRÉCIS : « la garde ne cherche que le
// littéral GoPlus » meurt sur C3, et sur lui seul. Il est DÉCLARÉ INSUFFISANT
// dans son intitulé — il passe la page GoPlus et laisse filer la page Forta,
// qui porte exactement la même faute sous un autre libellé. C'est le faux vert
// par sous-chaîne, déjà attrapé deux fois ailleurs.
//
// ⚠ UNE GARDE VIVANTE ROUGE, DÉLIBÉRÉMENT — voir AU/2 en fin de fichier.
//
// ─── Trou de preuve déclaré ───────────────────────────────────────────────
//
// Je n'ai AUCUN accès base depuis ce worktree : aucun `.env.local`. L'ensemble
// des sources ayant réellement tourné est donc INJECTÉ — sa provenance est
// désormais la mesure directe de T1, plus le rapport du watchdog. Si cet
// ensemble change, les gardes le suivent sans être réécrites. Ce que je prouve
// est le PRÉDICAT, jamais l'état de la base.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MEASUREMENT_STATES } from "@/lib/publication/absenceVocabulary";

// ═══ VOCABULAIRE RATIFIÉ ═════════════════════════════════════════════════

const CYCLE = ["DECLARED", "SCHEDULED", "REGISTERED", "EXECUTED", "PROVENANCED", "ADMISSIBLE"] as const;
type EtatCycle = (typeof CYCLE)[number];
const rang = (e: EtatCycle) => CYCLE.indexOf(e);

/** Les six sources du registre code, et leur palier. */
const SOURCES = {
  ofac: 1, amf: 1, fca: 1, scamsniffer: 2, forta: 2, goplus: 2,
} as const;
type Slug = keyof typeof SOURCES;

/**
 * INJECTÉ — provenance : MESURE DIRECTE EN BASE par T1, qui supersède le
 * rapport du watchdog cité dans la version précédente de ce fichier. Aucune
 * des quatre n'a jamais exécuté un lot.
 *
 * La règle ne change pas : je prouve le PRÉDICAT, jamais l'état de la base.
 * Mais l'état injecté a désormais une meilleure provenance qu'un rapport.
 */
const SOURCES_AVEC_RUN: ReadonlySet<Slug> = new Set<Slug>(["ofac", "scamsniffer"]);

// ═══ AXE A — DÉCLARER N'EST PAS EXÉCUTER ═════════════════════════════════

interface FaitsSource {
  slug: Slug;
  /** Déclarée EN CODE, avec un poids de scoring. */
  declareeEnCode: boolean;
  /** Présente comme LIGNE dans `SourceRegistry`. Axe DISTINCT du précédent. */
  enregistree: boolean;
  cronArme: boolean;
  aTourne: boolean;
  /** Instant du dernier run. `null` = âge NON MESURABLE, pas « ancien ». */
  dernierRunAt: Date | null;
}

interface EtatDeSource {
  etat: EtatCycle;
  /** `null` quand l'âge n'est pas mesurable. Jamais un nombre par défaut. */
  ageJours: number | null;
  fraicheur: "FRESH" | "STALE" | "NOT_MEASURABLE";
}

type Cycleur = (f: FaitsSource) => EtatDeSource;

const TEMOIN_CYCLE: Cycleur = (f) => {
  // Les deux axes peuvent DIVERGER — `goplus` déclarée sans entrée, `goplusec`
  // enregistrée sans déclaration. Aucun des deux n'atteint EXECUTED sans run,
  // et une moitié ne vaut jamais un tout.
  const etat: EtatCycle =
    !f.aTourne
      ? (f.cronArme ? "SCHEDULED" : f.enregistree ? "REGISTERED" : "DECLARED")
      : "EXECUTED";
  // L'âge se mesure sur un run. Sans run, il n'est pas « grand » : il n'existe
  // pas. C'est le motif fermé en BUILD 11, transposé aux sources.
  const ageJours = f.dernierRunAt === null ? null : 3;
  return {
    etat,
    ageJours,
    fraicheur: ageJours === null ? "NOT_MEASURABLE" : ageJours <= 14 ? "FRESH" : "STALE",
  };
};

const SRC = (o: Partial<FaitsSource> & Pick<FaitsSource, "slug">): FaitsSource => ({
  declareeEnCode: true, enregistree: false, cronArme: false,
  aTourne: false, dernierRunAt: null, ...o,
});

/** MESURÉ — `goplus` : déclarée en code, PAS enregistrée, aucun run. */
const GOPLUS = SRC({ slug: "goplus" });
/** MESURÉ — `amf` : déclarée, cron hebdomadaire armé, PAS enregistrée, aucun run. */
const AMF = SRC({ slug: "amf", cronArme: true });
/** MESURÉ — `forta` : déclarée ET enregistrée le 2026-03-19, hors pipeline. */
const FORTA = SRC({ slug: "forta", enregistree: true });
/**
 * MESURÉ — `goplusec` : ENREGISTRÉE le 2026-03-19 sans être déclarée en code.
 * L'autre moitié de `goplus`. Le cycle doit la représenter sans la confondre
 * avec une source complète.
 */
const GOPLUSEC = SRC({ slug: "goplus", declareeEnCode: false, enregistree: true });
/** MESURÉ — `ofac` : déclarée, enregistrée, cron quotidien, runs réels. */
const OFAC = SRC({
  slug: "ofac", enregistree: true, cronArme: true, aTourne: true, dernierRunAt: new Date(),
});

function batterieCycle(impl: Cycleur): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // A1 — une source DECLARED n'a produit aucune couverture
  dit(rang(impl(GOPLUS).etat) < rang("EXECUTED"), "A1 declaree-traitee-comme-executee");

  // A2 — aucun état n'est SAUTÉ : sans run, on ne dépasse pas SCHEDULED
  dit(rang(impl(AMF).etat) < rang("EXECUTED"), "A2 etat-saute");

  // A3 — un âge NON MESURABLE n'est pas FRESH
  dit(impl(GOPLUS).fraicheur === "NOT_MEASURABLE", "A3 age-non-mesurable-devenu-fresh");
  dit(impl(GOPLUS).ageJours === null, "A3b age-par-defaut");

  // A5 — DEUX DEMI-SOURCES : ni l'une ni l'autre n'atteint EXECUTED, et elles
  // ne sont pas confondues avec une source complète.
  dit(rang(impl(GOPLUSEC).etat) < rang("EXECUTED"), "A5 demi-source-traitee-comme-complete");
  dit(rang(impl(FORTA).etat) < rang("EXECUTED"), "A5b enregistree-traitee-comme-executee");

  // A4 — SUR-CORRECTION : une source réellement exécutée n'est pas refusée
  dit(rang(impl(OFAC).etat) >= rang("EXECUTED"), "A4 executee-refusee");
  dit(impl(OFAC).fraicheur === "FRESH", "A4b executee-declaree-non-mesurable");

  return v;
}

// ═══ AXE B — ABSENCE DE MESURE ≠ RIEN TROUVÉ ═════════════════════════════

interface Couverture {
  /** Les sources RÉELLEMENT vérifiées. Le périmètre du no-match. */
  sourcesVerifiees: Slug[];
  /** L'état d'absence, tiré d'absenceVocabulary. Jamais aplati. */
  etatParSource: Record<string, string>;
  /** Dénominateur du taux de couverture. */
  denominateur: number;
}

type Couvreur = (slugs: readonly Slug[], avecRun: ReadonlySet<Slug>) => Couverture;

const TEMOIN_COUVERTURE: Couvreur = (slugs, avecRun) => {
  const verifiees = slugs.filter((s) => avecRun.has(s));
  return {
    sourcesVerifiees: verifiees,
    etatParSource: Object.fromEntries(
      slugs.map((s) => [s, avecRun.has(s) ? "MEASURED" : "NOT_MEASURED"]),
    ),
    // Une source sans run n'entre pas au dénominateur : l'y mettre ferait
    // passer une couverture inexistante pour une couverture partielle.
    denominateur: verifiees.length,
  };
};

const TOUS: Slug[] = ["ofac", "amf", "fca", "scamsniffer", "forta", "goplus"];

function batterieCouverture(impl: Couvreur): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };
  const c = impl(TOUS, SOURCES_AVEC_RUN);

  // B1 — une source jamais exécutée n'est pas « mesurée, rien trouvé »
  dit(c.etatParSource.goplus !== "MEASURED", "B1 jamais-executee-rendue-mesuree");
  dit(c.etatParSource.goplus === "NOT_MEASURED", "B1b motif-de-l-absence-perdu");

  // B2 — les deux jetons d'absence ne s'aplatissent pas l'un sur l'autre
  dit(c.etatParSource.goplus !== "NOT_APPLICABLE", "B2 not-measured-aplati-sur-not-applicable");
  dit(
    Object.values(c.etatParSource).every((e) =>
      (MEASUREMENT_STATES as readonly string[]).includes(e)),
    "B2b vocabulaire-hors-absenceVocabulary",
  );

  // B3 — AU2 : le périmètre annoncé est le périmètre RÉELLEMENT vérifié
  dit(
    c.sourcesVerifiees.every((s) => SOURCES_AVEC_RUN.has(s)),
    "B3 perimetre-annonce-non-verifie",
  );
  dit(c.sourcesVerifiees.length === 2, "B3b perimetre-gonfle");

  // B4 — le dénominateur n'inclut pas une source sans run
  dit(c.denominateur === 2, "B4 denominateur-inclut-une-source-sans-run");

  // B5 — SUR-CORRECTION : un périmètre vide n'est pas rendu comme complet
  const rien = impl(TOUS, new Set<Slug>());
  dit(rien.sourcesVerifiees.length === 0 && rien.denominateur === 0, "B5 perimetre-vide-rendu-complet");

  return v;
}

// ═══ AXE C — REVENDICATION PUBLIÉE vs CAPACITÉ RÉELLE ════════════════════
//
// Le témoin lit les DEUX locales et raisonne sur la CLASSE, pas sur une
// chaîne. Une revendication est fautive quand elle NOMME une source du
// registre qui n'a jamais tourné — quel que soit son libellé.

const PAGES = [
  "src/app/en/methodology/tigerscore/page.tsx",
  "src/app/fr/methodology/tigerscore/page.tsx",
] as const;

const squelette = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Extrait les libellés de capacité annoncés par une page. */
export function revendications(source: string): string[] {
  return [...source.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** Les sources du registre NOMMÉES par une revendication, quel que soit le libellé. */
function sourcesNommees(libelles: readonly string[]): Slug[] {
  const out = new Set<Slug>();
  for (const l of libelles) {
    const sq = squelette(l);
    for (const s of Object.keys(SOURCES) as Slug[]) {
      if (sq.includes(squelette(s))) out.add(s);
    }
  }
  return [...out];
}

type Garde = (pages: readonly string[], avecRun: ReadonlySet<Slug>) => Slug[];

/** Rend les sources revendiquées SANS run. Vide = conforme. */
const TEMOIN_GARDE: Garde = (pages, avecRun) => {
  const nommees = new Set<Slug>();
  for (const p of pages) for (const s of sourcesNommees(revendications(p))) nommees.add(s);
  return [...nommees].filter((s) => !avecRun.has(s));
};

// ─── Fixtures de page ─────────────────────────────────────────────────────

const PAGE_CONFORME = `
  { code: "OFAC / Sanctions check", desc: "Screened against 332K+ sanctioned entities." },
  { code: "Scam Sniffer", desc: "Third-party scam-address database integration." },
`;
/** La revendication réelle, aujourd'hui, sur les deux locales. */
const PAGE_GOPLUS = PAGE_CONFORME + `\n  { code: "GoPlus", desc: "Honeypot and phishing contract detection." },`;
/**
 * CONSTRUITE — la MÊME faute, une AUTRE source. C'est elle qui démasque un
 * témoin qui ne chercherait que « GoPlus ».
 */
const PAGE_FORTA = PAGE_CONFORME + `\n  { code: "Forta Scam Detector", desc: "Real-time on-chain threat detection." },`;

function batterieGarde(impl: Garde): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  dit(impl([PAGE_CONFORME], SOURCES_AVEC_RUN).length === 0, "C1 page-conforme-signalee");
  dit(impl([PAGE_GOPLUS], SOURCES_AVEC_RUN).includes("goplus"), "C2 revendication-sans-run-non-vue");
  // ██ LE CRITÈRE DE CLASSE — une autre source, la même faute.
  dit(impl([PAGE_FORTA], SOURCES_AVEC_RUN).includes("forta"), "C3 garde-limitee-a-un-libelle");
  // Les deux locales, pas une seule.
  dit(impl([PAGE_CONFORME, PAGE_GOPLUS], SOURCES_AVEC_RUN).includes("goplus"), "C4 seconde-locale-ignoree");

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("AU/0 — les trois batteries sont satisfiables", () => {
  it("les TÉMOINS passent", () => {
    expect(batterieCycle(TEMOIN_CYCLE)).toEqual([]);
    expect(batterieCouverture(TEMOIN_COUVERTURE)).toEqual([]);
    expect(batterieGarde(TEMOIN_GARDE)).toEqual([]);
  });

  it("MEASURED et NOT_MEASURED appartiennent bien au vocabulaire ratifié", () => {
    for (const e of ["MEASURED", "NOT_MEASURED", "NOT_APPLICABLE"]) {
      expect(MEASUREMENT_STATES as readonly string[]).toContain(e);
    }
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

const M_CYCLE: Array<{ nom: string; critere: string; impl: Cycleur }> = [
  {
    nom: "██ une source DECLARED est traitée comme si elle avait produit une couverture",
    critere: "A1 declaree-traitee-comme-executee",
    impl: (f) => ({ ...TEMOIN_CYCLE(f), etat: "ADMISSIBLE" }),
  },
  {
    nom: "un état est SAUTÉ — cron armé donc réputé exécuté",
    critere: "A2 etat-saute",
    impl: (f) => (f.cronArme ? { ...TEMOIN_CYCLE(f), etat: "PROVENANCED" } : TEMOIN_CYCLE(f)),
  },
  {
    nom: "██ un âge NON MESURABLE est rendu FRESH",
    critere: "A3 age-non-mesurable-devenu-fresh",
    impl: (f) => ({ ...TEMOIN_CYCLE(f), fraicheur: "FRESH" }),
  },
  {
    nom: "l'âge absent reçoit une valeur par défaut de 0 jour",
    critere: "A3b age-par-defaut",
    impl: (f) => ({ ...TEMOIN_CYCLE(f), ageJours: TEMOIN_CYCLE(f).ageJours ?? 0 }),
  },
  {
    nom: "██ une DEMI-SOURCE enregistrée sans déclaration est traitée comme complète",
    critere: "A5 demi-source-traitee-comme-complete",
    impl: (f) => (f.enregistree && !f.declareeEnCode
      ? { ...TEMOIN_CYCLE(f), etat: "PROVENANCED" } : TEMOIN_CYCLE(f)),
  },
  {
    nom: "être ENREGISTRÉE est confondu avec avoir EXÉCUTÉ",
    critere: "A5b enregistree-traitee-comme-executee",
    impl: (f) => (f.enregistree ? { ...TEMOIN_CYCLE(f), etat: "EXECUTED" } : TEMOIN_CYCLE(f)),
  },
  {
    nom: "SUR-CORRECTION — une source réellement EXECUTED est refusée",
    critere: "A4 executee-refusee",
    impl: (f) => ({ ...TEMOIN_CYCLE(f), etat: "DECLARED" }),
  },
  {
    nom: "SUR-CORRECTION — même une source qui a tourné est dite non mesurable",
    critere: "A4b executee-declaree-non-mesurable",
    impl: (f) => ({ ...TEMOIN_CYCLE(f), fraicheur: "NOT_MEASURABLE" }),
  },
];

const M_COUV: Array<{ nom: string; critere: string; impl: Couvreur }> = [
  {
    nom: "██ une source jamais exécutée est rendue « mesurée, rien trouvé »",
    critere: "B1 jamais-executee-rendue-mesuree",
    impl: (s, r) => ({
      ...TEMOIN_COUVERTURE(s, r),
      etatParSource: Object.fromEntries(s.map((x) => [x, "MEASURED"])),
    }),
  },
  {
    nom: "NOT_MEASURED est APLATI sur NOT_APPLICABLE",
    critere: "B2 not-measured-aplati-sur-not-applicable",
    impl: (s, r) => {
      const c = TEMOIN_COUVERTURE(s, r);
      return {
        ...c,
        etatParSource: Object.fromEntries(
          Object.entries(c.etatParSource).map(([k, e]) =>
            [k, e === "NOT_MEASURED" ? "NOT_APPLICABLE" : e])),
      };
    },
  },
  {
    nom: "██ AU2 — le périmètre annoncé inclut des sources qui n'ont pas tourné",
    critere: "B3b perimetre-gonfle",
    impl: (s, r) => ({ ...TEMOIN_COUVERTURE(s, r), sourcesVerifiees: [...s] }),
  },
  {
    nom: "██ le DÉNOMINATEUR inclut une source sans run",
    critere: "B4 denominateur-inclut-une-source-sans-run",
    impl: (s, r) => ({ ...TEMOIN_COUVERTURE(s, r), denominateur: s.length }),
  },
  {
    nom: "SUR-CORRECTION — un périmètre vide est rendu comme complet",
    critere: "B5 perimetre-vide-rendu-complet",
    impl: (s, r) => {
      const c = TEMOIN_COUVERTURE(s, r);
      return c.sourcesVerifiees.length === 0
        ? { ...c, sourcesVerifiees: [...s], denominateur: s.length } : c;
    },
  },
  {
    nom: "un jeton hors du vocabulaire d'absence",
    critere: "B2b vocabulaire-hors-absenceVocabulary",
    impl: (s, r) => {
      const c = TEMOIN_COUVERTURE(s, r);
      return {
        ...c,
        etatParSource: Object.fromEntries(
          Object.entries(c.etatParSource).map(([k, e]) =>
            [k, e === "NOT_MEASURED" ? "NO_RUN" : e])),
      };
    },
  },
];

const M_GARDE: Array<{ nom: string; critere: string; impl: Garde }> = [
  {
    nom: "██ INSUFFISANT PAR CONSTRUCTION — la garde ne cherche que le littéral « GoPlus »",
    critere: "C3 garde-limitee-a-un-libelle",
    impl: (pages) => (pages.some((p) => p.includes("GoPlus")) ? ["goplus"] : []),
  },
  {
    nom: "la garde ne lit que la première locale",
    critere: "C4 seconde-locale-ignoree",
    impl: (pages, r) => TEMOIN_GARDE(pages.slice(0, 1), r),
  },
  {
    nom: "la garde ne voit aucune revendication fautive",
    critere: "C2 revendication-sans-run-non-vue",
    impl: () => [],
  },
  {
    nom: "SUR-CORRECTION — toute source nommée est signalée, run ou pas",
    critere: "C1 page-conforme-signalee",
    impl: (pages) => {
      const n = new Set<Slug>();
      for (const p of pages) for (const s of sourcesNommees(revendications(p))) n.add(s);
      return [...n];
    },
  },
];

describe("AU/1 — chaque mutant meurt sur sa propriété", () => {
  for (const m of M_CYCLE) {
    it(`MEURT — ${m.nom}`, () => {
      const v = batterieCycle(m.impl);
      expect(v, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(v, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
  for (const m of M_COUV) {
    it(`MEURT — ${m.nom}`, () => {
      const v = batterieCouverture(m.impl);
      expect(v, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(v, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
  for (const m of M_GARDE) {
    it(`MEURT — ${m.nom}`, () => {
      const v = batterieGarde(m.impl);
      expect(v, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(v, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }
});



// ═══ LA GARDE VIVANTE — sur les pages RÉELLES, EN et FR ══════════════════

describe("AU/2 — garde vivante sur les surfaces servies", () => {
  it("les deux locales sont lues, et leur structure est celle attendue", () => {
    for (const p of PAGES) {
      const r = revendications(readFileSync(p, "utf8"));
      expect(r.length, p).toBeGreaterThan(10);
    }
  });

  it("aucune source du registre SANS RUN n'est revendiquée comme capacité", () => {
    // ⚠ GARDE VIVANTE. Elle rougit tant que la revendication est servie, et
    // elle verdit dès que T1 la retire — sans être réécrite. Le message nomme
    // la source, pas une chaîne : la classe est gardée, pas le libellé.
    const fautives = TEMOIN_GARDE(
      PAGES.map((p) => readFileSync(p, "utf8")),
      SOURCES_AVEC_RUN,
    );
    expect(
      fautives,
      "sources revendiquées sur /methodology/tigerscore sans aucun run en base",
    ).toEqual([]);
  });
});
