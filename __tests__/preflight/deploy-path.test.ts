// LE CHEMIN DE DÉPLOIEMENT EXÉCUTABLE — ce que les tests doivent prouver.
//
//   Deployment safety is a property of the executable deployment path;
//   a correct optional preflight is not a deployment guard.
//
// Le preflight livré la veille était correct et démontré. Il n'était pas
// INÉVITABLE : la commande de déploiement du dépôt ne le traversait pas. Ces
// tests portent donc sur la seule chose qui manquait — le CÂBLAGE — et sur la
// propriété qui le rend non contournable : le CLI n'est pas spawné avant que le
// garde ait rendu 0.
//
// ⚠️ AUCUN TEST ICI NE DÉPLOIE. Les trois primitives du wrapper sont
// injectables précisément pour ça : on COMPTE les spawns, on n'en fait aucun.

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FILTRE_REJOUE_DEPUIS } from "../../scripts/preflight/upload-set.mjs";
import {
  VERCEL_CLI_VERSION, CIBLE, ETAPES, deployerProduction, resolveDeployCommand,
} from "../../scripts/deploy-production.mjs";

const RACINE = process.cwd();

/** Un environnement de test. `ProcessEnv` du dépôt exige NODE_ENV ; ces tests
 *  n'en ont pas besoin — ils vérifient une SEULE variable. */
const env = (v: Record<string, string> = {}) => v as NodeJS.ProcessEnv;
const lire = (rel: string) => readFileSync(join(RACINE, rel), "utf8");

// ─── LE CLI DE FIXTURE, ET POURQUOI IL EXISTE ────────────────────────────────
// Un test qui exige le CLI Vercel installé ne vaut que sur un poste : mesuré, il
// rougit sur le runner CI (`MODULE_NOT_FOUND`). La propriété POSITIVE — « la
// commande résolue exécute exactement la version épinglée » — doit se prouver
// PARTOUT. On fabrique donc un paquet CLI sur disque et on injecte le détecteur.
//
// L'injection se fait par PARAMÈTRE DE FONCTION, jamais par variable
// d'environnement : un paramètre ne se pose pas depuis l'extérieur du processus,
// et l'entrée en ligne de commande du wrapper n'en passe aucun.
const TEMPORAIRES: string[] = [];
afterAll(() => { for (const d of TEMPORAIRES) rmSync(d, { recursive: true, force: true }); });

function cliFactice(version: string, { bin = true, ecrireBinaire = true } = {}) {
  const racine = mkdtempSync(join(tmpdir(), "cli-factice-"));
  TEMPORAIRES.push(racine);
  const paquet = join(racine, "node_modules", "vercel");
  mkdirSync(join(paquet, "dist"), { recursive: true });
  const pkg = join(paquet, "package.json");
  writeFileSync(pkg, JSON.stringify({ name: "vercel", version, ...(bin ? { bin: { vercel: "./dist/vc.js" } } : {}) }));
  const entry = join(paquet, "dist", "vc.js");
  if (ecrireBinaire) writeFileSync(entry, "// binaire de fixture — jamais exécuté par les tests\n");
  return { entry, detect: () => ({ version, source: "fixture", path: pkg }) };
}

/** Un faux CLI résolu : ne spawne rien, dit seulement ce qu'il aurait spawné. */
const CLI_FACTICE = {
  bin: "/usr/local/bin/node",
  args: ["/quelque/part/vercel/dist/vc.js", "--prod"],
  version: FILTRE_REJOUE_DEPUIS,
  source: "test",
  entry: "/quelque/part/vercel/dist/vc.js",
};

/**
 * Un harnais qui COMPTE les spawns, et qui ne touche ni au réseau ni au CLI.
 *
 * La liaison de projet et le marqueur restent lus sur le disque RÉEL : ce sont
 * des portes, pas des dépendances, et les neutraliser reviendrait à tester un
 * wrapper qui n'est pas celui qu'on livre. Dans ce worktree la porte projet
 * refuse (il est lié à `interligens-t2`), ce qui rend une exécution complète
 * impossible ici — et c'est la bonne propriété, pas une gêne.
 */
