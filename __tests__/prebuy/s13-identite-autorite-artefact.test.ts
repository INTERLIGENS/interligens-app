// ─── BUILD 12 · S13 — L'IDENTITÉ D'AUTORITÉ VIT DANS LE DOCUMENT ──────────
//
// ██  Z  · l'autorité d'un artefact se lit SUR l'artefact                   ██
// ██  AA · ce qui identifie un dossier, et ce qui distingue deux tirages    ██
//
// « Le CaseFile canonique doit PORTER SA PROPRE IDENTITÉ/AUTORITÉ. L'URL
//   source ou l'auth de la route NE SUFFISENT PAS. »
//
// ─── L'ÉTAT MESURÉ LE 2026-09-10, ET IL CONTIENT DEUX INVERSIONS ────────
//
//                          <title>          identité rendue    horodatage
//   pdfGenerator.ts        AUCUN            case_id en <h1>    DATE SEULE
//   (canonique interne)
//   pdfGeneratorPublic.ts  docTitle·ref     ref en couverture  DATE SEULE
//   (canonique public)
//   pdfRenderer.ts         INTERLIGENS      case_id + mint     DATE ET HEURE
//   (NON autoritaire)      CaseFile
//
//   INVERSION 1 — le document NON autoritaire porte le titre LE PLUS
//   officiel des trois ; le canonique interne n'a pas de <title> du tout.
//
//   INVERSION 2 — le document NON autoritaire s'horodate À LA MINUTE ; les
//   DEUX canoniques s'horodatent à la JOURNÉE (`toISOString().slice(0, 10)`,
//   pdfGenerator.ts:153 et pdfGeneratorPublic.ts:203). Deux tirages canoniques
//   du MÊME jour sont donc temporellement indistinguables — et le tirage non
//   autoritaire, lui, ne l'est pas.
//
//   Sur l'axe qui compte pour une citation par un conseil, l'artefact NON
//   AUTORITAIRE EST MIEUX IDENTIFIÉ QUE LE CANONIQUE.
//
// ─── TROU DE PREUVE, DÉCLARÉ ────────────────────────────────────────────
//
//   COMPORTEMENTAL : `renderCaseFilePDF` est une fonction pure — le document
//   NON autoritaire est rendu et inspecté pour de vrai.
//   LEXICAL, ANNONCÉ : `generateCaseFilePdf` et `generateCaseFilePdfPublic`
//   sont asynchrones et passent par puppeteer/chromium ; elles ne sont pas
//   exécutables depuis la suite. Ce qui est prouvé d'elles l'est sur leur
//   SOURCE — le gabarit, pas la pièce. Voir S11 pour la même distinction.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";

const SRC = (p: string) => readFileSync(p, "utf8");
/** ⚠ Les sondes lisent le CODE SEUL — une citation en commentaire ne compte pas. */
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const CANON_INTERNE = "src/lib/casefile/pdfGenerator.ts";
const CANON_PUBLIC = "src/lib/casefile/pdfGeneratorPublic.ts";
const NON_AUTORITAIRE = "src/components/pdf/pdfRenderer.ts";

const scanDe = (caseId: string, mint: string, quand: string): any => ({
  mint,
  scanned_at: quand,
  off_chain: { claims: [], source: "test", status: "Referenced", summary: "s", case_id: caseId },
  on_chain: {
    markets: {
      source: null, primary_pool: null, dex: null, url: null, price: null,
      liquidity_usd: null, volume_24h_usd: null, fdv_usd: null,
      fetched_at: quand, cache_hit: false,
    },
  },
  risk: { score: 50, tier: "ORANGE", flags: [], breakdown: { claim_penalty: 0, severity_multiplier: 1 } },
});

// ═════════════════════════════════════════════════════════════════════════
// S13/c — LES DEUX INVERSIONS, MESURÉES
// ═════════════════════════════════════════════════════════════════════════

