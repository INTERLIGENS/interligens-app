/**
 * Ingestion d'UNE capture au fil de l'eau — zéro friction pendant la collecte.
 * Fait tout : SHA-256 → dedup → EvidenceItem → R2 → TSA (routage criticité) →
 * propose les posts Watcher V2 candidats à valider (liens créés si --link-all).
 *
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/ingest-capture.ts <fichier> \
 *     --handle <kol> [--criticality P0|OTHER] [--source-type X_POST|EXPLORER|...] \
 *     [--casefile <id>] [--at <iso>] [--window 48] [--link-all]
 *
 * Défauts : criticality=OTHER, source-type=X_POST, at=maintenant, window=48h.
 * Requiert la migration MIGRATION_evidence_chain_v1.sql appliquée (ep-square-band)
 * + env R2_* et TSA_URL_PRIMARY/FALLBACK (+ TSA_CA_URL_*). Sans TSA configurée,
 * l'ingestion se fait quand même (tsaToken null, à rattraper).
 */
import { statSync, existsSync } from "fs";
import { extname, basename } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { ingestFile } from "../../lib/evidence-chain/ingest";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "../../lib/evidence-chain/r2";
import { findWatcherCandidates, createLinksFromCandidates } from "../../lib/evidence-chain/attach";
import { SOURCE_TYPES, type EvidenceSourceType } from "../../lib/evidence-chain/types";
import { type Criticality } from "../../lib/evidence-chain/tsa";

function flag(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
function has(name: string): boolean { return process.argv.includes("--" + name); }

function mimeOf(p: string): string {
  const e = extname(p).toLowerCase();
  return { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".zip": "application/zip", ".json": "application/json", ".pdf": "application/pdf" }[e] ?? "application/octet-stream";
}

async function main() {
  const file = process.argv[2];
  const handle = flag("handle");
  const capturedBy = flag("captured-by");
  if (!file || file.startsWith("--") || !handle) {
    console.error("usage: ingest-capture <fichier> --handle <kol> --captured-by <opérateur> [--criticality P0|OTHER] [--source-type ...] [--casefile <id>] [--at <iso>] [--window 48] [--link-all]");
    process.exit(2);
  }
  if (!capturedBy || !capturedBy.trim()) {
    console.error("❌ --captured-by <opérateur> est OBLIGATOIRE (chaîne de possession). Aucun défaut, aucun null.");
    process.exit(2);
  }
  if (!existsSync(file)) { console.error(`fichier introuvable: ${file}`); process.exit(2); }

  const criticality = (flag("criticality", "OTHER") as Criticality);
  const sourceType = (flag("source-type", "X_POST") as EvidenceSourceType);
  if (!SOURCE_TYPES.includes(sourceType)) { console.error(`source-type invalide: ${sourceType}`); process.exit(2); }
  const casefileId = flag("casefile") ?? null;
  const capturedAt = flag("at") ? new Date(flag("at")!) : new Date();
  const windowHours = parseInt(flag("window", "48")!, 10);

  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  const r2cfg = evidenceR2ConfigFromEnv();
  const r2 = r2cfg ? { s3: buildEvidenceR2(r2cfg), bucket: r2cfg.bucket } : null;

  console.log(`Ingestion « ${basename(file)} » (@${handle}, ${criticality}, ${sourceType})…`);
  const res = await ingestFile({
    filePath: file, sourceType, mimeType: mimeOf(file), sourceUrl: null, casefileId, capturedAt,
    capturedBy, captureHost: process.env.HOSTNAME ?? null, captureTool: "ingest-capture", captureToolVersion: "v1",
    notes: `handle=@${handle}`, criticality,
  }, store, { r2, tsa: { enabled: true }, actor: `ingest-capture:@${handle}` });

  console.log(`  ${res.duplicate ? "DOUBLON (déjà en base)" : "OK"} — sha256=${res.item.sha256}`);
  console.log(`  r2Key=${res.r2Key ?? "(R2 non configuré)"} | tsa=${res.tsa.done ? "OK via " + res.tsa.tsaUsed + " (" + res.tsa.provider + ")" : (res.tsa.attempted ? "PENDING (à rattraper)" : "désactivé")}`);
  console.log(`  byteSize=${statSync(file).size} | item=${res.item.id}`);

  // Propose les posts Watcher V2 candidats (read-only) pour validation opérateur.
  const candidates = await findWatcherCandidates(prisma, { handle, capturedAt, windowHours });
  console.log(`\nCandidats Watcher V2 pour @${handle} (±${windowHours}h autour de ${capturedAt.toISOString()}): ${candidates.length}`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`  post ${c.postId} @ ${c.postedAtUtc?.toISOString() ?? "?"} — ${c.snippet.slice(0, 60).replace(/\s+/g, " ")}`);
  }
  if (candidates.length > 10) console.log(`  … +${candidates.length - 10} autres`);

  if (has("link-all") && candidates.length) {
    const links = await createLinksFromCandidates(res.item.id, candidates, store, { actor: `ingest-capture:@${handle}` });
    console.log(`\n  ${links.length} EvidenceLink créés (X_API_RECORD, corroboration ${links[0]?.corroborationLevel}).`);
  } else if (candidates.length) {
    console.log(`\n  Pour lier ces posts : relancer avec --link-all (ou lier en lot via un outil de revue).`);
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/(relation|table) .* does not exist/i.test(msg)) {
    console.error("\n❌ Tables absentes — applique d'abord MIGRATION_evidence_chain_v1.sql dans le Neon SQL Editor.");
  } else console.error("ingest-capture error:", msg);
  process.exit(1);
});
