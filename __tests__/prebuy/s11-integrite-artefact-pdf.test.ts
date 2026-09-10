// ─── BUILD 12 · S11 — L'INTÉGRITÉ D'ARTEFACT DU PDF DE DOSSIER ────────────
//
// ██  V · une absence STRUCTURELLE ne se présente pas comme un résultat    ██
// ██      de mesure propre à la cible                                       ██
// ██  W · une INSTRUCTION SERVIE doit pouvoir aboutir                       ██
//
// Deux défauts de natures différentes dans la même section d'un livrable
// juridique. Mesurés le 2026-09-10 :
//
//   `graphReport` est TOUJOURS `null` — donc 100 % des PDF servis prennent la
//   branche d'absence (pdfRenderer.ts:301-310), qui imprime :
//
//     « 🕸 Scam Family Graph »
//     « Graph data unavailable for this token. »
//     « Re-run analysis with HELIUS_API_KEY configured. »
//
//   (a) « for this token » impute à la CIBLE une absence dont la cause est
//       STRUCTURELLE : la garde `gData?.version === "1.0"`
//       (report/casefile/route.ts:136) ne peut être satisfaite par AUCUN
//       jeton, parce que le producteur réel n'émet aucun champ `version`.
//
//   (b) « Re-run analysis with HELIUS_API_KEY configured » nomme un mécanisme
//       qui n'existe pas sur ce chemin. Ce n'est pas une absence mal typée,
//       c'est une INSTRUCTION ACTIONNABLE FAUSSE.
//
// ─── ET LA CAUSE EST PLUS NETTE QUE « LE REMÈDE EST FAUX » ───────────────
//
// Il y a DEUX producteurs de graphe, et la garde valide la forme de l'un
// contre la réponse de l'autre :
//
//   solanaGraph/engine.ts:20   construit `{version:"1.0", provider:{name:"Helius"}}`
//                              → et n'a AUCUN appelant dans tout src/. ORPHELIN.
//   scan/solana/graph/route.ts rend `provider: 'INTERLIGENS Graph DB'`, lit
//                              PRISMA, et n'émet AUCUN `version`.
//
// La route PDF interroge le second et valide contre le premier. L'instruction
// « configurez HELIUS_API_KEY » était donc VRAIE — pour un producteur qui a
// été débranché. C'est une instruction gelée au moment d'un remplacement de
// producteur, et c'est pour ça qu'elle est plausible et fausse à la fois.
//
// ─── TROU DE PREUVE, DÉCLARÉ ────────────────────────────────────────────
//
//   MESURABLE ICI : `renderCaseFilePDF` est une fonction pure qui rend une
//   chaîne HTML. Le GABARIT est donc prouvé COMPORTEMENTALEMENT, sur la vraie
//   fonction, avec `graphReport = null`.
//
//   NON MESURABLE ICI : la PIÈCE SERVIE. `report/casefile/route.ts` frappe la
//   base, fait deux `fetch` internes et rend un PDF ; elle n'est pas
//   exécutable depuis la suite. Que 100 % des PDF prennent cette branche est
//   établi par CHAÎNAGE — gabarit prouvé + garde et producteur prouvés
//   lexicalement — et non par exécution de la route.
//
//   Un test sur le renderer prouve le gabarit, pas la pièce. C'est dit ici,
//   et les assertions ne prétendent rien de plus.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const RENDERER = "src/components/pdf/pdfRenderer.ts";
const ROUTE_PDF = "src/app/api/report/casefile/route.ts";
const GRAPHE = "src/app/api/scan/solana/graph/route.ts";
const ENGINE = "src/lib/solanaGraph/engine.ts";

/** Le scan minimal, repris de src/lib/solanaGraph/__tests__/graph.test.ts. */
const scanMinimal = (): any => ({
  mint: "So11111111111111111111111111111111111111112",
  scanned_at: new Date().toISOString(),
  off_chain: { claims: [], source: "test", status: "Referenced", summary: "test", case_id: "TEST" },
  on_chain: {
    markets: {
      source: null, primary_pool: null, dex: null, url: null, price: null,
      liquidity_usd: null, volume_24h_usd: null, fdv_usd: null,
      fetched_at: new Date().toISOString(), cache_hit: false,
    },
  },
  risk: { score: 50, tier: "ORANGE", flags: [], breakdown: { claim_penalty: 0, severity_multiplier: 1 } },
});

// ═════════════════════════════════════════════════════════════════════════
// S11/c — LE CONSTAT, la moitié comportementale et la moitié lexicale
// ═════════════════════════════════════════════════════════════════════════

