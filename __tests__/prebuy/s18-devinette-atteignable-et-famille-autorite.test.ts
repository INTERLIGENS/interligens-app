// ─── BUILD 12 · S18 — LA DEVINETTE EST ATTEIGNABLE, ET SILENCIEUSE ────────
//
// ██  AK5 · le contournement qui devine : forme, ATTEIGNABILITÉ, signal     ██
// ██  AG2 · l'autorité a-t-elle des frères, et où est-elle RENDUE           ██
// ██  AK6 · les valeurs stockées — la forme s'inscrit, la mesure se demande ██
//
// S17 avait établi la FORME de `?? items2[0]` (explorer/[caseId]/page.tsx:60).
// Une forme n'est pas un défaut servi. Ce fichier répond aux trois questions
// qui font la différence, et il n'en conclut aucune qu'il n'ait mesurée.
//
// ─── AK5/1 — ATTEIGNABLE : OUI, PAR CONSTRUCTION, ET DE DEUX FAÇONS ────
//
//   Le repli ne se déclenche que si la recherche RETOURNE des éléments dont
//   aucun ne satisfait l'égalité ni le préfixe. La question était donc :
//   le prédicat de recherche est-il PLUS LARGE que celui du préfixe ?
//
//   `explorerItems.ts:319-325` — mesuré :
//
//       i.title.toLowerCase().includes(q) ||
//       i.linkedActors.some(a => a.handle.toLowerCase().includes(q))
//
//   Deux élargissements INDÉPENDANTS, chacun suffisant :
//
//     (a) `includes` et non `startsWith` — « SHILL-BOTIFY-002 » contient
//         « BOTIFY » sans commencer par lui. Égalité NON, préfixe NON,
//         recherche OUI.
//     (b) le handle d'acteur — un dossier dont le titre ne porte NULLE PART
//         la chaîne cherchée entre dans le résultat par un @handle qui la
//         contient. Égalité NON, préfixe NON, recherche OUI.
//
//   Le `??` n'est donc pas un garde-fou mort. Il est le chemin NOMINAL dès
//   qu'un second dossier partage un fragment de nom ou un acteur.
//
//   ET CE N'EST PAS « LE PREMIER RÉSULTAT » AU SENS DE PERTINENCE : le tri
//   par `primaryDate` décroissant est appliqué AVANT le filtre de recherche
//   (l. 315 puis l. 319). `items2[0]` est le dossier le PLUS RÉCENT qui
//   mentionne le fragment — un ordre qui n'a aucun rapport avec l'identité
//   demandée, et qui peut changer sans qu'aucun des deux dossiers ne bouge.
//
// ─── AK5/2 — SILENCIEUX : OUI, ET LE TITRE AFFICHÉ AGGRAVE LE CAS ──────
//
//   `page.tsx:104` — `<h1>{caseId}</h1>`. Le titre rendu est le segment
//   d'URL DEMANDÉ, jamais `dossier.title`. `CaseSnapshot` ne rend pas
//   davantage `dossier.title` : il reçoit `caseId` en propriété et le
//   réémet (l. 492, l. 525). Le corps — résumé, acteurs liés, signaux —
//   vient du dossier SERVI.
//
//   Le lecteur voit donc l'identité qu'il a demandée au-dessus du contenu
//   d'un autre dossier, sans aucune marque. Et les captures sont récupérées
//   sur `relationKey = caseId` (l. 70), c'est-à-dire sur le dossier DEMANDÉ :
//   la page mélange deux dossiers dans un seul écran.
//
// ─── AK5/3 — PUBLIC : OUI ──────────────────────────────────────────────
//
//   `/en/explorer/*` n'est dans aucune entrée de `PRIVATE_PATH_SOURCES`
//   (next.config.ts) ; il n'y a pas de `middleware.ts` à la racine ni sous
//   `src/` ; `/api/explorer` ne lit aucun jeton. Aucune auth, et pas même
//   le `X-Robots-Tag: noindex` que portent les chemins privés.
//
//   Atteignable, silencieux, public : les trois convergent.
//
// ─── CE QUI RESTE NON MESURÉ, ET QUI NE DOIT PAS ÊTRE CONCLU ───────────
//
//   L'atteignabilité établie ici est STRUCTURELLE : le prédicat de recherche
//   est strictement plus large que celui du préfixe, donc l'ensemble
//   déclencheur n'est pas vide par construction. Qu'il soit NON VIDE EN
//   PRODUCTION dépend des valeurs de `KolCase.caseId` et des handles liés,
//   que ce worktree ne peut pas lire. Voir AK6 : la requête est nommée, la
//   mesure n'est pas fabriquée.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";

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

