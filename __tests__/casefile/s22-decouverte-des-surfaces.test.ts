// ─── BUILD 12 · S22 — LA DÉCOUVERTE DES SURFACES, PAR ATTEIGNABILITÉ ─────
//
// ██  P1 · GOVERNANCE COVERAGE / REGISTRY INTEGRITY                        ██
//
// La porte ratifiée :
//
//   « Do NOT fix MARKERS by adding the reader name. Move discovery to
//     TRANSITIVE REACHABILITY from executable surfaces to governed authority
//     roots. READER FUNCTION NAMES ARE NOT AUTHORITY. »
//
// ─── POURQUOI CE FICHIER, ALORS QU'UNE GARDE EXISTE DÉJÀ ────────────────
//
// `__tests__/casefile/surface-registry.test.ts` DÉCOUVRE déjà : il balaie et
// refuse toute surface non déclarée. Il est vert. Et il manque des surfaces.
//
// La raison est nommable, et elle est plus intéressante qu'un oubli : sa
// découverte est conditionnée par une LISTE DE MARQUEURS ÉCRITE À LA MAIN. La
// liste tenue à la main n'a pas disparu quand on a automatisé — elle est passée
// de « quelles surfaces » à « quels marqueurs », et elle est aussi aveugle un
// cran plus haut. UN MARQUEUR MANQUANT VAUT DIX SURFACES.
//
// Ajouter le nom du lecteur manquant à cette liste aurait refait la faute une
// entrée plus loin. Ce fichier ne nomme donc aucun lecteur, aucune surface,
// aucun répertoire : il calcule DEUX PROPRIÉTÉS et les compose.
//
// ─── LES DEUX PROPRIÉTÉS, ET AUCUN NOM ──────────────────────────────────
//
//   RACINE     un module qui LIT un magasin de dossiers — accès aux modèles
//              de dossier en base, SQL brut sur leurs tables, ou lecture de
//              fichier dans le magasin sur disque.
//
//   ÉMETTEUR   un module qui peut produire une SORTIE OBSERVABLE — un handler
//              HTTP, un corps de document, une écriture vers le stockage
//              objet, ou une entrée routée par le framework.
//
//   SURFACE = ÉMETTEUR ∧ (atteint une RACINE)
//
// ─── LE POINT DE DÉPART ÉTAIT LUI AUSSI UN NOM DE RÉPERTOIRE ────────────
//
// La garde existante balaie `src/app`. Or `src/lib/casefile/pdfGenerator.ts`
// IMPRIME une identité de dossier en tête d'un document remis, et ne vit pas
// sous `src/app` : elle ne le balaie même pas. L'univers des surfaces n'est
// donc pas « les fichiers d'un répertoire » — c'est une PROPRIÉTÉ, au même
// titre que celle des racines. Les deux bouts du calcul devaient cesser d'être
// des noms, pas seulement un des deux.
//
// ─── DEUX NATURES D'ARÊTE, ET LA SECONDE A ÉTÉ TROUVÉE PAR LA MESURE ────
//
// Un premier calcul ne suivait que les imports de valeur. Il a rendu un
// résultat qui se réfute tout seul : `pdfGeneratorPublic.ts` découvert, et
// `pdfGenerator.ts` NON — deux générateurs frères, l'un visible et l'autre
// pas, pour une raison qui n'a rien à voir avec ce qu'ils émettent.
//
// La raison est que le second reçoit le dossier EN PARAMÈTRE : il n'a aucune
// arête d'exécution vers l'autorité, seulement un `import type`. Un module qui
// reçoit la donnée ne va pas la chercher.
//
//   ARÊTE D'EXÉCUTION    import de valeur — le module VA CHERCHER la donnée
//   ARÊTE DE CONSOMMATION import de type — le module la REÇOIT
//
// Les deux sont suivies, et distinguées dans le rapport : elles n'appellent
// pas la même classification. Ne suivre que la première laisserait dehors
// exactement les générateurs d'artefacts, c'est-à-dire les modules dont la
// sortie est un document remis à un tiers.
//
// À l'inverse, un `import type` ne transporte AUCUNE donnée à l'exécution : il
// ne crée pas d'arête d'exécution, et trois pages qui type-importent la forme
// de réponse d'une route ne « lisent » pas le magasin. Les compter comme telles
// gonflerait le décompte d'une couverture qu'on n'a pas.
//
// ─── CE QUE CETTE GARDE NE PROUVE PAS ───────────────────────────────────
//
// L'atteignabilité dit qu'une surface PEUT toucher l'autorité. Elle ne dit pas
// qu'elle en ÉMET quoi que ce soit, et elle est délibérément sur-inclusive :
// pour une question de couverture, manquer une surface coûte infiniment plus
// que d'en inclure une qui sera classée « atteint sans émettre ». Le tri est
// une décision normative, il n'est pas ici, et il ne doit pas être simulé ici.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune classification
// d'audience. Aucune modification du registre ni de sa garde existante.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const RACINES_BALAYAGE = ["src"] as const;

