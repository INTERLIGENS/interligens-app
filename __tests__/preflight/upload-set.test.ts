// LE PREFLIGHT, ÉPROUVÉ PAR MUTATION.
//
//   Une suite verte ne prouve pas que le mécanisme est correct : elle prouve
//   que la règle qu'on a écrite est celle qu'on a testée.
//
// D'où les MUTANTS. Chaque contrôle est ici accompagné d'une version SABOTÉE de
// lui-même, et le test échoue si le sabotage passe inaperçu. Un test qui ne
// peut pas rougir n'atteste rien.

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  buildIgnore, buildManifest, enumerateUploadSet, merkleRoot, filteredHead,
  HARDCODED_IGNORES, clearRelative, PreflightError, nfc, FILTRE_REJOUE_DEPUIS,
} from "../../scripts/preflight/upload-set.mjs";
import {
  classify, screenManifest, VERDICT, SECRET_FORMS, AMBIGUOUS_FORMS,
  GENERATED_ALLOWED, GENERATED_PATHS,
} from "../../scripts/preflight/vocabulary.mjs";
import {
  porteProjet, porteSecrets, porteUploadSet, executerPreflight, porteCli,
  construireMarqueur, PROJET_PRODUCTION, MARQUEUR,
} from "../../scripts/preflight-deploy.mjs";

// Les modules du preflight sont en .mjs et ne portent pas de types. On les
// nomme ici plutôt que de saupoudrer des `any` : un test qui ne se relit pas
// ne se maintient pas.
type Forme = { id: string; why: string; test: (p: string) => boolean };
type Entree = { path: string; sha1?: string };
type Refus = { path: string; verdict: string; formId: string | null; why: string | null };
type Porte = { ok: boolean; nom: string; detail: string };
type Generated = {
  path: string; classification: string; generator: string;
  why: string; provedBy: string; addedAt: string;
};
type Fabrique = () => { add: (s: string) => { ignores: (p: string) => boolean } };

// ─── Un dépôt jetable, pour éprouver en vif plutôt qu'en simulation ──────────
function depotJetable(fichiers: Record<string, string>, vercelignore = "") {
  const dir = mkdtempSync(join(tmpdir(), "preflight-"));
  for (const [rel, contenu] of Object.entries(fichiers)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, contenu);
  }
  writeFileSync(join(dir, ".vercelignore"), vercelignore);
  const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("config", "user.email", "t@t.t");
  g("config", "user.name", "t");
  g("add", "-A");
  g("commit", "-q", "-m", "x");
  return { dir, nettoyer: () => rmSync(dir, { recursive: true, force: true }) };
}
const execGit = (cmd: string, cwd: string) => {
  const [bin, ...args] = cmd.split(" ");
  return execFileSync(bin, args, { cwd, maxBuffer: 1 << 28, encoding: "utf8" });
};

describe("le filtre rejoué est celui du CLI, pas une reconstitution", () => {
  it("la liste codée en dur contient les entrées qui décident du cas .env", () => {
    // Ce sont les DEUX seules entrées `.env` du CLI. C'est précisément parce
    // que `.env` nu n'y est pas que le fichier est parti en production.
    expect(HARDCODED_IGNORES).toContain(".env.local");
    expect(HARDCODED_IGNORES).toContain(".env.*.local");
    expect(HARDCODED_IGNORES).not.toContain(".env");
  });

  it("`.gitignore` est exclu du téléversement, donc n'est JAMAIS un filtre", () => {
    expect(HARDCODED_IGNORES).toContain(".gitignore");
  });

  it("clearRelative est la transformation verbatim du CLI", () => {
    expect(clearRelative("./a\n./b/c\nd")).toBe("a\nb/c\nd");
  });

  const REQ = createRequire(join(process.cwd(), "noop.js"));

  it("le choix du moteur `ignore` est immatériel — démontré, pas supposé", () => {
    // « Nous ne certifierions pas un filtre A pour en exécuter un B. » Le CLI
    // embarque sa propre copie d'`ignore` ; celle que nous résolvons peut
    // différer en version. On ne le suppose pas : on vérifie que deux moteurs
    // rendent le MÊME ensemble sur le .vercelignore réel du dépôt.
    const versions = ["ignore@5.3.2", "ignore@7.0.5"]
      .map((v) => {
        try {
          return REQ(join(process.cwd(), "node_modules/.pnpm", v, "node_modules/ignore/index.js")) as Fabrique;
        } catch { return null; }
      })
      .filter((f): f is Fabrique => f !== null);
    if (versions.length < 2) return; // les deux ne sont pas installées ici
    const textes = readFileSync(join(process.cwd(), ".vercelignore"), "utf8");
    const ensembles = versions.map((factory: Fabrique) => {
      const ig = factory().add(`${HARDCODED_IGNORES.join("\n")}\n${clearRelative(textes)}`);
      return enumerateUploadSet(process.cwd(), { ig }).map((e: Entree) => e.path).join("\n");
    });
    expect(ensembles[0]).toBe(ensembles[1]);
  });
});

