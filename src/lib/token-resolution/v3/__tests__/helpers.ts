// Outils de test partagés. Aucun réseau, aucune base, aucune horloge réelle.
import { readFileSync } from "fs";
import { join } from "path";
import type { DbClient } from "../sources/db";

const FIXTURES = join(__dirname, "..", "__fixtures__");

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as T;
}

export interface FakeDbRoute {
  /** Sous-chaîne devant apparaître dans le SQL. */
  match: string;
  rows: Record<string, unknown>[];
}

export interface FakeDb extends DbClient {
  readonly queries: Array<{ sql: string; params: unknown[] }>;
}

/** Équivalent JS de la normalisation SQL des symboles (regexp_replace + upper). */
function normSym(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[$\s_-]/g, "");
}

const SYMBOL_COLUMNS = ["tokenSymbol", "ticker"];
const ADDRESS_COLUMNS = ["contractAddress", "canonicalMint", "tokenMint", "mint", "addr"];

/**
 * Applique les MÊMES filtres que le SQL réel.
 *
 * Sans ça, la base factice rend toutes les lignes de la table quelle que soit la
 * requête — et un test qui cherche $SERIAL-12RUGS reçoit aussi les lignes $GHOST.
 * Une fausse base plus permissive que la vraie ne teste rien : elle flatte.
 */
function applySqlFilters(
  sql: string,
  params: unknown[],
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  let out = rows;

  // Préfiltre par symbole : ... LIKE $1  avec $1 de la forme "SERI%"
  const likeArg = params.find((p) => typeof p === "string" && p.endsWith("%"));
  if (/LIKE \$\d/.test(sql) && typeof likeArg === "string") {
    const prefix = likeArg.slice(0, -1);
    out = out.filter((r) =>
      SYMBOL_COLUMNS.some((c) => c in r && normSym(r[c]).startsWith(prefix)),
    );
  }

  // Restriction par adresse : ... IN ($1, $2, …)
  if (/IN \(\$\d/.test(sql)) {
    const wanted = new Set(params.filter((p) => typeof p === "string" && !p.endsWith("%")));
    if (wanted.size > 0) {
      out = out.filter((r) =>
        ADDRESS_COLUMNS.some(
          (c) =>
            c in r &&
            typeof r[c] === "string" &&
            (wanted.has(r[c] as string) || wanted.has(String(r[c]).toLowerCase())),
        ),
      );
    }
  }

  return out;
}

/**
 * Base factice pilotée par le SQL. Une requête sans route déclarée renvoie zéro
 * ligne — jamais une erreur : le test doit pouvoir vérifier qu'une source n'est
 * pas consultée sans avoir à toutes les déclarer.
 *
 * Les lignes déclarées passent par les mêmes filtres que le SQL réel (préfixe de
 * symbole, restriction par adresse), pour qu'un test ne puisse pas être vert
 * grâce à une permissivité que la production n'a pas.
 */
export function createFakeDb(routes: FakeDbRoute[]): FakeDb {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    queries,
    async query<T>(sql: string, params: unknown[]): Promise<T[]> {
      queries.push({ sql, params });
      const hit = routes.find((r) => sql.includes(r.match));
      if (!hit) return [] as T[];
      return applySqlFilters(sql, params, hit.rows) as T[];
    },
  };
}

/** Horloge manuelle pour tester les durées de vie sans dormir. */
export function manualClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}
