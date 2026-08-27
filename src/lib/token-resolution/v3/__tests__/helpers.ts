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

/**
 * Base factice pilotée par le SQL. Une requête sans route déclarée renvoie zéro
 * ligne — jamais une erreur : le test doit pouvoir vérifier qu'une source n'est
 * pas consultée sans avoir à toutes les déclarer.
 */
export function createFakeDb(routes: FakeDbRoute[]): FakeDb {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    queries,
    async query<T>(sql: string, params: unknown[]): Promise<T[]> {
      queries.push({ sql, params });
      const hit = routes.find((r) => sql.includes(r.match));
      return (hit ? hit.rows : []) as T[];
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