describe("PORTE — secret-bundle, vocabulaire CLOS", () => {
  it("refuse la FORME générale de .env, pas seulement l'instance trouvée", () => {
    for (const p of [".env", ".env.local", ".env.production", ".env-backup", ".env_old", "sous/dossier/.env.prod.2026"]) {
      expect(classify(p).verdict, p).toBe(VERDICT.SECRET);
    }
  });

  it("refuse le matériel cryptographique et les identifiants d'hôte", () => {
    for (const p of ["a/b.pem", "x.key", "id_rsa", ".npmrc", ".pgpass", ".aws/credentials", "srv/auth.json"]) {
      expect(classify(p).verdict, p).toBe(VERDICT.SECRET);
    }
  });

  it("INDÉCIDABLE vaut REFUS — « je ne sais pas » n'est jamais un laissez-passer", () => {
    const c = classify("ops/api-key.json");
    expect(c.verdict).toBe(VERDICT.UNDECIDABLE);
    expect(screenManifest([{ path: "ops/api-key.json", sha1: "x" }])).toHaveLength(1);
  });

  it("ne rougit PAS sur le code source ni sur le vocabulaire métier", () => {
    // Le domaine ambigu est borné, et la borne est mesurée : `token` est un nom
    // métier de premier plan ici (jeton crypto). Ces deux fixtures RÉELLES ont
    // fait rougir la première version du vocabulaire.
    for (const p of [
      "src/lib/security/tokenBucket.ts",
      "tests/lib/mm/fixtures/concentrated-token.json",
      "tests/lib/mm/fixtures/asymmetric-price-token.json",
      "src/lib/config/env.ts",
    ]) {
      expect(classify(p).verdict, p).toBe(VERDICT.CLEAR);
    }
    // …mais le signal d'authentification est conservé.
    expect(classify("cfg/auth-token.json").verdict).toBe(VERDICT.UNDECIDABLE);
  });

  it("aucune forme ne peut AUTORISER — il n'y a pas d'allowlist de secrets", () => {
    const src = readFileSync(
      join(process.cwd(), "scripts/preflight/vocabulary.mjs"), "utf8");
    expect(src).not.toMatch(/SECRET_ALLOW|ALLOW_SECRET|secretException/i);
    for (const f of [...SECRET_FORMS, ...AMBIGUOUS_FORMS]) {
      expect(typeof f.id).toBe("string");
      expect(f.why.length).toBeGreaterThan(10);
    }
  });

  // ══ MUTANT 1 — exigé : retirer .env du vocabulaire doit ROUGIR ═══════════
  it("MUTANT · retirer la forme `dotenv` du vocabulaire laisse passer .env", () => {
    // On compare la MÊME grandeur des deux côtés : « ce vocabulaire
    // refuse-t-il .env ? ». Comparer un `ok` de porte à un booléen de
    // classification comparerait deux choses de sens opposé.
    const refuse = (formes: Forme[], p: string) =>
      formes.some((f) => f.test(p)) || AMBIGUOUS_FORMS.some((f: Forme) => f.test(p));

    expect(refuse(SECRET_FORMS, ".env")).toBe(true);   // contrôle sain : REFUSE
    expect(porteSecrets([{ path: ".env", sha1: "deadbeef" }]).ok).toBe(false);

    const mutant = SECRET_FORMS.filter((f: Forme) => f.id !== "dotenv");
    expect(refuse(mutant, ".env")).toBe(false);        // mutant : LAISSE PASSER

    // Les deux divergent sur le même fichier : le sabotage est visible, donc
    // ce test rougirait si quelqu'un retirait `dotenv` du vocabulaire.
    expect(refuse(SECRET_FORMS, ".env")).not.toBe(refuse(mutant, ".env"));
  });
});