describe("S13/c1 — INVERSION 1 : le titre le plus officiel est sur le non autoritaire", () => {
  it("COMPORTEMENTAL — le document non autoritaire s'intitule « INTERLIGENS CaseFile »", () => {
    const html = renderCaseFilePDF(scanDe("CASE-A", "MINT-A", "2026-09-10T11:22:33.000Z"), "en", null);
    expect(html).toContain("<title>INTERLIGENS CaseFile</title>");
  });

  it("LEXICAL — le canonique INTERNE n'a aucun `<title>`", () => {
    // ⚠ preuve lexicale d'une absence : la fonction passe par puppeteer.
    expect(codeSeul(SRC(CANON_INTERNE))).toContain("<!DOCTYPE html><html><head>");
    expect(codeSeul(SRC(CANON_INTERNE))).not.toContain("<title>");
  });

  it("LEXICAL — le canonique PUBLIC, lui, porte titre ET référence", () => {
    // Il est le seul des trois à faire les choses dans le bon ordre.
    expect(codeSeul(SRC(CANON_PUBLIC))).toContain("<title>${esc(copy.docTitle)} · ${esc(dossier.ref)}</title>");
    expect(codeSeul(SRC(CANON_PUBLIC))).toContain('class="cover-case"');
  });
});

describe("S13/c2 — INVERSION 2 : le non autoritaire s'horodate mieux que les canoniques", () => {
  it("LEXICAL — les DEUX canoniques s'horodatent à la JOURNÉE", () => {
    for (const g of [CANON_INTERNE, CANON_PUBLIC]) {
      expect(codeSeul(SRC(g)), g).toContain('new Date().toISOString().slice(0, 10)');
    }
  });

  it("COMPORTEMENTAL — le non autoritaire rend l'HEURE, donc deux tirages diffèrent", () => {
    const a = renderCaseFilePDF(scanDe("CASE-A", "MINT-A", "2026-09-10T11:22:33.000Z"), "en", null);
    const b = renderCaseFilePDF(scanDe("CASE-A", "MINT-A", "2026-09-10T18:45:00.000Z"), "en", null);
    expect(a).not.toBe(b);
  });

  it("CONSÉQUENCE — deux tirages canoniques du même jour n'ont aucun champ d'identité qui diffère", () => {
    // Ni version, ni horodatage à l'heure, ni numéro de tirage, dans aucun des
    // deux générateurs canoniques. Un conseil qui reçoit deux exemplaires ne
    // peut pas dire lequel est lequel.
    for (const g of [CANON_INTERNE, CANON_PUBLIC]) {
      const c = codeSeul(SRC(g));
      expect(c, `${g} porte un numéro de version de document`).not.toMatch(
        /doc(ument)?[_ ]?version|revision|tirage/i,
      );
    }
  });

  it("et aucun des trois ne porte de VERSION de document", () => {
    const html = renderCaseFilePDF(scanDe("CASE-A", "MINT-A", "2026-09-10T11:22:33.000Z"), "en", null);
    expect(html).not.toMatch(/version/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE Z · L'AUTORITÉ SE LIT SUR L'ARTEFACT
// ═════════════════════════════════════════════════════════════════════════

type Origine = "CANONIQUE" | "NON_CANONIQUE";
const ORIGINES: Origine[] = ["CANONIQUE", "NON_CANONIQUE"];

/**
 * La FACE d'un document : ce qu'un lecteur voit, et ce qui ne voyage pas.
 * `tampons(pages)` sert l'anti-surcharge : un marquage correct ne CROÎT PAS
 * avec la taille du document.
 */
interface Face {
  /** Ce qui établit l'autorité, VISIBLE sur la page. */
  identiteDansLeDocument: boolean;
  /** En-tête HTTP, nom de fichier seul, métadonnées non rendues. Ne voyage pas. */
  identiteHorsDocument: boolean;
  /** Une marque de NON autorité, visible. */
  marqueNonAutorite: boolean;
  /** Nombre de tampons visibles, pour un document de `pages` pages. */
  tampons: (pages: number) => number;
}
type ImplZ = (o: Origine) => Face;

function batterieZ(impl: ImplZ): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  const c = impl("CANONIQUE");
  const nc = impl("NON_CANONIQUE");

  // Z1 — le canonique porte, DANS le document, ce qui établit son autorité.
  dit(c.identiteDansLeDocument === true, "Z1 canonique-sans-identite");
  // Z2 — hors du document ne compte pas. Un nom de fichier se renomme, des
  // métadonnées se perdent à l'impression. Ce qui compte est ce qu'on VOIT.
  dit(!(c.identiteHorsDocument && !c.identiteDansLeDocument), "Z2 identite-hors-document");
  // Z3 — les deux faces doivent DIFFÉRER. Indistinguables, l'ambiguïté reste.
  dit(
    c.identiteDansLeDocument !== nc.identiteDansLeDocument ||
      c.marqueNonAutorite !== nc.marqueNonAutorite,
    "Z3 faces-indistinguables",
  );
  // Z4 — SUR-CORRECTION. Le canonique ne porte pas de marque de NON autorité.
  dit(c.marqueNonAutorite === false, "Z4 canonique-marque-non-autoritaire");
  // Z5 — SUR-CORRECTION. Le critère est la DISTINGUABILITÉ, pas la quantité
  // de tampons. Un marquage qui croît avec le nombre de pages alourdit le
  // livrable sans rien distinguer de plus — une marque au bloc d'identité
  // suffit, un tampon par page est du bruit imprimé.
  for (const o of ORIGINES) {
    const f = impl(o);
    dit(f.tampons(1) === f.tampons(40), "Z5 marquage-croit-avec-le-document");
  }
  return v;
}

const TEMOIN_Z: ImplZ = (o) => ({
  identiteDansLeDocument: o === "CANONIQUE",
  identiteHorsDocument: true,
  marqueNonAutorite: o === "NON_CANONIQUE",
  tampons: () => 1,
});

describe("S13/z — CRITÈRE : l'autorité se lit sur la page, et une fois suffit", () => {
  it("le TÉMOIN passe", () => expect(batterieZ(TEMOIN_Z)).toEqual([]));

  const MUTANTS_Z: Array<{ nom: string; critere: string; impl: ImplZ }> = [
    {
      nom: "LE DÉFAUT ACTUEL — aucune identité d'autorité dans aucun document",
      critere: "Z1 canonique-sans-identite",
      impl: () => ({
        identiteDansLeDocument: false, identiteHorsDocument: true,
        marqueNonAutorite: false, tampons: () => 0,
      }),
    },
    {
      nom: "l'autorité vit dans l'en-tête HTTP et le nom de fichier — pas dans la page",
      critere: "Z2 identite-hors-document",
      impl: (o) => ({ ...TEMOIN_Z(o), identiteDansLeDocument: false }),
    },
    {
      nom: "SUR-CORRECTION — le canonique est tamponné « non autoritaire » lui aussi",
      critere: "Z4 canonique-marque-non-autoritaire",
      impl: (o) => ({ ...TEMOIN_Z(o), marqueNonAutorite: true }),
    },
    {
      nom: "SUR-CORRECTION — un tampon par page, le livrable devient illisible",
      critere: "Z5 marquage-croit-avec-le-document",
      impl: (o) => ({ ...TEMOIN_Z(o), tampons: (pages: number) => pages }),
    },
    {
      nom: "les deux faces deviennent identiques — l'ambiguïté est intacte",
      critere: "Z3 faces-indistinguables",
      impl: () => ({
        identiteDansLeDocument: true, identiteHorsDocument: true,
        marqueNonAutorite: false, tampons: () => 1,
      }),
    },
  ];

  for (const m of MUTANTS_Z) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieZ(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère Z est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_Z = [
      "Z1 canonique-sans-identite",
      "Z2 identite-hors-document",
      "Z3 faces-indistinguables",
      "Z4 canonique-marque-non-autoritaire",
      "Z5 marquage-croit-avec-le-document",
    ];
    const tues = new Set(MUTANTS_Z.flatMap((m) => batterieZ(m.impl)));
    expect(CRITERES_Z.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_Z.includes(c))).toEqual([]);
    expect(ORIGINES).toHaveLength(2);
    expect(MUTANTS_Z.length).toBeGreaterThanOrEqual(5);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AA · CE QUI IDENTIFIE UN DOSSIER, ET CE QUI SÉPARE DEUX TIRAGES
// ═════════════════════════════════════════════════════════════════════════

/** Les champs d'identité d'un tirage. `null` = absent du document. */
interface Tirage {
  cible: string | null;
  ref: string | null;
  horodatage: string | null;
  version: string | null;
  /** Le document ÉNONCE-t-il que sa référence n'est pas stable ? */
  instabiliteEnoncee: boolean;
}
/** Deux tirages du MÊME dossier, à deux moments du même jour. */
type ImplAA = (cible: string, tirage: 1 | 2) => Tirage;

const champsIdentite = (t: Tirage) => [t.cible, t.ref, t.horodatage, t.version];

function batterieAA(impl: ImplAA): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  const a = impl("DOSSIER-X", 1);
  const b = impl("DOSSIER-X", 2);

  // AA1 — deux tirages du même dossier doivent différer sur AU MOINS un champ
  // d'identité. Deux dossiers indistinguables sur un bureau d'avocat sont un
  // problème réel, pas théorique.
  dit(
    champsIdentite(a).some((x, i) => x !== champsIdentite(b)[i]),
    "AA1 deux-tirages-indistinguables",
  );
  // AA2 — si la RÉFÉRENCE change entre deux tirages, le document doit le DIRE.
  // Une référence instable et muette casse toute citation.
  if (a.ref !== b.ref) {
    dit(a.instabiliteEnoncee && b.instabiliteEnoncee, "AA2 reference-instable-non-enoncee");
  }
  // AA3 — SUR-CORRECTION. Rendre deux tirages distinguables ne dispense pas
  // d'identifier la CIBLE : un document unique mais anonyme n'est pas citable.
  for (const t of [a, b]) {
    dit(t.cible !== null && t.cible.length > 0, "AA3 cible-absente");
  }
  // AA4 — SUR-CORRECTION. L'unicité ne doit pas venir d'un champ qui rend le
  // document non reproductible sans le dire : si TOUT diffère, y compris la
  // référence, sans énoncé, on a échangé un problème contre un autre.
  dit(
    !(champsIdentite(a).every((x, i) => x !== champsIdentite(b)[i]) && !a.instabiliteEnoncee),
    "AA4 tout-diffère-sans-énoncé",
  );
  return v;
}

/** Le témoin : référence STABLE, horodatage à la minute, version de tirage. */
const TEMOIN_AA: ImplAA = (cible, tirage) => ({
  cible,
  ref: `${cible}-REF`,
  horodatage: tirage === 1 ? "2026-09-10T11:22Z" : "2026-09-10T18:45Z",
  version: `v${tirage}`,
  instabiliteEnoncee: false,
});

describe("S13/aa — CRITÈRE : deux tirages se distinguent, et la cible reste nommée", () => {
  it("le TÉMOIN passe", () => expect(batterieAA(TEMOIN_AA)).toEqual([]));

  const MUTANTS_AA: Array<{ nom: string; critere: string; impl: ImplAA }> = [
    {
      nom: "LE DÉFAUT ACTUEL — date seule, pas de version : deux tirages du même jour identiques",
      critere: "AA1 deux-tirages-indistinguables",
      impl: (cible) => ({
        cible, ref: `${cible}-REF`, horodatage: "2026-09-10", version: null,
        instabiliteEnoncee: false,
      }),
    },
    {
      nom: "la référence change d'un tirage à l'autre, en silence",
      critere: "AA2 reference-instable-non-enoncee",
      impl: (cible, tirage) => ({ ...TEMOIN_AA(cible, tirage), ref: `${cible}-REF-${tirage}` }),
    },
    {
      nom: "SUR-CORRECTION — les tirages sont uniques mais la cible a disparu",
      critere: "AA3 cible-absente",
      impl: (cible, tirage) => ({ ...TEMOIN_AA(cible, tirage), cible: null }),
    },
    {
      nom: "SUR-CORRECTION — TOUT diffère, référence comprise, sans le dire",
      critere: "AA4 tout-diffère-sans-énoncé",
      impl: (cible, tirage) => ({
        cible: `${cible}-${tirage}`, ref: `R${tirage}`,
        horodatage: `T${tirage}`, version: `v${tirage}`, instabiliteEnoncee: false,
      }),
    },
  ];

  for (const m of MUTANTS_AA) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAA(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AA est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_AA = [
      "AA1 deux-tirages-indistinguables",
      "AA2 reference-instable-non-enoncee",
      "AA3 cible-absente",
      "AA4 tout-diffère-sans-énoncé",
    ];
    const tues = new Set(MUTANTS_AA.flatMap((m) => batterieAA(m.impl)));
    expect(CRITERES_AA.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AA.includes(c))).toEqual([]);
    expect(MUTANTS_AA.length).toBeGreaterThanOrEqual(4);
  });

  it("l'état d'aujourd'hui, passé à la batterie : le canonique MEURT sur AA1", () => {
    // Date seule des deux côtés, aucune version : deux tirages canoniques du
    // même jour ne se distinguent par aucun champ d'identité.
    const AUJOURDHUI: ImplAA = (cible) => ({
      cible, ref: `${cible}-REF`, horodatage: "2026-09-10", version: null,
      instabiliteEnoncee: false,
    });
    expect(batterieAA(AUJOURDHUI)).toEqual(["AA1 deux-tirages-indistinguables"]);
  });
});