const codeSeul = (contenu: string): string =>
  contenu
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

function fichiers(): string[] {
  const out: string[] = [];
  const marche = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|\.next/.test(p)) marche(p);
      } else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) {
        out.push(p);
      }
    }
  };
  for (const r of RACINES_BALAYAGE) marche(r);
  return out;
}

const FICHIERS = fichiers();
const SOURCE = new Map(FICHIERS.map((f) => [f, readFileSync(f, "utf8")]));

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 1 — LIRE UN MAGASIN DE DOSSIERS
// ═══════════════════════════════════════════════════════════════════════════
//
// Aucun nom de fonction de lecture n'apparaît ici, et c'est l'exigence
// centrale : un lecteur renommé demain doit rester une racine. Ce qui est
// détecté est l'ACCÈS AU MAGASIN, pas le nom de qui y accède.

/** Accès aux tables de dossier, par le client typé ou en SQL brut. */
const MAGASIN_EN_BASE = [
  /\b(?:prisma|tx)\s*\.\s*(?:tokenCaseFile|platformCaseFile)\s*\./,
  /FROM\s+"?(?:CaseFileClaim|CaseFileSource|CaseFileShiller|CaseFileSmokingGun|token_casefiles)"?/i,
];

/**
 * Lecture du magasin sur disque.
 *
 * Deux conditions, et la seconde est écrite pour survivre à l'assemblage de
 * chemin : le magasin est atteint par `path.join(cwd(), "data", "cases", …)`,
 * où la chaîne « data/cases/ » n'apparaît JAMAIS en littéral. Une propriété
 * de racine qui aurait cherché le chemin écrit aurait manqué le lecteur
 * hérité — c'est-à-dire la racine qui porte le plus de surfaces du dépôt.
 * La propriété de racine était elle-même de forme littérale ; c'est la faute
 * de marqueur, commise un niveau plus bas.
 */