describe("PORTE — upload-set exact", () => {
  it("le prédicat est une ÉGALITÉ dans les DEUX sens", () => {
    const head = ["a.ts", "b.ts"];
    expect(porteUploadSet([{ path: "a.ts" }, { path: "b.ts" }], head).ok).toBe(true);
    // en trop
    expect(porteUploadSet([{ path: "a.ts" }, { path: "b.ts" }, { path: "c.ts" }], head).ok).toBe(false);
    // manquant — « aucun fichier de HEAD attendu après filtre n'est absent »
    const manquant = porteUploadSet([{ path: "a.ts" }], head);
    expect(manquant.ok).toBe(false);
    expect(manquant.detail).toContain("ABSENT");
  });

  it("GENERATED_ALLOWED est soustrait du terme gauche, et lui seul", () => {
    const head = ["a.ts"];
    expect(porteUploadSet([{ path: "a.ts" }, { path: MARQUEUR }], head).ok).toBe(true);
    expect(porteUploadSet([{ path: "a.ts" }, { path: "public/autre.json" }], head).ok).toBe(false);
  });

  it("la normalisation Unicode est appliquée — 13 faux positifs mesurés sans elle", () => {
    const nfd = "evidence/Capture d’écran.png";
    const nfcp = nfc(nfd);
    expect(nfcp).not.toBe(nfd);
    expect(porteUploadSet([{ path: nfcp }], [nfd]).ok).toBe(true);
  });
});

describe("GENERATED_ALLOWED ne peut pas s'élargir en silence", () => {
  // ══ LA CARDINALITÉ EST ÉPINGLÉE ICI ═════════════════════════════════════
  // Ajouter un membre exige DEUX modifications explicites, dans DEUX fichiers.
  // C'est la barrière qui empêche l'allowlist de redevenir l'ancien système
  // d'exemptions que le guard a mis à zéro.
  const ATTENDU = ["public/.well-known/source-set.json"];

  it("l'ensemble ATTENDU est exactement celui déclaré", () => {
    expect(GENERATED_ALLOWED.map((g: Generated) => g.path).sort()).toEqual([...ATTENDU].sort());
    expect(GENERATED_ALLOWED).toHaveLength(ATTENDU.length);
  });

  it("chaque membre est nominatif, motivé et démontré", () => {
    for (const g of GENERATED_ALLOWED as Generated[]) {
      expect(g.classification).toBe("GENERATED");
      for (const champ of ["path", "generator", "why", "provedBy", "addedAt"] as const) {
        expect(String(g[champ] ?? "").length, `${g.path}.${champ}`).toBeGreaterThan(3);
      }
    }
  });

  it("chemins EXACTS — aucun joker, aucune ancre, aucun préfixe de répertoire", () => {
    for (const g of GENERATED_ALLOWED as Generated[]) {
      expect(g.path).not.toMatch(/[*?^$]/);
      expect(g.path.endsWith("/")).toBe(false);
    }
  });

  it("aucun secret, aucune config, aucune source métier", () => {
    for (const g of GENERATED_ALLOWED as Generated[]) {
      expect(classify(g.path).verdict).toBe(VERDICT.CLEAR);
      expect(g.path.startsWith("src/")).toBe(false);
      expect(g.path).not.toMatch(/\.(ts|tsx|js|jsx|mjs|cjs)$/);
    }
  });

  it("les 24 fichiers mesurés hors commit ont été EXCLUS, pas autorisés", () => {
    for (const p of [
      ".env", ".claude/settings.local.json", "tsconfig.tsbuildinfo", "next-env.d.ts",
      "packages/widget/dist/embed.js", "public/tiger/orange.mp4", "AGENTS.md",
      "check_demo_restore.sh", ".wrangler/state/v3/r2/x.sqlite",
    ]) {
      expect(GENERATED_PATHS.has(p), p).toBe(false);
    }
  });

  it("le .vercelignore du dépôt exclut effectivement ces formes", () => {
    const ig = buildIgnore(process.cwd());
    for (const p of [
      ".env", ".env.production", ".env.example", ".envrc", "a/b.pem",
      ".claude/settings.local.json", ".wrangler/state/v3/r2/x.sqlite",
      "tsconfig.tsbuildinfo", "next-env.d.ts", "packages/widget/dist/embed.js",
      "public/tiger/orange.mp4", "AGENTS.md", "check_demo_restore.sh",
    ]) {
      expect(ig.ignores(p), p).toBe(true);
    }
    // …et n'exclut PAS ce dont la production dépend.
    expect(ig.ignores("public/tiger/analyst.png")).toBe(false);
    expect(ig.ignores("src/app/page.tsx")).toBe(false);
  });
});