const EXPLORER_PAGE = "src/app/en/explorer/[caseId]/page.tsx";
const EXPLORER_ITEMS = "src/lib/explorer/explorerItems.ts";
const SNAPSHOT = "src/components/case/CaseSnapshot.tsx";
const PROJECTION = "src/lib/casefile/publicProjection.ts";
const RENDERER = "src/components/pdf/pdfRenderer.ts";

// ═════════════════════════════════════════════════════════════════════════
// AXE AK5 · LE CONTOURNEMENT QUI DEVINE — ATTEIGNABILITÉ
// ═════════════════════════════════════════════════════════════════════════

// Le prédicat de recherche de l'explorer, RECOPIÉ depuis la source et ancré
// par le test d'ancrage ci-dessous. On ne peut pas l'importer : `explorerItems`
// ouvre un client Prisma à l'import.
interface Dossier {
  readonly title: string;
  readonly handles: readonly string[];
  /** Sert au tri : `primaryDate` décroissant, appliqué AVANT le filtre. */
  readonly date: string;
}

const rechercheExplorer = (corpus: readonly Dossier[], q: string): Dossier[] =>
  [...corpus]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter(
      (i) =>
        i.title.toLowerCase().includes(q.toLowerCase()) ||
        i.handles.some((h) => h.toLowerCase().includes(q.toLowerCase())),
    );

/** La chaîne de repli de la page, RECOPIÉE (l. 51-61). */
function replierComme(corpus: readonly Dossier[], caseIdDemande: string): Dossier | null {
  const items1 = rechercheExplorer(corpus, caseIdDemande);
  let match = items1.find((i) => i.title === caseIdDemande) ?? null;

  const slugMatch = caseIdDemande.match(/^CASE-\d{4}-(.+?)-\d+$/);
  const slug = slugMatch ? slugMatch[1] : null;

  if (!match && slug) {
    const items2 = rechercheExplorer(corpus, slug);
    const up = slug.toUpperCase();
    match =
      items2.find((i) => i.title.toUpperCase() === up) ??
      items2.find((i) => i.title.toUpperCase().startsWith(up)) ??
      items2[0] ??
      null;
  }
  return match;
}

describe("S18/ak5a — ANCRAGE : la recopie suit bien la source", () => {
  it("le filtre de recherche porte sur le titre OU le handle d'un acteur", () => {
    const c = aplat(codeSeul(SRC(EXPLORER_ITEMS)));
    expect(c).toContain("i.title.toLowerCase().includes(q) || i.linkedActors.some(a => a.handle.toLowerCase().includes(q))");
  });

  it("et le tri par date est appliqué AVANT le filtre — l'ordre n'est pas la pertinence", () => {
    const c = codeSeul(SRC(EXPLORER_ITEMS));
    const iTri = c.indexOf("items.sort((a, b) => new Date(b.primaryDate)");
    const iFiltre = c.indexOf("if (filters.search)");
    expect(iTri).toBeGreaterThan(-1);
    expect(iFiltre).toBeGreaterThan(iTri);
  });

  it("la chaîne de repli est bien égalité, puis préfixe, puis DEVINETTE", () => {
    const c = aplat(codeSeul(SRC(EXPLORER_PAGE)));
    expect(c).toContain("items2.find((i: any) => i.title.toUpperCase() === up)");
    expect(c).toContain("?? items2.find((i: any) => i.title.toUpperCase().startsWith(up))");
    expect(c).toContain("?? items2[0]");
  });
});

