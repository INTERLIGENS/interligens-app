/**
 * CC-OFFLINE-55 — Récupération catégorie D (fichier local absent) depuis R2.
 * imageUrl (public dev URL en 401) → clé R2 = chemin de l'URL, GetObject S3 AUTH.
 * Télécharge, recalcule SHA-256, compare au sha256 stocké → A/B ; sans sha256
 * stocké → C (hashable). Sans imageUrl → reste D. ADDITIF : EvidenceSnapshot intact.
 *
 * Défaut = dry-run (download + hash + reclasse, aucune écriture DB).
 * --commit : ingère les récupérées (non-B) + lien MANUAL. --throttle-ms M.
 */
import { existsSync, writeFileSync, rmSync } from "fs";
import { isAbsolute, join, extname } from "path";
import { tmpdir } from "os";
import { PrismaClient } from "@prisma/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { ingestFile } from "../../lib/evidence-chain/ingest";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "../../lib/evidence-chain/r2";
import { sha256File } from "../../lib/evidence-chain/hash";
import type { EvidenceSourceType } from "../../lib/evidence-chain/types";

const REPO = process.cwd();
const CAPTURED_BY = "legacy:evidence-snapshot";
const rp = (p: string) => (isAbsolute(p) ? p : join(REPO, p));
const flagN = (n: string, d: number) => { const i = process.argv.indexOf("--" + n); return i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : d; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function mapSourceType(s: string | null): EvidenceSourceType {
  const t = (s ?? "").toLowerCase();
  if (/x_search|x_profile|x_trending|tweet|x_post/.test(t)) return "X_POST";
  if (t.includes("document")) return "WEB_PAGE";
  return "OTHER";
}
/** imageUrl → clé R2 (chemin sans slash initial, décodé). */
function r2KeyFromUrl(u: string): string { return decodeURIComponent(new URL(u).pathname).replace(/^\/+/, ""); }

(async () => {
  const commit = process.argv.includes("--commit");
  const throttle = flagN("throttle-ms", 1000);
  const prisma = new PrismaClient();
  const cfg = evidenceR2ConfigFromEnv();
  if (!cfg) { console.error("R2 non configuré — impossible de récupérer."); process.exit(1); }
  const s3 = buildEvidenceR2(cfg);

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "id","sha256","imageUrl","snapshotType","relationType","relationKey","observedAt","sourceUrl","localFilePath" FROM "EvidenceSnapshot" ORDER BY "createdAt"`);
  const D = rows.filter((r) => !r.localFilePath || !existsSync(rp(r.localFilePath)));
  const recoverable = D.filter((r) => r.imageUrl);
  const unrecoverable = D.length - recoverable.length;
  console.log(`\n=== RECOVER-D ${commit ? "COMMIT" : "DRY-RUN"} — D=${D.length} (imageUrl=${recoverable.length}, sans URL=${unrecoverable}) ===`);

  const store = commit ? new PrismaEvidenceStore(prisma) : null;
  const r2 = commit ? { s3, bucket: cfg.bucket } : null;
  let becameA = 0, becameB = 0, becameC = 0, dlFail = 0, ingested = 0, linked = 0, noTsa = 0;

  for (const r of recoverable) {
    let buf: Buffer;
    try {
      const key = r2KeyFromUrl(r.imageUrl);
      const obj = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
      buf = Buffer.from(await (obj.Body as any).transformToByteArray());
    } catch (e) { dlFail++; console.log(`  DL-FAIL ${r.id} ${(e as Error).name}`); continue; }
    const tmp = join(tmpdir(), `recd-${r.id}${extname(new URL(r.imageUrl).pathname) || ".bin"}`);
    writeFileSync(tmp, buf);
    const h = await sha256File(tmp);
    const cat = r.sha256 ? (h === r.sha256 ? "A" : "B") : "C";
    if (cat === "A") becameA++; else if (cat === "B") becameB++; else becameC++;
    console.log(`  ${cat} ${r.id} dl=${buf.length}o sha=${h.slice(0, 12)}… stored=${r.sha256 ? r.sha256.slice(0, 12) + "…" : "null"} ${r.imageUrl.split("/").pop()}`);
    if (commit && cat !== "B") {
      const notes = `[TIMESTAMP:RETROACTIVE] horodatage rétroactif — recovered from R2 ${r.imageUrl} (fichier local absent); capturedAt déclarative (observedAt), seule l'existence du hash au stamping est prouvée. ${CAPTURED_BY} src=${r.id} rel=${r.relationType ?? ""}:${r.relationKey ?? ""}`;
      const ir = await ingestFile({
        filePath: tmp, sourceType: mapSourceType(r.snapshotType), sourceUrl: r.imageUrl,
        capturedAt: r.observedAt ? new Date(r.observedAt) : null, capturedBy: CAPTURED_BY,
        captureTool: "recover-d", captureToolVersion: "v1", notes, criticality: "OTHER",
      }, store!, { r2, tsa: { enabled: true }, actor: "recover-d" });
      if (!ir.tsa.done) noTsa++;
      const ex: unknown[] = await prisma.$queryRawUnsafe(`SELECT 1 FROM "EvidenceLink" WHERE "evidenceItemId"=$1 AND "linkType"='MANUAL' AND "externalId"=$2 LIMIT 1`, ir.item.id, r.id);
      if (!ex.length) { await store!.insertLink({ evidenceItemId: ir.item.id, linkType: "MANUAL", externalId: r.id, externalUrl: r.imageUrl }); linked++; }
      ingested++;
      await sleep(throttle);
    }
    rmSync(tmp, { force: true });
  }
  console.log(`\n  Reclassé : A=${becameA}, B=${becameB}, C=${becameC}, DL-fail=${dlFail}, restent D (sans URL)=${unrecoverable}`);
  if (commit) console.log(`  Ingérées=${ingested}, liens MANUAL=${linked}, sans TSA=${noTsa}`);
  else console.log(`  DRY-RUN : aucune écriture.`);
  await prisma.$disconnect();
})().catch((e) => { console.error("recover-d error:", e.message || e); process.exit(1); });