describe("PORTE — liaison de projet", () => {
  // ══ LA CIBLE ELLE-MÊME EST ÉPINGLÉE ═════════════════════════════════════
  // Sans ce test, une mutation PARTIELLE de la constante passe inaperçue :
  // remplacer le seul `projectId` par celui d'interligens-t2 laissait la suite
  // à 36/36, parce que `projectName` divergeait encore et que la porte
  // refusait toujours — pour la mauvaise raison. Mesuré, pas supposé.
  it("la cible de production est épinglée, valeur par valeur", () => {
    expect(PROJET_PRODUCTION).toEqual({
      projectName: "interligens-app",
      projectId: "prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ",
    });
  });

  it("chaque champ est comparé — une divergence seule suffit à refuser", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      // bon identifiant, mauvais nom
      writeFileSync(join(dir, ".vercel/project.json"),
        JSON.stringify({ ...PROJET_PRODUCTION, projectName: "autre" }));
      expect(porteProjet(dir, "production").ok).toBe(false);
      // bon nom, mauvais identifiant
      writeFileSync(join(dir, ".vercel/project.json"),
        JSON.stringify({ ...PROJET_PRODUCTION, projectId: "prj_autre" }));
      expect(porteProjet(dir, "production").ok).toBe(false);
    } finally { nettoyer(); }
  });

  it("accepte interligens-app et lui seul", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      writeFileSync(join(dir, ".vercel/project.json"), JSON.stringify(PROJET_PRODUCTION));
      expect(porteProjet(dir, "production").ok).toBe(true);
    } finally { nettoyer(); }
  });

  // ══ LE CAS NÉGATIF — la liaison réelle de ce worktree ════════════════════
  // Les VRAIES valeurs que porte `~/dev/interligens-t2/.vercel/project.json`.
  // Elles sont rejouées dans un dépôt jetable plutôt que lues sur place :
  // `.vercel/` est gitignoré, donc absent du runner de CI, et deux tests qui
  // le lisaient directement ne passaient que sur mon poste. Un test qui ne
  // vaut que sur une machine n'atteste rien.
  const LIAISON_T2 = { projectName: "interligens-t2", projectId: "prj_pW53otiwqBpwD6kZYPPDWAOLlQyS" };

  it("REFUSE un worktree lié à interligens-t2", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      writeFileSync(join(dir, ".vercel/project.json"), JSON.stringify(LIAISON_T2));
      const r = porteProjet(dir, "production");
      expect(r.ok).toBe(false);
      expect(r.detail).toContain("interligens-t2");
      expect(r.detail).toContain("FAIL CLOSED");
    } finally { nettoyer(); }
  });

  it("le worktree courant, s'il est lié, est jugé par la même porte", () => {
    // Opportuniste : ne s'exécute que là où la liaison existe réellement.
    const lien = join(process.cwd(), ".vercel/project.json");
    if (!existsSync(lien)) return;
    const reel = JSON.parse(readFileSync(lien, "utf8"));
    const r = porteProjet(process.cwd(), "production");
    expect(r.ok).toBe(reel.projectId === PROJET_PRODUCTION.projectId
      && reel.projectName === PROJET_PRODUCTION.projectName);
  });

  it("REFUSE quand la liaison est absente ou illisible", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      expect(porteProjet(dir, "production").ok).toBe(false);
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      writeFileSync(join(dir, ".vercel/project.json"), "{ pas du json");
      expect(porteProjet(dir, "production").ok).toBe(false);
    } finally { nettoyer(); }
  });

  // ══ MUTANT 3 — accepter un projet non attendu doit ROUGIR ═══════════════
  it("MUTANT · une porte dont la cible attendue est interligens-t2 accepte t2", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      writeFileSync(join(dir, ".vercel/project.json"), JSON.stringify(LIAISON_T2));
      // Les deux verdicts DIVERGENT sur le MÊME arbre : le sabotage est visible.
      expect(porteProjet(dir, "production", LIAISON_T2).ok).toBe(true);
      expect(porteProjet(dir, "production").ok).toBe(false);
    } finally { nettoyer(); }
  });
});