describe("S18/ak5b — MESURE : le prédicat de recherche est STRICTEMENT plus large", () => {
  it("(a) `includes` et non `startsWith` — un titre porteur du fragment sans le préfixer", () => {
    const corpus: Dossier[] = [
      { title: "SHILL-BOTIFY-002", handles: [], date: "2026-01-01T00:00:00.000Z" },
    ];
    // La recherche le retourne…
    expect(rechercheExplorer(corpus, "BOTIFY")).toHaveLength(1);
    // …alors qu'aucune des deux correspondances nommées ne le reconnaît.
    expect(corpus[0].title.toUpperCase() === "BOTIFY").toBe(false);
    expect(corpus[0].title.toUpperCase().startsWith("BOTIFY")).toBe(false);
  });

  it("(b) le handle d'acteur — un titre qui ne porte PAS le fragment entre quand même", () => {
    const corpus: Dossier[] = [
      { title: "PONZI-CBEX-004", handles: ["botifydev"], date: "2026-01-01T00:00:00.000Z" },
    ];
    expect(corpus[0].title.toUpperCase()).not.toContain("BOTIFY");
    expect(rechercheExplorer(corpus, "BOTIFY")).toHaveLength(1);
  });

  it("CONSÉQUENCE — l'ensemble déclencheur du `??` n'est pas vide par construction", () => {
    // Le seul cas où le `??` serait mort est celui où la recherche ne peut
    // matcher que sur ce que le préfixe teste. Ce n'est pas le cas : les deux
    // élargissements ci-dessus le peuplent, indépendamment l'un de l'autre.
    for (const corpus of [
      [{ title: "SHILL-BOTIFY-002", handles: [], date: "2026-01-01T00:00:00.000Z" }],
      [{ title: "PONZI-CBEX-004", handles: ["botifydev"], date: "2026-01-01T00:00:00.000Z" }],
    ] as Dossier[][]) {
      const servi = replierComme(corpus, "CASE-2026-BOTIFY-001");
      expect(servi, "le repli n'a rien servi — la devinette serait morte").not.toBeNull();
      expect(servi!.title).not.toBe("CASE-2026-BOTIFY-001");
    }
  });

  it("et ce n'est pas « le plus proche » : c'est le plus RÉCENT", () => {
    // Deux dossiers étrangers au dossier demandé, dont aucun ne satisfait
    // égalité ni préfixe. Ce qui décide est la date, et rien d'autre.
    const ancien: Dossier = { title: "SHILL-BOTIFY-002", handles: [], date: "2024-01-01T00:00:00.000Z" };
    const recent: Dossier = { title: "PONZI-CBEX-004", handles: ["botifydev"], date: "2026-06-01T00:00:00.000Z" };
    expect(replierComme([ancien, recent], "CASE-2026-BOTIFY-001")!.title).toBe("PONZI-CBEX-004");
    // Le même corpus, la seule date changée : la réponse SERVIE change.
    const recentDate = { ...ancien, date: "2027-01-01T00:00:00.000Z" };
    expect(replierComme([recentDate, recent], "CASE-2026-BOTIFY-001")!.title).toBe("SHILL-BOTIFY-002");
  });

  it("SUR-CORRECTION — quand l'exact existe, il gagne, et le repli ne s'arme pas", () => {
    // On ne condamne pas le chemin : la garde ne doit pas rougir sur un
    // corpus où l'identité demandée EST présente.
    const corpus: Dossier[] = [
      { title: "SHILL-BOTIFY-002", handles: [], date: "2027-01-01T00:00:00.000Z" },
      { title: "CASE-2026-BOTIFY-001", handles: [], date: "2020-01-01T00:00:00.000Z" },
    ];
    expect(replierComme(corpus, "CASE-2026-BOTIFY-001")!.title).toBe("CASE-2026-BOTIFY-001");
  });

  it("et quand RIEN ne mentionne le fragment, il ne devine pas — il ne rend rien", () => {
    expect(replierComme([{ title: "PONZI-CBEX-004", handles: ["alice"], date: "2026-01-01T00:00:00.000Z" }], "CASE-2026-BOTIFY-001")).toBeNull();
  });
});

// ─── Le critère : servir un autre dossier sans le dire ───────────────────

interface Resolution {
  /** L'identité DEMANDÉE dans l'URL. */
  readonly demande: string;
  /** L'identité du dossier effectivement SERVI, `null` si rien n'est servi. */
  readonly servi: string | null;
  /** L'écran porte-t-il une marque quand les deux diffèrent ? */
  readonly marqueLaSubstitution: boolean;
  /** Le titre affiché en tête vient-il du dossier SERVI ? */
  readonly titreAffichéEstCeluiDuServi: boolean;
}

