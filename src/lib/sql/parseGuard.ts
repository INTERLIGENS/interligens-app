/**
 * GARDE DE GRAMMAIRE SQL — PostgreSQL réel, hors connexion.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Le 2026-08-19, `docs/prep/EXECUTION_2026-08-19.sql` portait une virgule
 * orpheline : le retrait des deux `latest.pdf` avait laissé la virgule de la
 * ligne précédente, et l'un des deux écartés était le DERNIER du lot. Le
 * fichier se terminait donc par `…'retroactive'),` suivi de
 * `ON CONFLICT (id) DO NOTHING;`. PostgreSQL a rendu :
 *
 *     ERROR: syntax error at or near "ON"   (SQLSTATE 42601)
 *
 * sur le fichier qui ouvrait une chaîne de conservation.
 *
 * **Le défaut n'était pas la virgule.** Toutes les vérifications de la journée
 * portaient sur le SENS — compter les lignes, comparer les colonnes caractère
 * par caractère, relire les garde-fous en transaction — et AUCUNE sur la
 * GRAMMAIRE. Personne n'a demandé si le fichier se parsait.
 *
 * CE QUI REND CE MODULE POSSIBLE, ET CE QUI LE RENDAIT IMPOSSIBLE AVANT
 * --------------------------------------------------------------------
 * Mesuré le 2026-08-19 : ni `psql`, ni `postgres`, ni `pgsanity`, ni Docker,
 * ni `sqlparse`/`pglast` côté Python. `sqlite3` est présent, et c'est un FAUX
 * AMI — mesuré le 2026-08-20, il rejette ceci, qui est du PostgreSQL valide :
 *
 *     sqlite3> CREATE TABLE z (id TEXT PRIMARY KEY
 *                DEFAULT gen_random_uuid()::text, ts TIMESTAMP(3) …);
 *     Parse error near line 1: near "(": syntax error
 *
 * `@libpg-query/parser` est le parseur de PostgreSQL lui-même compilé en WASM :
 * la même grammaire que le serveur, sans serveur. Aucun appel réseau, aucune
 * base, aucune connexion. Il rend l'arbre syntaxique ou il lève — et le message
 * qu'il lève est mot pour mot celui du serveur.
 *
 * CE QU'IL NE FAIT PAS — et pourquoi le linter de la PR #123 reste
 * ----------------------------------------------------------------
 * La grammaire ne voit que la forme. **Un fichier peut se parser parfaitement
 * et verser deux fois la même preuve**, ou déclarer 34 lignes là où le
 * garde-fou en attend 32. Les empreintes `sha256` en double, le compte de
 * lignes `VALUES` confronté au garde-fou, l'absence de `DELETE`/`TRUNCATE` :
 * rien de tout cela n'est une question de syntaxe.
 *
 *     SQL généré → parse PostgreSQL réel → contrôles métier → exécution
 *
 * Le parseur est le deuxième maillon. Il ne remplace jamais le troisième.
 *
 * FAIL-CLOSED — la leçon de la sonde R2, appliquée ici
 * ----------------------------------------------------
 * Trois verdicts, jamais deux. Si le module WASM ne charge pas, on ne rend
 * PAS « valide » : on rend `UNABLE`. Un contrôle qui n'a pas pu s'exécuter
 * n'est pas un contrôle qui passe.
 *
 * Et `statementCount` est renseigné sur le chemin VALID : c'est ce qui rend le
 * verdict INFALSIFIABLE par une souche. Une implémentation qui rendrait
 * « valide » sans parser ne saurait pas combien d'instructions contient le
 * fichier. La leçon de la sonde était exactement celle-là : sous mutation, le
 * test de VERDICT restait vert ; ce sont les tests sur les GRANDEURS OBSERVÉES
 * qui ont attrapé la faute.
 */

export type ParseVerdict = "VALID" | "INVALID" | "UNABLE";

export interface ParseErrorInfo {
  /** Message brut de PostgreSQL, ex. `syntax error at or near "ON"`. */
  message: string;
  /** Décalage 1-basé rendu par le parseur, ou null. */
  cursorPosition: number | null;
  line: number | null;
  column: number | null;
  /** La ligne fautive, telle quelle. */
  excerpt: string | null;
}

export interface ParseResult {
  verdict: ParseVerdict;
  /**
   * Nombre d'instructions de l'arbre. Renseigné UNIQUEMENT sur VALID, et
   * uniquement par un parse réel — c'est le témoin d'adéquation.
   */
  statementCount: number | null;
  error: ParseErrorInfo | null;
  /** Renseigné uniquement sur UNABLE. */
  unableReason: string | null;
}

/**
 * L'unique capacité dont ce module a besoin. Injectable pour que les tests
 * puissent démontrer le fail-closed sans casser l'installation.
 */
export interface ParserPort {
  load(): Promise<void>;
  parse(sql: string): { stmts?: unknown[] };
}

