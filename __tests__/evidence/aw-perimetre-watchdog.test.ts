// ─── AW — PÉRIMÈTRE DU WATCHDOG D'INTÉGRITÉ DE PREUVE : CORPUS ADVERSE ─────
//
// ██  Un watchdog n'inspecte que ce qui peut ENTRER dans la chaîne.        ██
//
// Règle ratifiée : « un watchdog d'intégrité de preuve n'inspecte que les
// artefacts RÉELLEMENT ÉLIGIBLES à entrer dans la chaîne de preuve. »
//
// Fait mesuré par T1 : la sonde porte `casefileId: null` et
// `evidentiaryStatus: "EXCLUDED"`, donc `eligibleForEvidenceChain` la refuse —
// et le watchdog la compte quand même. Une pièce hors chaîne bloque 34 TSA.
//
// ─── Le témoin, et ce qu'il ne fait pas ───────────────────────────────────
//
// `TEMOIN` implémente le watchdog. L'autorité d'éligibilité lui est INJECTÉE :
// la batterie juge le watchdog, jamais l'autorité. Et l'autorité injectée par
// défaut est la VRAIE — `eligibleForEvidenceChain` — pour qu'un mutant qui la
// réimplémente diverge d'elle et meure.

// ─── ATTRIBUABILITÉ — largeur mesurée avant de compter un mutant ──────────
//
//   PRÉCIS (1)   W1b · W4 · W5b · W6
//   COUPLÉS (2)  W2 · W3 · W5 — le second critère est une conséquence
//                nécessaire du premier, pas celui d'un voisin
//   LARGES       W1 (3) · W2b (5) — ils suppriment le bornage, ou tout
//
// Un mutant a dû être RÉÉCRIT : W1b était le mutant W3 à l'identique, à un
// `?? null` non opérant près. Deux mutants identiques ne prouvent pas deux
// propriétés.
//
// Une FIXTURE a dû être ajoutée : sans une pièce ÉLIGIBLE et SANS DOSSIER, le
// mutant qui restreint la population aux pièces rattachées SURVIVAIT. Trou de
// preuve mesuré, pas mutant inoffensif.

import { describe, it, expect } from "vitest";
import { eligibleForEvidenceChain } from "@/lib/evidence-chain/eligibility";

// ═══ CONTRAT ═════════════════════════════════════════════════════════════

interface Piece {
  id: string;
  evidentiaryStatus: string | null;
  casefileId: string | null;
  r2Key: string | null;
  notes: string | null;
  capturedBy: string | null;
}

/** L'autorité d'éligibilité, injectée. Par défaut : la canonique. */
type Eligibilite = (p: { evidentiaryStatus?: string | null }) => boolean;

interface RapportWatchdog {
  /** Combien de pièces le watchdog a réellement inspectées. */
  inspectees: number;
  /** Lesquelles — un compteur seul ne dit pas QUI a été écarté. */
  ids: string[];
  /** Sans octets ET sans marqueur : ce qui bloque la TSA. */
  orphelines: string[];
  /** Les deux clauses de marquage. Elles restent servies à population nulle. */
  hashOnly: number;
  r2Unavailable: number;
}

type Watchdog = (pieces: readonly Piece[], eligible: Eligibilite) => RapportWatchdog;

const MARQUEUR_R2 = "[R2:UNAVAILABLE]";
const MARQUEUR_HASH = "HASH-ONLY";

// ═══ FIXTURES ════════════════════════════════════════════════════════════

const p = (o: Partial<Piece> & Pick<Piece, "id">): Piece => ({
  evidentiaryStatus: null, casefileId: "case-1", r2Key: "r2/ok",
  notes: null, capturedBy: null, ...o,
});

/** MESURÉE — la sonde qui bloque 34 TSA : hors dossier, exclue, sans octets. */
const SONDE = p({
  id: "probe-1", evidentiaryStatus: "EXCLUDED", casefileId: null,
  r2Key: null, notes: null, capturedBy: "probe-postdeploy",
});

/** Une pièce complète et éligible. */
const COMPLETE = p({ id: "ok-1" });

/** Éligible, sans octets, marquée délibérément. */
const HASH_ONLY = p({ id: "h-1", r2Key: null, notes: `vision-ingest; ${MARQUEUR_HASH} (bytes non transmis)` });

/** Éligible, sans octets, panne R2 marquée. */
const R2_KO = p({ id: "r-1", r2Key: null, notes: `${MARQUEUR_R2} put failed` });

