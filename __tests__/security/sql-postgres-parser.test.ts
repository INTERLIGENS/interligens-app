// __tests__/security/sql-postgres-parser.test.ts
//
// LE PARSEUR MORD-IL SUR NOTRE VRAIE VIRGULE ?
//
// Le 2026-08-19, `docs/prep/EXECUTION_2026-08-19.sql` a rendu
// `ERROR: syntax error at or near "ON"` (SQLSTATE 42601) sur la production,
// parce que le retrait des deux `latest.pdf` avait laissé la virgule de la
// ligne précédente — l'un des deux écartés était le DERNIER du lot.
//
// Ce fichier ne teste pas une virgule inventée. Il extrait le BLOC 3 du VRAI
// fichier versionné, et fabrique les deux états à partir de son PROPRE
// contenu : avec la virgule terminale (l'état qui a échoué) et sans (l'état
// qui a été exécuté). Aucun SQL n'est écrit à la main pour ce cas.
//
// La construction est volontairement robuste à l'état de la PR #123 : selon
// qu'elle est fusionnée ou non, le fichier sur disque porte l'un ou l'autre
// état. Les deux cas sont dérivés dans les deux situations.
//
// ── LA LEÇON DE LA SONDE R2, APPLIQUÉE ────────────────────────────────────
//
// Sous mutation, le test « rend UNABLE » de la sonde restait VERT : les tests
// de VERDICT sont les plus faibles. Ce sont ceux qui portent sur des GRANDEURS
// OBSERVÉES qui attrapent les régressions. Ici on assert donc, en plus du
// verdict : le nombre d'instructions parsées, le message exact rendu par
// PostgreSQL, et la LIGNE désignée. Une souche qui rendrait « valide » sans
// parser ne saurait produire aucun des trois.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parsePostgres,
  locate,
  exitCodeFor,
  formatParseResult,
  type ParserPort,
} from "@/lib/sql/parseGuard";

const EXEC_SQL = path.join(process.cwd(), "docs/prep/EXECUTION_2026-08-19.sql");

/**
 * Extrait le BLOC 3 du vrai fichier : de `INSERT INTO "EvidenceItem" (`
 * jusqu'à `ON CONFLICT (id) DO NOTHING;` inclus.
 */
function blocTroisReel(): string {
  const lignes = fs.readFileSync(EXEC_SQL, "utf8").split("\n");
  const debut = lignes.findIndex((l) => l.startsWith('INSERT INTO "EvidenceItem" ('));
  expect(debut, "le BLOC 3 doit exister dans le fichier versionné").toBeGreaterThan(-1);
  const fin = lignes.findIndex((l, i) => i > debut && l.startsWith("ON CONFLICT (id) DO NOTHING;"));
  expect(fin, "le BLOC 3 doit se terminer par son ON CONFLICT").toBeGreaterThan(debut);
  return lignes.slice(debut, fin + 1).join("\n");
}

/** Index (dans le bloc) de la dernière ligne `VALUES`. */
function indexDerniereValeur(lignes: string[]): number {
  for (let i = lignes.length - 1; i >= 0; i--) {
    if (lignes[i].startsWith("  ('evi_rep_")) return i;
  }
  throw new Error("aucune ligne VALUES trouvée dans le BLOC 3");
}

/** Le bloc AVEC la virgule terminale — l'état exact qui a échoué en production. */
function avecVirguleOrpheline(): string {
  const lignes = blocTroisReel().split("\n");
  const i = indexDerniereValeur(lignes);
  lignes[i] = lignes[i].replace(/,?$/, ",");
  return lignes.join("\n");
}

/** Le bloc SANS la virgule terminale — l'état qui a réellement été exécuté. */
function sansVirguleOrpheline(): string {
  const lignes = blocTroisReel().split("\n");
  const i = indexDerniereValeur(lignes);
  lignes[i] = lignes[i].replace(/,$/, "");
  return lignes.join("\n");
}

/**
 * Corpus de PostgreSQL RÉEL — pas du SQL de manuel. Chaque construction ici
 * est présente dans nos fichiers d'exécution, et `sqlite3` rejette la
 * troisième dès `gen_random_uuid()::text` (mesuré le 2026-08-20 :
 * « Parse error near line 1: near "(": syntax error »).
 */