/**
 * Convertit le décalage rendu par le parseur en ligne / colonne, et ramène la
 * ligne fautive. Sans ça, un rejet dit « il y a une faute » sans dire OÙ —
 * et sur un fichier de 942 lignes, ce n'est pas exploitable.
 *
 * ⚠️ SÉMANTIQUE DE `cursorPosition` — MESURÉE, PAS SUPPOSÉE (2026-08-20)
 * ---------------------------------------------------------------------
 * PostgreSQL documente `cursorpos` comme **1-basé, en caractères**. Ce que
 * `@libpg-query/parser` rend est **0-basé, en caractères** : `sql[cursorPosition]`
 * est le PREMIER caractère du jeton fautif. Mesuré sur trois cas dont deux
 * avec des accents avant la faute :
 *
 *   SQL                          cursorPosition   index caractère   index octet
 *   ASCII court                  40               40                40
 *   « SELECT 'ééééé'; ON… »      16               16                21
 *   200 « é » avant la faute     211              211               411
 *
 * Les deux erreurs possibles ont été commises ici avant d'être mesurées, et
 * les deux désignaient la mauvaise ligne du BLOC 3 réel :
 *   — traiter la valeur comme 1-basée  → une ligne trop tôt ;
 *   — la traiter comme un décalage en octets → très loin, dans les `notes`,
 *     parce que nos fichiers portent du français donc de l'UTF-8 multi-octets.
 *
 * Un contrôle qui désigne la mauvaise ligne ne vaut pas mieux que pas de
 * contrôle. La sémantique est donc verrouillée par un test à accents.
 */
export function locate(
  sql: string,
  cursorPosition: number | null | undefined
): { line: number | null; column: number | null; excerpt: string | null } {
  if (cursorPosition == null || cursorPosition < 0 || cursorPosition > sql.length) {
    return { line: null, column: null, excerpt: null };
  }
  const before = sql.slice(0, cursorPosition);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = cursorPosition - lastNl; // 1-basée, comme un éditeur l'affiche
  const excerpt = sql.split("\n")[line - 1] ?? null;
  return { line, column, excerpt };
}

function defaultPort(): ParserPort {
  let mod: typeof import("@libpg-query/parser") | null = null;
  return {
    async load() {
      mod = await import("@libpg-query/parser");
      await mod.loadModule();
    },
    parse(sql: string) {
      if (!mod) throw new Error("parseGuard: module non chargé");
      return mod.parseSync(sql) as { stmts?: unknown[] };
    },
  };
}

/**
 * Parse `sql` avec la grammaire de PostgreSQL.
 *
 * VALID   — l'arbre a été produit. `statementCount` le prouve.
 * INVALID — PostgreSQL refuse. `error` porte le message, la ligne, la colonne.
 * UNABLE  — le parseur n'a pas pu s'exécuter. **Jamais confondu avec VALID.**
 */
export async function parsePostgres(sql: string, port?: ParserPort): Promise<ParseResult> {
  const p = port ?? defaultPort();

  try {
    await p.load();
  } catch (err) {
    return {
      verdict: "UNABLE",
      statementCount: null,
      error: null,
      unableReason: `chargement du parseur impossible — ${describe(err)}`,
    };
  }

  try {
    const tree = p.parse(sql);
    // Un arbre sans `stmts` n'est pas un arbre : on ne peut pas affirmer VALID
    // sur la foi d'un objet vide rendu par une implémentation inattendue.
    if (!tree || !Array.isArray(tree.stmts)) {
      return {
        verdict: "UNABLE",
        statementCount: null,
        error: null,
        unableReason: "le parseur n'a rendu aucun arbre exploitable (`stmts` absent)",
      };
    }
    return { verdict: "VALID", statementCount: tree.stmts.length, error: null, unableReason: null };
  } catch (err) {
    const details = extractSqlDetails(err);
    // Une erreur qui ne ressemble pas à une erreur de syntaxe PostgreSQL n'est
    // pas un verdict sur le SQL : c'est une panne du contrôle. Fail-closed.
    if (!details) {
      return {
        verdict: "UNABLE",
        statementCount: null,
        error: null,
        unableReason: `échec du parseur sans diagnostic SQL — ${describe(err)}`,
      };
    }
    const { line, column, excerpt } = locate(sql, details.cursorPosition);
    return {
      verdict: "INVALID",
      statementCount: null,
      error: {
        message: details.message,
        cursorPosition: details.cursorPosition ?? null,
        line,
        column,
        excerpt,
      },
      unableReason: null,
    };
  }
}

function extractSqlDetails(
  err: unknown
): { message: string; cursorPosition: number | null } | null {
  const e = err as
    | { name?: string; message?: string; sqlDetails?: { message?: string; cursorPosition?: number } }
    | undefined;
  if (!e) return null;
  const d = e.sqlDetails;
  if (d && typeof d.message === "string") {
    return { message: d.message, cursorPosition: typeof d.cursorPosition === "number" ? d.cursorPosition : null };
  }
  // Repli : le parseur signale son type, mais sans détail structuré.
  if (e.name === "SqlError" && typeof e.message === "string") {
    return { message: e.message, cursorPosition: null };
  }
  return null;
}

function describe(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  return `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`;
}

/** 0 seulement si VALID. INVALID et UNABLE sortent en échec. */
export function exitCodeFor(r: ParseResult): number {
  return r.verdict === "VALID" ? 0 : 1;
}

export function formatParseResult(label: string, r: ParseResult): string {
  if (r.verdict === "VALID") {
    return `VALID    ${label} — ${r.statementCount} instruction(s)`;
  }
  if (r.verdict === "UNABLE") {
    return `UNABLE   ${label} — ${r.unableReason}`;
  }
  const e = r.error!;
  const where = e.line != null ? `ligne ${e.line}, colonne ${e.column}` : `position ${e.cursorPosition ?? "?"}`;
  const excerpt = e.excerpt ? `\n           ${e.excerpt.trim().slice(0, 120)}` : "";
  return `INVALID  ${label} — ${e.message} (${where})${excerpt}`;
}
