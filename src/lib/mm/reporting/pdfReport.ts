// ─── MM forensic PDF generator (Phase 10) ────────────────────────────────
// Loads a full snapshot from the registry + engine + MmScore + MmScanRun,
// renders the HTML template, converts to PDF via Puppeteer + chromium-min,
// optionally caches the result on R2 for 24 h.
//
// The heavy work is isolated behind `generateMmReport(slug, opts)` which
// returns a Buffer. Tests mock the puppeteer + S3 paths.
//
// R2 key: `mm-reports/{slug}_{yyyymmdd}.pdf` — 24 h cache by default.

import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEntityFull } from "@/lib/mm/registry/entities";
import {
  renderMmReportHtml,
  type MmReportAttribution,
  type MmReportClaim,
  type MmReportClusterRelation,
  type MmReportInput,
  type MmReportScanSummary,
  type MmReportSource,
} from "./templateMm";
import type { MmChain } from "@/lib/mm/types";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

// ─── R2 ───────────────────────────────────────────────────────────────────

interface R2Handles {
  client: S3Client;
  bucket: string;
}

function buildR2(): R2Handles | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return null;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return { client, bucket: R2_BUCKET_NAME };
}

function todayKey(slug: string, now: Date): string {
  const iso = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `mm-reports/${slug}_${iso}.pdf`;
}

async function bufferFromStream(stream: unknown): Promise<Buffer> {
  const nodeStream = stream as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    nodeStream.on("data", (c: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.on("error", reject);
  });
}

export async function readReportCache(
  slug: string,
  options: { maxAgeMs?: number; now?: Date } = {},
): Promise<Buffer | null> {
  const r2 = buildR2();
  if (!r2) return null;
  const now = options.now ?? new Date();
  const key = todayKey(slug, now);
  try {
    const res = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
    );
    if (!res.LastModified) return null;
    const age = now.getTime() - res.LastModified.getTime();
    if (age > (options.maxAgeMs ?? DEFAULT_CACHE_TTL_MS)) return null;
    if (!res.Body) return null;
    return await bufferFromStream(res.Body);
  } catch {
    return null;
  }
}

export async function writeReportCache(
  slug: string,
  pdf: Buffer,
  options: { now?: Date } = {},
): Promise<string | null> {
  const r2 = buildR2();
  if (!r2) return null;
  const key = todayKey(slug, options.now ?? new Date());
  try {
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: pdf,
        ContentType: "application/pdf",
        CacheControl: "public, max-age=86400",
      }),
    );
    return key;
  } catch (err) {
    console.error("[mm/pdf] R2 write failed", err);
    return null;
  }
}

// ─── Snapshot builder ─────────────────────────────────────────────────────

export interface ReportSnapshotOptions {
  includeScans?: boolean; // default true
  maxScans?: number; // default 12
  maxClusters?: number; // default 8
}

export async function buildReportInput(
  slug: string,
  options: ReportSnapshotOptions = {},
): Promise<MmReportInput | null> {
  const entity = await getEntityFull(slug);
  if (!entity) return null;

  const claims: MmReportClaim[] = entity.claims.map((c) => ({
    id: c.id,
    claimType: c.claimType,
    text: c.text,
    textFr: c.textFr,
    jurisdiction: c.jurisdiction,
    orderIndex: c.orderIndex,
    source: {
      id: c.source.id,
      publisher: c.source.publisher,
      title: c.source.title,
      url: c.source.url,
      sourceType: c.source.sourceType,
      credibilityTier: c.source.credibilityTier,
      publishedAt: c.source.publishedAt,
    } satisfies MmReportSource,
  }));

  const attributions: MmReportAttribution[] = entity.attributions.map((a) => ({
    id: a.id,
    walletAddress: a.walletAddress,
    chain: a.chain,
    attributionMethod: a.attributionMethod,
    confidence: a.confidence,
    reviewedAt: a.reviewedAt,
    createdAt: a.createdAt,
  }));

  let scans: MmReportScanSummary[] = [];
  if (options.includeScans !== false && attributions.length > 0) {
    const walletAddresses = attributions.map((a) => a.walletAddress);
    const maxScans = options.maxScans ?? 12;
    const rows = await prisma.mmScore.findMany({
      where: {
        subjectId: { in: walletAddresses },
      },
      orderBy: { displayScore: "desc" },
      take: maxScans,
    });

    for (const r of rows) {
      const breakdown = r.breakdown as unknown as {
        engine?: {
          signals?: Array<{ type: string; severity: string; description?: string }>;
          detectorBreakdown?: Record<
            string,
            { score?: number; detectorType?: string } | null
          >;
        };
      } | null;
      const signals = breakdown?.engine?.signals ?? [];
      const detectorBreakdown = breakdown?.engine?.detectorBreakdown ?? {};
      const detectorScores = Object.values(detectorBreakdown)
        .filter(
          (d): d is { score: number; detectorType: string } =>
            !!d && typeof d.score === "number" && typeof d.detectorType === "string",
        )
        .map((d) => ({ detectorType: d.detectorType, score: d.score }));
      scans.push({
        subjectId: r.subjectId,
        chain: r.chain as MmChain,
        displayScore: r.displayScore,
        band: r.band,
        confidence: r.confidence,
        coverage: r.coverage,
        dominantDriver: r.dominantDriver,
        computedAt: r.computedAt,
        signalsCount: r.signalsCount,
        topSignals: signals.slice(0, 6),
        detectorScores,
      });
    }
  }

  const clusters = await buildClusterSnapshots(
    attributions.map((a) => a.walletAddress),
    options.maxClusters ?? 8,
  );

  return {
    entity: {
      slug: entity.slug,
      name: entity.name,
      legalName: entity.legalName,
      jurisdiction: entity.jurisdiction,
      foundedYear: entity.foundedYear,
      founders: entity.founders,
      status: entity.status,
      riskBand: entity.riskBand,
      defaultScore: entity.defaultScore,
      publicSummary: entity.publicSummary,
      publicSummaryFr: entity.publicSummaryFr,
      workflow: entity.workflow,
      publishedAt: entity.publishedAt,
      updatedAt: entity.updatedAt,
    },
    claims,
    attributions,
    scans,
    clusters,
    generatedAt: new Date(),
  };
}