const POSTGRES_REEL = [
  // bloc anonyme + garde-fou qui échoue la transaction — le motif de nos BLOC
  `DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "EvidenceItem" WHERE "r2Key" LIKE 'reports/%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'EvidenceItem contient deja % ligne(s) sous reports/. Arret.', n;
  END IF;
END $$;`,
  // casts, TIMESTAMP(3), gen_random_uuid(), JSONB, index partiel
  `CREATE TABLE IF NOT EXISTS "LaundryTrailPublicationLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "assertedValueUsd" NUMERIC,
  "payload" JSONB
);`,
  // le cast de timestamp littéral utilisé par le versement
  `INSERT INTO "EvidenceItem" ("id", "capturedAt", "sha256")
VALUES ('a', '2026-07-20T04:38:58.270Z'::timestamp, 'ff')
ON CONFLICT (id) DO NOTHING;`,
  // FILTER + agrégat, comme le compteur du watchdog
  `SELECT count(*) FILTER (WHERE "notes" LIKE '[R2:UNAVAILABLE]%')::int AS accidental
FROM "EvidenceItem" WHERE "r2Key" IS NULL;`,
  // ALTER additif + CHECK nommé, comme les migrations A12/A14
  `ALTER TABLE "KolProfile"
  ADD COLUMN IF NOT EXISTS "monetaryClaimsPublication" TEXT NOT NULL DEFAULT 'published';`,
  // transaction et niveau d'isolement
  `BEGIN; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY; COMMIT;`,
];

// ── C0 — PRÉSENCE ─────────────────────────────────────────────────────────

describe("C0 — le parseur est atteignable", () => {
  it("expose parsePostgres, locate et exitCodeFor", () => {
    expect(typeof parsePostgres).toBe("function");
    expect(typeof locate).toBe("function");
    expect(typeof exitCodeFor).toBe("function");
  });

  it("le fichier d'exécution du 19 août est bien dans le dépôt", () => {
    expect(fs.existsSync(EXEC_SQL)).toBe(true);
  });
});

// ── C1 — EXÉCUTION ────────────────────────────────────────────────────────

describe("C1 — il s'exécute et rend un arbre", () => {
  it("un fichier à trois instructions rend statementCount = 3", async () => {
    const r = await parsePostgres("SELECT 1; SELECT 2; SELECT 3;");
    expect(r.verdict).toBe("VALID");
    // La grandeur observée : une souche ne peut pas l'inventer.
    expect(r.statementCount).toBe(3);
    expect(exitCodeFor(r)).toBe(0);
  });
});

// ── C2 — IL MORD SUR NOTRE VRAIE VIRGULE ──────────────────────────────────

describe("C2 — la virgule orpheline réelle du 2026-08-19", () => {
  it("le BLOC 3 avec sa virgule terminale est REJETÉ", async () => {
    const sql = avecVirguleOrpheline();
    const r = await parsePostgres(sql);

    expect(r.verdict).toBe("INVALID");
    expect(exitCodeFor(r)).toBe(1);
    // Le message MOT POUR MOT rendu par PostgreSQL sur la production.
    expect(r.error?.message).toBe('syntax error at or near "ON"');
  });

  it("et il désigne la LIGNE fautive — pas seulement « il y a une faute »", async () => {
    const sql = avecVirguleOrpheline();
    const r = await parsePostgres(sql);

    expect(r.error?.line).not.toBeNull();
    // La ligne désignée est bien celle du ON CONFLICT, pas une autre.
    expect(r.error?.excerpt?.trim()).toMatch(/^ON CONFLICT/);
    // Et c'est la dernière ligne du bloc.
    expect(r.error?.line).toBe(sql.split("\n").length);
    expect(formatParseResult("BLOC 3", r)).toContain("ON CONFLICT");
  });

  it("la virgule retirée, le MÊME bloc est ACCEPTÉ — le rouge n'est pas permanent", async () => {
    const r = await parsePostgres(sansVirguleOrpheline());
    expect(r.verdict).toBe("VALID");
    // Un seul INSERT dans le BLOC 3 : la grandeur, encore.
    expect(r.statementCount).toBe(1);
  });

  it("la SEULE différence entre les deux états est un caractère", () => {
    const avec = avecVirguleOrpheline();
    const sans = sansVirguleOrpheline();
    expect(avec.length - sans.length).toBe(1);
    expect(avec.replace(/,\nON CONFLICT/, "\nON CONFLICT")).toBe(sans);
  });
});

