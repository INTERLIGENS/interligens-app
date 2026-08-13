/**
 * Backfill des pièces existantes dans la chaîne de preuve.
 * Cible : ./evidence/** + artefacts forensiques racine (sxyz500_hops.json,
 * BOTIFY_KOL_SCAN_REPORT.json).
 *
 * ARCHIVES (.zip) : ingérées comme pièce PARENTE ; chaque membre réel extrait
 * devient un EvidenceItem lié au parent via EvidenceLink linkType=ARCHIVE_MEMBER
 * (externalId = id du parent). Le junk macOS (__MACOSX/, ._*) est ignoré.
 *
 * capturedBy : "backfill:unknown-operator" (provenance FAIBLE, non maquillée).
 * capturedAt : commit git d'introduction (seule date honnête, documentée dans notes).
 * sourceType : déduit du chemin ; sourceUrl = null (jamais inventée).
 *
 * Défaut = --dry-run (aucune écriture). --commit : ingère (exige migration appliquée).
 */
import { readdirSync, statSync, existsSync, mkdtempSync, rmSync } from "fs";
import { join, extname, relative, basename } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { sha256File } from "../../lib/evidence-chain/hash";
import type { EvidenceSourceType } from "../../lib/evidence-chain/types";

const REPO = process.cwd();
const ROOT_ARTIFACTS = ["sxyz500_hops.json", "BOTIFY_KOL_SCAN_REPORT.json"];
const CAPTURED_BY = "backfill:unknown-operator";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
function mimeOf(path: string): string {
  const ext = extname(path).toLowerCase();
  return { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".zip": "application/zip", ".json": "application/json" }[ext] ?? "application/octet-stream";
}
function sourceTypeOf(rel: string): EvidenceSourceType {
  const p = rel.toLowerCase();
  if (p.includes("capture_x") || p.includes("/social/")) return "X_POST";
  if (p.includes("/onchain/") || p.includes("/evm/")) return "EXPLORER";
  if (p.endsWith(".json")) return "REPO_ARTIFACT";
  if (p.endsWith(".zip")) return "OTHER";
  return "OTHER";
}
function gitIntroduced(rel: string): { at: Date; sha: string } | null {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--follow", "--format=%H|%aI", "--", rel],
      { cwd: REPO, encoding: "utf8" }).trim();
    if (!out) return null;
    const [sha, iso] = out.split("\n").pop()!.split("|");
    return { at: new Date(iso), sha: sha.slice(0, 10) };
  } catch { return null; }
}
function isJunk(p: string): boolean {
  return p.includes("__MACOSX") || basename(p).startsWith("._") || p.endsWith("/");
}
/** Extract a zip to a temp dir; return real member file paths (junk filtered). */
function extractZip(absZip: string): { dir: string; members: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "evzip-"));
  execFileSync("unzip", ["-o", "-qq", absZip, "-d", dir], { stdio: "ignore" });
  const members = walk(dir).filter((p) => !isJunk(p));
  return { dir, members };
}

