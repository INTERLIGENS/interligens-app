// ─── TigerScore hardening migration runner ────────────────────────────────
// Reads a .sql file and applies each statement one-by-one through the pooled
// DATABASE_URL (ep-square-band only). Purely additive statements — safe to
// re-run. Refuses to target anything other than ep-square-band per project
// memory rule.
//
// Usage: npx tsx scripts/tigerscore/applyMigration.ts path/to/file.sql

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
// @ts-expect-error — @types/pg is not installed in this project
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error("usage: tsx scripts/tigerscore/applyMigration.ts <path/to/file.sql>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  if (!url.includes("ep-square-band")) {
    throw new Error("refusing to run: target is not ep-square-band");
  }
  const sql = readFileSync(resolve(sqlPath), "utf-8");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const statements = splitSqlStatements(sql);
    console.log(
      `[tigerscore migration] applying ${statements.length} statements from ${sqlPath}`,
    );
    for (const [i, stmt] of statements.entries()) {
      try {
        await client.query(stmt);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `\n[stmt ${i + 1}/${statements.length}] FAILED:\n${stmt.slice(0, 300)}\n→ ${msg}\n`,
        );
        throw err;
      }
    }
    console.log(`[tigerscore migration] applied ${sqlPath}`);
  } finally {
    await client.end();
  }
}

function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  const src = sql.replace(/--[^\n]*/g, "");
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    if (rest.startsWith("$$")) {
      inDollar = !inDollar;
      buf += "$$";
      i += 2;
      continue;
    }
    const ch = src[i];
    if (ch === ";" && !inDollar) {
      const stmt = buf.trim();
      if (stmt.length > 0) out.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