/** ██ L'ORPHELINE — éligible, sans octets, sans aucun marqueur. */
const ORPHELINE = p({ id: "orph-1", r2Key: null, notes: null });

/**
 * CONSTRUITE — un statut ni `null` ni `EXCLUDED`. Aucune ligne connue n'en
 * porte : elle existe pour discriminer l'autorité canonique, qui est
 * FAIL-CLOSED sur les états inconnus, d'une copie écrite `!== "EXCLUDED"`,
 * qui laisserait passer tout état futur.
 */
const STATUT_INCONNU = p({ id: "q-1", evidentiaryStatus: "QUARANTINED", r2Key: null, notes: null });

/**
 * CONSTRUITE — ÉLIGIBLE et pourtant nommée comme une sonde. Elle existe pour
 * qu'un filtre sur le nom se trahisse : il marcherait aujourd'hui et serait
 * faux le jour où une vraie pièce portera ce `capturedBy`.
 */
const ELIGIBLE_NOMMEE_SONDE = p({
  id: "ok-2", capturedBy: "probe-postdeploy", r2Key: null, notes: null,
});

/**
 * CONSTRUITE — ÉLIGIBLE et pourtant SANS dossier. L'autorité canonique ne lit
 * que `evidentiaryStatus` : une pièce non encore rattachée reste éligible.
 * Sans elle, le mutant qui restreint la population aux pièces rattachées
 * SURVIVAIT — mesuré, et c'était un trou de preuve, pas un mutant inoffensif.
 */
const ELIGIBLE_SANS_DOSSIER = p({ id: "ok-3", casefileId: null });

const CORPUS: Piece[] = [
  SONDE, COMPLETE, HASH_ONLY, R2_KO, ORPHELINE, STATUT_INCONNU, ELIGIBLE_SANS_DOSSIER,
];

// ═══ LE TÉMOIN ═══════════════════════════════════════════════════════════

const TEMOIN: Watchdog = (pieces, eligible) => {
  const pop = pieces.filter((x) => eligible(x));
  const sansOctets = pop.filter((x) => x.r2Key === null);
  const porteMarqueur = (x: Piece) =>
    (x.notes ?? "").includes(MARQUEUR_R2) || (x.notes ?? "").includes(MARQUEUR_HASH);
  return {
    inspectees: pop.length,
    ids: pop.map((x) => x.id),
    orphelines: sansOctets.filter((x) => !porteMarqueur(x)).map((x) => x.id),
    // Les deux clauses sont SERVIES même quand elles valent 0. Mesuré 0 sur
    // 1 104 pièces ne veut pas dire « inutile » : ça veut dire que rien n'est
    // tombé dans ce cas aujourd'hui.
    hashOnly: sansOctets.filter((x) => (x.notes ?? "").includes(MARQUEUR_HASH)).length,
    r2Unavailable: sansOctets.filter((x) => (x.notes ?? "").includes(MARQUEUR_R2)).length,
  };
};

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

function batterie(impl: Watchdog): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  const r = impl(CORPUS, eligibleForEvidenceChain);

  // W1 — un artefact NON ÉLIGIBLE n'entre pas dans la population
  dit(!r.orphelines.includes("probe-1"), "W1 non-eligible-compte");
  dit(r.inspectees === 5, "W1b population-mal-bornee");

  // W2 — un artefact ÉLIGIBLE y entre TOUJOURS (sur-correction)
  dit(r.orphelines.includes("orph-1") && r.ids.includes("ok-3"), "W2 eligible-ecarte");
  dit(impl([COMPLETE], eligibleForEvidenceChain).inspectees === 1, "W2b watchdog-n-inspecte-plus-rien");

  // W3 — le périmètre vient de L'AUTORITÉ, pas d'une copie.
  // Le discriminant est l'état INCONNU : la canonique est fail-closed, une
  // copie `!== "EXCLUDED"` le laisserait entrer.
  dit(!r.orphelines.includes("q-1"), "W3 autorite-reimplementee");

  // W4 — aucun cas particulier sur un nom de sonde ou un `capturedBy`
  const nommee = impl([ELIGIBLE_NOMMEE_SONDE], eligibleForEvidenceChain);
  dit(nommee.inspectees === 1 && nommee.orphelines.includes("ok-2"), "W4 filtre-sur-le-nom");

  // W5 — les deux clauses restent valides À POPULATION NULLE
  const vide = impl([], eligibleForEvidenceChain);
  dit(
    vide.hashOnly === 0 && vide.r2Unavailable === 0 &&
      Object.prototype.hasOwnProperty.call(vide, "hashOnly") &&
      Object.prototype.hasOwnProperty.call(vide, "r2Unavailable"),
    "W5 clauses-retirees-a-population-nulle",
  );
  dit(r.hashOnly === 1 && r.r2Unavailable === 1, "W5b clauses-ne-comptent-plus");

  // W6 — une pièce marquée n'est PAS une orpheline
  dit(!r.orphelines.includes("h-1") && !r.orphelines.includes("r-1"), "W6 marquee-comptee-orpheline");

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("AW/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", () => {
    expect(batterie(TEMOIN)).toEqual([]);
  });

  it("l'autorité utilisée est bien la canonique, pas une copie locale", () => {
    // Contrôle de la fixture discriminante : si `eligibleForEvidenceChain`
    // cessait d'être fail-closed, W3 ne prouverait plus rien.
    expect(eligibleForEvidenceChain({ evidentiaryStatus: null })).toBe(true);
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "EXCLUDED" })).toBe(false);
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "QUARANTINED" })).toBe(false);
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Watchdog }