function batterieAK5(r: Resolution): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const substitue = r.servi !== null && r.servi !== r.demande;

  // AK5-1 — servir un dossier qui n'est pas celui demandé sans aucune marque.
  dit(!substitue || r.marqueLaSubstitution, "AK5-1 substitution-silencieuse");
  // AK5-2 — le titre en tête doit décrire ce qui est RENDU, pas ce qui est
  // demandé. Afficher l'URL au-dessus d'un autre contenu est le mécanisme
  // exact qui rend la substitution invisible.
  dit(!substitue || r.titreAffichéEstCeluiDuServi, "AK5-2 titre-de-l-url-sur-contenu-etranger");
  // AK5-3 — SUR-CORRECTION : ne rien servir du tout n'est pas la réponse.
  // Une identité demandée qui EXISTE doit être servie.
  dit(!(r.servi === null && r.demande === "EXISTE"), "AK5-3 refuse-de-servir-ce-qui-existe");

  return v;
}

const TEMOIN_AK5: Resolution = {
  demande: "CASE-A", servi: "CASE-A",
  marqueLaSubstitution: false, titreAffichéEstCeluiDuServi: true,
};

describe("S18/ak5c — CRITÈRE : ce qui est servi est ce qui est demandé, ou c'est DIT", () => {
  it("le TÉMOIN passe", () => expect(batterieAK5(TEMOIN_AK5)).toEqual([]));

  const MUTANTS: Array<{ nom: string; critere: string; r: Resolution }> = [
    {
      nom: "LE DÉFAUT ACTUEL — `?? items2[0]` sert un autre dossier, titre de l'URL en tête",
      critere: "AK5-1 substitution-silencieuse",
      r: { demande: "CASE-2026-BOTIFY-001", servi: "PONZI-CBEX-004", marqueLaSubstitution: false, titreAffichéEstCeluiDuServi: false },
    },
    {
      nom: "la substitution est marquée, mais le titre reste celui de l'URL",
      critere: "AK5-2 titre-de-l-url-sur-contenu-etranger",
      r: { demande: "CASE-X", servi: "CASE-Y", marqueLaSubstitution: true, titreAffichéEstCeluiDuServi: false },
    },
    {
      nom: "SUR-CORRECTION — on retire le repli ET on cesse de servir ce qui existe",
      critere: "AK5-3 refuse-de-servir-ce-qui-existe",
      r: { demande: "EXISTE", servi: null, marqueLaSubstitution: false, titreAffichéEstCeluiDuServi: true },
    },
  ];

  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAK5(m.r);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AK5 est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AK5-1 substitution-silencieuse",
      "AK5-2 titre-de-l-url-sur-contenu-etranger",
      "AK5-3 refuse-de-servir-ce-qui-existe",
    ];
    const tues = new Set(MUTANTS.map((m) => m.critere));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });
});

describe("S18/ak5d — MESURE : l'écran ne distingue pas le servi du demandé", () => {
  it("le titre en tête est le segment d'URL, jamais `dossier.title`", () => {
    const c = codeSeul(SRC(EXPLORER_PAGE));
    expect(aplat(c)).toContain(">{caseId}</h1>");
    expect(c, "la page rendrait l'identité du dossier servi — le défaut serait absent")
      .not.toContain("dossier.title");
  });

  it("et le bloc de compression ne la rend pas davantage", () => {
    const c = codeSeul(SRC(SNAPSHOT));
    expect(c).not.toContain("dossier.title");
    // Il réémet le `caseId` qu'on lui passe — celui de l'URL.
    expect(c).toContain("data-case-id={caseId}");
  });

  it("et les captures sont cherchées sur le dossier DEMANDÉ — deux dossiers, un écran", () => {
    expect(aplat(codeSeul(SRC(EXPLORER_PAGE)))).toContain(
      "/api/evidence/snapshots?relationType=case&relationKey=' + encodeURIComponent(caseId)",
    );
  });
});

