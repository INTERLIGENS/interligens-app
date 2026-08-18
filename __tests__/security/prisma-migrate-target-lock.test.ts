// __tests__/security/prisma-migrate-target-lock.test.ts
//
// A9 — LE VERROU DE COHÉRENCE DE LA CIBLE DE MIGRATION.
//
// Le défaut corrigé n'était pas « prisma migrate casse la prod ». C'était pire
// et plus discret : `directUrl` désignait `ep-bold-sky`, un AUTRE projet Neon.
// `prisma migrate deploy|dev|status` et `prisma db push` y partaient, y
// créaient `_prisma_migrations`, et rendaient « SUCCÈS ». Le danger n'est pas
// de casser la production — c'est de croire l'avoir migrée.
//
// La protection était une INTERDICTION ÉCRITE dans CLAUDE.md, donc une
// discipline humaine. Ce fichier vérifie qu'elle est devenue un REFUS DU
// SYSTÈME : la tentative échoue d'elle-même, bruyamment, et avant tout accès
// réseau.
//
// ── CE QUI EST EXÉCUTÉ, PAS DÉDUIT ────────────────────────────────────────
//
// Les tests lancent réellement le binaire Prisma et lisent son code de sortie.
// Ils ne se contentent PAS de relire le schema : un test qui vérifierait
// seulement la présence d'une chaîne dans un fichier prouverait que quelqu'un
// a écrit quelque chose, pas que l'outil refuse.
//
// ── POURQUOI C'EST SANS DANGER ────────────────────────────────────────────
//
// L'échec survient à l'étape `getConfig`, AVANT la résolution de `url` et
// avant toute ouverture de socket. Mesuré : l'erreur P1012 nomme `directUrl`
// alors même que, sur la sonde jetable, `url` est tout aussi absente — le
// moteur s'arrête sur la cible de migration en premier. Aucun de ces tests ne
// peut donc joindre `ep-square-band` ni `ep-bold-sky`.
//
// ── LES DEUX SCHEMAS, ET POURQUOI LES DEUX ────────────────────────────────
//
// `prisma/schema.prod.prisma` est la cible explicite (`db:deploy` la nomme).
// `prisma/schema.prisma` est le schema PAR DÉFAUT — celui qu'on atteint en
// OUBLIANT le drapeau, et `db:status` l'atteint déjà. CLAUDE.md le décrit
// comme « dev SQLite » : c'est faux, il est `postgresql` et visait la même
// base. Verrouiller l'un sans l'autre aurait donné un demi-verrou d'apparence
// entière — pire que pas de verrou.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** La variable qui ne doit exister NULLE PART. C'est tout le mécanisme. */
const VARIABLE_INTERDITE = "PRISMA_MIGRATE_INTENTIONNELLEMENT_DESACTIVE_VOIR_CLAUDE_MD";

const SCHEMAS = [
  { role: "cible explicite (db:deploy)", fichier: "prisma/schema.prod.prisma" },
  { role: "schema PAR DÉFAUT (db:status, tout oubli de --schema)", fichier: "prisma/schema.prisma" },
];

const lire = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

