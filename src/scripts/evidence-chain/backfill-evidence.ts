/**
 * Backfill des pièces existantes dans la chaîne de preuve.
 * Cible : ./evidence/** + artefacts forensiques racine (sxyz500_hops.json,
 * BOTIFY_KOL_SCAN_REPORT.json).
 *
 * capturedAt : dérivé du commit git qui a INTRODUIT le fichier (--diff-filter=A).
 *   C'est la seule date honnête disponible ; documenté dans notes. La vraie date
 *   de capture est inconnue et N'EST PAS inventée. sourceUrl = null si inconnue.
 *
 * Défaut = --dry-run (aucune écriture DB/R2/TSA) : imprime ce qui serait ingéré.
 *   --commit : ingère réellement (exige la migration appliquée + PrismaEvidenceStore).
 *
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/backfill-evidence.ts            # dry-run
 *   pnpm tsx src/scripts/evidence-chain/backfill-evidence.ts --commit   # ingestion réelle
 */
import { readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative } from "path";
import { execFileSync } from "child_process";
import { sha256File } from "../../lib/evidence-chain/hash";
import type { EvidenceSourceType } from "../../lib/evidence-chain/types";

const REPO = process.cwd();
const ROOT_ARTIFACTS = ["sxyz500_hops.json", "BOTIFY_KOL_SCAN_REPORT.json"];

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

/** Path-based source type. Never guesses a URL. */
function sourceTypeOf(rel: string): EvidenceSourceType {
  const p = rel.toLowerCase();
  if (p.includes("capture_x") || p.includes("/social/")) return "X_POST";
  if (p.includes("/onchain/") || p.includes("/evm/")) return "EXPLORER";
  if (p.endsWith(".json")) return "REPO_ARTIFACT";
  if (p.endsWith(".zip")) return "OTHER";
  return "OTHER";
}

/** First commit that added the file → ISO date + short sha. Null if untracked. */
function gitIntroduced(rel: string): { at: Date; sha: string } | null {
  try {
    const out = execFileSync("git", ["log", "--diff-filter=A", "--follow", "--format=%H|%aI", "--", rel],
      { cwd: REPO, encoding: "utf8" }).trim();
    if (!out) return null;
    const last = out.split("\n").pop()!; // oldest add
    const [sha, iso] = last.split("|");
    return { at: new Date(iso), sha: sha.slice(0, 10) };
  } catch { return null; }
}

async function main() {
  const commit = process.argv.includes("--commit");
  const files = [...walk(join(REPO, "evidence")), ...ROOT_ARTIFACTS.map((f) => join(REPO, f)).filter(existsSync)];

  const rows: Array<Record<string, string | number>> = [];
  for (const abs of files) {
    const rel = relative(REPO, abs);
    const sha = await sha256File(abs);
    const bytes = statSync(abs).size;
    const st = sourceTypeOf(rel);
    const g = gitIntroduced(rel);
    rows.push({
      file: rel, sourceType: st, bytes,
      sha256: sha.slice(0, 16) + "…",
      capturedAt: g ? g.at.toISOString() : "UNKNOWN (untracked)",
      gitSha: g ? g.sha : "-",
    });
  }

  console.log(`\n=== BACKFILL ${commit ? "COMMIT" : "DRY-RUN"} — ${rows.length} fichier(s) ===`);
  console.log("sourceUrl = null (jamais inventée) · capturedAt = date du commit d'introduction git\n");
  const byType: Record<string, number> = {};
  for (const r of rows) {
    byType[r.sourceType] = (byType[r.sourceType] as number ?? 0) + 1;
    console.log(`  [${String(r.sourceType).padEnd(13)}] ${r.capturedAt}  ${String(r.bytes).padStart(9)}o  ${r.file}`);
  }
  console.log("\n  Par type:", Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(", "));

  if (!commit) {
    console.log("\n  DRY-RUN : aucune écriture. Relancer avec --commit APRÈS application de la migration.");
    return;
  }

  // --commit : ingestion réelle (exige migration appliquée).
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaEvidenceStore } = await import("../../lib/evidence-chain/store/prisma");
  const { ingestFile } = await import("../../lib/evidence-chain/ingest");
  const { evidenceR2ConfigFromEnv, buildEvidenceR2 } = await import("../../lib/evidence-chain/r2");
  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  const r2cfg = evidenceR2ConfigFromEnv();
  const r2 = r2cfg ? { s3: buildEvidenceR2(r2cfg), bucket: r2cfg.bucket } : null;
  let ingested = 0, dup = 0;
  for (const abs of files) {
    const rel = relative(REPO, abs);
    const g = gitIntroduced(rel);
    const res = await ingestFile({
      filePath: abs, sourceType: sourceTypeOf(rel), mimeType: mimeOf(abs), sourceUrl: null,
      capturedAt: g ? g.at : null,
      notes: `backfill: capturedAt dérivé du commit git d'introduction ${g ? g.sha + " (" + g.at.toISOString() + ")" : "inconnu"}; vraie date de capture inconnue`,
      criticality: "OTHER",
    }, store, { r2, tsa: { enabled: true }, actor: "backfill" });
    res.duplicate ? dup++ : ingested++;
    console.log(`  ${res.duplicate ? "DUP " : "OK  "} ${rel} → ${res.item.sha256.slice(0, 12)}… tsa=${res.tsa.done}`);
  }
  console.log(`\n  Ingérés: ${ingested}, doublons: ${dup}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("backfill error:", e); process.exit(1); });