describe("S18/ak5e — MESURE : la surface est PUBLIQUE", () => {
  it("aucun `middleware.ts` n'intercepte quoi que ce soit", () => {
    for (const p of ["middleware.ts", "src/middleware.ts", "middleware.tsx", "src/middleware.tsx"]) {
      expect(existsSync(p), `${p} existe — la conclusion « public » doit être revue`).toBe(false);
    }
  });

  it("`/en/explorer` n'est dans aucun chemin privé déclaré", () => {
    const cfg = codeSeul(SRC("next.config.ts"));
    // Les chemins privés sont ÉNUMÉRÉS dans le fichier ; on vérifie que
    // l'explorer n'y est pas, et que l'énumération existe toujours.
    expect(cfg).toContain("PRIVATE_PATH_SOURCES");
    const bloc = cfg.slice(cfg.indexOf("PRIVATE_PATH_SOURCES"), cfg.indexOf("];", cfg.indexOf("PRIVATE_PATH_SOURCES")));
    expect(bloc).toContain('"/admin/:path*"');
    expect(bloc).not.toContain("explorer");
  });

  it("et la route qui sert les dossiers ne lit aucun jeton", () => {
    const c = codeSeul(SRC("src/app/api/explorer/route.ts"));
    expect(c).not.toMatch(/x-admin-token|ADMIN_TOKEN|authorization|getServerSession/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AG2 · L'AUTORITÉ A-T-ELLE DES FRÈRES, ET OÙ EST-ELLE RENDUE
// ═════════════════════════════════════════════════════════════════════════

const fichiers = (racine: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(racine, { withFileTypes: true })) {
    const p = join(racine, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...fichiers(p)); }
    else if (/\.(ts|tsx|json)$/.test(e.name)) out.push(p);
  }
  return out;
};

/**
 * La famille `IL-*` est DÉCOUVERTE, jamais énumérée — et sur le CODE, pas sur
 * le texte : une référence citée dans un commentaire n'est pas une référence
 * portée. C'est la leçon de S15/ag1, appliquée d'emblée.
 */
const FAMILLE_IL: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const f of fichiers("src")) {
    for (const m of codeSeul(SRC(f)).matchAll(/\bIL-[A-Z]+-[A-Z0-9]+-\d{3}\b/g)) {
      (out[m[0]] ??= []).includes(f) || (out[m[0]] ??= []).push(f);
    }
  }
  return out;
})();

describe("S18/ag2a — MESURE : l'autorité a bien des frères, et VINE en est un", () => {
  it("`IL-SHILL-VINE-001` existe, au même endroit et sous la même forme", () => {
    // Réponse directe à la question posée : la question VINE ne va pas au
    // backlog. Une autorité gouvernée de la même famille lui est DÉJÀ
    // attribuée, deux lignes sous celle de BOTIFY.
    expect(FAMILLE_IL["IL-SHILL-VINE-001"]).toContain(PROJECTION);
    expect(FAMILLE_IL["IL-SHILL-BOTIFY-001"]).toContain(PROJECTION);
  });

  it("les deux sont routées par MINT, dans la même carte", () => {
    const c = aplat(codeSeul(SRC(PROJECTION)));
    expect(c).toContain("const CANONICAL_REF_BY_MINT: Record<string, string> = { [BOTIFY_MINT]: BOTIFY_CASEFILE_REF, [VINE_MINT]: VINE_CASEFILE_REF, }");
  });

  it("la famille compte d'AUTRES membres, et ils ne sont pas de la même sous-famille", () => {
    // Découverte, non énumérée : le recensement dit ce qu'il trouve.
    // `IL-PON-*` et `IL-PND-*` sont des dossiers de plateforme, servis par
    // `/en/cases/*` — un espace distinct de `IL-SHILL-*`.
    const sousFamilles = new Set(Object.keys(FAMILLE_IL).map((r) => r.split("-")[1]));
    expect(sousFamilles.has("SHILL")).toBe(true);
    expect(sousFamilles.size).toBeGreaterThan(1);
  });
});