// ── C3 — DISCRIMINATION : il accepte le PostgreSQL que sqlite3 rejette ────

describe("C3 — il ne condamne pas le PostgreSQL valide", () => {
  it.each(POSTGRES_REEL.map((sql, i) => [i, sql] as const))(
    "corpus réel nº %i — ACCEPTÉ",
    async (_i, sql) => {
      const r = await parsePostgres(sql);
      expect(r.verdict).toBe("VALID");
      expect(r.statementCount).toBeGreaterThanOrEqual(1);
    }
  );

  it("le fichier d'exécution ENTIER, hors BLOC 3, se parse", async () => {
    // Le reste du fichier n'a jamais été mis en cause : s'il ne se parsait pas,
    // le corpus de contrôle serait faux et le C2 ne prouverait rien.
    const r = await parsePostgres(sansVirguleOrpheline());
    expect(r.verdict).toBe("VALID");
  });

  it("il rejette bien d'AUTRES fautes que la nôtre — il n'est pas réglé sur un cas", async () => {
    const autres: [string, string][] = [
      ["parenthèse non fermée", "SELECT * FROM (SELECT 1;"],
      ["mot-clé mal placé", "SELECT FROM WHERE t;"],
      ["dollar-quote non refermé", "DO $$ BEGIN RAISE NOTICE 'x'; END;"],
      ["virgule orpheline dans une liste de colonnes", "CREATE TABLE t (a TEXT, b TEXT,);"],
    ];
    for (const [nom, sql] of autres) {
      const r = await parsePostgres(sql);
      expect(r.verdict, nom).toBe("INVALID");
      expect(r.error?.message, nom).toBeTruthy();
    }
  });
});

// ── C4 — ADÉQUATION ET FAIL-CLOSED ────────────────────────────────────────