describe("PORTE — CLI épinglé", () => {
  it("CLI introuvable ⇒ REFUS, et surtout PAS une exception", () => {
    // Le runner de CI n'a aucun CLI Vercel installé. C'est le cas réel, et il
    // doit produire une PORTE ROUGE — pas une levée qui ferait perdre le
    // verdict des autres portes.
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    const home = process.env.HOME;
    try {
      process.env.HOME = dir; // ni installation globale, ni cache npx
      const r = porteCli(dir);
      expect(r.ok).toBe(false);
      expect(r.detail).toContain("REFUS");
    } finally {
      process.env.HOME = home;
      nettoyer();
    }
  });
});

describe("FAIL-CLOSED — l'impossibilité de calculer n'est jamais un vert", () => {
  it("un `.nowignore` concurrent fait REFUSER, comme le CLI", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" }, "docs/");
    try {
      writeFileSync(join(dir, ".nowignore"), "x");
      expect(() => buildIgnore(dir)).toThrow(PreflightError);
    } finally { nettoyer(); }
  });

  it("un lien symbolique dans l'ensemble expédié fait REFUSER — cible indécidable", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      symlinkSync("/etc/passwd", join(dir, "lien.txt"));
      expect(() => buildManifest(dir)).toThrow(/lien symbolique/);
    } finally { nettoyer(); }
  });

  it("un `git ls-tree` vide fait REFUSER — un arbre vide n'est pas une mesure", () => {
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" });
    try {
      expect(() => filteredHead(dir, { exec: () => "" })).toThrow(PreflightError);
    } finally { nettoyer(); }
  });

  // ══ MUTANT 2 — exigé : passer quand le calcul échoue doit ROUGIR ═════════
  it("MUTANT · un preflight qui rend VERT sur échec de calcul est détecté", () => {
    // ⚠️ `.vercelignore` doit être NON VIDE : le CLI ne lève
    // CONFLICTING_IGNORE_FILES que si les DEUX fichiers ont du contenu, et nous
    // rejouons cette condition à l'identique. Un `.vercelignore` vide ici
    // rendait le test vert pour la mauvaise raison.
    const { dir, nettoyer } = depotJetable({ "a.ts": "x" }, "docs/");
    try {
      // On sabote le calcul en rendant le filtre impossible à construire.
      writeFileSync(join(dir, ".nowignore"), "x");
      mkdirSync(join(dir, ".vercel"), { recursive: true });
      writeFileSync(join(dir, ".vercel/project.json"), JSON.stringify(PROJET_PRODUCTION));

      const res = executerPreflight({ cwd: dir, target: "production", emitMarker: false });
      expect(res.ok).toBe(false);
      expect(res.manifest).toBeNull();
      const porte = res.portes.find((p: Porte) => p.nom === "Calcul de l'ensemble expédié");
      expect(porte).toBeDefined();
      expect(porte!.detail).toContain("FAIL-CLOSED");

      // Le mutant : `ok` calculé en ignorant les portes en échec.
      const mutantOk = res.portes.filter((p: Porte) => p.ok).length > 0;
      expect(mutantOk).toBe(true);        // le mutant dirait « vert »
      expect(res.ok).toBe(false);         // le contrôle sain refuse
      expect(res.ok).not.toBe(mutantOk);  // ils divergent : sabotage visible
    } finally { nettoyer(); }
  });

  it("aucun drapeau de contournement n'existe dans le preflight", () => {
    // On lit le CODE, pas les commentaires : le fichier explique justement
    // qu'il n'offre pas de `--force`, et cette phrase ne doit pas faire rougir
    // le test qui vérifie qu'il n'en offre pas.
    const src: string = readFileSync(
      join(process.cwd(), "scripts/preflight-deploy.mjs"), "utf8");
    const code = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(code).not.toMatch(/--force|--skip|SKIP_PREFLIGHT|allowDirty/);
    // et la lecture d'argv ne connaît que les trois drapeaux déclarés
    expect(code.match(/argv\.includes\("([^"]+)"\)/g) ?? []).toEqual([
      'argv.includes("--emit-marker")',
      'argv.includes("--json")',
    ]);
  });
});

