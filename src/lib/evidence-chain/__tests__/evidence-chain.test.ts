/**
 * Phase 7 — tests réels. Offline (toujours) : hash, dedup, ingestion sxyz500,
 * manifeste PASS, tamper FAIL, rattachement. Live (derrière flags) : TSA réel
 * (EVIDENCE_TSA_LIVE=1) et R2 (EVIDENCE_R2_LIVE=1) — évite une CI flaky réseau.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, copyFileSync, appendFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SqliteEvidenceStore } from "../store/sqlite";
import { ingestFile } from "../ingest";
import { sha256File } from "../hash";
import { generateManifest, verifyManifest } from "../manifest";
import { createLinksFromCandidates, findWatcherCandidates, type WatcherCandidate } from "../attach";

const REPO = process.cwd();
const SXYZ = join(REPO, "sxyz500_hops.json");
let tmp: string;
let store: SqliteEvidenceStore;

beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), "evtest-")); store = new SqliteEvidenceStore(":memory:"); });
afterAll(() => { store.close(); });

describe("evidence-chain — ingestion & hash (offline)", () => {
  it("ingests a file and the stored sha256 matches a fresh hash of the file", async () => {
    const f = join(tmp, "a.txt");
    writeFileSync(f, "hello evidence " + "x".repeat(50));
    const expected = await sha256File(f);
    const r = await ingestFile({ filePath: f, sourceType: "OTHER", casefileId: "case-1" }, store);
    expect(r.duplicate).toBe(false);
    expect(r.item.sha256).toBe(expected);
    expect(r.item.byteSize).toBeGreaterThan(0);
  });

  it("detects a duplicate by hash (signalled, not duplicated)", async () => {
    const f = join(tmp, "a.txt");
    const r = await ingestFile({ filePath: f, sourceType: "OTHER", casefileId: "case-1" }, store);
    expect(r.duplicate).toBe(true);
    const items = await store.getCasefileItems("case-1");
    expect(items.length).toBe(1); // still one item, not two
  });

  it("ingests sxyz500_hops.json as REPO_ARTIFACT (first real piece)", async () => {
    expect(existsSync(SXYZ)).toBe(true);
    const expected = await sha256File(SXYZ);
    const r = await ingestFile({ filePath: SXYZ, sourceType: "REPO_ARTIFACT", casefileId: "case-1", notes: "sxyz500 wallet hops" }, store);
    expect(r.item.sourceType).toBe("REPO_ARTIFACT");
    expect(r.item.sha256).toBe(expected);
  });
});

describe("evidence-chain — manifest (offline)", () => {
  it("generates a manifest and verifies it → PASS", async () => {
    const manifest = await generateManifest("case-1", store, { generatedAt: new Date("2026-07-30T00:00:00Z") });
    expect(manifest.itemCount).toBe(2);
    expect(manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    // Build a self-contained bundle: files named by sha256.
    const bundle = join(tmp, "bundle"); mkdirSync(bundle, { recursive: true });
    for (const it of manifest.items) copyFileSync(it.filePath!, join(bundle, it.sha256));
    const report = await verifyManifest(manifest, bundle);
    expect(report.manifestHashOk).toBe(true);
    expect(report.overall).toBe("PASS");
    expect(report.items.every((i) => i.status === "PASS")).toBe(true);
  });

  it("flips one byte in a bundled file → verification FAIL for that piece", async () => {
    const manifest = await generateManifest("case-1", store, { generatedAt: new Date("2026-07-30T00:00:00Z") });
    const bundle = join(tmp, "bundle2"); mkdirSync(bundle, { recursive: true });
    for (const it of manifest.items) copyFileSync(it.filePath!, join(bundle, it.sha256));
    const victim = join(bundle, manifest.items[0].sha256);
    appendFileSync(victim, Buffer.from([0x00])); // 1 byte altered
    const report = await verifyManifest(manifest, bundle);
    expect(report.overall).toBe("FAIL");
    const v = report.items.find((i) => i.sha256 === manifest.items[0].sha256)!;
    expect(v.status).toBe("FAIL");
  });
});

describe("evidence-chain — X API attach (offline, mocked DB)", () => {
  it("findWatcherCandidates builds the join query and maps rows", async () => {
    let captured = "";
    const rows = [
      { id: "c1", postId: "111", postUrl: "https://x.com/h/status/111", handle: "h", postedAtUtc: new Date(), discoveredAtUtc: new Date(), snippet: "buy $X" },
    ];
    const db = { $queryRawUnsafe: async (q: string) => { captured = q; return rows as unknown as never; } };
    const out = await findWatcherCandidates(db, { handle: "h", capturedAt: new Date(), windowHours: 24 });
    expect(captured).toMatch(/social_post_candidates/);
    expect(captured).toMatch(/JOIN "Influencer"/);
    expect(out[0].postId).toBe("111");
  });

  it("creates one EvidenceLink per candidate (multi-link on a single capture)", async () => {
    const items = await store.getCasefileItems("case-1");
    const itemId = items[0].id;
    const candidates: WatcherCandidate[] = [
      { candidateId: "c1", postId: "1", postUrl: "u1", handle: "h", postedAtUtc: new Date(), discoveredAtUtc: new Date(), snippet: "" },
      { candidateId: "c2", postId: "2", postUrl: "u2", handle: "h", postedAtUtc: new Date(), discoveredAtUtc: new Date(), snippet: "" },
      { candidateId: "c3", postId: "3", postUrl: "u3", handle: "h", postedAtUtc: new Date(), discoveredAtUtc: new Date(), snippet: "" },
    ];
    const links = await createLinksFromCandidates(itemId, candidates, store);
    expect(links.length).toBe(3);
    expect(links.every((l) => l.linkType === "X_API_RECORD")).toBe(true);
    expect(links[0].corroborationLevel).toBe("CORROBORATED"); // >1 source
    const stored = await store.getItemLinks(itemId);
    expect(stored.length).toBe(3);
  });
});

// ─── LIVE (réseau) — exécutés seulement avec le flag ────────────────────────
const TSA_LIVE = process.env.EVIDENCE_TSA_LIVE === "1";
describe.runIf(TSA_LIVE)("evidence-chain — TSA réel (live)", () => {
  it("obtains a real RFC3161 token and verifies it; tamper → false", async () => {
    const { requestTimestampWithRetry, verifyTimestamp } = await import("../tsa");
    const f = join(tmp, "tsa.txt"); writeFileSync(f, "tsa live " + Date.now());
    const sha = await sha256File(f);
    const ts = await requestTimestampWithRetry(sha, { tsaUrl: process.env.TSA_URL ?? "https://freetsa.org/tsr" });
    expect(ts).not.toBeNull();
    // fetch freetsa CA for verification
    const ca = join(tmp, "ca.pem");
    writeFileSync(ca, Buffer.from(await (await fetch("https://freetsa.org/files/cacert.pem")).arrayBuffer()));
    const ok = await verifyTimestamp(sha, ts!.token, { caFile: ca });
    expect(ok.ok).toBe(true);
    const bad = await verifyTimestamp("0".repeat(64), ts!.token, { caFile: ca });
    expect(bad.ok).toBe(false);
  }, 60000);
});

const R2_LIVE = process.env.EVIDENCE_R2_LIVE === "1";
describe.runIf(R2_LIVE)("evidence-chain — R2 (live, retention dégradée)", () => {
  it("round-trips an object and DELETE SUCCEEDS (proof it is NOT WORM)", async () => {
    const { evidenceR2ConfigFromEnv, buildEvidenceR2, putEvidenceObject, evidenceObjectExists, deleteEvidenceObject } = await import("../r2");
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    const s3 = buildEvidenceR2(cfg!);
    const key = "_evidence_chain_test/live-" + Date.now() + ".txt";
    await putEvidenceObject(s3, cfg!.bucket, key, Buffer.from("live r2 test"), "text/plain");
    expect(await evidenceObjectExists(s3, cfg!.bucket, key)).toBe(true);
    await deleteEvidenceObject(s3, cfg!.bucket, key); // succeeds → not immutable
    expect(await evidenceObjectExists(s3, cfg!.bucket, key)).toBe(false);
  }, 60000);
});
