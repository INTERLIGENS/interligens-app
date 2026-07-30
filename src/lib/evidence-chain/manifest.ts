/**
 * Phase 5 — Manifest. Per-casefile JSON: for each piece — hash, timestamp,
 * source, chain of custody, external links, corroboration level. The manifest
 * itself is hashed (and optionally timestamped). A third party can verify
 * everything with just the manifest + the files (no system access).
 */
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { sha256Buffer, sha256File } from "./hash";
import { requestTimestampWithRetry, verifyTimestampOffline } from "./tsa";
import type { EvidenceStore, CorroborationLevel } from "./types";

export const MANIFEST_VERSION = "evidence-chain/v1";

export interface ManifestItem {
  sha256: string;
  r2Key: string | null;
  filePath: string | null;
  mimeType: string | null;
  byteSize: number | null;
  sourceType: string;
  sourceUrl: string | null;
  capturedAt: string | null;
  custody: { capturedBy: string | null; captureHost: string | null; captureTool: string | null; captureToolVersion: string | null; ingestedAt: string };
  tsa: { provider: string; timestampedAt: string; tokenB64: string; certChainPem: string } | null;
  links: { linkType: string; externalId: string | null; externalUrl: string | null; corroborationLevel: string }[];
  corroboration: CorroborationLevel;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  casefileId: string;
  itemCount: number;
  items: ManifestItem[];
  manifestHash: string;
  manifestTsa: { provider: string; timestampedAt: string; tokenB64: string; certChainPem: string } | null;
}

/** Deterministic JSON (sorted keys) for hashing. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

function highestCorroboration(levels: string[]): CorroborationLevel {
  if (levels.includes("CORROBORATED")) return "CORROBORATED";
  if (levels.includes("SINGLE_SOURCE")) return "SINGLE_SOURCE";
  return "NONE";
}

export async function generateManifest(
  casefileId: string,
  store: EvidenceStore,
  opts: { generatedAt: Date; tsaEnabled?: boolean; tsaUrl?: string; tsaCaUrl?: string } = { generatedAt: new Date() },
): Promise<Manifest> {
  const items = await store.getCasefileItems(casefileId);
  const manifestItems: ManifestItem[] = [];
  for (const it of items) {
    const links = await store.getItemLinks(it.id);
    manifestItems.push({
      sha256: it.sha256, r2Key: it.r2Key, filePath: it.filePath, mimeType: it.mimeType,
      byteSize: it.byteSize, sourceType: it.sourceType, sourceUrl: it.sourceUrl,
      capturedAt: it.capturedAt ? it.capturedAt.toISOString() : null,
      custody: {
        capturedBy: it.capturedBy, captureHost: it.captureHost, captureTool: it.captureTool,
        captureToolVersion: it.captureToolVersion, ingestedAt: it.ingestedAt.toISOString(),
      },
      tsa: it.tsaToken && it.tsaProvider && it.tsaTimestampedAt
        ? { provider: it.tsaProvider, timestampedAt: it.tsaTimestampedAt.toISOString(), tokenB64: it.tsaToken.toString("base64"), certChainPem: it.tsaCertChain ?? "" }
        : null,
      links: links.map((l) => ({ linkType: l.linkType, externalId: l.externalId, externalUrl: l.externalUrl, corroborationLevel: l.corroborationLevel })),
      corroboration: highestCorroboration(links.map((l) => l.corroborationLevel)),
    });
  }
  const core = { version: MANIFEST_VERSION, generatedAt: opts.generatedAt.toISOString(), casefileId, items: manifestItems };
  const manifestHash = sha256Buffer(stableStringify(core));

  let manifestTsa: Manifest["manifestTsa"] = null;
  if (opts.tsaEnabled) {
    const ts = await requestTimestampWithRetry(manifestHash, { tsaUrl: opts.tsaUrl, caUrl: opts.tsaCaUrl });
    if (ts) manifestTsa = { provider: ts.provider, timestampedAt: ts.genTime.toISOString(), tokenB64: ts.token.toString("base64"), certChainPem: ts.certChainPem };
  }
  return { ...core, itemCount: manifestItems.length, manifestHash, manifestTsa };
}

// ─── Verification (self-contained; only manifest + files needed) ─────────────

export interface ItemVerdict { sha256: string; status: "PASS" | "FAIL"; reason: string; tsaVerified?: boolean }
export interface VerifyReport { manifestHashOk: boolean; overall: "PASS" | "FAIL"; items: ItemVerdict[]; manifestTsaVerified?: boolean }

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

/**
 * Verify a manifest against a directory of files. PASS/FAIL per piece.
 * TSA verification is OFFLINE: it uses ONLY the cert chain archived in the
 * manifest at stamping time — no network, no external CA file. Verifiable
 * forever, even after the TSA certs expire or the authority disappears.
 */
export async function verifyManifest(
  manifest: Manifest,
  filesDir: string,
  opts: { verifyTsa?: boolean } = {},
): Promise<VerifyReport> {
  // 1. Manifest integrity: recompute hash over the canonical core.
  const core = { version: manifest.version, generatedAt: manifest.generatedAt, casefileId: manifest.casefileId, items: manifest.items };
  const manifestHashOk = sha256Buffer(stableStringify(core)) === manifest.manifestHash;

  // 2. Hash every file in the dir → content map (order-independent).
  const present = new Map<string, string>();
  for (const f of walkFiles(filesDir)) present.set(await sha256File(f), f);

  const items: ItemVerdict[] = [];
  for (const it of manifest.items) {
    if (!present.has(it.sha256)) {
      items.push({ sha256: it.sha256, status: "FAIL", reason: "file missing or content does not match sha256" });
      continue;
    }
    let tsaVerified: boolean | undefined;
    if (opts.verifyTsa && it.tsa && it.tsa.certChainPem) {
      const r = await verifyTimestampOffline(it.sha256, Buffer.from(it.tsa.tokenB64, "base64"), it.tsa.certChainPem);
      tsaVerified = r.ok;
      if (!r.ok) { items.push({ sha256: it.sha256, status: "FAIL", reason: `tsa verify failed: ${r.detail}`, tsaVerified }); continue; }
    }
    items.push({ sha256: it.sha256, status: "PASS", reason: "hash match" + (tsaVerified ? " + tsa OK" : ""), tsaVerified });
  }

  let manifestTsaVerified: boolean | undefined;
  if (opts.verifyTsa && manifest.manifestTsa && manifest.manifestTsa.certChainPem) {
    manifestTsaVerified = (await verifyTimestampOffline(manifest.manifestHash, Buffer.from(manifest.manifestTsa.tokenB64, "base64"), manifest.manifestTsa.certChainPem)).ok;
  }

  const overall: "PASS" | "FAIL" = manifestHashOk && items.every((i) => i.status === "PASS") ? "PASS" : "FAIL";
  return { manifestHashOk, overall, items, manifestTsaVerified };
}
