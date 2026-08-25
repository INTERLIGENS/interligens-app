// ─── Adaptateur `JobRunLog` → `WatcherRunRecord[]` ───────────────────────────
//
// Le seul endroit du système où la sonde C4 touche la base. La sonde elle-même
// (`watcherHealthProbe.ts`) reste une fonction pure sur des données : c'est ce
// qui permet de prouver ses 6 invariants par mutation, sans base.
//
// ── LE PIÈGE QUE CE FICHIER EXISTE POUR DÉSAMORCER ────────────────────────
//
// Les 4 colonnes temporelles de `JobRunLog` sont `timestamp without time zone`.
// Les drivers PostgreSQL de Node (`pg`, et Prisma qui s'appuie dessus) parsent
// ce type dans le fuseau LOCAL DU PROCESS. Mesuré sur la production le
// 2026-08-25 : la dernière ligne vaut `2026-08-25 07:06:32` en base et ressort
// à `2026-08-25T05:06:32.760Z` depuis un process en Europe/Paris — 2 h d'écart.
// Depuis Host-001 (Lombok, UTC+8) l'écart serait de 8 h.
//
// C'est exactement le défaut SI-01 qui fausse déjà l'ancien check n°1 du
// watchdog (`MAX(discoveredAtUtc)`), dont le seuil affiché à 3,5 j se déclenche
// en réalité à 3,17 j. Une sonde de fraîcheur qui se trompe de 8 h sur ses
// propres mesures ne vaut pas mieux que celle qu'elle remplace.
//
// LA PARADE : `"colonne" AT TIME ZONE 'UTC'`. Sur un `timestamp without time
// zone`, cet opérateur dit « cette valeur naïve EST de l'UTC » et rend un
// `timestamptz`, c'est-à-dire un instant absolu — que le driver ne peut plus
// décaler. Vérifié sur la vraie ligne : `07:06:32.760Z`, la bonne valeur.
//
// Toute colonne temporelle ajoutée ici plus tard DOIT passer par la même forme.

import type { WatcherRunRecord } from "./watcherRunTypes";
import { SOURCE_WATCHER_V2 } from "./watcherRunTypes";

/** Exécute une requête paramétrée et rend les lignes. Abstrait `pg` et Prisma. */
export type SqlRunner = (sql: string, params: readonly unknown[]) => Promise<unknown[]>;

/** Bridge pour un `PrismaClient` (route Next.js, tests). */
export function fromPrisma(db: {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}): SqlRunner {
  return (sql, params) => db.$queryRawUnsafe<unknown[]>(sql, ...params);
}

/** Bridge pour un `pg.Client` brut (le watchdog `.mjs` de Host-001). */
export function fromPgClient(client: {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }>;
}): SqlRunner {
  return async (sql, params) => (await client.query(sql, params)).rows;
}

/**
 * La requête de la sonde.
 *
 * ── POURQUOI LE `WHERE` NE FILTRE QUE SUR `source` ────────────────────────
 *
 * La spec demande `trigger=CRON AND ingestionMode=LIVE AND source=WATCHER_V2`.
 * Le filtre EFFECTIF est bien celui-là — mais il est appliqué en deux temps :
 * `source` ici, `trigger` et `ingestionMode` par `selectLiveCronRuns()` dans la
 * sonde. Ce n'est pas un relâchement, c'est ce qui garde `ignoredRunCount`
 * vivant.
 *
 * Si le SQL écartait déjà les backfills, la sonde n'en verrait aucun,
 * `ignoredRunCount` vaudrait 0 en permanence, et l'invariant C4-1 — « un
 * backfill de 261 lignes n'a pas bougé la fraîcheur, ET il a été compté » —
 * deviendrait invérifiable en production. Il resterait vrai sur fixtures et
 * indémontrable sur le réel : précisément le genre de garantie qui s'érode sans
 * bruit. Le tri par `trigger`/`ingestionMode` appartient à la sonde, qui le
 * documente comme sa porte d'entrée.
 *
 * `source` est en revanche un filtre de VOLUME légitime : il écarte les lignes
 * `watcher_bridge_promote`, qui ne décrivent pas le collecteur et n'ont donc
 * rien à faire dans la fenêtre.
 */
const RUN_WINDOW_SQL = `
  SELECT id,
         "source", "trigger", "ingestionMode", "status",
         "scheduledAt"         AT TIME ZONE 'UTC' AS "scheduledAt",
         "startedAt"           AT TIME ZONE 'UTC' AS "startedAt",
         "collectionStartedAt" AT TIME ZONE 'UTC' AS "collectionStartedAt",
         "finishedAt"          AT TIME ZONE 'UTC' AS "finishedAt",
         "handlesAttempted", "handlesSucceeded", "tweetsFetched",
         "newPostsObserved", "candidatesProduced", "xApiErrors", "durationMs"
    FROM "JobRunLog"
   WHERE "source" = $1
     AND "startedAt" >= ((now() AT TIME ZONE 'UTC') - make_interval(days => $2::int))
   ORDER BY "startedAt" DESC
   LIMIT $3
`;

export interface LoadRunsOptions {
  /** Profondeur de la fenêtre. 14 j couvre large les 24 h de la sonde C. */
  readonly windowDays?: number;
  readonly limit?: number;
  readonly source?: string;
}

function toIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "bigint" ? Number(v) : typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Convertit une ligne brute en `WatcherRunRecord`. Défensif sur chaque champ. */
export function mapRowToRunRecord(row: Record<string, unknown>): WatcherRunRecord {
  return {
    id: toStr(row.id),
    source: toStr(row.source),
    trigger: toStr(row.trigger),
    ingestionMode: toStr(row.ingestionMode),
    status: toStr(row.status),

    scheduledAt: toDateOrNull(row.scheduledAt),
    startedAt: toDateOrNull(row.startedAt),
    collectionStartedAt: toDateOrNull(row.collectionStartedAt),
    finishedAt: toDateOrNull(row.finishedAt),

    handlesAttempted: toIntOrNull(row.handlesAttempted),
    handlesSucceeded: toIntOrNull(row.handlesSucceeded),
    tweetsFetched: toIntOrNull(row.tweetsFetched),
    newPostsObserved: toIntOrNull(row.newPostsObserved),
    candidatesProduced: toIntOrNull(row.candidatesProduced),
    xApiErrors: toIntOrNull(row.xApiErrors),
    durationMs: toIntOrNull(row.durationMs),
  };
}

/** Lit la fenêtre de runs que la sonde C4 doit juger. */
export async function loadWatcherRuns(
  run: SqlRunner,
  opts: LoadRunsOptions = {},
): Promise<WatcherRunRecord[]> {
  const rows = await run(RUN_WINDOW_SQL, [
    opts.source ?? SOURCE_WATCHER_V2,
    opts.windowDays ?? 14,
    opts.limit ?? 200,
  ]);
  return rows.map((r) => mapRowToRunRecord(r as Record<string, unknown>));
}

export const __RUN_WINDOW_SQL_FOR_TESTS = RUN_WINDOW_SQL;