describe("S11/c1 — COMPORTEMENTAL : le gabarit, sur la vraie fonction", () => {
  it("sans rapport de graphe, le PDF impute l'absence à la CIBLE", () => {
    const html = renderCaseFilePDF(scanMinimal(), "en", null);
    expect(html).toContain("Scam Family Graph");
    expect(html).toContain("Graph data unavailable for this token.");
  });

  it("et sert une instruction nommant HELIUS_API_KEY", () => {
    const html = renderCaseFilePDF(scanMinimal(), "en", null);
    expect(html).toContain("Re-run analysis with HELIUS_API_KEY configured.");
  });

  it("la version française porte les deux mêmes défauts", () => {
    const html = renderCaseFilePDF(scanMinimal(), "fr", null);
    expect(html).toContain("Données graphe non disponibles pour ce token.");
    expect(html).toContain("Relancez l'analyse avec HELIUS_API_KEY configuré.");
  });

  it("la section est imprimée DANS LES DEUX CAS — l'absence n'est pas omise", () => {
    // Ce n'est pas un défaut en soi : imprimer la section est ce qui rend
    // l'absence visible. Le défaut est ce qu'elle DIT.
    const avec = renderCaseFilePDF(scanMinimal(), "en", {
      version: "1.0", overall_status: "CORROBORATED", clusters: [], related_projects: [],
      limits: {}, query: {}, provider: { name: "Helius" }, cache_hit: false,
    } as any);
    expect(avec).toContain("Scam Family Graph");
    expect(renderCaseFilePDF(scanMinimal(), "en", null)).toContain("Scam Family Graph");
  });
});

describe("S11/c2 — LEXICAL : la garde ne peut être satisfaite par aucun jeton", () => {
  it("la garde exige `version === \"1.0\"`", () => {
    expect(codeSeul(SRC(ROUTE_PDF))).toContain('if (gData?.version === "1.0") graphReport = gData;');
  });

  it("le producteur réellement interrogé n'émet AUCUN champ `version`", () => {
    // ⚠ PREUVE LEXICALE D'UNE ABSENCE — aucune exécution ne prouve une absence,
    // et cette route frappe la base.
    expect(codeSeul(SRC(ROUTE_PDF))).toContain("/api/scan/solana/graph?mint=");
    expect(codeSeul(SRC(GRAPHE))).not.toMatch(/version\s*:/);
  });

  it("le SEUL constructeur de `version: \"1.0\"` est un moteur ORPHELIN", () => {
    expect(codeSeul(SRC(ENGINE))).toContain('version:"1.0"');
    expect(codeSeul(SRC(ENGINE))).toContain('provider:{name:"Helius"');
    // Et rien ne l'importe : la garde valide la forme d'un producteur débranché.
    expect(APPELANTS_ENGINE).toEqual([]);
  });

  it("donc `graphReport` est TOUJOURS null, et c'est STRUCTUREL", () => {
    // Le chaînage, énoncé : garde exige `version`, producteur n'en émet pas,
    // seul émetteur orphelin ⇒ aucune valeur de jeton ne change l'issue.
    const gardeExigeVersion = codeSeul(SRC(ROUTE_PDF)).includes('gData?.version === "1.0"');
    const producteurEmetVersion = /version\s*:/.test(codeSeul(SRC(GRAPHE)));
    expect(gardeExigeVersion && !producteurEmetVersion).toBe(true);
  });
});

/**
 * Les appelants du moteur orphelin, résolus depuis les sources — pas asserté
 * à la main. Un import de `solanaGraph/engine` ferait rougir S11/c2.
 */
const FICHIERS_SRC: string[] = (() => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of require("node:fs").readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
      else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
    }
  };
  walk("src");
  return out;
})();

const APPELANTS_ENGINE = FICHIERS_SRC.filter(
  (f) => !f.startsWith("src/lib/solanaGraph/") && /solanaGraph\/engine/.test(SRC(f)),
);

// ═════════════════════════════════════════════════════════════════════════
// AXE V · UNE ABSENCE STRUCTURELLE N'EST PAS UN RÉSULTAT DE MESURE
// ═════════════════════════════════════════════════════════════════════════

/** Pourquoi il n'y a rien à montrer. Trois causes, trois vérités différentes. */
type Cause = "MESURE_ABOUTIE_RIEN_TROUVE" | "NON_MESURABLE_SUR_CE_CHEMIN" | "PANNE";
const CAUSES: Cause[] = ["MESURE_ABOUTIE_RIEN_TROUVE", "NON_MESURABLE_SUR_CE_CHEMIN", "PANNE"];

