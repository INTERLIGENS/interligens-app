// ─── BUILD 12 · S14 — CE QUE LE DOCUMENT PROMET, ET CE QU'IL PEUT TENIR ───
//
// ██  AB · le document dit CE QU'IL EST, jamais CE QU'IL VAUT               ██
// ██  AC · l'empreinte dit DE QUOI elle est l'empreinte                     ██
// ██  AD · deux faits temporels, pas un                                     ██
//
// « VISUAL AUTHORITY MUST NOT CONTRADICT GOVERNED AUTHORITY. » Et la limite
// ferme : « STOP BEFORE USING WORDING IMPLYING LEGAL CERTIFICATION SUCH AS
// "OFFICIAL FORENSIC REPORT". »
//
// ─── AB N'A PAS DE DÉFAUT À CONSTATER, ET IL FAUT LE DIRE ───────────────
//
// Mesuré le 2026-09-10 : les deux seules occurrences d'un vocabulaire de
// certification dans les trois générateurs sont EN COMMENTAIRE —
// « dark internal forensic report » (pdfGeneratorPublic.ts:6, en-tête) et
// « la valeur probante de cette page DÉPENDAIT de la signature »
// (pdfGeneratorPublic.ts:622, note expliquant pourquoi la section est RETIRÉE).
// Aucune n'est rendue. AB est donc un axe PRÉVENTIF, pas un constat : il arme
// une limite avant qu'on l'approche, au moment précis où l'on s'apprête à
// ajouter des affirmations d'autorité au canonique. Inventer ici un défaut
// pour faire nombre serait exactement ce que la discipline interdit.
//
// ─── AC EST PIRE QUE LE PIÈGE SIGNALÉ, ET DE DEUX FAÇONS ────────────────
//
// `admin/graph/cases/[id]/pdf/route.ts:23-26` :
//
//   const payload = JSON.stringify({ nodes, edges, generated: new Date().toISOString() })
//   const sha256  = createHash('sha256').update(payload).digest('hex')
//   const html    = renderGraphPDF(graphCase, lang, sha256)
//
// et le gabarit rend, en pied de page et en corps : « SHA-256: <hex> ».
//
//   (1) L'ÉTIQUETTE NE DIT PAS SON SUJET. Un lecteur qui voit « SHA-256 » sur
//       une pièce d'allure forensique lira l'empreinte DU DOCUMENT. Elle est
//       celle de la donnée source — le piège annoncé.
//
//   (2) ET ELLE N'EST MÊME PAS UNE EMPREINTE DE SOURCE UTILISABLE : le payload
//       haché contient `generated: new Date().toISOString()`. Deux exécutions
//       sur le MÊME GraphCase produisent DEUX empreintes différentes. Elle ne
//       peut donc rien vérifier : ni le document, ni la source. Un champ non
//       déterministe dans le payload transforme une garantie de
//       reproductibilité en nonce imprimé sur un livrable juridique.
//
// ─── AD · TROISIÈME INVERSION, MÊME MOTIF QUE LES DEUX DE S13 ───────────
//
//                          génération   snapshot
//   pdfGenerator.ts             1           0
//   pdfGeneratorPublic.ts       5           0
//   pdfRenderer.ts (NON aut.)   0           4
//
// AUCUN des trois ne porte les DEUX faits, et chacun porte celui qui manque à
// l'autre. Les canoniques disent quand le DOCUMENT a été fabriqué, jamais de
// quand datent les DONNÉES ; le non autoritaire dit l'inverse. Un dossier
// canonique daté du 10 septembre ne dit pas si ses données sont du 10
// septembre ou de mars.
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
const ROUTE_GRAPHE_PDF = "src/app/api/admin/graph/cases/[id]/pdf/route.ts";
const GABARIT_GRAPHE = "src/lib/pdf/graph/templateGraph.ts";
const GENERATEURS = [CANON_INTERNE, CANON_PUBLIC, NON_AUTORITAIRE] as const;