const LECTURE_FICHIER = /(?:readFileSync|readFile|createReadStream)/;
const SEGMENT_MAGASIN = /["']cases["']|\/cases\//;

const estRacine = (f: string): boolean => {
  const c = codeSeul(SOURCE.get(f)!);
  if (MAGASIN_EN_BASE.some((re) => re.test(c))) return true;
  return LECTURE_FICHIER.test(c) && SEGMENT_MAGASIN.test(c);
};

const RACINES = FICHIERS.filter(estRacine);
const ENSEMBLE_RACINES = new Set(RACINES);

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 2 — POUVOIR PRODUIRE UNE SORTIE OBSERVABLE
// ═══════════════════════════════════════════════════════════════════════════

const FORMES_EMISSION: ReadonlyArray<{ nom: string; motif: RegExp }> = [
  { nom: "handler HTTP", motif: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/ },
  { nom: "corps de document", motif: /<!DOCTYPE html>|<!doctype html>/ },
  { nom: "écriture vers le stockage objet", motif: /PutObjectCommand|putObject|\.upload\(/ },
];

/**
 * Le nom de fichier EST le contrat de routage du framework — ce n'est pas une
 * convention que je choisis, c'est la façon dont Next décide ce qui est servi.
 * L'employer ici n'est donc pas retomber dans la découverte par nom : c'est
 * lire une déclaration, au seul endroit où le nom est porteur de sens.
 */
const ROUTE_DU_FRAMEWORK = /^src\/app\/.*\/(?:page|layout|route|template|default)\.tsx?$/;

const formesDe = (f: string): string[] => {
  const c = codeSeul(SOURCE.get(f)!);
  const out = FORMES_EMISSION.filter((e) => e.motif.test(c)).map((e) => e.nom);
  if (ROUTE_DU_FRAMEWORK.test(f)) out.push("routé par le framework");
  return out;
};

const EMETTEURS = new Map<string, string[]>();
for (const f of FICHIERS) {
  const formes = formesDe(f);
  if (formes.length > 0) EMETTEURS.set(f, formes);
}

// ═══════════════════════════════════════════════════════════════════════════
// LE GRAPHE — DEUX NATURES D'ARÊTE
// ═══════════════════════════════════════════════════════════════════════════

const resoudre = (depuis: string, spec: string): string | null => {
  let base: string;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(depuis), spec).replace(`${process.cwd()}/`, "");
  else return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base]) {
    if (SOURCE.has(c)) return c;
  }
  return null;
};

const SANS_TYPES = (s: string) =>
  s
    .replace(/^\s*import\s+type\s[\s\S]*?from\s*["'][^"']+["'];?/gm, "")
    .replace(/^\s*export\s+type\s[\s\S]*?from\s*["'][^"']+["'];?/gm, "");

const AVEC_TYPES = /^\s*(?:import|export)\s+type\s[\s\S]*?from\s*["']([^"']+)["']/gm;

const executionEdges = new Map<string, Set<string>>();
const consommationEdges = new Map<string, Set<string>>();
for (const f of FICHIERS) {
  const brut = SOURCE.get(f)!;
  const ex = new Set<string>();
  for (const m of SANS_TYPES(brut).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const r = resoudre(f, m[1]);
    if (r) ex.add(r);
  }
  executionEdges.set(f, ex);
  const ty = new Set<string>();
  for (const m of brut.matchAll(AVEC_TYPES)) {
    const r = resoudre(f, m[1]);
    if (r) ty.add(r);
  }
  consommationEdges.set(f, ty);
}

const atteintRacine = (depart: string): boolean => {
  const vus = new Set<string>([depart]);
  const file = [depart];
  while (file.length > 0) {
    const c = file.shift()!;
    if (ENSEMBLE_RACINES.has(c)) return true;
    for (const i of executionEdges.get(c) ?? []) if (!vus.has(i)) { vus.add(i); file.push(i); }
  }
  return false;
};

/** Le chemin d'exécution le plus court vers une racine, ou `null`. */
const temoinDeChemin = (depart: string): string[] | null => {
  const vus = new Set<string>([depart]);
  const file: Array<[string, string[]]> = [[depart, [depart]]];
  while (file.length > 0) {
    const [c, p] = file.shift()!;
    if (ENSEMBLE_RACINES.has(c)) return p;
    for (const i of executionEdges.get(c) ?? []) if (!vus.has(i)) { vus.add(i); file.push([i, [...p, i]]); }
  }
  return null;
};

const consommeUnDossier = (f: string): boolean =>
  [...(consommationEdges.get(f) ?? [])].some((t) => ENSEMBLE_RACINES.has(t) || atteintRacine(t));

type Nature = "execution" | "consommation";
interface Surface {
  readonly fichier: string;
  readonly formes: readonly string[];
  readonly nature: Nature;
}

const SURFACES: Surface[] = [...EMETTEURS.keys()]
  .filter((f) => atteintRacine(f) || consommeUnDossier(f))
  .map((f) => ({ fichier: f, formes: EMETTEURS.get(f)!, nature: atteintRacine(f) ? "execution" : "consommation" }));