/** Lance une commande et rend `{ code, sortie }` sans jamais lever. */
function lancer(args: string[]): { code: number; sortie: string } {
  try {
    const sortie = execFileSync("npx", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { code: 0, sortie };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, sortie: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("A9 — la cible de migration est verrouillée dans les DEUX schemas", () => {
  for (const s of SCHEMAS) {
    it(`${s.fichier} — ${s.role} : plus aucune trace de DATABASE_URL_UNPOOLED`, () => {
      const src = lire(s.fichier);
      expect(
        src.includes(`directUrl = env("${VARIABLE_INTERDITE}")`),
        `${s.fichier} ne porte plus le verrou`,
      ).toBe(true);
      // `DATABASE_URL_UNPOOLED` peut rester CITÉE dans le commentaire qui
      // explique le verrou ; ce qui ne doit plus exister, c'est l'affectation.
      expect(src).not.toMatch(/directUrl\s*=\s*env\("DATABASE_URL_UNPOOLED"\)/);
    });
  }

  it("la variable du verrou n'existe nulle part — ni en environnement, ni dans un fichier .env", () => {
    expect(process.env[VARIABLE_INTERDITE]).toBeUndefined();

    // On teste la PRÉSENCE DE LA CLÉ, jamais une valeur : aucun secret n'est
    // lu, comparé, ni a fortiori imprimé.
    const fichiersEnv = fs
      .readdirSync(process.cwd())
      .filter((f) => f === ".env" || f.startsWith(".env."));
    for (const f of fichiersEnv) {
      const cles = fs
        .readFileSync(path.join(process.cwd(), f), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("=")[0].trim());
      expect(cles, `${f} pose ${VARIABLE_INTERDITE} — le verrou serait désarmé`).not.toContain(
        VARIABLE_INTERDITE,
      );
    }
  });
});

describe("A9 — une tentative de migration échoue BRUYAMMENT, et avant tout réseau", () => {
  it("`prisma validate` sur le schema de production : sortie non nulle, P1012, variable nommée", () => {
    const { code, sortie } = lancer(["prisma", "validate", "--schema", "prisma/schema.prod.prisma"]);
    expect(code, "prisma validate a réussi — le verrou ne tient pas").not.toBe(0);
    expect(sortie).toContain("P1012");
    expect(sortie).toContain(`Environment variable not found: ${VARIABLE_INTERDITE}`);
  });

  it("`prisma migrate status` — la VRAIE commande de migration — s'arrête à getConfig", () => {
    // Sonde JETABLE dans le répertoire temporaire du système : elle reproduit
    // le bloc `datasource` du dépôt, mais ses DEUX variables sont inexistantes.
    // Même si le moteur allait au-delà de `directUrl`, il n'aurait aucune cible
    // à joindre. On lance donc la commande de migration elle-même sans jamais
    // pointer sur une base réelle.
    const sonde = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a9-")), "sonde.prisma");
    fs.writeFileSync(
      sonde,
      [
        "generator client {",
        '  provider = "prisma-client-js"',
        "}",
        "",
        "datasource db {",
        '  provider  = "postgresql"',
        '  url       = env("A9_SONDE_URL_QUI_N_EXISTE_PAS")',
        `  directUrl = env("${VARIABLE_INTERDITE}")`,
        "}",
        "",
        "model Sonde {",
        "  id String @id",
        "}",
        "",
      ].join("\n"),
    );

    const { code, sortie } = lancer(["prisma", "migrate", "status", "--schema", sonde]);

    expect(code, "prisma migrate status a réussi sur une cible incohérente").not.toBe(0);
    expect(sortie).toContain("[Context: getConfig]");
    expect(sortie).toContain(`Environment variable not found: ${VARIABLE_INTERDITE}`);

    // Le point décisif : sur la sonde, `url` est TOUT AUSSI absente que
    // `directUrl` — et le moteur ne signale qu'UNE erreur, celle de
    // `directUrl`. Il s'arrête donc sur la CIBLE DE MIGRATION, avant d'avoir
    // seulement tenté de résoudre la connexion : aucun accès réseau n'est
    // possible.
    //
    // (Le nom de la variable d'`url` APPARAÎT malgré tout dans la sortie :
    // Prisma affiche les lignes voisines en contexte. Ce n'est pas une
    // résolution, c'est un extrait de source — d'où l'assertion portée sur le
    // MESSAGE d'erreur, pas sur la présence de la chaîne.)
    expect(sortie).not.toContain("Environment variable not found: A9_SONDE_URL_QUI_N_EXISTE_PAS");
    expect(sortie).toContain("Validation Error Count: 1");

    fs.rmSync(path.dirname(sonde), { recursive: true, force: true });
  });

  it("le verrou ne casse PAS la génération du client — ni le build", () => {
    // Le contrôle qui manquerait le plus s'il n'était pas là. `vercel-build`
    // lance `prisma generate --schema prisma/schema.prod.prisma` : si le verrou
    // faisait échouer `generate`, il ferait échouer le déploiement.
    //
    // ISOLATION OBLIGATOIRE : un `prisma generate` sur le schema du dépôt
    // RÉÉCRIT le client dans `node_modules` pendant que le reste de la suite
    // l'importe — course garantie, et un échec qui n'a rien à voir avec le
    // verrou. On génère donc depuis une COPIE du schema, avec une sortie
    // redirigée vers un répertoire temporaire. Rien du dépôt n'est touché.
    // Le répertoire temporaire du SYSTÈME ne convient pas : Prisma infère
    // alors « / » comme racine de projet et tente un auto-install. On reste
    // donc sous le dépôt, dans `node_modules/.cache` — hors suivi Git, hors
    // de tout chemin lu par la construction.
    const cache = path.join(process.cwd(), "node_modules", ".cache");
    fs.mkdirSync(cache, { recursive: true });
    const dossier = fs.mkdtempSync(path.join(cache, "a9-gen-"));
    const copie = path.join(dossier, "schema.prisma");
    const sortieClient = path.join(dossier, "client");

    fs.writeFileSync(
      copie,
      lire("prisma/schema.prod.prisma").replace(
        /generator client \{/,
        `generator client {\n  output = "${sortieClient}"`,
      ),
    );

    const { code, sortie } = lancer(["prisma", "generate", "--schema", copie]);

    expect(
      code,
      `prisma generate échoue — le verrou casserait le build :\n${sortie}`,
    ).toBe(0);
    expect(fs.existsSync(sortieClient), "aucun client généré").toBe(true);

    fs.rmSync(dossier, { recursive: true, force: true });
  });
});

describe("A9 — les scripts du dépôt passent bien par les schemas verrouillés", () => {
  it("db:deploy et db:status ne peuvent atteindre qu'un schema verrouillé", () => {
    const pkg = JSON.parse(lire("package.json")) as { scripts: Record<string, string> };

    // `db:deploy` nomme explicitement le schema de production.
    expect(pkg.scripts["db:deploy"]).toContain("prisma/schema.prod.prisma");

    // `db:status` ne nomme AUCUN schema : il tombe sur le schema par défaut.
    // C'est pour cela que le verrou devait couvrir les deux — le test le fige
    // plutôt que de le supposer. Si quelqu'un ajoute `--schema` un jour, il
    // devra nommer un fichier, et ce test dira lequel.
    const status = pkg.scripts["db:status"];
    if (!status.includes("--schema")) {
      expect(lire("prisma/schema.prisma")).toContain(VARIABLE_INTERDITE);
    } else {
      const nomme = SCHEMAS.some((s) => status.includes(s.fichier));
      expect(nomme, `db:status vise un schema hors du périmètre verrouillé : ${status}`).toBe(true);
    }
  });
});