const scanMinimal = (quand: string): any => ({
  mint: "MINT-A", scanned_at: quand,
  off_chain: { claims: [], source: "t", status: "Referenced", summary: "s", case_id: "CASE-A" },
  on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null,
    liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, fetched_at: quand, cache_hit: false } },
  risk: { score: 50, tier: "ORANGE", flags: [], breakdown: { claim_penalty: 0, severity_multiplier: 1 } },
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AB · LE DOCUMENT DIT CE QU'IL EST, JAMAIS CE QU'IL VAUT
// ═════════════════════════════════════════════════════════════════════════

/** Le vocabulaire qui promet une valeur, et non une nature. */
const PROMESSES_INTERDITES =
  /official(ly)?\s+(forensic|report|certified)|certifi(ed|é|e)\b|sworn|notari[sz]|legally\s+(binding|admissible)|admissible\s+in\s+court|expert\s+(opinion|witness)|valeur\s+probante|rapport\s+officiel|force\s+probante/i;

describe("S14/ab1 — CONSTAT : aucune promesse de certification n'est RENDUE", () => {
  it("les trois générateurs sont nets, dans leur CODE", () => {
    // ⚠ code seul : deux occurrences existent en COMMENTAIRE dans le canonique
    // public, et elles n'atteignent aucun lecteur. Les compter serait la
    // quatrième forme du faux positif par citation.
    for (const g of GENERATEURS) {
      expect(codeSeul(SRC(g)), `${g} promet une valeur`).not.toMatch(PROMESSES_INTERDITES);
    }
  });

  it("COMPORTEMENTAL — le document non autoritaire, rendu, ne promet rien non plus", () => {
    const html = renderCaseFilePDF(scanMinimal("2026-09-10T11:22:33.000Z"), "en", null);
    expect(html).not.toMatch(PROMESSES_INTERDITES);
  });

  it("les occurrences en commentaire existent, et restent des commentaires", () => {
    // Le constat exact, pour qu'un lecteur ne croie pas la sonde aveugle.
    expect(SRC(CANON_PUBLIC)).toMatch(/forensic report/);
    expect(codeSeul(SRC(CANON_PUBLIC))).not.toMatch(/forensic report/);
  });
});

// ─── Le critère ──────────────────────────────────────────────────────────

type Regime = "CANONIQUE" | "NON_CANONIQUE";
interface Enonce {
  /** Ce que le document dit de sa NATURE. */
  nature: string;
  /** Ce qu'il dit de sa VALEUR — doit rester vide. */
  valeur: string;
}
type ImplAB = (r: Regime) => Enonce;

function batterieAB(impl: ImplAB): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  for (const r of ["CANONIQUE", "NON_CANONIQUE"] as Regime[]) {
    const e = impl(r);
    // AB1 — aucune promesse de valeur, dans aucun régime.
    dit(!PROMESSES_INTERDITES.test(`${e.nature} ${e.valeur}`), "AB1 promesse-de-valeur");
    // AB2 — l'autorité affichée ne contredit pas l'autorité gouvernée : une
    // surface non canonique ne se dit pas canonique.
    if (r === "NON_CANONIQUE") {
      dit(!/canonical|canonique/i.test(e.nature), "AB2 autorite-visuelle-contredit-gouvernee");
    }
  }
  // AB3 — SUR-CORRECTION. Le canonique DOIT dire qu'il est canonique. Une
  // règle qui interdirait toute affirmation d'autorité produirait un livrable
  // anonyme — c'est-à-dire le défaut d'aujourd'hui, atteint par l'autre bord.
  dit(/canonical|canonique/i.test(impl("CANONIQUE").nature), "AB3 canonique-anonyme");
  return v;
}

const TEMOIN_AB: ImplAB = (r) => ({
  nature: r === "CANONIQUE" ? "INTERLIGENS CaseFile · Canonical Artifact" : "INTERLIGENS scan export",
  valeur: "",
});

