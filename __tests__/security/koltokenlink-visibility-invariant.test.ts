// P0-2 — INVARIANT : toute lecture PUBLIQUE de KolTokenLink filtre en liste
// blanche sur `visibility`.
//
// C'est ce test qui rend la dépublication réellement effective. `archived`
// n'est pas un état magique : il ne retire le lien d'un consommateur que si ce
// consommateur filtre en LISTE BLANCHE (visibility = 'public'). Une lecture
// qui oublie le filtre continue de servir un lien archivé — et la
// dépublication devient une promesse non tenue.
//
// Le chantier P0-2 a trouvé CINQ lectures publiques sans filtre, toutes
// postérieures au « Sprint 8 » censé les avoir toutes couvertes :
//   coordinationSignals.ts   getCoordinationSignalsForLaunch
//   coordinationSignals.ts   getCoordinationSignalsForCase
//   clusterRisk.ts           getClusterContextForLaunch
//   clusterRisk.ts           getClusterSignalsForCase
//   explorerItems.ts         getExplorerStats  (compteur « launches »)
//
// Une revue humaine ne rattrape pas ça de façon fiable. Ce test, si.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/**
 * Surfaces INTERNES : elles doivent voir les drafts et les archives, c'est
 * leur métier. Chaque entrée porte sa raison — une exemption sans raison est
 * une exemption qu'on ne saura pas réévaluer.
 */
const INTERNAL_READERS: Record<string, string> = {
  "src/lib/watcher-bridge/campaignReviewStatus.ts":
    "compte public/rejected/archived pour le rollup de campagne — doit tout voir",
  "src/lib/watcher-bridge/createDraftKolTokenLink.ts":
    "lit la visibility existante pour décider de créer ou non un draft",
  "src/lib/watcher-bridge/reviewDraftLink.ts":
    "charge le lien à approuver/rejeter, par définition non public",
  "src/lib/watcher-bridge/archiveLinkPublication.ts":
    "charge le lien à archiver et garde son propre WHERE visibility = 'public'",
  "src/lib/watcher-bridge/loadWatcherDraftQueue.ts":
    "file de revue admin — n'affiche QUE des non-publics",
  "src/lib/osint/review/prismaReviewStore.ts":
    "store de revue OSINT admin",
  "src/lib/osint/review/loadReviewQueue.ts":
    "file de revue OSINT admin",
  "src/lib/osint/observability/loadDashboard.ts":
    "dashboard admin : compte explicitement visibility <> 'public'",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules" || entry === "scripts") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Extrait le bloc d'arguments qui suit `openIndex` (l'index de la parenthèse). */
function argumentBlock(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return source.slice(openIndex);
}

/** Extrait le littéral SQL (backticks) qui contient `hitIndex`. */
function sqlLiteral(source: string, hitIndex: number): string {
  const start = source.lastIndexOf("`", hitIndex);
  if (start === -1) return source.slice(Math.max(0, hitIndex - 400), hitIndex + 400);
  const end = source.indexOf("`", hitIndex);
  return source.slice(start, end === -1 ? source.length : end + 1);
}

interface Site {
  file: string;
  kind: "prisma" | "sql";
  snippet: string;
}

function collectSites(): Site[] {
  const sites: Site[] = [];
  const prismaCall = /\bkolTokenLink\s*\.\s*(findMany|findFirst|findUnique|count|groupBy|aggregate)\s*\(/g;
  const rawSql = /FROM\s+"KolTokenLink"/gi;

  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    const rel = relative(ROOT, file).split(sep).join("/");

    prismaCall.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = prismaCall.exec(source)) !== null) {
      const open = source.indexOf("(", m.index + m[0].length - 1);
      sites.push({ file: rel, kind: "prisma", snippet: argumentBlock(source, open) });
    }

    rawSql.lastIndex = 0;
    while ((m = rawSql.exec(source)) !== null) {
      sites.push({ file: rel, kind: "sql", snippet: sqlLiteral(source, m.index) });
    }
  }
  return sites;
}

const SITES = collectSites();

describe("invariant KolTokenLink — le garde-fou du test lui-même", () => {
  it("trouve bien des sites de lecture (sinon le test est vert pour rien)", () => {
    expect(SITES.length).toBeGreaterThanOrEqual(20);
  });

  it("couvre les consommateurs publics nommés par le chantier", () => {
    const files = new Set(SITES.map((s) => s.file));
    for (const expected of [
      "src/lib/explorer/explorerItems.ts",     // Explorer / Launch Dossiers
      "src/lib/cluster/clusterRisk.ts",        // ClusterRiskBadge
      "src/app/api/watchlist/route.ts",        // watchlist
      "src/lib/coordination/coordinationSignals.ts",
      "src/lib/kol/kolLeaderboard.ts",
      "src/lib/reflex/casefileMatch.ts",       // casefileMatch / PRE-BUY GUARD
      "src/app/api/scan/resolve/route.ts",
    ]) {
      expect(files, `${expected} n'est plus scanné`).toContain(expected);
    }
  });

  it("chaque exemption interne pointe sur un fichier qui lit vraiment la table", () => {
    const files = new Set(SITES.map((s) => s.file));
    for (const exempt of Object.keys(INTERNAL_READERS)) {
      expect(files, `exemption morte : ${exempt}`).toContain(exempt);
    }
  });
});

describe("invariant KolTokenLink — filtre visibility sur toute lecture publique", () => {
  const publicSites = SITES.filter((s) => !(s.file in INTERNAL_READERS));

  it.each(publicSites.map((s) => [s.file, s.kind, s.snippet] as const))(
    "%s (%s) filtre sur visibility",
    (file, _kind, snippet) => {
      expect(
        /visibility/i.test(snippet),
        `Lecture publique de KolTokenLink sans filtre visibility dans ${file}.\n` +
          `Un lien ARCHIVÉ y resterait visible — la dépublication ne serait pas effective.\n` +
          `Extrait :\n${snippet.slice(0, 400)}`,
      ).toBe(true);
    },
  );

  it("le filtre est une LISTE BLANCHE sur 'public', jamais une liste noire", () => {
    for (const site of publicSites) {
      if (!/visibility/i.test(site.snippet)) continue;
      const whitelisted =
        /visibility['"\s:=]+.{0,4}['"]public['"]/i.test(site.snippet) ||
        /visibility\s*=\s*'public'/i.test(site.snippet);
      expect(
        whitelisted,
        `${site.file} filtre sur visibility mais pas en liste blanche 'public'.\n` +
          `Une liste noire (visibility != 'draft') laisserait passer tout état FUTUR,\n` +
          `à commencer par 'archived'.\nExtrait :\n${site.snippet.slice(0, 400)}`,
      ).toBe(true);
    }
  });
});