async function main() {
  const commit = process.argv.includes("--commit");
  const files = [...walk(join(REPO, "evidence")), ...ROOT_ARTIFACTS.map((f) => join(REPO, f)).filter(existsSync)];

  // ── Store (only in --commit) ──
  let store: import("../../lib/evidence-chain/store/prisma").PrismaEvidenceStore | null = null;
  let prisma: import("@prisma/client").PrismaClient | null = null;
  let r2: { s3: import("@aws-sdk/client-s3").S3Client; bucket: string } | null = null;
  let ingestFile!: typeof import("../../lib/evidence-chain/ingest").ingestFile;
  if (commit) {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaEvidenceStore } = await import("../../lib/evidence-chain/store/prisma");
    ({ ingestFile } = await import("../../lib/evidence-chain/ingest"));
    const { evidenceR2ConfigFromEnv, buildEvidenceR2 } = await import("../../lib/evidence-chain/r2");
    prisma = new PrismaClient();
    store = new PrismaEvidenceStore(prisma);
    const cfg = evidenceR2ConfigFromEnv();
    r2 = cfg ? { s3: buildEvidenceR2(cfg), bucket: cfg.bucket } : null;
  }

  console.log(`\n=== BACKFILL ${commit ? "COMMIT" : "DRY-RUN"} ===`);
  console.log(`capturedBy="${CAPTURED_BY}" (provenance faible) · capturedAt=commit git d'introduction · sourceUrl=null\n`);

  const stats = { items: 0, members: 0, dup: 0, noTsa: 0, fail: 0, archives: 0 };

  for (const abs of files) {
    const rel = relative(REPO, abs);
    const g = gitIntroduced(rel);
    const isZip = extname(abs).toLowerCase() === ".zip";
    const at = g ? g.at.toISOString() : "UNKNOWN";
    const bytes = statSync(abs).size;

    if (!commit) {
      console.log(`  [${sourceTypeOf(rel).padEnd(13)}] ${at}  ${String(bytes).padStart(9)}o  ${rel}`);
      if (isZip) {
        const { dir, members } = extractZip(abs);
        console.log(`      └─ archive → ${members.length} membre(s) ARCHIVE_MEMBER :`);
        for (const m of members.slice(0, 4)) console.log(`         · ${sourceTypeOf(m)} ${statSync(m).size}o ${basename(m)}`);
        if (members.length > 4) console.log(`         · … +${members.length - 4}`);
        rmSync(dir, { recursive: true, force: true });
        stats.archives++; stats.members += members.length;
      }
      stats.items++;
      continue;
    }

    // ── COMMIT ──
    try {
      const parentNotes = `backfill${isZip ? " archive parente" : ""}; provenance FAIBLE; capturedAt=commit git ${g ? g.sha + " (" + at + ")" : "inconnu"}; vraie date de capture inconnue`;
      const res = await ingestFile({
        filePath: abs, sourceType: sourceTypeOf(rel), mimeType: mimeOf(abs), sourceUrl: null,
        capturedAt: g ? g.at : null, capturedBy: CAPTURED_BY, captureTool: "backfill", captureToolVersion: "v1",
        provenanceType: "MIGRATED_BACKFILL", timestampMode: "retroactive",
        notes: parentNotes, criticality: "OTHER",
      }, store!, { r2, tsa: { enabled: true }, actor: "backfill" });
      res.duplicate ? stats.dup++ : stats.items++;
      if (!res.tsa.done) stats.noTsa++;
      console.log(`  ${res.duplicate ? "DUP " : "OK  "} ${rel} tsa=${res.tsa.done ? res.tsa.tsaUsed : "PENDING"}`);

      if (isZip) {
        stats.archives++;
        const { dir, members } = extractZip(abs);
        for (const m of members) {
          try {
            const mr = await ingestFile({
              filePath: m, sourceType: sourceTypeOf(join(rel, basename(m))), mimeType: mimeOf(m), sourceUrl: null,
              capturedAt: g ? g.at : null, capturedBy: CAPTURED_BY, captureTool: "backfill", captureToolVersion: "v1",
              provenanceType: "MIGRATED_BACKFILL", timestampMode: "retroactive",
              notes: `backfill membre d'archive ${rel} (parent ${res.item.sha256.slice(0, 12)}); provenance FAIBLE; capturedAt=commit git de l'archive`,
              criticality: "OTHER",
            }, store!, { r2, tsa: { enabled: true }, actor: "backfill" });
            await store!.insertLink({ evidenceItemId: mr.item.id, linkType: "ARCHIVE_MEMBER", externalId: res.item.id, externalUrl: null });
            mr.duplicate ? stats.dup++ : stats.members++;
            if (!mr.tsa.done) stats.noTsa++;
          } catch (e) { stats.fail++; console.error(`    member FAIL ${basename(m)}: ${e instanceof Error ? e.message : e}`); }
        }
        rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) { stats.fail++; console.error(`  FAIL ${rel}: ${e instanceof Error ? e.message : e}`); }
  }

  console.log(`\n  Résumé : pièces racine=${stats.items}, membres d'archives=${stats.members}, archives=${stats.archives}, doublons=${stats.dup}, sans TSA=${stats.noTsa}, échecs=${stats.fail}`);
  if (!commit) console.log("  DRY-RUN : aucune écriture. Relancer avec --commit.");
  if (prisma) await prisma.$disconnect();
}
main().catch((e) => { console.error("backfill error:", e); process.exit(1); });