/** Ce que le document dit de l'absence. */
interface Rendu {
  /** À QUOI l'absence est imputée par le libellé servi. */
  impute: "LA_CIBLE" | "LE_CHEMIN" | "LA_PANNE" | "RIEN";
  /** Le libellé lui-même. Vide = l'absence a été effacée. */
  libelle: string;
}
type ImplV = (c: Cause) => Rendu;

function batterieV(impl: ImplV): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  for (const cause of CAUSES) {
    const r = impl(cause);
    // V1 — une absence structurelle ne s'impute pas à la cible.
    if (cause === "NON_MESURABLE_SUR_CE_CHEMIN") {
      dit(r.impute !== "LA_CIBLE", "V1 structurelle-imputee-a-la-cible");
    }
    // V3 — SUR-CORRECTION. On ne remplace pas une fausse attribution par un
    // silence : toute cause doit produire un libellé.
    dit(r.libelle.trim().length > 0, "V3 absence-effacee");
  }

  // V2 — les trois causes doivent être DISTINGUABLES dans le rendu. C'est
  // `absenceVocabulary` transposé au rendu documentaire : un lecteur doit
  // pouvoir savoir s'il lit « mesuré, rien trouvé » ou « non mesurable ici ».
  const images = new Set(CAUSES.map((c) => `${impl(c).impute}|${impl(c).libelle}`));
  dit(images.size === CAUSES.length, "V2 causes-indistinguables");

  // V4 — SUR-CORRECTION. Une absence RÉELLEMENT mesurée et propre à la cible
  // doit pouvoir se dire comme telle. Interdire toute imputation à la cible
  // serait l'autre mur.
  dit(impl("MESURE_ABOUTIE_RIEN_TROUVE").impute === "LA_CIBLE", "V4 mesure-reelle-non-disable");
  return v;
}

const TEMOIN_V: ImplV = (c) =>
  c === "MESURE_ABOUTIE_RIEN_TROUVE"
    ? { impute: "LA_CIBLE", libelle: "No scam-family links found for this token." }
    : c === "NON_MESURABLE_SUR_CE_CHEMIN"
      ? { impute: "LE_CHEMIN", libelle: "Graph analysis is not available on this report path." }
      : { impute: "LA_PANNE", libelle: "Graph analysis did not complete for this report." };