// ═══════════════════════════════════════════════════════════════════════════
// L'IDENTITÉ D'UNE SURFACE — JAMAIS UNE COORDONNÉE
// ═══════════════════════════════════════════════════════════════════════════
//
// Règle apprise contre moi, un lot plus tôt : un cliquet ancré sur
// `fichier:ligne` rougit quand un commentaire réécrit plus haut décale la
// ligne, alors que rien de ce qu'il garde n'a bougé. UN NUMÉRO DE LIGNE
// N'IDENTIFIE PAS UN SITE, IL IDENTIFIE SA POSITION.
//
// Pour une surface, l'identité de gouvernance est :
//
//   · ROUTÉE     l'URL servie. Elle survit à tout déplacement de fichier à
//                l'intérieur de la même route, et ne change que si l'URL
//                change — ce qui EST un changement produit, et doit être
//                reclassé.
//   · NON ROUTÉE le nom de base du module. Il survit au déplacement de
//                répertoire.
//
// Résidu ASSUMÉ et nommé : renommer la surface elle-même la rend indiscernable
// d'une suppression suivie d'un ajout. C'est le comportement CORRECT — pour la
// gouvernance, une surface renommée est une surface neuve jusqu'à ce que
// quelqu'un dise le contraire. Aucune clé automatique ne peut faire mieux sans
// un identifiant durable posé dans le code, et en poser un serait une décision
// qui ne m'appartient pas.