function harnais(over: Record<string, unknown> = {}) {
  const spawns: unknown[] = [];
  const base = {
    cwd: RACINE,
    runPreflight: () => 0,
    resolveCli: () => CLI_FACTICE,
    spawnCli: (c: unknown) => { spawns.push(c); },
    env: env(),
    log: () => {},
  };
  return { spawns, opts: { ...base, ...over } };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("LA SÉQUENCE — celle du ruling, dans son ordre", () => {
  it("les six étapes sont déclarées, dans l'ordre exigé", () => {
    expect(ETAPES).toEqual([
      "preflight-upload-set-exact",
      "refus-des-secrets",
      "liaison-de-projet",
      "source-set-merkle",
      "cli-epingle",
      "deploy",
    ]);
  });

  it("le chemin ne dessert QUE la production — il n'a pas de paramètre de cible", () => {
    expect(CIBLE).toBe("production");
    const src = lire("scripts/deploy-production.mjs");
    // Aucune lecture d'un `--target` en ligne de commande : le wrapper ne peut
    // pas être détourné vers une cible où la porte projet est inapplicable.
    expect(src).not.toMatch(/argv\.indexOf\(["']--target["']\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE GARDE PRÉCÈDE TOUTE POSSIBILITÉ D'UPLOAD", () => {
  it("preflight ROUGE ⇒ le CLI n'est JAMAIS spawné", () => {
    const { spawns, opts } = harnais({ runPreflight: () => 1 });
    const res = deployerProduction(opts);
    expect(res.ok).toBe(false);
    expect(res.deploye).toBe(false);
    expect(spawns).toHaveLength(0); // ZÉRO, pas « moins que d'habitude »
  });

  it("un preflight qui n'a même pas pu démarrer est un REFUS, pas un silence", () => {
    const { spawns, opts } = harnais({ runPreflight: () => 2 });
    expect(deployerProduction(opts).ok).toBe(false);
    expect(spawns).toHaveLength(0);
  });

  it("le refus nomme l'étape ET dit qu'aucun octet n'est parti", () => {
    const { opts } = harnais({ runPreflight: () => 1 });
    const res = deployerProduction(opts);
    const dernier = res.journal[res.journal.length - 1] as { etape: string; detail: string };
    expect(dernier.etape).toBe("preflight");
    expect(dernier.detail).toMatch(/le CLI n'a pas été lancé/);
  });

  it("MUTANT · un wrapper qui spawne AVANT le garde est détecté par ce même harnais", () => {
    // Le mutant : la séquence inversée. Si le test ne rougissait pas ici, il ne
    // prouverait pas l'ordre — il constaterait seulement qu'un refus refuse.
    const spawns: unknown[] = [];
    const mutant = ({ runPreflight, spawnCli }: { runPreflight: () => number; spawnCli: (c: unknown) => void }) => {
      spawnCli(CLI_FACTICE); // ⛔ avant le garde
      return { ok: runPreflight() === 0, deploye: true };
    };
    mutant({ runPreflight: () => 1, spawnCli: (c) => { spawns.push(c); } });
    expect(spawns).toHaveLength(1); // le mutant téléverse malgré le rouge
  });

  it("aucun drapeau de contournement n'existe dans le wrapper", () => {
    const src = lire("scripts/deploy-production.mjs");
    const interdits = ["--force", "--skip-preflight", "--no-preflight", "SKIP_PREFLIGHT", "--yolo"];
    const trouves = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .flatMap((l) => interdits.filter((d) => l.includes(d)));
    expect(trouves).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LES PORTES QUI RESTENT DANS LE WRAPPER", () => {
  it("liaison de projet ROUGE après le garde ⇒ pas de spawn", () => {
    // Un répertoire sans `.vercel/project.json` : la porte projet refuse.
    const { spawns, opts } = harnais({ cwd: "/tmp" });
    const res = deployerProduction(opts);
    expect(res.ok).toBe(false);
    expect(spawns).toHaveLength(0);
    expect((res.journal.at(-1) as { etape: string }).etape).toBe("liaison-de-projet");
  });

  it("un marqueur absent ou malformé REFUSE — une racine n'est pas facultative", () => {
    // On court-circuite la porte projet en la rendant verte via un cwd lié,
    // impossible ici : on vérifie donc la forme du contrôle dans la source.
    const src = lire("scripts/deploy-production.mjs");
    expect(src).toMatch(/\/\^\[0-9a-f\]\{64\}\$\//);
    expect(src).toMatch(/return refus\("source-set-merkle"/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LA VERSION EST UNE CONSTANTE DU MÉCANISME, PAS DE LA PROSE", () => {
  it("il n'y a pas DEUX constantes à tenir synchronisées, il y en a UNE", () => {
    expect(VERCEL_CLI_VERSION).toBe(FILTRE_REJOUE_DEPUIS);
    const src = lire("scripts/deploy-production.mjs");
    // La valeur littérale n'est PAS recopiée dans le wrapper : elle est importée.
    const litterales = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .filter((l) => /["'`]51\.7\.0["'`]/.test(l));
    expect(litterales).toEqual([]);
    expect(src).toMatch(/VERCEL_CLI_VERSION = FILTRE_REJOUE_DEPUIS/);
  });

  it("la valeur épinglée est bien 51.7.0 — la version dont le filtre est rejoué", () => {
    expect(VERCEL_CLI_VERSION).toBe("51.7.0");
  });

  it("la commande résolue exécute EXACTEMENT la version épinglée", () => {
    const { detect, entry } = cliFactice(VERCEL_CLI_VERSION);
    const cmd = resolveDeployCommand(RACINE, env(), detect);
    expect(cmd.version).toBe(VERCEL_CLI_VERSION);
    expect(cmd.entry).toBe(entry);
    // Preuve indépendante : on relit le package.json du binaire résolu.
    const pkgDuBinaire = cmd.entry.replace(/\/dist\/[^/]+$/, "/package.json");
    expect(JSON.parse(readFileSync(pkgDuBinaire, "utf8")).version).toBe(VERCEL_CLI_VERSION);
    expect(cmd.args[1]).toBe("--prod");
  });

  it("REFUSE un CLI qui n'est pas la version épinglée — même d'un cheveu", () => {
    const { detect } = cliFactice("51.7.1");
    expect(() => resolveDeployCommand(RACINE, env(), detect)).toThrow(/51\.7\.1.*épinglé à 51\.7\.0/s);
  });

  it("REFUSE un paquet CLI qui ne déclare aucun binaire, ou dont le binaire manque", () => {
    const { detect: sansBin } = cliFactice(VERCEL_CLI_VERSION, { bin: false });
    expect(() => resolveDeployCommand(RACINE, env(), sansBin)).toThrow(/ne déclare pas de binaire/);
    const { detect: binAbsent } = cliFactice(VERCEL_CLI_VERSION, { ecrireBinaire: false });
    expect(() => resolveDeployCommand(RACINE, env(), binAbsent)).toThrow(/introuvable/);
  });

  it("REFUSE VERCEL_CLI_PACKAGE_JSON — sur ce chemin elle choisirait le binaire EXÉCUTÉ", () => {
    // La porte 1 du preflight accepte cette variable ; le chemin de déploiement
    // la refuse, et le refus arrive AVANT toute détection.
    const { detect } = cliFactice(VERCEL_CLI_VERSION);
    expect(() => resolveDeployCommand(RACINE, env({ VERCEL_CLI_PACKAGE_JSON: "/dev/null" }), detect))
      .toThrow(/VERCEL_CLI_PACKAGE_JSON/);
  });

  it("sur un poste où le CLI est installé, c'est bien celui de la porte 1", () => {
    // ⚠️ Ce test ne doit valoir ni PLUS ni MOINS sur un runner sans CLI. La
    // propriété est un COUPLE : ou bien la version épinglée, ou bien un REFUS.
    // Il n'y a pas de troisième état, et c'est ça qu'on vérifie — pas « ça
    // marche sur ma machine » (panne déjà mesurée, corrigée en c451ad5).
    try {
      const cmd = resolveDeployCommand(RACINE, env());
      expect(cmd.version).toBe(VERCEL_CLI_VERSION);
      expect(cmd.bin).toBe(process.execPath);
    } catch (e) {
      expect((e as Error).message).toMatch(/indéterminable hors ligne|épinglé à/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("AUCUNE RÉSOLUTION FLOTTANTE DANS LE CHEMIN GOUVERNÉ", () => {
  /** Une spécification est FLOTTANTE si elle nomme `vercel` sans version exacte. */
  const estFlottante = (spec: string) =>
    /(^|[\s"'`=])(npx\s+)?vercel(@(latest|canary|next|\^|~|\*)|\s|$|["'`])/.test(spec);

  it("le détecteur reconnaît les formes flottantes, et épargne la forme épinglée", () => {
    expect(estFlottante("npx vercel --prod")).toBe(true);
    expect(estFlottante("vercel --prod")).toBe(true);
    expect(estFlottante("npx vercel@latest --prod")).toBe(true);
    expect(estFlottante("npx vercel@canary --prod")).toBe(true);
    expect(estFlottante("npx vercel@^51 --prod")).toBe(true);
    expect(estFlottante("npx vercel@51.7.0 --prod")).toBe(false);
  });

  it("la commande réellement construite ne contient AUCUN nom de paquet à re-résoudre", () => {
    const { detect } = cliFactice(VERCEL_CLI_VERSION);
    const cmd = resolveDeployCommand(RACINE, env(), detect);
    // `node /chemin/absolu/vc.js --prod` : rien n'est résolu au moment de
    // l'exécution, donc rien ne peut flotter.
    expect(cmd.bin).toBe(process.execPath);
    expect(cmd.args[0].startsWith("/")).toBe(true);
    expect(cmd.args.join(" ")).not.toMatch(/\bnpx\b/);
    expect(estFlottante(cmd.args.join(" "))).toBe(false);
  });

  /**
   * LE DOMAINE DU DÉTECTEUR, ET IL EST BORNÉ POUR LA MÊME RAISON QUE CELUI
   * D'`AMBIGUOUS_FORMS`. Appliqué à TOUTES les lignes, il rougit sur la prose
   * d'un message d'erreur qui contient le mot `vercel` — mesuré : la ligne
   * « le package.json du CLI ne déclare pas de binaire `vercel` ». Un détecteur
   * qui rougit sur une phrase est un détecteur qu'on finit par couper. Il ne
   * regarde donc que les lignes EN POSITION D'EXÉCUTION : celles qui lancent un
   * processus ou qui construisent des arguments de commande.
   */
  const enPositionDExecution = (l: string) =>
    /execFileSync|execSync|spawnSync|spawn\(|\bnpx\b|--prod/.test(l);

  it("MUTANT · un wrapper qui repasse par `npx vercel` rougit", () => {
    const mutantArgv = ["npx", "vercel", "--prod"].join(" ");
    expect(estFlottante(mutantArgv)).toBe(true);
    expect(enPositionDExecution(mutantArgv)).toBe(true);

    const reel = lire("scripts/deploy-production.mjs")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .filter(enPositionDExecution);
    expect(reel.length).toBeGreaterThan(0); // le domaine n'est pas vide : le test mord
    expect(reel.filter((l) => estFlottante(l))).toEqual([]);
  });

  it("AUCUN script de package.json n'invoque vercel de façon non épinglée", () => {
    const scripts = JSON.parse(lire("package.json")).scripts as Record<string, string>;
    const coupables = Object.entries(scripts).filter(([, v]) => estFlottante(v));
    expect(coupables).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE CÂBLAGE — package.json expose la commande, et elle passe par le garde", () => {
  it("`deploy:prod` existe et pointe sur le wrapper", () => {
    const scripts = JSON.parse(lire("package.json")).scripts as Record<string, string>;
    expect(scripts["deploy:prod"]).toBe("node scripts/deploy-production.mjs");
  });

  it("le wrapper invoque le preflight — et par son chemin, pas par un alias", () => {
    const src = lire("scripts/deploy-production.mjs");
    expect(src).toMatch(/preflight-deploy\.mjs/);
    expect(src).toMatch(/"--emit-marker"/);
  });

  it("le preflight n'est PAS branché sur un crochet `pre` que pnpm n'appelle pas", () => {
    const scripts = JSON.parse(lire("package.json")).scripts as Record<string, string>;
    expect(scripts["predeploy:prod"]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE GEL — le moteur, le vocabulaire et le wrapper sont gouvernés", () => {
  const guard = () => lire("scripts/guard-offline.sh");

  it("scripts/preflight/ est dans le périmètre protégé", () => {
    expect(guard()).toMatch(/\^scripts\/preflight\//);
  });

  it("l'orchestrateur et le wrapper aussi — geler la serrure sans la porte ne sert à rien", () => {
    expect(guard()).toMatch(/\^scripts\/preflight-deploy\\\.mjs\$/);
    expect(guard()).toMatch(/\^scripts\/deploy-production\\\.mjs\$/);
  });

  it("le motif du moteur couvre bien les deux fichiers du répertoire", () => {
    const motif = /^scripts\/preflight\//;
    expect(motif.test("scripts/preflight/upload-set.mjs")).toBe(true);
    expect(motif.test("scripts/preflight/vocabulary.mjs")).toBe(true);
    // …et pas l'orchestrateur, qui a donc besoin de son propre motif.
    expect(motif.test("scripts/preflight-deploy.mjs")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("L'ASSET QUE LA PRODUCTION SERT EST DANS LE SOURCE-SET", () => {
  it("public/tiger/analyst.png est COMMITÉ, et c'est bien l'octet vérifié", async () => {
    const { createHash } = await import("node:crypto");
    const octets = readFileSync(join(RACINE, "public/tiger/analyst.png"));
    expect(octets.length).toBe(581655);
    expect(createHash("sha256").update(octets).digest("hex"))
      .toBe("8ddfcd1a86a4b1673e485703404e89cee76b889076de9eb85482823aa699db9f");
  });

  it("il entre par l'ÉGALITÉ avec HEAD, jamais par GENERATED_ALLOWED", async () => {
    const { GENERATED_PATHS } = await import("../../scripts/preflight/vocabulary.mjs");
    expect(GENERATED_PATHS.has("public/tiger/analyst.png")).toBe(false);
    expect(GENERATED_PATHS.size).toBe(1);
  });

  it("les trois MP4 sortent par l'EXCLUSION, pas par l'autorisation", async () => {
    const { GENERATED_PATHS } = await import("../../scripts/preflight/vocabulary.mjs");
    const vercelignore = lire(".vercelignore");
    for (const m of ["green", "orange", "red"]) {
      expect(GENERATED_PATHS.has(`public/tiger/${m}.mp4`)).toBe(false);
      expect(vercelignore).toContain(`public/tiger/${m}.mp4`);
    }
  });
});