describe("LE MARQUEUR — identité du source-set, et rien de plus", () => {
  it("la racine EXCLUT son propre fichier, sinon elle ne peut pas exister", () => {
    const manifeste = [
      { path: "a.ts", sha1: "aa" },
      { path: MARQUEUR, sha1: "peu-importe" },
      { path: "b.ts", sha1: "bb" },
    ];
    const r1 = construireMarqueur(manifeste, {});
    const autreMarqueur = [...manifeste];
    autreMarqueur[1] = { path: MARQUEUR, sha1: "completement-different" };
    const r2 = construireMarqueur(autreMarqueur, {});
    expect(r1.root).toBe(r2.root); // le contenu du marqueur n'entre pas dans sa racine
    expect(r1.contenu.fileCount).toBe(2);
    expect(r1.contenu.excludesSelf).toBe(MARQUEUR);
  });

  it("la racine change si UN octet change, et si l'ordre change elle NE change pas", () => {
    const a = [{ path: "x", sha1: "1" }, { path: "y", sha1: "2" }];
    const b = [{ path: "x", sha1: "1" }, { path: "y", sha1: "3" }];
    expect(merkleRoot(a)).not.toBe(merkleRoot(b));
    expect(merkleRoot(a)).toBe(merkleRoot([...a])); // déterministe
  });

  it("une feuille ne peut pas se faire passer pour un nœud", () => {
    // Préfixes de domaine distincts : sans eux, la structure est malléable.
    const src = readFileSync(
      join(process.cwd(), "scripts/preflight/upload-set.mjs"), "utf8");
    expect(src).toContain('"leaf\\0"');
    expect(src).toContain('"node\\0"');
  });

  it("une racine sur un manifeste vide est REFUSÉE", () => {
    expect(() => merkleRoot([])).toThrow(PreflightError);
  });

  // ⛔ LE CLASSEMENT, ÉCRIT DANS LA DONNÉE ET NON SEULEMENT À CÔTÉ
  it("le marqueur porte le classement RC sans l'adoucir", () => {
    const { contenu } = construireMarqueur([{ path: "a", sha1: "1" }], {});
    expect(contenu.attestation.sourceInputIntegrity).toBe("PROVEN");
    expect(contenu.attestation.buildReproducibilitySLSA).toBe("NOT_ESTABLISHED");
    expect(contenu.attestation.servedDeploymentBinding)
      .toBe("provider-asserted unless independently attestable");
  });
});

describe("le dépôt réel", () => {
  it("l'ensemble expédié ne contient AUCUN secret", () => {
    const manifeste = buildManifest(process.cwd());
    const refus = screenManifest(manifeste);
    expect(refus.map((r: Refus) => `${r.verdict} ${r.path}`)).toEqual([]);
  });

  it("le HEAD filtré est non vide et exclut docs/ et __tests__/", () => {
    const head: string[] = filteredHead(process.cwd(), { exec: execGit });
    expect(head.length).toBeGreaterThan(500);
    expect(head.some((p: string) => p.startsWith("docs/"))).toBe(false);
    expect(head.some((p: string) => p.startsWith("__tests__/"))).toBe(false);
  });

  it("la version rejouée est déclarée et non vide", () => {
    expect(FILTRE_REJOUE_DEPUIS).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