describe("S11/v — CRITÈRE : l'absence dit sa cause, et ne l'invente pas", () => {
  it("le TÉMOIN passe", () => expect(batterieV(TEMOIN_V)).toEqual([]));

  const MUTANTS_V: Array<{ nom: string; critere: string; impl: ImplV }> = [
    {
      nom: "LE DÉFAUT ACTUEL — « unavailable for this token » quelle que soit la cause",
      critere: "V1 structurelle-imputee-a-la-cible",
      impl: () => ({ impute: "LA_CIBLE", libelle: "Graph data unavailable for this token." }),
    },
    {
      nom: "les trois causes rendues par un libellé unique — indistinguables",
      critere: "V2 causes-indistinguables",
      impl: (c) => ({
        impute: c === "MESURE_ABOUTIE_RIEN_TROUVE" ? "LA_CIBLE" : "LE_CHEMIN",
        libelle: "No data.",
      }),
    },
    {
      nom: "SUR-CORRECTION — l'absence est effacée, la section devient muette",
      critere: "V3 absence-effacee",
      impl: () => ({ impute: "RIEN", libelle: "" }),
    },
    {
      nom: "SUR-CORRECTION — plus rien ne peut être imputé à la cible, même mesuré",
      critere: "V4 mesure-reelle-non-disable",
      impl: (c) => ({ ...TEMOIN_V(c), impute: "LE_CHEMIN" }),
    },
  ];

  for (const m of MUTANTS_V) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieV(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère V est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_V = [
      "V1 structurelle-imputee-a-la-cible",
      "V2 causes-indistinguables",
      "V3 absence-effacee",
      "V4 mesure-reelle-non-disable",
    ];
    const tues = new Set(MUTANTS_V.flatMap((m) => batterieV(m.impl)));
    expect(CRITERES_V.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_V.includes(c))).toEqual([]);
    expect(CAUSES.length).toBe(3);
    expect(MUTANTS_V.length).toBeGreaterThanOrEqual(4);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE W · UNE INSTRUCTION SERVIE DOIT POUVOIR ABOUTIR
// ═════════════════════════════════════════════════════════════════════════
//
// ██  LE TÉMOIN LIT LE PRODUCTEUR RÉEL, PAS LA CHAÎNE DE CARACTÈRES.       ██
//
// Une sonde qui ferait `html.includes("HELIUS")` serait un faux vert par
// sous-chaîne — le défaut a déjà eu lieu quatre fois dans ce travail. Ce qui
// est fait ici : la CHAÎNE DE PRODUCTION de la surface est RÉSOLUE depuis les
// sources, hop par hop, et l'ensemble des mécanismes dont la surface dépend
// RÉELLEMENT est calculé. L'instruction est ensuite confrontée à cet ensemble.

/** Un mécanisme actionnable : ce qu'un lecteur pourrait effectivement changer. */
type Mecanisme = string;

/**
 * Résout la chaîne de production de la section graphe du PDF, depuis les
 * fichiers. Chaque hop est ANCRÉ : si un hop ne se résout pas, la fonction
 * rend `null` et le critère W4 mord — elle ne devine jamais.
 */
function resoudreChaine(): { hops: string[]; mecanismes: Mecanisme[] } | null {
  const renderer = codeSeul(SRC(RENDERER));
  if (!renderer.includes("graphReport")) return null;

  const routePdf = codeSeul(SRC(ROUTE_PDF));
  if (!routePdf.includes("renderCaseFilePDF")) return null;

  // Hop 2 → 3 : l'URL réellement interrogée, extraite et non supposée.
  //
  // ⚠ ANCRÉE SUR `graphUrl`, et pas sur le premier `${baseUrl}` venu. Première
  // écriture : /\$\{baseUrl\}(\/api\/...)\?/ — qui capturait le fetch de MARCHÉ,
  // lequel lit bien HELIUS_API_KEY. Le résolveur concluait donc que la surface
  // dépend de Helius, et l'axe W entier se retournait. Lire le mauvais hop est
  // précisément le défaut que cet axe combat : il l'a eu dans son propre outil,
  // et c'est le test qui l'a dit.
  //
  // Si `graphUrl` est renommée, la chaîne ne se résout plus et W4 mord —
  // fail-safe assumé, jamais une devinette.
  const m = routePdf.match(/graphUrl\s*=\s*`\$\{baseUrl\}(\/api\/[a-z0-9/\-]+)\?/i);
  if (!m) return null;
  const cheminProducteur = `src/app${m[1]}/route.ts`;
  let producteur: string;
  try {
    producteur = codeSeul(SRC(cheminProducteur));
  } catch {
    return null;
  }

  // Les mécanismes du producteur : ce dont il dépend, lu chez lui.
  const mecanismes: Mecanisme[] = [];
  if (/prisma\./.test(producteur)) mecanismes.push("DATABASE_URL");
  if (/prisma\.graphCase/.test(producteur)) mecanismes.push("table:GraphCase");
  for (const env of producteur.match(/process\.env\.([A-Z][A-Z0-9_]+)/g) ?? []) {
    mecanismes.push(env.replace("process.env.", ""));
  }
  return { hops: [RENDERER, ROUTE_PDF, cheminProducteur], mecanismes };
}

/** Les mécanismes nommés par une instruction servie. */
const mecanismesCites = (instruction: string): Mecanisme[] =>
  instruction.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? [];

interface Instruction {
  texte: string;
  /** Les mécanismes dont la surface dépend RÉELLEMENT, résolus. `null` = non résolue. */
  mecanismesDuChemin: Mecanisme[] | null;
}
type ImplW = (i: Instruction) => { servie: boolean };

const INSTRUCTIONS: Instruction[] = [];

function batterieW(impl: ImplW): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  for (const i of INSTRUCTIONS) {
    const cites = mecanismesCites(i.texte);
    const atteignable =
      i.mecanismesDuChemin !== null &&
      cites.length > 0 &&
      cites.some((c) => i.mecanismesDuChemin!.includes(c));

    if (i.mecanismesDuChemin === null) {
      // W4 — chaîne non résolue : on ne conclut PAS que l'instruction est
      // bonne. Fail-safe, comme la sonde de la GATE 2.
      dit(impl(i).servie === false, "W4 chaine-non-resolue-servie");
    } else if (!atteignable && cites.length > 0) {
      // W1 — le mécanisme nommé n'est pas sur le chemin : l'instruction ne
      // peut pas aboutir, donc elle ne se sert pas.
      dit(impl(i).servie === false, "W1 mecanisme-absent-du-chemin");
    } else if (atteignable) {
      // W2 — SUR-CORRECTION. Une instruction VRAIE sur ce chemin reste
      // servable : le critère porte sur la CORRESPONDANCE, pas sur la
      // présence d'une instruction.
      dit(impl(i).servie === true, "W2 instruction-vraie-refusee");
    }
  }

  // W3 — SUR-CORRECTION. Supprimer toute instruction n'est pas le correctif.
  dit(INSTRUCTIONS.some((i) => impl(i).servie), "W3 toute-instruction-supprimee");
  return v;
}

const TEMOIN_W: ImplW = (i) => {
  if (i.mecanismesDuChemin === null) return { servie: false };
  const cites = mecanismesCites(i.texte);
  return { servie: cites.length > 0 && cites.some((c) => i.mecanismesDuChemin!.includes(c)) };
};

describe("S11/w — CRITÈRE : instruction ↔ mécanisme, résolu depuis les sources", () => {
  const chaine = resoudreChaine();

  it("la chaîne de production se résout, hop par hop, depuis les fichiers", () => {
    expect(chaine, "la chaîne ne se résout plus — les ancres ont bougé").not.toBeNull();
    expect(chaine!.hops).toEqual([
      RENDERER,
      ROUTE_PDF,
      "src/app/api/scan/solana/graph/route.ts",
    ]);
  });

  it("MESURÉ — la surface dépend de la BASE, jamais de Helius", () => {
    expect(chaine!.mecanismes).toContain("DATABASE_URL");
    expect(chaine!.mecanismes).toContain("table:GraphCase");
    expect(chaine!.mecanismes).not.toContain("HELIUS_API_KEY");
  });

  it("CONSTAT — l'instruction servie nomme un mécanisme absent du chemin", () => {
    const html = renderCaseFilePDF(scanMinimal(), "en", null);
    expect(html).toContain("HELIUS_API_KEY");
    expect(mecanismesCites("Re-run analysis with HELIUS_API_KEY configured.")).toContain(
      "HELIUS_API_KEY",
    );
    expect(chaine!.mecanismes).not.toContain("HELIUS_API_KEY");
  });

  // Les cas de la batterie, construits à partir de la chaîne RÉSOLUE.
  INSTRUCTIONS.length = 0;
  INSTRUCTIONS.push(
    { texte: "Re-run analysis with HELIUS_API_KEY configured.", mecanismesDuChemin: chaine?.mecanismes ?? null },
    { texte: "Check DATABASE_URL and retry.", mecanismesDuChemin: chaine?.mecanismes ?? null },
    { texte: "Re-run analysis with HELIUS_API_KEY configured.", mecanismesDuChemin: null },
  );

  it("le TÉMOIN passe", () => expect(batterieW(TEMOIN_W)).toEqual([]));

  const MUTANTS_W: Array<{ nom: string; critere: string; impl: ImplW }> = [
    {
      nom: "LE DÉFAUT ACTUEL — toute instruction est servie, sans vérifier le mécanisme",
      critere: "W1 mecanisme-absent-du-chemin",
      impl: () => ({ servie: true }),
    },
    {
      nom: "la chaîne ne se résout pas, et on sert quand même",
      critere: "W4 chaine-non-resolue-servie",
      impl: (i) => ({ servie: i.mecanismesDuChemin === null ? true : TEMOIN_W(i).servie }),
    },
    {
      nom: "SUR-CORRECTION — plus aucune instruction n'est servie",
      critere: "W3 toute-instruction-supprimee",
      impl: () => ({ servie: false }),
    },
    {
      nom: "SUR-CORRECTION — une instruction VRAIE est refusée avec les fausses",
      critere: "W2 instruction-vraie-refusee",
      impl: (i) => ({ servie: TEMOIN_W(i).servie && !i.texte.includes("DATABASE_URL") }),
    },
  ];

  for (const m of MUTANTS_W) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieW(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère W est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_W = [
      "W1 mecanisme-absent-du-chemin",
      "W2 instruction-vraie-refusee",
      "W3 toute-instruction-supprimee",
      "W4 chaine-non-resolue-servie",
    ];
    const tues = new Set(MUTANTS_W.flatMap((m) => batterieW(m.impl)));
    expect(CRITERES_W.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_W.includes(c))).toEqual([]);
    // Non-vacuité du jeu de cas : trois instructions, dont une vraie et une
    // non résolue. Vider ce tableau rendrait W1, W2 et W4 inatteignables.
    expect(INSTRUCTIONS).toHaveLength(3);
  });
});