describe("S18/ag2b — MESURE : QUI PRODUIT la référence, et ce qui est RENDU", () => {
  it("la constante n'est pas l'autorité : c'est une CLÉ DE LECTURE", () => {
    // `BOTIFY_CASEFILE_REF` ne fabrique rien. Elle adresse une ligne en base.
    // Ce qui est rendu est `dossier.ref`, RELU depuis cette ligne.
    const lecteur = aplat(codeSeul(SRC("src/lib/casefile/canonicalReader.ts")));
    expect(lecteur).toContain("prisma.tokenCaseFile.findUnique({ where: { ref },");
    expect(lecteur).toContain("if (!dossier) return null;");
    expect(lecteur).toContain("ref: dossier.ref,");
  });

  it("et sans la ligne, la surface servante ne se rabat sur RIEN", () => {
    // La conséquence qui fait que la constante ne peut pas inventer une
    // autorité : pas de dossier, pas de claims, et la source le DIT.
    const c = aplat(codeSeul(SRC("src/app/api/report/casefile/route.ts")));
    expect(c).toContain('casefile.off_chain.source = "none"');
    expect(c).toContain("casefile.off_chain.claims = []");
  });

  it("DEUX espaces atterrissent dans le MÊME emplacement rendu", () => {
    // C'est le cœur de la question posée : ce n'est pas un défaut de nommage,
    // c'est un défaut de PUBLICATION. Un seul champ, un seul renderer, un
    // seul emplacement visuel — et deux producteurs de familles différentes.
    const renderer = aplat(codeSeul(SRC(RENDERER)));
    expect(renderer, "l'emplacement unique où la référence est imprimée")
      .toContain("${off_chain.case_id ?? \"—\"}");

    // Producteur 1 — la voie canonique y met `IL-SHILL-*`.
    expect(aplat(codeSeul(SRC("src/app/api/report/casefile/route.ts"))))
      .toContain("casefile.off_chain.case_id = dossier.ref;");
    // Producteur 2 — la voie legacy y met `CASE-YYYY-*`, réécrit par l'horloge.
    expect(aplat(codeSeul(SRC("src/app/api/scan/solana/route.ts"))))
      .toContain("off_chain.case_id = caseFile.case_meta.case_id.replace(/CASE-\\d{4}-/, `CASE-${new Date().getFullYear()}-`);");
  });

  it("et le lecteur n'a AUCUN moyen de savoir laquelle il regarde", () => {
    // Le renderer imprime la chaîne qu'on lui donne. Il ne nomme pas l'espace
    // de nommage, ne le qualifie pas, et ne distingue pas les deux voies.
    const renderer = codeSeul(SRC(RENDERER));
    expect(renderer).not.toContain("IL-SHILL");
    expect(renderer).not.toMatch(/off_chain\.source\s*===/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AK6 · LES VALEURS STOCKÉES — LA FORME S'INSCRIT, LA MESURE SE DEMANDE
// ═════════════════════════════════════════════════════════════════════════
//
// Ce qui est ÉTABLI : `explorerItems.ts:123` → `title: caseId`. Pour
// `kind='case'`, ce que la page compare EST la colonne `KolCase.caseId`.
//
// Ce qui n'est PAS établi : les VALEURS. Le commentaire de la page affirme
// « BOTIFY-MAIN », « BOTIFY », « BOTIFY-C1 » ; c'est un commentaire.
//
// LA REQUÊTE À FAIRE EXÉCUTER PAR LE CHEMIN QUI A L'ACCÈS — elle ne lit
// qu'une colonne d'identifiants, aucune donnée nominative, aucun montant :
//
//     SELECT "caseId", COUNT(*) AS n
//       FROM "KolCase"
//      GROUP BY "caseId"
//      ORDER BY "caseId";
//
// Et, pour trancher l'atteignabilité RÉELLE du `?? items2[0]` — c'est-à-dire
// pour savoir si deux dossiers distincts partagent un fragment de nom :
//
//     SELECT c."caseId", c."kolHandle"
//       FROM "KolCase" c
//       JOIN "KolProfile" p ON p.handle = c."kolHandle"
//      WHERE p."publishStatus" = 'published'
//      ORDER BY c."caseId", c."kolHandle";
//
// (le second joint la même gate publique que `getPublishedHandles`, faute de
// quoi il compterait des acteurs que l'explorer ne rend pas ; le prédicat
// exact est `PUBLIC_KOL_FILTER` dans `src/lib/kol/publishGate.ts`.)
//
// Ce qui suit inscrit la CONTRAINTE DE FORME, sans prétendre aux valeurs :
// quelle que soit la valeur stockée, sa CLASSE DE FORME détermine par quel
// chemin la page la résout — et laquelle des classes arme la devinette.

type ClasseDeForme = "CASE_ANNEE" | "SLUG_COURT" | "SLUG_SUFFIXE";

const classer = (valeur: string): ClasseDeForme =>
  /^CASE-\d{4}-(.+?)-\d+$/.test(valeur) ? "CASE_ANNEE"
    : /-/.test(valeur) ? "SLUG_SUFFIXE"
    : "SLUG_COURT";

type Chemin = "EXACT" | "PREFIXE" | "DEVINETTE" | "RIEN";

/** Par quel chemin une valeur STOCKÉE est atteinte, pour une URL demandée. */
function cheminDeResolution(stockee: string, demandee: string): Chemin {
  const corpus: Dossier[] = [{ title: stockee, handles: [], date: "2026-01-01T00:00:00.000Z" }];
  if (stockee === demandee) return "EXACT";
  const slug = demandee.match(/^CASE-\d{4}-(.+?)-\d+$/)?.[1] ?? null;
  if (!slug) return "RIEN";
  const items2 = rechercheExplorer(corpus, slug);
  if (items2.length === 0) return "RIEN";
  const up = slug.toUpperCase();
  if (items2.some((i) => i.title.toUpperCase() === up)) return "PREFIXE";
  if (items2.some((i) => i.title.toUpperCase().startsWith(up))) return "PREFIXE";
  return "DEVINETTE";
}

// Les échantillons sont NEUTRES à dessein. Réutiliser « BOTIFY-MAIN » ou
// « BOTIFY-C1 » comme échantillon de forme réintroduirait par la porte du
// test l'affirmation que le commentaire fait sans mesure : le lecteur y
// verrait une valeur de production validée. Le fragment est donc arbitraire,
// et seule la FORME est démontrée.
const DEMANDEE = "CASE-2026-ACME-001";
const ECHANTILLONS = ["CASE-2026-ACME-001", "ACME", "ACME-C1", "SHILL-ACME-002"] as const;

describe("S18/ak6 — CONTRAINTE DE FORME : la classe décide du chemin, pas la valeur", () => {
  it("LIMITE DÉCLARÉE — aucune valeur de production n'est affirmée ici", () => {
    // La garde ne doit pas hériter du commentaire qu'elle conteste, et elle
    // ne doit pas non plus se mordre : l'aiguille est ASSEMBLÉE, jamais
    // écrite en clair, faute de quoi cette ligne serait sa propre violation.
    const moi = SRC("__tests__/prebuy/s18-devinette-atteignable-et-famille-autorite.test.ts");
    expect(moi, "la requête à faire exécuter doit rester nommée").toContain('SELECT "caseId", COUNT(*) AS n');
    for (const affirmee of [["BOTIFY", "MAIN"].join("-"), ["BOTIFY", "C1"].join("-")]) {
      expect(codeSeul(moi), `valeur affirmée sans mesure : ${affirmee}`).not.toContain(affirmee);
    }
  });

  it("une valeur de la classe `CASE_ANNEE` est atteinte EXACTEMENT — la devinette dort", () => {
    expect(classer(DEMANDEE)).toBe("CASE_ANNEE");
    expect(cheminDeResolution(DEMANDEE, DEMANDEE)).toBe("EXACT");
  });

  it("une valeur `SLUG_COURT` n'est atteinte que par le CONTOURNEMENT", () => {
    expect(classer("ACME")).toBe("SLUG_COURT");
    expect(cheminDeResolution("ACME", DEMANDEE)).toBe("PREFIXE");
    // Et si la cause partait — plus de réécriture d'horloge, une URL portant
    // l'autorité gouvernée — la même valeur stockée deviendrait INATTEIGNABLE :
    // l'URL n'aurait plus la forme qui déclenche l'extraction du slug.
    // C'est AK, mesuré sur la forme : le contournement ne survit pas à sa cause.
    expect(cheminDeResolution("ACME", "IL-SHILL-ACME-001")).toBe("RIEN");
  });

  it("une valeur `SLUG_SUFFIXE` qui ne PRÉFIXE pas le slug arme la DEVINETTE", () => {
    // La classe qui fait la différence, et la seule.
    expect(classer("SHILL-ACME-002")).toBe("SLUG_SUFFIXE");
    expect(cheminDeResolution("SHILL-ACME-002", DEMANDEE)).toBe("DEVINETTE");
    // Alors qu'un suffixe qui PRÉFIXE bien reste sur le chemin nommé.
    expect(cheminDeResolution("ACME-C1", DEMANDEE)).toBe("PREFIXE");
  });

  it("SUR-CORRECTION — la contrainte ne condamne pas la colonne, elle la classe", () => {
    // Les trois classes sont légitimes en base. Ce qui n'est pas légitime est
    // qu'une seule d'entre elles change SILENCIEUSEMENT le dossier servi.
    const classes = new Set(ECHANTILLONS.map(classer));
    expect([...classes].sort()).toEqual(["CASE_ANNEE", "SLUG_COURT", "SLUG_SUFFIXE"]);
    const armants = ECHANTILLONS.filter((v) => cheminDeResolution(v, DEMANDEE) === "DEVINETTE");
    expect(armants).toEqual(["SHILL-ACME-002"]);
  });
});