const MUTANTS: Mutant[] = [
  {
    nom: "██ LE DÉFAUT ACTUEL — le watchdog inspecte TOUT, éligible ou non",
    critere: "W1 non-eligible-compte",
    impl: (pieces) => TEMOIN(pieces, () => true),
  },
  {
    // Première rédaction : `(x) => x.evidentiaryStatus !== "EXCLUDED"` — soit
    // EXACTEMENT le mutant W3 à un `?? null` près, qui n'est pas opérant ici.
    // Deux mutants identiques ne prouvent pas deux propriétés : celui-ci vise
    // désormais une faute distincte — la population est bien bornée, mais le
    // compteur publié ne la reflète pas.
    nom: "la population est correcte, le COMPTEUR publié ne l'est pas",
    critere: "W1b population-mal-bornee",
    impl: (pieces, eligible) => ({ ...TEMOIN(pieces, eligible), inspectees: pieces.length }),
  },
  {
    nom: "SUR-CORRECTION — le watchdog n'inspecte plus rien",
    critere: "W2b watchdog-n-inspecte-plus-rien",
    impl: () => ({ inspectees: 0, ids: [], orphelines: [], hashOnly: 0, r2Unavailable: 0 }),
  },
  {
    nom: "SUR-CORRECTION — seules les pièces rattachées à un dossier sont inspectées",
    critere: "W2 eligible-ecarte",
    impl: (pieces, eligible) =>
      TEMOIN(pieces.filter((x) => x.casefileId !== null), eligible),
  },
  {
    nom: "██ l'autorité est RÉIMPLÉMENTÉE à côté — `!== EXCLUDED`",
    critere: "W3 autorite-reimplementee",
    impl: (pieces) => TEMOIN(pieces, (x) => (x.evidentiaryStatus ?? null) !== "EXCLUDED"),
  },
  {
    nom: "██ cas particulier sur le nom de sonde — marche aujourd'hui, faux demain",
    critere: "W4 filtre-sur-le-nom",
    impl: (pieces, eligible) =>
      TEMOIN(pieces.filter((x) => x.capturedBy !== "probe-postdeploy"), eligible),
  },
  {
    nom: "les deux clauses de marquage sont RETIRÉES « puisqu'elles valent 0 »",
    critere: "W5 clauses-retirees-a-population-nulle",
    impl: (pieces, eligible) => {
      const { inspectees, ids, orphelines } = TEMOIN(pieces, eligible);
      return { inspectees, ids, orphelines } as unknown as RapportWatchdog;
    },
  },
  {
    nom: "les clauses subsistent mais ne comptent plus rien",
    critere: "W5b clauses-ne-comptent-plus",
    impl: (pieces, eligible) => ({ ...TEMOIN(pieces, eligible), hashOnly: 0, r2Unavailable: 0 }),
  },
  {
    nom: "une pièce MARQUÉE est comptée comme orpheline",
    critere: "W6 marquee-comptee-orpheline",
    impl: (pieces, eligible) => {
      const r = TEMOIN(pieces, eligible);
      return {
        ...r,
        orphelines: pieces.filter((x) => eligible(x) && x.r2Key === null).map((x) => x.id),
      };
    },
  },
];

describe("AW/1 — chaque mutant meurt, et sur la propriété visée", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, () => {
      const viol = batterie(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }


  it("les 9 mutants sont déclarés, sans doublon de critère", () => {
    expect(MUTANTS).toHaveLength(9);
    expect(new Set(MUTANTS.map((m) => m.critere)).size).toBe(9);
  });
});
