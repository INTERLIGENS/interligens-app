// src/lib/pdf/engine.ts
// PDF Engine V2 — data-driven, adaptive dossier per KolProfile.
// Pulls profile + wallets + proceeds (raw SQL) + evidence, computes a completeness
// score, renders an adaptive HTML template via Puppeteer, uploads archive + latest
// to R2, and patches KolProfile.pdf{Url,GeneratedAt,Score,Version}.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import { prisma } from "@/lib/prisma";

type RawProceedsEvent = {
  id: string;
  kolHandle: string;
  walletAddress: string;
  chain: string;
  txHash: string;
  eventDate: Date;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  amountTokens: number | null;
  amountUsd: number | null;
  priceUsdAtTime: number | null;
  pricingSource: string | null;
  eventType: string | null;
  ambiguous: boolean | null;
  caseId: string | null;
};

export type PdfGenerationResult = {
  success: boolean;
  handle: string;
  pdfUrl?: string;
  archiveUrl?: string;
  score: number;
  sections: string[];
  version?: number;
  error?: string;
};

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

function buildR2(): S3Client {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials missing (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function computeScore(input: {
  proceedsEvents: RawProceedsEvent[];
  walletCount: number;
  evidenceCount: number;
  cexIdentified: boolean;
  identityConfirmed: boolean;
}): { score: number; breakdown: Record<string, number> } {
  const breakdown = {
    onchain_events: 0,
    wallets: 0,
    evidence_offchain: 0,
    cex_identified: 0,
    identity_confirmed: 0,
  };

  const totalUsd = input.proceedsEvents.reduce((s, e) => s + (e.amountUsd || 0), 0);
  const eventCount = input.proceedsEvents.length;
  if (eventCount > 0) {
    breakdown.onchain_events = Math.min(
      40,
      Math.floor(
        (Math.min(eventCount, 50) / 50) * 20 +
        (Math.min(totalUsd, 500_000) / 500_000) * 20
      )
    );
  }

  if (input.walletCount >= 3) breakdown.wallets = 20;
  else if (input.walletCount >= 1) breakdown.wallets = 10;

  if (input.evidenceCount >= 5) breakdown.evidence_offchain = 20;
  else if (input.evidenceCount >= 2) breakdown.evidence_offchain = 10;
  else if (input.evidenceCount >= 1) breakdown.evidence_offchain = 5;

  if (input.cexIdentified) breakdown.cex_identified = 10;
  if (input.identityConfirmed) breakdown.identity_confirmed = 10;

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { score, breakdown };
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const iso = typeof d === "string" ? d : d.toISOString();
  return iso.slice(0, 10);
}

function fmtUsd(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function buildHtml(params: {
  handle: string;
  profile: {
    platform: string | null;
    tier: string | null;
    internalNote: string | null;
    pdfVersion: number | null;
  };
  wallets: Array<{ address: string; chain: string; label: string | null; claimType: string | null }>;
  proceedsEvents: RawProceedsEvent[];
  evidence: Array<{
    type: string;
    label: string;
    description: string | null;
    sourceUrl: string | null;
    dateFirst: Date | null;
    dateLast: Date | null;
    amountUsd: number | null;
  }>;
  score: number;
  breakdown: Record<string, number>;
}): string {
  const { handle, profile, wallets, proceedsEvents, evidence, score, breakdown } = params;
  const totalUsd = proceedsEvents.reduce((s, e) => s + (e.amountUsd || 0), 0);
  const tierColor =
    profile.tier === "CRITICAL"
      ? "#FF0000"
      : profile.tier === "HIGH"
      ? "#FF6B00"
      : profile.tier === "MEDIUM"
      ? "#FFA500"
      : "#888888";
  const scoreColor = score >= 60 ? "#00C853" : score >= 30 ? "#FF6B00" : "#CC0000";
  const scoreLabel =
    score >= 60 ? "DOSSIER COMPLET" : score >= 30 ? "DOSSIER PARTIEL" : "DONNÉES LIMITÉES";
  const now = new Date().toISOString().slice(0, 10);
  const nextVersion = (profile.pdfVersion || 0) + 1;

  const hasOnchain = proceedsEvents.length > 0;
  const hasWallets = wallets.length > 0;
  const hasEvidence = evidence.length > 0;

  const topEvents = [...proceedsEvents]
    .sort((a, b) => (b.amountUsd || 0) - (a.amountUsd || 0))
    .slice(0, 30);

  const eventsRows = topEvents
    .map(
      (e) => `
    <tr>
      <td>${fmtDate(e.eventDate)}</td>
      <td>${escapeHtml(e.tokenSymbol)}</td>
      <td style="color:#FF6B00; font-weight:bold;">$${(e.amountUsd || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
      <td style="font-family:monospace; font-size:8px;">${escapeHtml((e.txHash || "").slice(0, 22))}…</td>
      <td>${escapeHtml(e.eventType)}</td>
      <td style="font-size:8px; color:#888;">${escapeHtml(e.pricingSource)}</td>
    </tr>
  `
    )
    .join("");

  const walletsRows = wallets
    .map(
      (w) => `
    <tr>
      <td>${escapeHtml(w.chain || "SOL")}</td>
      <td style="font-family:monospace; font-size:9px;">${escapeHtml(w.address)}</td>
      <td>${escapeHtml(w.label)}</td>
      <td><span style="background:${
        w.claimType === "verified_onchain" ? "#00C853" : "#FF6B00"
      }; color:white; padding:2px 6px; border-radius:3px; font-size:9px;">${escapeHtml(w.claimType || "attributed")}</span></td>
    </tr>
  `
    )
    .join("");

  const evidenceRows = evidence
    .map(
      (e) => `
    <tr>
      <td>${fmtDate(e.dateFirst || e.dateLast)}</td>
      <td>${escapeHtml(e.type)}</td>
      <td>${escapeHtml(e.label)}${e.description ? ` — ${escapeHtml(e.description.slice(0, 120))}` : ""}</td>
      <td>${escapeHtml(e.sourceUrl)}</td>
    </tr>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #000; color: #fff; font-size: 11px; }
  .page { background: #000; padding: 24px; min-height: 297mm; position: relative; }

  .header { border-bottom: 3px solid #FF6B00; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #fff; }
  .header-left .handle { color: #FF6B00; font-size: 18px; font-weight: 700; }
  .header-right { text-align: right; }
  .score-box { background: ${scoreColor}; color: white; padding: 8px 16px; border-radius: 4px; font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 6px; }
  .score-num { font-size: 28px; font-weight: 900; display: block; }
  .meta { color: #888; font-size: 9px; line-height: 1.5; }

  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .card { background: #111; border: 1px solid #333; border-left: 3px solid #FF6B00; padding: 12px; }
  .card-val { font-size: 22px; font-weight: 900; color: #FF6B00; }
  .card-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; }

  .section { margin-bottom: 24px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #FF6B00; border-bottom: 1px solid #333; padding-bottom: 6px; margin-bottom: 12px; }

  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  th { background: #1a1a1a; color: #FF6B00; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 7px 8px; text-align: left; font-size: 8.5px; }
  td { padding: 6px 8px; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
  tr:nth-child(even) td { background: #0a0a0a; }

  .tier { display: inline-block; background: ${tierColor}; color: white; padding: 4px 10px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; }

  .breakdown { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .bd-item { background: #111; border: 1px solid #333; padding: 8px; text-align: center; }
  .bd-val { font-size: 16px; font-weight: 900; color: #FF6B00; }
  .bd-label { font-size: 8px; color: #888; margin-top: 2px; }

  .disclaimer { background: #0a0a0a; border: 1px solid #333; padding: 10px; font-size: 8.5px; color: #888; margin-top: 20px; border-left: 3px solid #FF6B00; }
  .footer { border-top: 1px solid #333; padding-top: 10px; margin-top: 20px; display: flex; justify-content: space-between; color: #555; font-size: 8px; }
  .empty { color: #555; padding: 12px; background: #0a0a0a; border: 1px solid #222; }
  ${
    score < 30
      ? ".watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; color: rgba(255,107,0,0.07); font-weight: 900; pointer-events: none; z-index: 0; }"
      : ""
  }
</style>
</head>
<body>
<div class="page">
  ${score < 30 ? '<div class="watermark">DONNÉES LIMITÉES</div>' : ""}

  <div class="header">
    <div class="header-left">
      <div style="color:#888; font-size:9px; text-transform:uppercase; letter-spacing:2px; margin-bottom:4px;">INTERLIGENS — INTELLIGENCE DOSSIER</div>
      <h1>@${escapeHtml(handle)}</h1>
      <div class="handle">${escapeHtml(profile.platform || "X")} &bull; <span class="tier">${escapeHtml(profile.tier || "UNKNOWN")}</span></div>
      ${
        profile.internalNote
          ? `<div style="color:#666; font-size:9px; margin-top:6px; max-width:420px;">${escapeHtml(profile.internalNote.slice(0, 200))}</div>`
          : ""
      }
    </div>
    <div class="header-right">
      <div class="score-box">
        <span class="score-num">${score}</span>
        ${scoreLabel}
      </div>
      <div class="meta">
        Généré le : ${now}<br>
        Version : ${nextVersion}<br>
        TX on-chain : ${proceedsEvents.length}<br>
        Wallets : ${wallets.length}
      </div>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-val">${fmtUsd(totalUsd)}</div>
      <div class="card-label">Cashouts documentés</div>
    </div>
    <div class="card">
      <div class="card-val">${proceedsEvents.length}</div>
      <div class="card-label">Transactions tracées</div>
    </div>
    <div class="card">
      <div class="card-val">${wallets.length}</div>
      <div class="card-label">Wallets identifiés</div>
    </div>
    <div class="card">
      <div class="card-val">${evidence.length}</div>
      <div class="card-label">Preuves off-chain</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Score de complétude — ${score}/100</div>
    <div class="breakdown">
      <div class="bd-item"><div class="bd-val">${breakdown.onchain_events}</div><div class="bd-label">On-chain<br>proceeds</div></div>
      <div class="bd-item"><div class="bd-val">${breakdown.wallets}</div><div class="bd-label">Wallets<br>identifiés</div></div>
      <div class="bd-item"><div class="bd-val">${breakdown.evidence_offchain}</div><div class="bd-label">Preuves<br>off-chain</div></div>
      <div class="bd-item"><div class="bd-val">${breakdown.cex_identified}</div><div class="bd-label">CEX<br>identifiés</div></div>
      <div class="bd-item"><div class="bd-val">${breakdown.identity_confirmed}</div><div class="bd-label">Identité<br>confirmée</div></div>
    </div>
  </div>

  ${
    hasWallets
      ? `<div class="section">
    <div class="section-title">Wallets identifiés (${wallets.length})</div>
    <table>
      <tr><th>Chain</th><th>Adresse</th><th>Label</th><th>Statut</th></tr>
      ${walletsRows}
    </table>
  </div>`
      : ""
  }

  ${
    hasOnchain
      ? `<div class="section">
    <div class="section-title">Cashouts on-chain — Top ${Math.min(topEvents.length, 30)} / ${proceedsEvents.length} TX — Total $${Math.round(totalUsd).toLocaleString("fr-FR")}</div>
    <table>
      <tr><th>Date</th><th>Token</th><th>USD</th><th>TX Hash</th><th>Type</th><th>Source prix</th></tr>
      ${eventsRows}
    </table>
    ${proceedsEvents.length > 30 ? `<div style="color:#888; font-size:9px; margin-top:6px;">+ ${proceedsEvents.length - 30} transactions supplémentaires en DB (non affichées)</div>` : ""}
  </div>`
      : `<div class="section">
    <div class="section-title">Cashouts on-chain</div>
    <div class="empty">Aucune transaction on-chain documentée dans la base. Scan Helius requis.</div>
  </div>`
  }

  ${
    hasEvidence
      ? `<div class="section">
    <div class="section-title">Preuves off-chain (${evidence.length})</div>
    <table>
      <tr><th>Date</th><th>Type</th><th>Description</th><th>Source</th></tr>
      ${evidenceRows}
    </table>
  </div>`
      : ""
  }

  <div class="disclaimer">
    <strong>INTERLIGENS — MÉTHODOLOGIE :</strong> Les montants USD sont estimés sur la base du prix SOL au moment de la transaction (source : Binance klines via PriceCache, ou estimation de repli si non disponible ±25%). Les wallets <em>verified_onchain</em> ont été vérifiés via Arkham Intelligence ou preuves on-chain directes. Ce document est généré automatiquement et constitue un premier niveau d'analyse — il ne remplace pas une investigation judiciaire complète. Score ${score}/100 — ${scoreLabel}.
  </div>

  <div class="footer">
    <span>INTERLIGENS — app.interligens.com — ${now}</span>
    <span>@${escapeHtml(handle)} — v${nextVersion} — ${proceedsEvents.length} TX — Score ${score}/100</span>
    <span>CONFIDENTIEL — usage judiciaire</span>
  </div>
</div>
</body>
</html>`;
}

export async function generateCasePdf(handle: string): Promise<PdfGenerationResult> {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_BASE_URL || "https://pub-interligens.r2.dev";

  try {
    const profile = await prisma.kolProfile.findUnique({ where: { handle } });
    if (!profile) {
      return { success: false, handle, score: 0, sections: [], error: "Profile not found" };
    }

    const [wallets, proceedsEvents, evidence] = await Promise.all([
      prisma.kolWallet.findMany({ where: { kolHandle: handle } }),
      prisma.$queryRaw<RawProceedsEvent[]>`
        SELECT id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
               "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd",
               "priceUsdAtTime", "pricingSource", "eventType", ambiguous, "caseId"
        FROM "KolProceedsEvent"
        WHERE "kolHandle" = ${handle}
        ORDER BY "amountUsd" DESC NULLS LAST
      `,
      prisma.kolEvidence.findMany({ where: { kolHandle: handle } }),
    ]);

    const cexIdentified = proceedsEvents.some(
      (e) => e.eventType === "cex_deposit" || (e.pricingSource && e.pricingSource.includes("cex"))
    );
    const identityConfirmed = wallets.some((w) => w.claimType === "verified_onchain");

    const { score, breakdown } = computeScore({
      proceedsEvents,
      walletCount: wallets.length,
      evidenceCount: evidence.length,
      cexIdentified,
      identityConfirmed,
    });

    const html = buildHtml({
      handle,
      profile: {
        platform: profile.platform,
        tier: profile.tier,
        internalNote: profile.internalNote,
        pdfVersion: profile.pdfVersion,
      },
      wallets: wallets.map((w) => ({
        address: w.address,
        chain: w.chain,
        label: w.label,
        claimType: w.claimType,
      })),
      proceedsEvents,
      evidence: evidence.map((e) => ({
        type: e.type,
        label: e.label,
        description: e.description,
        sourceUrl: e.sourceUrl,
        dateFirst: e.dateFirst,
        dateLast: e.dateLast,
        amountUsd: e.amountUsd,
      })),
      score,
      breakdown,
    });

    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    let pdfBytes: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdfBytes = (await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      })) as Uint8Array;
    } finally {
      await browser.close();
    }

    if (!bucket) throw new Error("R2_BUCKET_NAME missing");
    const r2 = buildR2();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const archiveKey = `reports/${handle}/CASE_${handle}_${ts}.pdf`;
    const latestKey = `reports/${handle}/latest.pdf`;

    for (const Key of [archiveKey, latestKey]) {
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key,
          Body: pdfBytes,
          ContentType: "application/pdf",
          CacheControl: "no-cache",
        })
      );
    }

    const pdfUrl = `/api/pdf/${encodeURIComponent(handle)}`;
    const archiveUrl = `${publicBase}/${archiveKey}`;

    const nextVersion = (profile.pdfVersion || 0) + 1;
    await prisma.kolProfile.update({
      where: { handle },
      data: {
        pdfUrl,
        pdfGeneratedAt: new Date(),
        pdfScore: score,
        pdfVersion: nextVersion,
      },
    });

    const sections: string[] = [];
    if (wallets.length > 0) sections.push("wallets");
    if (proceedsEvents.length > 0) sections.push("onchain");
    if (evidence.length > 0) sections.push("evidence");

    console.log(`[pdf] ${handle} — score ${score}/100 — ${pdfUrl}`);
    return { success: true, handle, pdfUrl, archiveUrl, score, sections, version: nextVersion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pdf] ${handle} failed:`, message);
    return { success: false, handle, score: 0, sections: [], error: message };
  }
}