const identiteDe = (f: string): string => {
  const m = f.match(/^src\/app\/(.*)\/(?:page|layout|route|template|default)\.tsx?$/);
  if (m) return `route:/${m[1].replace(/\/\([^)]*\)/g, "")}`;
  return `module:${f.split("/").pop()!.replace(/\.tsx?$/, "")}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// LE CLIQUET — DÉMARRÉ À LA MESURE, PAS À ZÉRO
// ═══════════════════════════════════════════════════════════════════════════
//
// Dix-neuf surfaces remontent d'un coup. Un cliquet démarré à zéro rougirait
// en masse et finirait DÉSACTIVÉ — ce que la garde existante écrit déjà
// d'elle-même : « une garde bruyante finit désactivée ». Il démarre donc à la
// mesure, chaque entrée portant sa raison, et il ne peut que décroître.
//
// AUCUNE de ces entrées n'est une approbation. Le cliquet dit « connu et non
// classé », jamais « acceptable » — la classification d'audience est une
// décision normative qui n'est pas prise ici et ne doit pas l'être.

interface NonClassee {
  readonly id: string;
  readonly nature: Nature;
  readonly raison: string;
}

const HERITE = "atteint le magasin hérité sur disque — LEGACY_SCORING_INPUT, arbitrage HOLD";

const NON_CLASSEES: readonly NonClassee[] = [
  { id: "route:/api/admin/prebuy/verdict", nature: "execution", raison: "atteint le magasin par la couche pré-achat" },
  { id: "route:/api/cron/watcher-bridge", nature: "execution", raison: "atteint le magasin par la résolution de jetons v3" },
  { id: "route:/api/explorer", nature: "execution", raison: "atteint le magasin par l'énumération des dossiers" },
  { id: "route:/api/mobile/v1/scan", nature: "execution", raison: HERITE },
  { id: "route:/api/partner/v1/batch-score", nature: "execution", raison: HERITE },
  { id: "route:/api/partner/v1/score-lite", nature: "execution", raison: HERITE },
  { id: "route:/api/partner/v1/transaction-check", nature: "execution", raison: HERITE },
  { id: "route:/api/pdf/casefile", nature: "execution", raison: HERITE },
  { id: "route:/api/reflex", nature: "execution", raison: HERITE },
  { id: "route:/api/report/v2", nature: "execution", raison: HERITE },
  { id: "route:/api/scan/solana", nature: "execution", raison: HERITE },
  { id: "route:/api/v1/scan-context", nature: "execution", raison: HERITE },
  { id: "route:/api/v1/score", nature: "execution", raison: HERITE },
  { id: "route:/en/demo", nature: "consommation", raison: "reçoit une forme de réponse portant du matériel de dossier" },
  { id: "route:/fr/demo", nature: "consommation", raison: "reçoit une forme de réponse portant du matériel de dossier" },
  { id: "route:/scan", nature: "consommation", raison: "reçoit une forme de réponse portant du matériel de dossier" },
  { id: "module:pdfRenderer", nature: "consommation", raison: "générateur d'artefact — reçoit le dossier en paramètre et l'imprime" },
  { id: "module:pdfGenerator", nature: "consommation", raison: "générateur d'artefact — reçoit le dossier en paramètre et l'imprime" },
  { id: "module:pdfGeneratorPublic", nature: "execution", raison: "générateur d'artefact — lit la projection publique" },
];

const REGISTRE = readFileSync("src/lib/casefile/surfaceRegistry.ts", "utf8");
const estDeclaree = (f: string) => REGISTRE.includes(`"${f}"`);

// ═══════════════════════════════════════════════════════════════════════════

describe("S22/p1 — les deux bouts du calcul sont des PROPRIÉTÉS, et ils rendent", () => {
  // Un balayage qui ne trouve rien parce qu'il n'a rien regardé rend le même
  // vert qu'un dépôt conforme. Le témoin de non-vacuité est exigé avant toute
  // mesure, et il est exigé sur LES DEUX bouts.
  it("TÉMOIN — l'ensemble des RACINES est non vide et contient les deux autorités", () => {
    expect(RACINES.length, "aucune racine découverte — la propriété a cessé de mordre").toBeGreaterThan(5);
    // Le lecteur canonique, atteint par accès aux tables.
    expect(RACINES).toContain("src/lib/casefile/canonicalReader.ts");
    // Le lecteur hérité, atteint par lecture de fichier sur un chemin ASSEMBLÉ.
    // C'est lui que la découverte par marqueur manquait, et il porte à lui seul
    // la majorité des surfaces non déclarées.
    expect(RACINES).toContain("src/lib/caseDb.ts");
  });

  it("TÉMOIN — l'ensemble des ÉMETTEURS est non vide, et déborde de `src/app`", () => {
    expect(EMETTEURS.size, "aucun émetteur découvert").toBeGreaterThan(100);
    // La correction de périmètre, rendue exécutable : ce qui IMPRIME vit dans
    // `src/lib`, et un balayage borné à `src/app` ne le voit jamais.
    expect([...EMETTEURS.keys()]).toContain("src/lib/casefile/pdfGenerator.ts");
    expect([...EMETTEURS.keys()].some((f) => !f.startsWith("src/app/"))).toBe(true);
  });

  it("TÉMOIN — le graphe porte les deux natures d'arête", () => {
    const ex = [...executionEdges.values()].reduce((n, s) => n + s.size, 0);
    const co = [...consommationEdges.values()].reduce((n, s) => n + s.size, 0);
    expect(ex, "aucune arête d'exécution — la résolution d'import est cassée").toBeGreaterThan(500);
    expect(co, "aucune arête de consommation — les générateurs sortiraient de l'univers").toBeGreaterThan(20);
  });
});

describe("S22/p2 — toute surface découverte est déclarée, ou connue et non classée", () => {
  it("⚑ COUVERTURE — aucune surface hors du registre ET hors du cliquet", () => {
    const connues = new Set(NON_CLASSEES.map((n) => n.id));
    const orphelines = SURFACES
      .filter((s) => !estDeclaree(s.fichier) && !connues.has(identiteDe(s.fichier)))
      .map((s) => {
        const t = temoinDeChemin(s.fichier);
        return `      ${identiteDe(s.fichier)}  [${s.formes.join(", ")}]\n` +
          `        ${s.fichier}\n` +
          `        ${t ? t.join(" → ") : "arête de consommation (reçoit le dossier en paramètre)"}`;
      });
    expect(
      orphelines,
      `surface(s) atteignant l'autorité sans déclaration ni classement :\n${orphelines.join("\n")}`,
    ).toEqual([]);
  });

  it("CLIQUET — le nombre de non classées ne remonte pas", () => {
    const nonDeclarees = SURFACES.filter((s) => !estDeclaree(s.fichier));
    expect(
      nonDeclarees.length,
      `non déclarées :\n${nonDeclarees.map((s) => `      ${identiteDe(s.fichier)}`).join("\n")}`,
    ).toBeLessThanOrEqual(NON_CLASSEES.length);
  });

  it("le cliquet n'est pas une approbation — chaque entrée porte sa raison", () => {
    for (const n of NON_CLASSEES) {
      expect(n.raison.length, `${n.id} est au cliquet sans raison`).toBeGreaterThan(20);
    }
    // Et aucune entrée fantôme : une surface classée qui aurait disparu doit
    // sortir du cliquet, sinon il ne décroît jamais vraiment.
    const vues = new Set(SURFACES.map((s) => identiteDe(s.fichier)));
    const fantomes = NON_CLASSEES.filter((n) => !vues.has(n.id)).map((n) => n.id);
    expect(fantomes, "entrées de cliquet qui ne correspondent à aucune surface").toEqual([]);
  });

  it("MESURE — la répartition par nature d'arête, qui n'appelle pas le même classement", () => {
    const parNature = (n: Nature) => SURFACES.filter((s) => s.nature === n).length;
    expect(parNature("execution") + parNature("consommation")).toBe(SURFACES.length);
    expect(parNature("consommation"), "les générateurs d'artefacts ont quitté l'univers")
      .toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES MUTANTS
// ═══════════════════════════════════════════════════════════════════════════
//
// Corpus SYNTHÉTIQUES : démontrer qu'une découverte trouve une surface ne doit
// pas exiger d'en introduire une dans le dépôt.

type Faux = ReadonlyArray<readonly [string, string]>;

/** Rejoue le calcul complet sur un corpus arbitraire. */
function decouvrir(corpus: Faux): { racines: string[]; surfaces: string[] } {
  const src = new Map(corpus);
  const noms = [...src.keys()];
  const racine = (f: string) => {
    const c = codeSeul(src.get(f)!);
    if (MAGASIN_EN_BASE.some((re) => re.test(c))) return true;
    return LECTURE_FICHIER.test(c) && SEGMENT_MAGASIN.test(c);
  };
  const racines = noms.filter(racine);
  const setR = new Set(racines);
  const res = (depuis: string, spec: string) => {
    const base = spec.startsWith("@/")
      ? join("src", spec.slice(2))
      : resolve("/", dirname(depuis), spec).slice(1);
    for (const c of [`${base}.ts`, `${base}.tsx`, base]) if (src.has(c)) return c;
    return null;
  };
  const ex = new Map<string, Set<string>>();
  for (const f of noms) {
    const s = new Set<string>();
    for (const m of SANS_TYPES(src.get(f)!).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const r = res(f, m[1]);
      if (r) s.add(r);
    }
    ex.set(f, s);
  }
  const atteint = (d: string) => {
    const vus = new Set([d]); const q = [d];
    while (q.length) {
      const c = q.shift()!;
      if (setR.has(c)) return true;
      for (const i of ex.get(c) ?? []) if (!vus.has(i)) { vus.add(i); q.push(i); }
    }
    return false;
  };
  const surfaces = noms.filter((f) => formesSynth(src.get(f)!, f).length > 0 && atteint(f));
  return { racines, surfaces };
}

const formesSynth = (c: string, f: string): string[] => {
  const out = FORMES_EMISSION.filter((e) => e.motif.test(codeSeul(c))).map((e) => e.nom);
  if (ROUTE_DU_FRAMEWORK.test(f)) out.push("routé par le framework");
  return out;
};

describe("S22/m — MUTANTS : la découverte tient-elle ce qu'elle promet ?", () => {
  it("M5 — un magasin et une surface SYNTHÉTIQUES sont tous deux découverts", () => {
    const { racines, surfaces } = decouvrir([
      ["src/lib/magasin.ts", `import fs from "node:fs";\nexport function lire(){ return fs.readFileSync(path.join("data","cases","x.json")); }`],
      ["src/app/api/neuve/route.ts", `import { lire } from "@/lib/magasin";\nexport async function GET(){ return Response.json(lire()); }`],
    ]);
    expect(racines).toEqual(["src/lib/magasin.ts"]);
    expect(surfaces).toEqual(["src/app/api/neuve/route.ts"]);
  });

  // ── M6 · LE MUTANT QUI COMPTE ─────────────────────────────────────────
  //
  // C'est la cécité d'aujourd'hui rendue exécutable. La garde existante
  // conditionne sa découverte à des noms ; renommer le lecteur la rend
  // aveugle sans que rien d'observable ait changé. Ici le nom n'entre nulle
  // part dans le calcul, et la surface doit rester découverte à l'identique.
  it("M6 — RENOMMER le lecteur ne change RIEN : la surface reste découverte", () => {
    const avec = (nomLecteur: string) =>
      decouvrir([
        ["src/lib/magasin.ts", `import fs from "node:fs";\nexport function ${nomLecteur}(){ return fs.readFileSync(path.join("data","cases","x.json")); }`],
        ["src/app/api/neuve/route.ts", `import { ${nomLecteur} } from "@/lib/magasin";\nexport async function GET(){ return Response.json(${nomLecteur}()); }`],
      ]);
    const a = avec("loadCaseByMint");
    const b = avec("recupererLeDossierParJeton");
    const c = avec("__x9");
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.surfaces).toEqual(["src/app/api/neuve/route.ts"]);
  });

  it("M6b — et ASSEMBLER le chemin du magasin ne la cache pas non plus", () => {
    // La forme exacte qui a mis en défaut ma première propriété de racine :
    // le magasin atteint par segments, sans que le chemin écrit existe.
    const assemble = decouvrir([
      ["src/lib/magasin.ts", `import fs from "node:fs";\nexport function l(){ return fs.readFileSync(path.join(process.cwd(), "data", "cases", f)); }`],
      ["src/app/api/neuve/route.ts", `import { l } from "@/lib/magasin";\nexport async function GET(){ return Response.json(l()); }`],
    ]);
    expect(assemble.racines).toEqual(["src/lib/magasin.ts"]);
    expect(assemble.surfaces).toEqual(["src/app/api/neuve/route.ts"]);
  });

  it("M7 — une chaîne à DEUX SAUTS est découverte", () => {
    // Ce qu'un balayage à plat manque : la surface ne mentionne jamais le
    // magasin, et c'est le cas de la majorité des surfaces réelles.
    const { surfaces } = decouvrir([
      ["src/lib/magasin.ts", `import fs from "node:fs";\nexport const l = () => fs.readFileSync(path.join("data","cases","x"));`],
      ["src/lib/intermediaire.ts", `import { l } from "@/lib/magasin";\nexport const passe = () => l();`],
      ["src/app/api/neuve/route.ts", `import { passe } from "@/lib/intermediaire";\nexport async function GET(){ return Response.json(passe()); }`],
    ]);
    expect(surfaces).toEqual(["src/app/api/neuve/route.ts"]);
  });

  it("NON-MUTANT — un module qui n'atteint aucun magasin n'est PAS une surface", () => {
    // Une découverte qui attrape tout est aussi inutile qu'une qui n'attrape
    // rien : elle rougit sur du code irréprochable, on la désarme, et il ne
    // reste ni l'une ni l'autre.
    const { racines, surfaces } = decouvrir([
      ["src/lib/rien.ts", `export const f = () => 1;`],
      ["src/app/api/neuve/route.ts", `import { f } from "@/lib/rien";\nexport async function GET(){ return Response.json(f()); }`],
    ]);
    expect(racines).toEqual([]);
    expect(surfaces).toEqual([]);
  });

  it("NON-MUTANT — un import de TYPE ne crée pas d'arête d'exécution", () => {
    // Trois pages du dépôt type-importent la forme de réponse d'une route.
    // Les compter comme atteignant le magasin gonflerait le décompte d'une
    // couverture qu'on n'a pas.
    const { surfaces } = decouvrir([
      ["src/lib/magasin.ts", `import fs from "node:fs";\nexport type D = { a: 1 };\nexport const l = () => fs.readFileSync(path.join("data","cases","x"));`],
      ["src/app/api/neuve/route.ts", `import type { D } from "@/lib/magasin";\nexport async function GET(){ return Response.json({} as D); }`],
    ]);
    expect(surfaces).toEqual([]);
  });

  it("le commentaire qui CITE un accès au magasin ne fait pas une racine", () => {
    const { racines } = decouvrir([
      ["src/lib/faux.ts", `// return prisma.tokenCaseFile.findMany()\nexport const f = () => 1;`],
    ]);
    expect(racines).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA CÉCITÉ D'AUJOURD'HUI, RENDUE EXÉCUTABLE
// ═══════════════════════════════════════════════════════════════════════════
//
// Affirmer « la garde existante échoue M6 par construction » ne vaut rien : ça
// se démontre, ou ça ne se dit pas. Sa règle de découverte est donc reproduite
// ici pour être RÉFUTÉE — le même geste que la clé synthétique de
// `tokenIdentity.ts`, présente pour être reconnue et refusée, et que le
// consommateur naïf de S21.
//
// Ce bloc ne juge pas la garde existante, qui a trouvé une troisième autorité
// que personne ne cherchait. Il mesure la LIMITE de sa forme, et cette limite
// est exactement ce que la découverte par atteignabilité lève.

describe("S22/z — pourquoi la découverte par MARQUEURS ne pouvait pas suffire", () => {
  /**
   * La règle de la garde existante, reproduite : un fichier est une surface
   * s'il MENTIONNE l'un des marqueurs connus. Le fond du problème tient dans
   * cette phrase — « mentionne un nom connu ».
   */
  const parMarqueurs = (contenu: string): boolean =>
    [
      /IL-(?:PND|PON|SHILL|CONC)-[A-Z0-9]+-\d+/,
      /loadPublicProjection|loadCanonicalCaseFile|toInternalCaseView/,
      /data\/cases\/botify\.json|buildBotifyInput|buildVineInput/,
      /tokenCaseFile\.|platformCaseFile\./,
    ].some((re) => re.test(codeSeul(contenu)));

  const ROUTE_REELLE = `import { loadCaseByMint } from "@/lib/caseDb";
export async function GET() { return Response.json(loadCaseByMint("x")); }`;

  it("CONSTAT — une route qui LIT le magasin hérité n'est vue par AUCUN marqueur", () => {
    // Elle lit un dossier, l'émet, et ne mentionne aucun nom de la liste.
    expect(parMarqueurs(ROUTE_REELLE)).toBe(false);
    // La découverte par atteignabilité, elle, la voit — parce qu'elle ne
    // regarde pas ce que le fichier DIT, mais ce qu'il ATTEINT.
    const { surfaces } = decouvrir([
      ["src/lib/caseDb.ts", `import fs from "node:fs";\nexport const loadCaseByMint = () => fs.readFileSync(path.join(process.cwd(),"data","cases","x.json"));`],
      ["src/app/api/neuve/route.ts", ROUTE_REELLE],
    ]);
    expect(surfaces).toEqual(["src/app/api/neuve/route.ts"]);
  });

  it("M6 CONTRE LA FORME PAR MARQUEURS — un renommage la rend aveugle", () => {
    // Un marqueur de la liste, donc une surface vue.
    const avant = `import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";
export async function GET() { return Response.json(loadCanonicalCaseFile("r")); }`;
    expect(parMarqueurs(avant)).toBe(true);

    // Le MÊME code, la MÊME lecture, la MÊME émission — le lecteur renommé.
    const apres = avant.replace(/loadCanonicalCaseFile/g, "chargerDossierCanonique");
    expect(parMarqueurs(apres), "la découverte par marqueurs a survécu au renommage").toBe(false);

    // Rien d'observable n'a changé. C'est la définition d'une découverte qui
    // dépend d'un nom, et la raison pour laquelle « READER FUNCTION NAMES ARE
    // NOT AUTHORITY » n'est pas une préférence de style.
  });
});
