// ─── SPINE-00 — L'ADAPTATEUR PRISMA DE L'EXÉCUTEUR ──────────────────────────
//
// Le seul endroit où l'exécuteur rencontre la base de production. Il ne
// contient AUCUN SQL : il ouvre une transaction interactive Prisma en
// REPEATABLE READ et rend une `SqlRunner` qui délègue à `$queryRawUnsafe` —
// paramètres positionnels, jamais d'interpolation.
//
// Séparé de `governedExecutor.ts` à dessein : les preuves de l'exécuteur ne
// doivent pas importer `@/lib/prisma`, et ce fichier ne doit rien décider.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SqlRunner, SqlTransactor } from "./governedExecutor";

export const prismaTransactor: SqlTransactor = {
  transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
    return prisma.$transaction(
      async (tx) => {
        const db: SqlRunner = {
          query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) =>
            (await tx.$queryRawUnsafe(sql, ...params)) as R[],
        };
        return fn(db);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 },
    );
  },
};
