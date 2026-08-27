// ─── Invariant de nommage — un seul résolveur canonique ────────────────────
//
// Le risque que ce test ferme : qu'un backtest ou un harness teste la MAUVAISE
// implémentation par simple ambiguïté de chemin, et conclue sur elle.
//
// Trois modules de résolution ont coexisté dans ce dépôt : le résolveur V1 du
// bridge (racine de src/lib/token-resolution/), le résolveur du scan public
// (route gelée) et l'itération V2 devenue V3. Un « src/lib/token-resolution/v2/ »
// laissé à côté d'un « v3/ » suffirait à faire rejouer un backtest sur la
// version périmée sans que personne ne le remarque.
//
// Règles tenues ici :
//   • UN seul dossier de module versionné, et c'est v3/ ;
//   • v3/index.ts se déclare @canonical-resolver ;
//   • les fichiers V1 de la racine se déclarent @legacy-v1-do-not-extend ;
//   • le seul consommateur du V1 est le bridge, qui n'est pas encore basculé ;
//   • pas de barillet à la racine : « @/lib/token-resolution » ne doit pas être
//     importable, sinon le chemin le plus court désigne le mauvais module.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const V3_DIR = join(__dirname, "..");
const MODULE_ROOT = join(V3_DIR, "..");
const REPO_ROOT = join(MODULE_ROOT, "..", "..", "..");
const SRC = join(REPO_ROOT, "src");

const LEGACY_MARKER = "@legacy-v1-do-not-extend";
const CANONICAL_MARKER = "@canonical-resolver";

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__fixtures__") continue;
      walkTs(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const SRC_FILES = walkTs(SRC).map((f) => ({
  path: relative(REPO_ROOT, f).split(sep).join("/"),
  source: readFileSync(f, "utf8"),
}));

describe("nommage — un seul module de résolution canonique", () => {
  it("le garde-fou voit bien la source (sinon il est vert pour rien)", () => {
    expect(SRC_FILES.length).toBeGreaterThan(200);
  });

  it("il n'existe QU'UN dossier de module versionné, et c'est v3", () => {
    const versioned = readdirSync(MODULE_ROOT).filter(
      (e) => statSync(join(MODULE_ROOT, e)).isDirectory() && /^v\d+$/.test(e),
    );
    expect(versioned).toEqual(["v3"]);
  });

  it("aucun chemin « token-resolution/v2 » ne subsiste dans la source", () => {
    // Ce fichier-ci CITE le motif interdit pour le décrire : il s'exclut lui-même.
    const SELF = "v3/__tests__/module-naming.test.ts";
    const stragglers = SRC_FILES.filter(
      (f) => !f.path.endsWith(SELF) && /token-resolution\/v[0-2]\b/.test(f.source),
    );
    expect(stragglers.map((f) => f.path)).toEqual([]);
  });

  it("v3 se déclare canonique", () => {
    const index = readFileSync(join(V3_DIR, "index.ts"), "utf8");
    expect(index).toContain(CANONICAL_MARKER);
  });

  it("tous les fichiers V1 de la racine se déclarent legacy", () => {
    const rootFiles = readdirSync(MODULE_ROOT).filter((e) => /\.ts$/.test(e));
    expect(rootFiles.length).toBeGreaterThan(0);
    for (const f of rootFiles) {
      const source = readFileSync(join(MODULE_ROOT, f), "utf8");
      expect(source, `${f} ne porte pas ${LEGACY_MARKER}`).toContain(LEGACY_MARKER);
    }
  });

  it("pas de barillet à la racine — « @/lib/token-resolution » n'est pas importable", () => {
    // Un index.ts ici ferait du chemin le PLUS COURT le chemin vers le module
    // périmé. C'est exactement l'ambiguïté qu'on ferme.
    expect(existsSync(join(MODULE_ROOT, "index.ts"))).toBe(false);
    const barrelImports = SRC_FILES.filter((f) =>
      /from\s+["']@\/lib\/token-resolution["']/.test(f.source),
    );
    expect(barrelImports.map((f) => f.path)).toEqual([]);
  });

  it("le résolveur V1 n'a que ses consommateurs déclarés — le bridge et son ombre", () => {
    const importers = SRC_FILES.filter(
      (f) =>
        !f.path.startsWith("src/lib/token-resolution/") &&
        !f.path.includes("__tests__/") &&
        /@\/lib\/token-resolution\/(resolveCanonicalToken|normalizeSolanaMint|scoreTokenCandidate)/.test(
          f.source,
        ),
    ).map((f) => f.path).sort();
    // Liste NOMMÉE, sans joker. `shadowResolveV3` n'appelle pas V1 : il en
    // importe le TYPE de résultat, parce qu'il journalise ce résultat à côté du
    // sien. Toute autre entrée dans cette liste est un consommateur non déclaré.
    expect(importers).toEqual([
      "src/lib/watcher-bridge/promoteWatcherSignalsToDraft.ts",
      "src/lib/watcher-bridge/shadowResolveV3.ts",
    ]);
  });

  it("un SEUL fichier touche le V1 et le V3 : le hook shadow, et il est nommé", () => {
    // Un fichier qui touche les deux est le point exact où un harness peut
    // comparer, confondre, puis conclure sur la mauvaise implémentation. Il en
    // existe désormais un, et un seul : l'ombre, dont c'est précisément le
    // métier — comparer sans jamais conclure. Le tenir dans une liste nommée
    // fait de tout NOUVEAU mélange une régression visible, au lieu de rouvrir
    // la porte à tous.
    const both = SRC_FILES.filter(
      (f) =>
        !f.path.includes("__tests__/") &&
        /@\/lib\/token-resolution\/(resolveCanonicalToken|scoreTokenCandidate|normalizeSolanaMint)/.test(
          f.source,
        ) && /token-resolution\/v3/.test(f.source),
    ).map((f) => f.path);
    expect(both).toEqual(["src/lib/watcher-bridge/shadowResolveV3.ts"]);
  });

  it("l'ombre ne renvoie AUCUN verdict V3 consommable", () => {
    const src = readFileSync(
      join(SRC, "lib/watcher-bridge/shadowResolveV3.ts"),
      "utf8",
    );
    // Le hook n'exporte que des fabriques de LIGNE DE JOURNAL. S'il se mettait à
    // exporter une résolution, un appelant pourrait la consommer sans que rien
    // ne le signale.
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+\w*[Rr]esolve\w*\s*\([^)]*\)\s*:\s*Promise<TokenResolution>/);
    expect(src).toContain("JOURNALISÉ puis");
  });
});
