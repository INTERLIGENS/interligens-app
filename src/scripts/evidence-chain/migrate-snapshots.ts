/**
 * CC-OFFLINE-55 Phase 2/3 — Migration EvidenceSnapshot → EvidenceItem.
 * ADDITIF : ne modifie/supprime JAMAIS EvidenceSnapshot (source intacte).
 *
 * Mapping : sha256→sha256, localFilePath→filePath, imageUrl→r2Key (via ingest),
 *   snapshotType→sourceType, observedAt→capturedAt, sourceUrl→sourceUrl.
 *   capturedBy="legacy:evidence-snapshot". Lien MANUAL externalId=<EvidenceSnapshot.id>
 *   (traçabilité vers la source). Dedup par sha256 (pièce déjà en base → lien seul).
 *
 * ⚠️ HORODATAGE RÉTROACTIF : notes marquées [TIMESTAMP:RETROACTIVE]. Le token TSA
 *   prouve l'existence du hash à la date de stamping, PAS la date de capture
 *   (capturedAt déclarative = observedAt de la source).
 *
 * Catégories (cf. audit) : A migrable, C migrable+hash, B QUARANTAINE (non migrée),
 *   D ignorée (fichier absent).
 *
 * Modes :
 *   (défaut)            dry-run : classe + rapporte, aucune écriture.
 *   --commit            migre A(+C), idempotent/reprenable, throttle TSA.
 *   --stamp-pending     (re)horodate les EvidenceItem tsaToken NULL (reprise).
 *   --test-stamp N      teste le stamping réel sur N pièces (TSA+verify), SANS écrire.
 *   --limit N           borne le nombre traité. --throttle-ms M  délai entre TSA.
 */
import { existsSync } from "fs";
import { join, isAbsolute } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { ingestFile } from "../../lib/evidence-chain/ingest";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "../../lib/evidence-chain/r2";
import { sha256File } from "../../lib/evidence-chain/hash";
import { requestTimestampWithRetry, verifyTimestampOffline } from "../../lib/evidence-chain/tsa";
import type { EvidenceSourceType } from "../../lib/evidence-chain/types";

