/**
 * CC-OFFLINE-56 — provenance + câblage live. Tests réels (sqlite, aucun réseau) :
 * règles d'ingestion (unattributed/THIRD_PARTY/submittedBy), ingestBuffer,
 * manifeste v2 + dérivation legacy (Option A : colonnes NULL jamais réécrites),
 * compat verify des manifestes v1 déjà émis, validation stricte des bytes du
 * commit opérateur, chaîne watcher-bridge sur artefact JSON canonique.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "crypto";
import { SqliteEvidenceStore } from "../store/sqlite";
import { ingestBuffer, ingestFile } from "../ingest";
import { sha256Buffer } from "../hash";
import { generateManifest, verifyManifest, stableStringify, MANIFEST_VERSION, MANIFEST_DISCLAIMER, type Manifest } from "../manifest";
import { validateCommitImages } from "@/lib/osint/evidenceCommitBridge";
import { createAutoEvidenceSnapshot } from "@/lib/watcher-bridge/createAutoEvidenceSnapshot";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let store: SqliteEvidenceStore;
let tmp: string;
beforeAll(() => { store = new SqliteEvidenceStore(":memory:"); tmp = mkdtempSync(join(tmpdir(), "evprov-")); });
afterAll(() => { store.close(); });

describe("provenance — règles d'ingestion", () => {
  it("refuse capturedBy='unattributed' hors THIRD_PARTY_SUBMISSION", async () => {
    await expect(ingestBuffer({
      buffer: Buffer.from("first party unattributed"), sourceType: "OTHER",
      capturedBy: "unattributed", provenanceType: "FIRST_PARTY_CAPTURE", timestampMode: "at-capture",
    }, store)).rejects.toThrow(/unattributed/);
  });

  it("refuse THIRD_PARTY_SUBMISSION sans submittedBy", async () => {
    await expect(ingestBuffer({
      buffer: Buffer.from("third party no submitter"), sourceType: "OTHER",
      capturedBy: "unattributed", provenanceType: "THIRD_PARTY_SUBMISSION", timestampMode: "at-ingestion",
    }, store)).rejects.toThrow(/submittedBy/);
  });

  it("accepte le triplet retail et le persiste (roundtrip SQL réel)", async () => {
    const buf = Buffer.from("retail piece " + "r".repeat(64));
    const r = await ingestBuffer({
      buffer: buf, sourceType: "X_POST", sourceUrl: "https://x.com/a/status/1",
      casefileId: "prov-case", capturedBy: "unattributed",
      provenanceType: "THIRD_PARTY_SUBMISSION", submittedBy: "iphash-abc123", timestampMode: "at-ingestion",
    }, store);
    expect(r.duplicate).toBe(false);
    expect(r.item.sha256).toBe(sha256Buffer(buf));
    expect(r.item.filePath).toBeNull();
    expect(r.item.byteSize).toBe(buf.length);
    const back = await store.getItem(r.item.id);
    expect(back!.provenanceType).toBe("THIRD_PARTY_SUBMISSION");
    expect(back!.submittedBy).toBe("iphash-abc123");
    expect(back!.timestampMode).toBe("at-ingestion");
  });

  it("dédupe buffer vs fichier de même contenu (une seule pièce)", async () => {
    const content = "same bytes either way";
    const f = join(tmp, "dup.txt"); writeFileSync(f, content);
    const a = await ingestFile({ filePath: f, sourceType: "OTHER", casefileId: "prov-case", capturedBy: "op", provenanceType: "FIRST_PARTY_CAPTURE", timestampMode: "at-capture" }, store);
    const b = await ingestBuffer({ buffer: Buffer.from(content), sourceType: "OTHER", casefileId: "prov-case", capturedBy: "op", provenanceType: "FIRST_PARTY_CAPTURE", timestampMode: "at-capture" }, store);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.item.id).toBe(a.item.id);
  });
});

describe("manifeste v2 — provenance exposée + dérivation legacy", () => {
  it("expose provenanceType/submittedBy/timestampMode et vérifie PASS offline", async () => {
    const manifest = await generateManifest("prov-case", store, { generatedAt: new Date("2026-08-13T00:00:00Z") });
    expect(manifest.version).toBe("evidence-chain/v2");
    expect(MANIFEST_VERSION).toBe("evidence-chain/v2");
    const retail = manifest.items.find((i) => i.submittedBy === "iphash-abc123")!;
    expect(retail.provenanceType).toBe("THIRD_PARTY_SUBMISSION");
    expect(retail.timestampMode).toBe("at-ingestion");
    const firstParty = manifest.items.find((i) => i.submittedBy === null)!;
    expect(firstParty.provenanceType).toBe("FIRST_PARTY_CAPTURE");

    // Vérif offline : bundle par sha256. La pièce buffer (filePath null) est
    // matérialisée depuis son contenu connu du test.
    const bundle = join(tmp, "bundle-v2"); mkdirSync(bundle, { recursive: true });
    writeFileSync(join(bundle, retail.sha256), Buffer.from("retail piece " + "r".repeat(64)));
    writeFileSync(join(bundle, firstParty.sha256), "same bytes either way");
    const report = await verifyManifest(manifest, bundle);
    expect(report.manifestHashOk).toBe(true);
    expect(report.overall).toBe("PASS");
  });

  it("legacy (colonnes NULL, jamais réécrites) → MIGRATED_BACKFILL dérivé ; timestampMode depuis le marqueur notes", async () => {
    // Simule les pièces pré-provenance : insertion directe SANS colonnes (Option A).
    await store.insertItem({ sha256: "a".repeat(64), sourceType: "OTHER", casefileId: "legacy-case", capturedBy: "legacy:evidence-snapshot", notes: "[TIMESTAMP:RETROACTIVE] horodatage rétroactif" });
    await store.insertItem({ sha256: "b".repeat(64), sourceType: "OTHER", casefileId: "legacy-case", capturedBy: "backfill:unknown-operator", notes: "backfill sans marqueur" });
    const manifest = await generateManifest("legacy-case", store, { generatedAt: new Date("2026-08-13T00:00:00Z") });
    const marked = manifest.items.find((i) => i.sha256 === "a".repeat(64))!;
    const unmarked = manifest.items.find((i) => i.sha256 === "b".repeat(64))!;
    expect(marked.provenanceType).toBe("MIGRATED_BACKFILL");
    expect(marked.timestampMode).toBe("retroactive");
    expect(unmarked.provenanceType).toBe("MIGRATED_BACKFILL");
    expect(unmarked.timestampMode).toBe("at-capture"); // statu quo CC-55 : pas de marqueur → at-capture
  });

  it("compat : un manifeste v1 AVEC disclaimer (émis par CC-55) reste vérifiable", async () => {
    const core = { version: "evidence-chain/v1", generatedAt: "2026-07-30T00:00:00.000Z", casefileId: "v1-case", disclaimer: MANIFEST_DISCLAIMER, items: [] as never[] };
    const manifest = { ...core, itemCount: 0, manifestHash: sha256Buffer(stableStringify(core)), manifestTsa: null } as unknown as Manifest;
    const bundle = join(tmp, "bundle-v1a"); mkdirSync(bundle, { recursive: true });
    const report = await verifyManifest(manifest, bundle);
    expect(report.manifestHashOk).toBe(true);
    expect(report.overall).toBe("PASS");
  });

  it("compat : un manifeste v1 SANS disclaimer (tout premiers émis) reste vérifiable (shim)", async () => {
    const core = { version: "evidence-chain/v1", generatedAt: "2026-07-30T00:00:00.000Z", casefileId: "v1-case", items: [] as never[] };
    const manifest = { ...core, itemCount: 0, manifestHash: sha256Buffer(stableStringify(core)), manifestTsa: null } as unknown as Manifest;
    const bundle = join(tmp, "bundle-v1b"); mkdirSync(bundle, { recursive: true });
    const report = await verifyManifest(manifest, bundle);
    expect(report.manifestHashOk).toBe(true);
    expect(report.overall).toBe("PASS");
  });
});

describe("commit opérateur — validation stricte des bytes AVANT toute écriture", () => {
  const bytes = Buffer.from("operator capture png bytes");
  const sha = createHash("sha256").update(bytes).digest("hex");

  it("bytes conformes → ok", () => {
    const v = validateCommitImages([{ sha256: sha }], { [sha]: bytes.toString("base64") });
    expect(v.ok).toBe(true);
    expect(v.mismatches).toEqual([]);
    expect(v.unknown).toEqual([]);
  });

  it("sha annoncé ≠ sha recalculé → mismatch explicite", () => {
    const lying = "f".repeat(64);
    const v = validateCommitImages([{ sha256: lying }], { [lying]: bytes.toString("base64") });
    expect(v.ok).toBe(false);
    expect(v.mismatches).toEqual([{ claimed: lying, actual: sha }]);
  });

  it("image hors plan → unknown, rejet", () => {
    const v = validateCommitImages([{ sha256: "1".repeat(64) }], { [sha]: bytes.toString("base64") });
    expect(v.ok).toBe(false);
    expect(v.unknown).toEqual([sha]);
  });

  it("accepte les data:-URL (même décodage que l'UI admin)", () => {
    const v = validateCommitImages([{ sha256: sha }], { [sha]: `data:image/png;base64,${bytes.toString("base64")}` });
    expect(v.ok).toBe(true);
  });
});

describe("watcher-bridge — artefact JSON canonique chaîné", () => {
  function mockDb(candidate: Record<string, unknown>) {
    const inserted: string[] = [];
    return {
      inserted,
      $queryRawUnsafe: async <T = unknown>(q: string): Promise<T> => {
        if (q.includes("FROM \"social_post_candidates\" c")) return [candidate] as T;
        if (q.includes("SELECT 1 AS one FROM \"EvidenceSnapshot\"")) return [] as T;
        if (q.includes("INSERT INTO \"EvidenceSnapshot\"")) { inserted.push(q); return [{ id: "snap-1" }] as T; }
        throw new Error("unexpected query: " + q.slice(0, 80));
      },
    };
  }
  const candidate = {
    id: "cand-1", handle: "kolx", postUrl: "https://x.com/kolx/status/9",
    postedAtUtc: new Date("2026-08-10T10:00:00Z"), discoveredAtUtc: new Date("2026-08-11T06:05:00Z"),
    toks: JSON.stringify(["NOVA"]), addrs: JSON.stringify([]),
  };

  it("crée l'EvidenceItem de l'artefact + liens X_API_RECORD et MANUAL, provenance FIRST_PARTY", async () => {
    const db = mockDb(candidate);
    const chainStore = new SqliteEvidenceStore(":memory:");
    const r = await createAutoEvidenceSnapshot(db, "cand-1", { chain: { store: chainStore } });
    expect(r.action).toBe("created");
    expect(r.snapshotId).toBe("snap-1");

    const expected = stableStringify({
      kind: "watcher-v2-candidate", candidateId: "cand-1", handle: "kolx",
      postUrl: candidate.postUrl, postedAtUtc: "2026-08-10T10:00:00.000Z",
      discoveredAtUtc: "2026-08-11T06:05:00.000Z", detectedTokens: ["NOVA"], detectedAddresses: [], snapshotId: "snap-1",
    });
    const item = await chainStore.findBySha256(sha256Buffer(Buffer.from(expected, "utf8")));
    expect(item).not.toBeNull();
    expect(item!.provenanceType).toBe("FIRST_PARTY_CAPTURE");
    expect(item!.timestampMode).toBe("at-ingestion");
    expect(item!.capturedBy).toBe("watcher-v2:x-api");
    expect(item!.capturedAt!.toISOString()).toBe("2026-08-11T06:05:00.000Z");

    const links = await chainStore.getItemLinks(item!.id);
    expect(links.map((l) => l.linkType).sort()).toEqual(["MANUAL", "X_API_RECORD"]);
    expect(links.find((l) => l.linkType === "X_API_RECORD")!.externalId).toBe("cand-1");
    expect(links.find((l) => l.linkType === "MANUAL")!.externalId).toBe("snap-1");
    chainStore.close();
  });

  it("échec de la chaîne = jamais bloquant pour le snapshot (created quand même)", async () => {
    const db = mockDb(candidate);
    const failingStore = new SqliteEvidenceStore(":memory:");
    failingStore.findBySha256 = async () => { throw new Error("chain down"); };
    const r = await createAutoEvidenceSnapshot(db, "cand-1", { chain: { store: failingStore } });
    expect(r.action).toBe("created");
    expect(r.snapshotId).toBe("snap-1");
    failingStore.close();
  });
});