async function buildClusterSnapshots(
  seedWallets: string[],
  max: number,
): Promise<MmReportClusterRelation[]> {
  if (seedWallets.length === 0) return [];
  const runs = await prisma.mmScanRun.findMany({
    where: {
      subjectId: { in: seedWallets },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      detectorOutputs: {
        where: { detectorType: "CLUSTER_COORDINATION" },
      },
    },
  });
  const seen = new Set<string>();
  const out: MmReportClusterRelation[] = [];
  for (const run of runs) {
    for (const d of run.detectorOutputs) {
      const ev = d.evidence as unknown as {
        clusters?: Array<{
          internalClusterId?: string;
          rootWallet?: string;
          memberCount?: number;
          members?: string[];
          sharedTokens?: string[];
        }>;
      } | null;
      if (!ev?.clusters?.length) continue;
      for (const c of ev.clusters) {
        if (!c.internalClusterId || seen.has(c.internalClusterId)) continue;
        seen.add(c.internalClusterId);
        out.push({
          internalClusterId: c.internalClusterId,
          rootWallet: c.rootWallet ?? "",
          memberCount: c.memberCount ?? (c.members?.length ?? 0),
          members: c.members ?? [],
          sharedTokens: c.sharedTokens ?? [],
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

// ─── Puppeteer renderer (test-injectable) ────────────────────────────────

export interface RenderHooks {
  /**
   * Override the headless rendering step. Tests inject a stub that returns
   * a deterministic buffer without touching puppeteer / chromium.
   */
  render?: (html: string) => Promise<Buffer>;
}

async function defaultRenderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = (await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    })) as Uint8Array;
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Public entry point ──────────────────────────────────────────────────

export interface GenerateMmReportOptions extends ReportSnapshotOptions {
  /**
   * Disable the R2 read-through cache and force a fresh render.
   */
  bypassCache?: boolean;
  /**
   * Skip writing the generated PDF to R2. Useful for ad-hoc admin previews.
   */
  skipCacheWrite?: boolean;
  /**
   * Override "now" for deterministic cache keys.
   */
  now?: Date;
  /**
   * Hooks for tests.
   */
  hooks?: RenderHooks;
  /**
   * Allow generation even for non-PUBLISHED entities. Callers must have
   * already authorised the admin override.
   */
  allowDraft?: boolean;
}

export interface GenerateMmReportResult {
  pdf: Buffer;
  source: "cache" | "render";
  cacheKey: string | null;
  slug: string;
  generatedAt: Date;
}

export async function generateMmReport(
  slug: string,
  options: GenerateMmReportOptions = {},
): Promise<GenerateMmReportResult> {
  const now = options.now ?? new Date();
  const snapshot = await buildReportInput(slug, options);
  if (!snapshot) throw new MmReportError("entity_not_found", 404);
  const isPublished =
    snapshot.entity.workflow === "PUBLISHED" ||
    snapshot.entity.workflow === "CHALLENGED";
  if (!isPublished && !options.allowDraft) {
    throw new MmReportError("entity_not_published", 403);
  }

  // 1. Try cache (unless bypassed)
  if (!options.bypassCache) {
    const cached = await readReportCache(slug, { now });
    if (cached) {
      return {
        pdf: cached,
        source: "cache",
        cacheKey: todayKey(slug, now),
        slug,
        generatedAt: now,
      };
    }
  }

  // 2. Render
  const html = renderMmReportHtml(snapshot);
  const render = options.hooks?.render ?? defaultRenderHtmlToPdf;
  const pdf = await render(html);

  // 3. Cache write (best effort)
  let cacheKey: string | null = null;
  if (!options.skipCacheWrite) {
    cacheKey = await writeReportCache(slug, pdf, { now });
  }

  return { pdf, source: "render", cacheKey, slug, generatedAt: now };
}

export class MmReportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MmReportError";
  }
}

// Keep Prisma import live — used by TS inference; marker prevents tree-shake
// warnings if the file is imported in contexts that only touch the types.
export type __PrismaUsed = Prisma.JsonValue;
