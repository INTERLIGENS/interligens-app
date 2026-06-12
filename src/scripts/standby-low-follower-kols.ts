/**
 * src/scripts/standby-low-follower-kols.ts
 * Move low-follower KOLs to standby (isActive = false) — WITH casefile protection.
 *
 * Targets KolProfile WHERE followerCount < 25000 AND isActive = true, EXCLUDING
 * any handle linked to a casefile/investigation, and sets on the survivors:
 *   isActive          = false
 *   deactivatedAt     = now()
 *   deactivatedReason = 'low_followers_under_25k_2026_06_12'
 *
 * PROTECTED (never standby'd) = union of, case-insensitive:
 *   - KolCase.kolHandle               (cases: BOTIFY, GHOST, RAVE, SERIAL, …)
 *   - KolEvidence.kolHandle           (any documented evidence)
 *   - KolTokenLink.kolHandle WHERE caseId IS NOT NULL  (casefile token links)
 *   - handle literals in CODE_SOURCES (malxbt insider, BOTIFY/Myrrha seeds,
 *     BULLISH/SWIF casefile JSON) scanned at runtime — investigated/flagged
 *   - handlesV2 (src/lib/watcher/handles.ts) — the active watchlist
 *   - KNOWN_PROTECTED floor below     (always protected, even if not yet linked)
 * Protected handles are SKIPPED (deactivatedReason stays NULL). Widening the
 * protected set only ever skips MORE rows — the safe direction for this op.
 *
 * Idempotent: re-running matches nothing (already isActive = false). Rows with
 * followerCount NULL (unknown / suspended) are intentionally NOT touched.
 *
 * PREREQUISITE: isActive / deactivatedAt / deactivatedReason columns must exist
 * (MIGRATION_kolprofile_isactive_v1.sql). Raw SQL — no Prisma client regen needed.
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/standby-low-follower-kols.ts          # WRITE
 *   pnpm tsx -r dotenv/config src/scripts/standby-low-follower-kols.ts --dry    # preview only
 *   (DOTENV_CONFIG_PATH=.env.local for DATABASE_URL)
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { handlesV2 } from "@/lib/watcher/handles";

const THRESHOLD = 25_000;
const REASON = "low_followers_under_25k_2026_06_12";

// Always-protected floor (explicit), independent of DB / code linkage.
const KNOWN_PROTECTED = ["bkokoski", "sxyz500", "GordonGekko", "DonWedge", "planted", "lynk0x", "edurio"];

// Investigation source files: any handle named here (insider/case-linked/flagged)
// is protected. Scanned at runtime so new handles added to these files auto-protect.
// Over-protection is the SAFE direction for a deactivation op.
const CODE_SOURCES = [
  "src/scripts/seed/malxbtInsiderFlag.ts",        // MalXBT -> TEAM_MEMBER insider
  "src/scripts/seed/botifyKolScan.ts",            // BOTIFY scan roster
  "scripts/seed/seedBotifyComplete.ts",           // BOTIFY casefile seed
  "scripts/seed/seedBotifyLeakedDoc.ts",          // BOTIFY leaked-doc handles
  "scripts/seed/seedMyrrhaWallets.ts",            // Myrrha investigation
  "src/scripts/seed/casefiles/bullish_seed.json", // BULLISH casefile (source of truth)
  "src/scripts/seed/casefiles/swif_seed.json",    // SWIF casefile (source of truth)
];
// Matches  handle: "x"  |  kolHandle:"x"  |  const HANDLE = "x"  |  "handle": "x" (JSON)
const HANDLE_LITERAL_RE = /\b(?:kolHandle|handle|HANDLE)["']?\s*[:=]\s*["'`]([A-Za-z0-9_]{2,15})["'`]/g;

type Row = { handle: string; followerCount: number | null };
type HandleRow = { kolHandle: string };

async function distinctHandles(sql: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<HandleRow[]>(sql);
  return rows.map((r) => r.kolHandle).filter((h): h is string => typeof h === "string" && h.length > 0);
}

// Returns lower(handle) -> source label, extracted from the investigation files.
function handlesFromCode(): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of CODE_SOURCES) {
    const p = path.resolve(process.cwd(), rel);
    if (!existsSync(p)) {
      console.warn(`[standby]   WARN code source missing (skipped): ${rel}`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    const label = `code:${path.basename(rel)}`;
    let m: RegExpExecArray | null;
    let n = 0;
    HANDLE_LITERAL_RE.lastIndex = 0;
    while ((m = HANDLE_LITERAL_RE.exec(text)) !== null) {
      const k = m[1].toLowerCase();
      n++;
      if (!out.has(k)) out.set(k, label);
    }
    console.log(`[standby]   ${rel}: ${n} handle literal(s)`);
  }
  return out;
}

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry");
  console.log(
    `[standby] mode: ${dryRun ? "DRY (no writes)" : "WRITE"} | threshold: <${THRESHOLD.toLocaleString()} followers\n`,
  );

  // ─── Build the PROTECTED set (case-insensitive) ──────────────────────────
  let fromCase: string[], fromEvidence: string[], fromTokenLink: string[];
  try {
    fromCase = await distinctHandles(`SELECT DISTINCT "kolHandle" FROM "KolCase"`);
    fromEvidence = await distinctHandles(`SELECT DISTINCT "kolHandle" FROM "KolEvidence"`);
    fromTokenLink = await distinctHandles(`SELECT DISTINCT "kolHandle" FROM "KolTokenLink" WHERE "caseId" IS NOT NULL`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("isActive") || msg.includes("does not exist") || msg.includes("column")) {
      console.error(
        "[standby] ERROR: required columns/tables missing.\n" +
          "          Apply MIGRATION_kolprofile_isactive_v1.sql in the Neon SQL Editor first.",
      );
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  // lowercased -> source label (first source wins for display)
  const protectedSrc = new Map<string, string>();
  const addAll = (handles: string[], src: string) => {
    for (const h of handles) {
      const k = h.toLowerCase();
      if (!protectedSrc.has(k)) protectedSrc.set(k, src);
    }
  };
  addAll(fromCase, "KolCase");
  addAll(fromEvidence, "KolEvidence");
  addAll(fromTokenLink, "KolTokenLink");
  // Code/JSON investigation sources (scanned at runtime).
  console.log(`[standby] scanning ${CODE_SOURCES.length} investigation source file(s):`);
  const fromCode = handlesFromCode();
  for (const [k, src] of fromCode) if (!protectedSrc.has(k)) protectedSrc.set(k, src);
  // 4th source: the active watchlist (handlesV2) — anything we still monitor.
  const fromWatchlist = [...new Set(handlesV2.map((h) => h.handle))];
  addAll(fromWatchlist, "watchlist");
  addAll(KNOWN_PROTECTED, "known_floor");
  const protectedLower = new Set(protectedSrc.keys());

  console.log(
    `[standby] PROTECTED set: ${protectedLower.size} distinct handles ` +
      `(KolCase=${fromCase.length}, KolEvidence=${fromEvidence.length}, KolTokenLink/caseId=${fromTokenLink.length}, code/json=${fromCode.size}, watchlist=${fromWatchlist.length}, known_floor=${KNOWN_PROTECTED.length})`,
  );
  // Verify which of the explicit known handles are actually DB-linked.
  for (const h of KNOWN_PROTECTED) {
    const k = h.toLowerCase();
    const dbLinked = fromCase.concat(fromEvidence, fromTokenLink).some((x) => x.toLowerCase() === k);
    console.log(`           known @${h.padEnd(14)} ${dbLinked ? "DB-linked (KolCase/Evidence/TokenLink)" : "NOT DB-linked — protected by floor only"}`);
  }
  console.log();

  // ─── Candidates under threshold ──────────────────────────────────────────
  let candidates: Row[];
  try {
    candidates = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "handle", "followerCount"
         FROM "KolProfile"
        WHERE "followerCount" < $1
          AND "isActive" = true
        ORDER BY "followerCount" DESC NULLS LAST`,
      THRESHOLD,
    );
  } catch (e) {
    const msg = String(e);
    if (msg.includes("isActive") || msg.includes("does not exist") || msg.includes("column")) {
      console.error(
        "[standby] ERROR: the isActive/deactivated* columns are missing.\n" +
          "          Apply MIGRATION_kolprofile_isactive_v1.sql in the Neon SQL Editor first.",
      );
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  // ─── Partition: protected (skip) vs to-standby ───────────────────────────
  const skipped = candidates.filter((c) => protectedLower.has(c.handle.toLowerCase()));
  const toStandby = candidates.filter((c) => !protectedLower.has(c.handle.toLowerCase()));

  console.log(`[standby] PROTECTED handles in-range (SKIPPED, ${skipped.length}):`);
  if (skipped.length === 0) console.log("  (none under threshold)");
  for (const c of skipped) {
    console.log(
      `  SKIP  @${c.handle.padEnd(22)} ${(c.followerCount ?? 0).toLocaleString().padStart(8)}  [${protectedSrc.get(c.handle.toLowerCase())}]`,
    );
  }
  console.log();

  console.log(`[standby] handles TO STANDBY (${toStandby.length}):`);
  for (const c of toStandby) {
    console.log(`  @${c.handle.padEnd(22)} ${(c.followerCount ?? 0).toLocaleString()}`);
  }
  console.log();

  console.log(
    `[standby] SUMMARY — under-threshold active: ${candidates.length} | protected-skipped: ${skipped.length} | to-standby: ${toStandby.length}`,
  );

  if (dryRun) {
    console.log("[standby] DRY run — no rows modified. Re-run without --dry to apply.");
    return;
  }

  if (toStandby.length === 0) {
    console.log("[standby] nothing to do — no eligible rows after protection (idempotent no-op).");
    return;
  }

  // Update only the explicit survivor handles (exact casing), idempotent on isActive.
  const handles = toStandby.map((c) => c.handle);
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "KolProfile"
        SET "isActive" = false,
            "deactivatedAt" = now(),
            "deactivatedReason" = $1
      WHERE "handle" = ANY($2::text[])
        AND "isActive" = true`,
    REASON,
    handles,
  );

  console.log(`[standby] DONE — ${affected} handle(s) moved to standby.`);
  console.log(`[standby] reason: ${REASON}`);
  console.log(`[standby] ${skipped.length} casefile-protected handle(s) left active (deactivatedReason NULL).`);
}

main()
  .catch((e) => {
    console.error("[standby] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