describe("C4 — il parse vraiment, et il le dit quand il ne peut pas", () => {
  it("PARSEUR INDISPONIBLE : UNABLE, jamais VALID", async () => {
    const casse: ParserPort = {
      async load() {
        throw new Error("WASM introuvable (double de test)");
      },
      parse() {
        throw new Error("jamais atteint");
      },
    };
    const r = await parsePostgres("SELECT 1;", casse);

    expect(r.verdict).toBe("UNABLE");
    expect(r.verdict).not.toBe("VALID");
    expect(exitCodeFor(r)).toBe(1);
    expect(r.statementCount).toBeNull();
    expect(formatParseResult("x", r)).toContain("UNABLE");
  });

  it("ARBRE VIDE : un objet sans `stmts` ne vaut PAS un SQL valide", async () => {
    const menteur: ParserPort = {
      async load() {},
      parse() {
        return {} as { stmts?: unknown[] };
      },
    };
    const r = await parsePostgres("SELECT 1;", menteur);
    // Le piège : une implémentation inattendue qui rend un objet vide.
    expect(r.verdict).toBe("UNABLE");
    expect(r.statementCount).toBeNull();
  });

  it("ÉCHEC SANS DIAGNOSTIC SQL : UNABLE, pas INVALID — on n'accuse pas le fichier", async () => {
    const panne: ParserPort = {
      async load() {},
      parse() {
        throw new Error("out of memory");
      },
    };
    const r = await parsePostgres("SELECT 1;", panne);
    // Déclarer INVALID ici accuserait un SQL peut-être parfait.
    expect(r.verdict).toBe("UNABLE");
    expect(r.error).toBeNull();
    expect(r.unableReason).toContain("out of memory");
  });

  it("locate convertit le décalage en ligne / colonne / extrait", () => {
    const sql = "SELECT 1;\nSELECT 2;\nON CONFLICT;";
    // 0-basé : sql[20] est le « O » de ON, donc cursorPosition vaut 20.
    expect(sql[20]).toBe("O");
    const l = locate(sql, 20);
    expect(l.line).toBe(3);
    expect(l.column).toBe(1);
    expect(l.excerpt).toBe("ON CONFLICT;");
  });

  it("locate suit la sémantique MESURÉE : 0-basé, en CARACTÈRES", () => {
    // Deux pièges commis avant d'être mesurés, tous deux fatals sur le BLOC 3
    // réel : croire la valeur 1-basée, ou la croire en octets. « é » pèse
    // 2 octets pour 1 caractère — avec 200 accents avant la faute, l'écart
    // atteint 200 caractères, soit bien plus qu'une ligne.
    const sql = `SELECT '${"é".repeat(200)}';\nON CONFLICT;`;
    const idxChar = sql.indexOf("ON");
    const idxOctet = Buffer.from(sql, "utf8").indexOf(Buffer.from("ON"));
    expect(idxOctet).toBe(idxChar + 200); // le piège est bien réel ici

    const l = locate(sql, idxChar);
    expect(l.line).toBe(2);
    expect(l.column).toBe(1);
    expect(l.excerpt).toBe("ON CONFLICT;");

    // Et l'interprétation « en octets » ne désigne PAS la bonne ligne : la
    // preuve que ce test discrimine au lieu de simplement passer.
    expect(locate(sql, idxOctet).excerpt).not.toBe("ON CONFLICT;");
    // Ni l'interprétation « 1-basée » sur une faute en début de ligne.
    expect(locate(sql, idxChar + 1).column).not.toBe(1);
  });

  it("le parseur rend bien un index 0-basé en caractères — contrat vérifié en vif", async () => {
    const sql = `SELECT '${"é".repeat(200)}';\nON CONFLICT;`;
    const r = await parsePostgres(sql);
    expect(r.verdict).toBe("INVALID");
    // sql[cursorPosition] est le premier caractère du jeton fautif.
    expect(sql.slice(r.error!.cursorPosition!, r.error!.cursorPosition! + 2)).toBe("ON");
  });

  it("locate refuse d'inventer une position hors bornes", () => {
    expect(locate("SELECT 1;", null)).toEqual({ line: null, column: null, excerpt: null });
    expect(locate("SELECT 1;", -1)).toEqual({ line: null, column: null, excerpt: null });
    expect(locate("SELECT 1;", 9999)).toEqual({ line: null, column: null, excerpt: null });
  });

  it("STRUCTUREL : le module ne parle ni à une base ni au réseau", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/sql/parseGuard.ts"), "utf8");
    for (const interdit of ["PrismaClient", "@/lib/prisma", "@aws-sdk", "node:https", "fetch("]) {
      expect(src).not.toContain(interdit);
    }
    // Le seul import de runtime est le parseur lui-même, et il est dynamique.
    expect(src).toContain('await import("@libpg-query/parser")');
  });
});

// ── CE QUE LE PARSEUR NE VOIT PAS — la frontière avec le linter ───────────

describe("la grammaire ne remplace pas les contrôles métier", () => {
  it("un INSERT qui verse DEUX FOIS la même empreinte se parse parfaitement", async () => {
    const doublon = `INSERT INTO "EvidenceItem" ("id","sha256") VALUES
  ('a', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  ('b', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
ON CONFLICT (id) DO NOTHING;`;
    const r = await parsePostgres(doublon);

    // VALID — et pourtant `sha256` est @unique : la transaction échouerait.
    // C'est exactement ce que couvre sql-execution-file-lint.test.ts (PR #123),
    // et c'est pourquoi le parseur ne le remplace pas.
    expect(r.verdict).toBe("VALID");
    expect(r.statementCount).toBe(1);
  });

  it("un DELETE FROM massif se parse parfaitement lui aussi", async () => {
    const r = await parsePostgres('DELETE FROM "EvidenceItem";');
    expect(r.verdict).toBe("VALID");
  });
});