describe("S14/ab2 — CRITÈRE : nature affirmée, valeur jamais promise", () => {
  it("le TÉMOIN passe", () => expect(batterieAB(TEMOIN_AB)).toEqual([]));

  const MUTANTS_AB: Array<{ nom: string; critere: string; impl: ImplAB }> = [
    {
      nom: "le canonique se dit « Official Forensic Report »",
      critere: "AB1 promesse-de-valeur",
      impl: (r) => ({ ...TEMOIN_AB(r), nature: "INTERLIGENS Official Forensic Report" }),
    },
    {
      nom: "une mention de valeur probante s'ajoute au pied de page",
      critere: "AB1 promesse-de-valeur",
      impl: (r) => ({ ...TEMOIN_AB(r), valeur: "Ce document a valeur probante." }),
    },
    {
      nom: "le NON canonique se présente comme canonique",
      critere: "AB2 autorite-visuelle-contredit-gouvernee",
      impl: () => ({ nature: "INTERLIGENS CaseFile · Canonical Artifact", valeur: "" }),
    },
    {
      nom: "SUR-CORRECTION — plus aucune affirmation d'autorité, le canonique redevient anonyme",
      critere: "AB3 canonique-anonyme",
      impl: () => ({ nature: "INTERLIGENS CaseFile", valeur: "" }),
    },
  ];

  for (const m of MUTANTS_AB) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAB(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AB est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_AB = [
      "AB1 promesse-de-valeur",
      "AB2 autorite-visuelle-contredit-gouvernee",
      "AB3 canonique-anonyme",
    ];
    const tues = new Set(MUTANTS_AB.flatMap((m) => batterieAB(m.impl)));
    expect(CRITERES_AB.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AB.includes(c))).toEqual([]);
    expect(MUTANTS_AB.length).toBeGreaterThanOrEqual(4);
  });

  it("le vocabulaire neutre proposé passe la batterie", () => {
    // « INTERLIGENS CaseFile · Canonical Artifact » — nature, pas valeur.
    expect(batterieAB(TEMOIN_AB)).toEqual([]);
    expect(TEMOIN_AB("CANONIQUE").nature).toContain("Canonical Artifact");
    expect(PROMESSES_INTERDITES.test(TEMOIN_AB("CANONIQUE").nature)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AC · L'EMPREINTE DIT DE QUOI ELLE EST L'EMPREINTE
// ═════════════════════════════════════════════════════════════════════════

describe("S14/ac1 — CONSTAT : l'empreinte du PDF de graphe est muette ET instable", () => {
  it("le payload haché contient un champ NON DÉTERMINISTE", () => {
    const c = codeSeul(SRC(ROUTE_GRAPHE_PDF));
    expect(c).toContain("generated: new Date().toISOString()");
    expect(c).toContain("createHash('sha256').update(payload)");
  });

  it("CONSÉQUENCE — deux exécutions sur le MÊME cas donnent deux empreintes", () => {
    // Reproduction annoncée de l'expression du site (ancrée ci-dessus) : ce
    // qui est démontré est la propriété du payload, pas la route.
    const { createHash } = require("node:crypto");
    const nodes = [{ id: "n1" }], edges = [{ id: "e1" }];
    const empreinte = () =>
      createHash("sha256")
        .update(JSON.stringify({ nodes, edges, generated: new Date().toISOString() }))
        .digest("hex");
    const a = empreinte();
    // Un champ horodaté à la milliseconde suffit à séparer deux appels ; on
    // force l'écart pour que le test ne dépende pas de la vitesse d'exécution.
    const b = createHash("sha256")
      .update(JSON.stringify({ nodes, edges, generated: "2026-09-10T00:00:00.001Z" }))
      .digest("hex");
    expect(a).not.toBe(b);
  });

  it("et l'étiquette rendue ne dit PAS de quoi elle est l'empreinte", () => {
    const g = codeSeul(SRC(GABARIT_GRAPHE));
    expect(g).toContain("SHA-256: ${sha256}");
    // Aucun sujet nommé à côté : ni « source data », ni « graph case », ni rien.
    expect(g).not.toMatch(/SHA-256 (of|de|du) /i);
  });
});

// ─── Le critère ──────────────────────────────────────────────────────────

interface Empreinte {
  /** Ce que l'empreinte couvre RÉELLEMENT. */
  sujetReel: "DONNEE_SOURCE" | "DOCUMENT";
  /** Ce que l'étiquette ANNONCE. `null` = rien d'annoncé. */
  sujetAnnonce: "DONNEE_SOURCE" | "DOCUMENT" | null;
  /** Le payload haché est-il déterministe pour une même source ? */
  reproductible: boolean;
  affichee: boolean;
}
type ImplAC = () => Empreinte;

function batterieAC(impl: ImplAC): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const e = impl();

  if (e.affichee) {
    // AC1 — le sujet annoncé doit être le sujet réel. Le critère PRÉSUPPOSE
    // un sujet annoncé : muet, c'est AC2 qui mord, et pas les deux. Sans cette
    // garde, une étiquette muette déclenchait AC1 ET AC2, ce qui rendait AC1
    // impossible à isoler — un critère qui ne se déclenche jamais seul ne
    // localise rien.
    dit(e.sujetAnnonce === null || e.sujetAnnonce === e.sujetReel, "AC1 sujet-annonce-faux");
    // AC2 — et il doit être ANNONCÉ. Une empreinte muette sur une pièce
    // d'allure forensique se lit comme l'empreinte du document.
    dit(e.sujetAnnonce !== null, "AC2 empreinte-sans-sujet");
    // AC3 — revendiquer l'empreinte du PDF est structurellement impossible :
    // un document ne peut pas contenir son propre condensat.
    dit(e.sujetAnnonce !== "DOCUMENT", "AC3 empreinte-du-pdf-revendiquee");
    // AC4 — une empreinte affichée doit VÉRIFIER quelque chose. Non
    // reproductible, elle ne vérifie rien : c'est un nonce imprimé.
    dit(e.reproductible, "AC4 empreinte-non-reproductible-affichee");
  }
  // AC5 — SUR-CORRECTION. Une empreinte de source correctement désignée et
  // reproductible RESTE affichable : c'est une vraie garantie, on ne la retire
  // pas par prudence.
  const correcte: Empreinte = {
    sujetReel: "DONNEE_SOURCE", sujetAnnonce: "DONNEE_SOURCE", reproductible: true, affichee: true,
  };
  dit(batterieACInterne(correcte).length === 0, "AC5 empreinte-correcte-retiree");
  return v;
}

/** Le noyau, sans AC5, pour que la sur-correction puisse s'évaluer sans récursion. */
function batterieACInterne(e: Empreinte): string[] {
  const v: string[] = [];
  if (!e.affichee) return v;
  if (e.sujetAnnonce !== null && e.sujetAnnonce !== e.sujetReel) v.push("AC1 sujet-annonce-faux");
  if (e.sujetAnnonce === null) v.push("AC2 empreinte-sans-sujet");
  if (e.sujetAnnonce === "DOCUMENT") v.push("AC3 empreinte-du-pdf-revendiquee");
  if (!e.reproductible) v.push("AC4 empreinte-non-reproductible-affichee");
  return v;
}

const TEMOIN_AC: ImplAC = () => ({
  sujetReel: "DONNEE_SOURCE", sujetAnnonce: "DONNEE_SOURCE", reproductible: true, affichee: true,
});

describe("S14/ac2 — CRITÈRE : une empreinte nomme son sujet, et vérifie quelque chose", () => {
  it("le TÉMOIN passe", () => expect(batterieAC(TEMOIN_AC)).toEqual([]));

  const MUTANTS_AC: Array<{ nom: string; critere: string; impl: ImplAC }> = [
    {
      nom: "LE DÉFAUT ACTUEL — étiquette muette « SHA-256: <hex> »",
      critere: "AC2 empreinte-sans-sujet",
      impl: () => ({ ...TEMOIN_AC(), sujetAnnonce: null }),
    },
    {
      nom: "l'empreinte de source est présentée comme celle du document",
      critere: "AC1 sujet-annonce-faux",
      impl: () => ({ ...TEMOIN_AC(), sujetAnnonce: "DOCUMENT" }),
    },
    {
      nom: "LE DÉFAUT ACTUEL, second volet — payload horodaté, empreinte non reproductible",
      critere: "AC4 empreinte-non-reproductible-affichee",
      impl: () => ({ ...TEMOIN_AC(), reproductible: false }),
    },
    {
      nom: "SUR-CORRECTION — l'empreinte est retirée par prudence, la garantie disparaît",
      critere: "AC5 empreinte-correcte-retiree",
      impl: () => ({ ...TEMOIN_AC(), affichee: false }),
    },
  ];

  for (const m of MUTANTS_AC) {
    it(`MORD — ${m.nom}`, () => {
      // AC5 ne se déclenche que si la batterie NOYAU refuse une empreinte
      // correcte : le mutant « retirée » est donc évalué à part.
      const viol =
        m.critere === "AC5 empreinte-correcte-retiree"
          ? (m.impl().affichee ? [] : ["AC5 empreinte-correcte-retiree"])
          : batterieAC(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AC du noyau est tué", () => {
    const CRITERES_AC = [
      "AC1 sujet-annonce-faux",
      "AC2 empreinte-sans-sujet",
      "AC3 empreinte-du-pdf-revendiquee",
      "AC4 empreinte-non-reproductible-affichee",
    ];
    const cas: Empreinte[] = [
      { sujetReel: "DONNEE_SOURCE", sujetAnnonce: null, reproductible: true, affichee: true },
      { sujetReel: "DONNEE_SOURCE", sujetAnnonce: "DOCUMENT", reproductible: true, affichee: true },
      { sujetReel: "DONNEE_SOURCE", sujetAnnonce: "DONNEE_SOURCE", reproductible: false, affichee: true },
    ];
    const tues = new Set(cas.flatMap(batterieACInterne));
    expect(CRITERES_AC.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AC.includes(c))).toEqual([]);
  });

  it("l'état d'aujourd'hui MEURT sur les DEUX volets", () => {
    const AUJOURDHUI: Empreinte = {
      sujetReel: "DONNEE_SOURCE", sujetAnnonce: null, reproductible: false, affichee: true,
    };
    expect(batterieACInterne(AUJOURDHUI).sort()).toEqual([
      "AC2 empreinte-sans-sujet",
      "AC4 empreinte-non-reproductible-affichee",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AD · DEUX FAITS TEMPORELS, PAS UN
// ═════════════════════════════════════════════════════════════════════════

describe("S14/ad1 — CONSTAT : chacun porte le fait qui manque à l'autre", () => {
  it("les canoniques portent la GÉNÉRATION, jamais le SNAPSHOT", () => {
    for (const g of [CANON_INTERNE, CANON_PUBLIC]) {
      expect(codeSeul(SRC(g)), g).toMatch(/Generated|generatedOn/);
      expect(codeSeul(SRC(g)), `${g} porte un snapshot`).not.toMatch(
        /scanned_at|snapshot|computed_at/,
      );
    }
  });

  it("le NON autoritaire porte le SNAPSHOT, jamais la GÉNÉRATION", () => {
    const c = codeSeul(SRC(NON_AUTORITAIRE));
    expect(c).toMatch(/scanned_at/);
    expect(c).not.toMatch(/Generated:|generatedOn/);
  });

  it("aucun des trois ne porte les DEUX", () => {
    const porte = (g: string) => {
      const c = codeSeul(SRC(g));
      return {
        gen: /Generated|generatedOn/.test(c),
        snap: /scanned_at|snapshot|computed_at/.test(c),
      };
    };
    for (const g of GENERATEURS) {
      const p = porte(g);
      expect(p.gen && p.snap, `${g} porte les deux — le constat est périmé`).toBe(false);
    }
  });
});

// ─── Le critère ──────────────────────────────────────────────────────────

interface FaitsTemporels {
  /** Quand le DOCUMENT a été fabriqué. */
  generation: string | null;
  /** De quand datent les DONNÉES. */
  snapshot: string | null;
  /** Le snapshot dépend-il des DONNÉES, ou de l'instant du rendu ? */
  snapshotSuitLaDonnee: boolean;
}
type ImplAD = (tirage: 1 | 2) => FaitsTemporels;

const aLHeure = (s: string | null) => s !== null && /T\d{2}:\d{2}/.test(s);

function batterieAD(impl: ImplAD): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const a = impl(1), b = impl(2);

  // AD1 — les deux faits existent et sont DISTINCTS. Les confondre revient à
  // dater les données du jour où l'on a imprimé.
  for (const t of [a, b]) {
    dit(t.generation !== null && t.snapshot !== null, "AD1 un-seul-fait-porte");
  }
  dit(a.generation !== a.snapshot, "AD2 faits-temporels-confondus");
  // AD3 — granularité : à la journée, deux tirages du même jour ne se
  // distinguent pas. C'est AA1 de S13, tenu ici sur le fait de GÉNÉRATION.
  dit(aLHeure(a.generation), "AD3 granularite-a-la-journee");
  // AD4 — SUR-CORRECTION, et c'est AA4 appliqué au temps : le SNAPSHOT ne doit
  // pas bouger quand seule l'heure d'impression change. Sinon deux tirages du
  // même dossier semblent porter sur des données différentes, et la citation
  // devient impossible.
  dit(a.snapshot === b.snapshot && a.snapshotSuitLaDonnee, "AD4 snapshot-suit-l-horloge");
  return v;
}

const TEMOIN_AD: ImplAD = (tirage) => ({
  generation: tirage === 1 ? "2026-09-10T11:22:33Z" : "2026-09-10T18:45:00Z",
  snapshot: "2026-09-09T04:00:00Z",
  snapshotSuitLaDonnee: true,
});

describe("S14/ad2 — CRITÈRE : génération et snapshot, distincts et bien ancrés", () => {
  it("le TÉMOIN passe", () => expect(batterieAD(TEMOIN_AD)).toEqual([]));

  const MUTANTS_AD: Array<{ nom: string; critere: string; impl: ImplAD }> = [
    {
      nom: "LE DÉFAUT ACTUEL — un seul fait porté",
      critere: "AD1 un-seul-fait-porte",
      impl: (t) => ({ ...TEMOIN_AD(t), snapshot: null }),
    },
    {
      nom: "les deux faits sont confondus — la donnée est datée du jour de l'impression",
      critere: "AD2 faits-temporels-confondus",
      impl: (t) => {
        const g = TEMOIN_AD(t).generation;
        return { generation: g, snapshot: g, snapshotSuitLaDonnee: false };
      },
    },
    {
      nom: "LE DÉFAUT ACTUEL, second volet — granularité à la journée",
      critere: "AD3 granularite-a-la-journee",
      impl: (t) => ({ ...TEMOIN_AD(t), generation: "2026-09-10" }),
    },
    {
      nom: "SUR-CORRECTION — le snapshot suit l'horloge, deux tirages semblent porter sur des données différentes",
      critere: "AD4 snapshot-suit-l-horloge",
      impl: (t) => ({
        ...TEMOIN_AD(t),
        snapshot: t === 1 ? "2026-09-10T11:22:33Z" : "2026-09-10T18:45:00Z",
        snapshotSuitLaDonnee: false,
      }),
    },
  ];

  for (const m of MUTANTS_AD) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAD(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AD est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_AD = [
      "AD1 un-seul-fait-porte",
      "AD2 faits-temporels-confondus",
      "AD3 granularite-a-la-journee",
      "AD4 snapshot-suit-l-horloge",
    ];
    const tues = new Set(MUTANTS_AD.flatMap((m) => batterieAD(m.impl)));
    expect(CRITERES_AD.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AD.includes(c))).toEqual([]);
    expect(MUTANTS_AD.length).toBeGreaterThanOrEqual(4);
  });

  it("l'état canonique d'aujourd'hui MEURT sur AD1 et AD3", () => {
    const CANONIQUE_AUJOURDHUI: ImplAD = () => ({
      generation: "2026-09-10", snapshot: null, snapshotSuitLaDonnee: true,
    });
    const viol = batterieAD(CANONIQUE_AUJOURDHUI).sort();
    expect(viol).toContain("AD1 un-seul-fait-porte");
    expect(viol).toContain("AD3 granularite-a-la-journee");
  });
});