const REPO = process.cwd();
const CAPTURED_BY = "legacy:evidence-snapshot";
const FREETSA = { url: process.env.TSA_URL_FALLBACK ?? "https://freetsa.org/tsr", caUrl: process.env.TSA_CA_URL_FALLBACK ?? "https://freetsa.org/files/cacert.pem" };
const resolvePath = (p: string) => (isAbsolute(p) ? p : join(REPO, p));
const flagN = (name: string, def: number) => { const i = process.argv.indexOf("--" + name); return i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : def; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mapSourceType(snapshotType: string | null): EvidenceSourceType {
  const s = (snapshotType ?? "").toLowerCase();
  if (/x_search|x_profile|x_trending|tweet|x_post/.test(s)) return "X_POST";
  if (s.includes("document")) return "WEB_PAGE";
  return "OTHER";
}

interface Row { id: string; sha256: string | null; localFilePath: string | null; snapshotType: string | null;
  relationType: string | null; relationKey: string | null; observedAt: Date | null; sourceUrl: string | null; }

async function classify(prisma: PrismaClient) {
  const rows: Row[] = await prisma.$queryRawUnsafe(
    `SELECT "id","sha256","localFilePath","snapshotType","relationType","relationKey","observedAt","sourceUrl" FROM "EvidenceSnapshot" ORDER BY "createdAt"`);
  const A: Row[] = [], C: Row[] = [], D: Row[] = [], B: Row[] = [];
  for (const r of rows) {
    const present = !!r.localFilePath && existsSync(resolvePath(r.localFilePath));
    if (!present) { D.push(r); continue; }
    if (!r.sha256) { C.push(r); continue; }
    (await sha256File(resolvePath(r.localFilePath!))) === r.sha256 ? A.push(r) : B.push(r);
  }
  return { A, B, C, D, total: rows.length };
}

async function main() {
  const commit = process.argv.includes("--commit");
  const stampPending = process.argv.includes("--stamp-pending");
  const testStamp = process.argv.includes("--test-stamp");
  const limit = flagN("limit", Infinity);
  const throttle = flagN("throttle-ms", 1000);
  const prisma = new PrismaClient();

  // ── --test-stamp N : stamping réel sur N pièces, AUCUNE écriture DB ──
  if (testStamp) {
    const n = flagN("test-stamp", 5);
    const { A } = await classify(prisma);
    const sample = A.slice(0, n);
    console.log(`\n=== TEST STAMPING (réel, sans écriture) sur ${sample.length} pièce(s), throttle ${throttle}ms ===`);
    const t0 = Date.now();
    let ok = 0, fail = 0;
    for (const r of sample) {
      const sha = r.sha256!;
      const res = await requestTimestampWithRetry(sha, { tsaUrl: FREETSA.url, caUrl: FREETSA.caUrl, retries: 1 });
      if (!res) { fail++; console.log(`  FAIL ${r.id} (TSA indisponible)`); await sleep(throttle); continue; }
      const v = await verifyTimestampOffline(sha, res.token, res.certChainPem);
      console.log(`  ${v.ok ? "OK  " : "VERIFY-FAIL"} ${r.id} — ${res.provider} @ ${res.genTime.toISOString()} — offline verify ${v.ok}`);
      v.ok ? ok++ : fail++;
      await sleep(throttle);
    }
    const per = (Date.now() - t0) / Math.max(1, sample.length);
    console.log(`\n  ${ok} OK, ${fail} échec. ~${(per / 1000).toFixed(1)}s/pièce (throttle inclus).`);
    console.log(`  ESTIMATION 925 pièces ≈ ${((per * 925) / 60000).toFixed(0)} min à ce throttle.`);
    await prisma.$disconnect();
    return;
  }

  // ── --stamp-pending : (re)horodate les EvidenceItem sans TSA (reprise) ──
  if (stampPending) {
    const store = new PrismaEvidenceStore(prisma);
    const pend: Array<{ id: string; sha256: string }> = await prisma.$queryRawUnsafe(
      `SELECT "id","sha256" FROM "EvidenceItem" WHERE "tsaToken" IS NULL ORDER BY "ingestedAt" LIMIT $1`, isFinite(limit) ? limit : 100000);
    console.log(`=== STAMP-PENDING : ${pend.length} pièce(s) sans TSA, throttle ${throttle}ms ===`);
    let done = 0, fail = 0;
    for (const p of pend) {
      const res = await requestTimestampWithRetry(p.sha256, { tsaUrl: FREETSA.url, caUrl: FREETSA.caUrl, retries: 1 });
      if (res) { await store.setTsa(p.id, res.token, res.provider, res.genTime, res.certChainPem); await store.insertAccessLog(p.id, "VERIFY", "stamp-pending", `retro tsa via ${res.provider}`); done++; }
      else fail++;
      await sleep(throttle);
    }
    console.log(`  horodatées: ${done}, encore en échec: ${fail}`);
    await prisma.$disconnect();
    return;
  }

  // ── Classification (dry-run + commit) ──
  const { A, B, C, D, total } = await classify(prisma);
  console.log(`\n=== MIGRATION ${commit ? "COMMIT" : "DRY-RUN"} — ${total} EvidenceSnapshot ===`);
  console.log(`  A migrable=${A.length} · C hashable=${C.length} · B QUARANTAINE=${B.length} · D absente=${D.length}`);
  const migr = [...A, ...C].slice(0, isFinite(limit) ? limit : undefined);
  const bySrc: Record<string, number> = {};
  for (const r of migr) bySrc[mapSourceType(r.snapshotType)] = (bySrc[mapSourceType(r.snapshotType)] ?? 0) + 1;
  console.log(`  → migrables (A+C, limit): ${migr.length} · sourceType: ${Object.entries(bySrc).map(([k, v]) => k + "=" + v).join(", ")}`);
  if (B.length) { console.log(`  ⚠️ QUARANTAINE (B, non migrées):`); for (const b of B) console.log(`     ${b.id} ${b.localFilePath}`); }

  if (!commit) { console.log(`\n  DRY-RUN : aucune écriture. B laissées en quarantaine, D ignorées.`); await prisma.$disconnect(); return; }

  // ── COMMIT ──
  const store = new PrismaEvidenceStore(prisma);
  const cfg = evidenceR2ConfigFromEnv();
  const r2 = cfg ? { s3: buildEvidenceR2(cfg), bucket: cfg.bucket } : null;
  let created = 0, linked = 0, dup = 0, noTsa = 0, fail = 0;
  for (const r of migr) {
    try {
      const notes = `[TIMESTAMP:RETROACTIVE] horodatage rétroactif — capturedAt déclarative (observedAt source), seule l'existence du hash au stamping est prouvée. ${CAPTURED_BY} src=${r.id} rel=${r.relationType ?? ""}:${r.relationKey ?? ""}`;
      const res = await ingestFile({
        filePath: resolvePath(r.localFilePath!), sourceType: mapSourceType(r.snapshotType), sourceUrl: r.sourceUrl ?? null,
        capturedAt: r.observedAt ? new Date(r.observedAt) : null, capturedBy: CAPTURED_BY, captureTool: "migrate-snapshots", captureToolVersion: "v1",
        notes, criticality: "OTHER",
      }, store, { r2, tsa: { enabled: true }, actor: "migrate-snapshots" });
      res.duplicate ? dup++ : created++;
      if (!res.tsa.done) noTsa++;
      // Lien MANUAL vers la source (idempotent).
      const ex: unknown[] = await prisma.$queryRawUnsafe(`SELECT 1 FROM "EvidenceLink" WHERE "evidenceItemId"=$1 AND "linkType"='MANUAL' AND "externalId"=$2 LIMIT 1`, res.item.id, r.id);
      if (!ex.length) { await store.insertLink({ evidenceItemId: res.item.id, linkType: "MANUAL", externalId: r.id, externalUrl: r.sourceUrl ?? null }); linked++; }
      await sleep(throttle);
    } catch (e) { fail++; console.error(`  FAIL ${r.id}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`\n  créées=${created}, doublons=${dup}, liens MANUAL=${linked}, sans TSA=${noTsa}, échecs=${fail}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("migrate error:", e.message || e); process.exit(1); });
