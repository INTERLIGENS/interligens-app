#!/usr/bin/env tsx
/**
 * CONTRÔLE DE GRAMMAIRE SQL — runner. LECTURE SEULE.
 *
 * Logique pure : src/lib/sql/parseGuard.ts.
 * Ce fichier ne fait que lire des fichiers et imprimer un verdict.
 *
 * USAGE
 *     npx tsx scripts/sql/parse-check.ts <fichier.sql> [...]
 *
 * SORTIE : 0 seulement si TOUS les fichiers sont VALID.
 *          INVALID et UNABLE sortent en 1 — un contrôle qui n'a pas pu
 *          s'exécuter n'est pas un contrôle qui passe.
 *
 * PLACE DANS LA CHAÎNE
 *     SQL généré → **parse PostgreSQL réel** → contrôles métier → exécution
 *
 * Le maillon suivant — `__tests__/security/sql-execution-file-lint.test.ts` —
 * n'est pas remplacé par celui-ci : la grammaire ne voit ni les empreintes
 * sha256 en double, ni le compte de lignes VALUES confronté au garde-fou.
 *
 * N'ÉCRIT RIEN, ne se connecte à rien : ni base, ni réseau. Le parseur est du
 * WASM local.
 */
import fs from "node:fs";
import path from "node:path";
import { parsePostgres, formatParseResult, type ParseResult } from "../../src/lib/sql/parseGuard";

async function main(): Promise<number> {
  const fichiers = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (fichiers.length === 0) {
    console.error("usage: npx tsx scripts/sql/parse-check.ts <fichier.sql> [...]");
    // Aucun fichier examiné n'est un UNABLE, pas un succès. Même règle que
    // « périmètre vide » dans la sonde d'existence des octets.
    console.error("UNABLE — aucun fichier fourni : rien n'a été contrôlé.");
    return 1;
  }

  let pire = 0;
  for (const f of fichiers) {
    const abs = path.resolve(f);
    let sql: string;
    try {
      sql = fs.readFileSync(abs, "utf8");
    } catch (err) {
      console.log(`UNABLE   ${f} — illisible : ${(err as Error).message}`);
      pire = 1;
      continue;
    }
    const r: ParseResult = await parsePostgres(sql);
    console.log(formatParseResult(f, r));
    if (r.verdict !== "VALID") pire = 1;
  }
  return pire;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`UNABLE — exception non rattrapée : ${(err as Error)?.message ?? err}`);
    process.exit(1);
  });
