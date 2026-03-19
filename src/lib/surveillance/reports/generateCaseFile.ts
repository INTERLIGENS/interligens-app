/**
 * src/lib/surveillance/reports/generateCaseFile.ts
 * Génère un PDF "court-ready" pour un signal donné
 */

import { prisma } from "@/lib/prisma";
import { evidenceStorage } from "@/lib/storage/evidenceStorage";
import { sha256 } from "../evidencePack";
import { randomUUID } from "crypto";

// ─── HTML TEMPLATE ────────────────────────────────────────────────────────────

function buildHtml(data: {
  handle: string;
  walletAddress: string;
  ensName?: string;
  verifiedMethod: string;
  postUrl: string;
  postedAtUtc?: string;
  capturedAtUtc: string;
  textExcerpt?: string;
  manifestSha256?: string;
  screenshotSha256?: string;
  htmlSha256?: string;
  txHash?: string;
  blockNumber?: number;
  blockTimeUtc?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amountRaw?: string;
  windowBucket?: string;
  windowMinutes?: number;
  severity?: string;
  confidence?: string;
  soldPct?: number;
  recidivismScore?: number;
  recidivismLabel?: string;
  notes?: string;
  generatedAt: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 32px; }
  h1 { font-size: 18px; color: #0a0a2e; margin-bottom: 4px; }
  h2 { font-size: 13px; color: #0a0a2e; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  .BLATANT { background: #fee2e2; color: #991b1b; }
  .PROBABLE { background: #fef3c7; color: #92400e; }
  .POSSIBLE { background: #dbeafe; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
  td:first-child { font-weight: bold; width: 35%; background: #f9fafb; }
  .mono { font-family: monospace; font-size: 10px; word-break: break-all; }
  .disclaimer { margin-top: 24px; padding: 12px; background: #f3f4f6; border-left: 3px solid #6b7280; font-size: 10px; color: #6b7280; }
  .footer { margin-top: 16px; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>INTERLIGENS — Evidence Report</h1>
    <div style="color:#6b7280; font-size:10px;">Generated ${data.generatedAt}</div>
  </div>
  <span class="badge ${data.windowBucket ?? ''}">${data.windowBucket ?? 'N/A'}</span>
</div>

<h2>1 — Identity</h2>
<table>
  <tr><td>X Handle</td><td>${data.handle}</td></tr>
  <tr><td>Wallet Address</td><td class="mono">${data.walletAddress}</td></tr>
  ${data.ensName ? `<tr><td>ENS</td><td>${data.ensName}</td></tr>` : ''}
  <tr><td>Verification Method</td><td>${data.verifiedMethod}</td></tr>
</table>

<h2>2 — The Post</h2>
<table>
  <tr><td>Post URL</td><td class="mono">${data.postUrl}</td></tr>
  ${data.postedAtUtc ? `<tr><td>Posted At (UTC)</td><td>${data.postedAtUtc}</td></tr>` : ''}
  <tr><td>Captured At (UTC)</td><td>${data.capturedAtUtc}</td></tr>
  ${data.textExcerpt ? `<tr><td>Text Excerpt</td><td>${data.textExcerpt}</td></tr>` : ''}
</table>

<h2>3 — The Transaction</h2>
<table>
  ${data.txHash ? `<tr><td>TX Hash</td><td class="mono">${data.txHash}</td></tr>` : ''}
  ${data.blockNumber ? `<tr><td>Block Number</td><td>${data.blockNumber}</td></tr>` : ''}
  ${data.blockTimeUtc ? `<tr><td>Block Time (UTC)</td><td>${data.blockTimeUtc}</td></tr>` : ''}
  ${data.tokenAddress ? `<tr><td>Token Address</td><td class="mono">${data.tokenAddress}</td></tr>` : ''}
  ${data.tokenSymbol ? `<tr><td>Token Symbol</td><td>${data.tokenSymbol}</td></tr>` : ''}
  ${data.amountRaw ? `<tr><td>Amount (raw)</td><td class="mono">${data.amountRaw}</td></tr>` : ''}
</table>

<h2>4 — Analysis</h2>
<table>
  <tr><td>Window</td><td>${data.windowMinutes ?? 'N/A'} minutes after post</td></tr>
  <tr><td>Bucket</td><td>${data.windowBucket ?? 'N/A'}</td></tr>
  <tr><td>Severity</td><td>${data.severity ?? 'N/A'}</td></tr>
  <tr><td>Confidence</td><td>${data.confidence ?? 'N/A'}</td></tr>
  ${data.soldPct !== undefined ? `<tr><td>% of Holdings Sold</td><td>${data.soldPct.toFixed(1)}%</td></tr>` : ''}
  ${data.recidivismScore !== undefined ? `<tr><td>Recidivism Score (30d)</td><td>${data.recidivismScore} — ${data.recidivismLabel}</td></tr>` : ''}
  ${data.notes ? `<tr><td>Observed</td><td>${data.notes}</td></tr>` : ''}
</table>

<h2>5 — Evidence Hashes</h2>
<table>
  ${data.manifestSha256 ? `<tr><td>Manifest SHA-256</td><td class="mono">${data.manifestSha256}</td></tr>` : ''}
  ${data.screenshotSha256 ? `<tr><td>Screenshot SHA-256</td><td class="mono">${data.screenshotSha256}</td></tr>` : ''}
  ${data.htmlSha256 ? `<tr><td>HTML SHA-256</td><td class="mono">${data.htmlSha256}</td></tr>` : ''}
  ${data.txHash ? `<tr><td>Etherscan</td><td class="mono">https://etherscan.io/tx/${data.txHash}</td></tr>` : ''}
</table>

<div class="disclaimer">
  <strong>Important:</strong> This report documents observable on-chain facts and publicly archived social media content.
  It does not constitute legal advice, financial advice, or an accusation of wrongdoing.
  All timestamps are UTC. Hash values verify content integrity at time of capture.
  Facts only — "Wallet sold X% of holdings N minutes after post" is an observation, not a legal conclusion.
</div>

<div class="footer">INTERLIGENS Intelligence Platform — Confidential — For investigative purposes only</div>
</body>
</html>`;
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

export async function generateCaseFile(signalId: string): Promise<{
  caseFileId: string;
  storageKey: string;
  pdfSha256: string;
  status: string;
}> {
  // Récupérer le signal avec toutes les données
  const signal = await prisma.signal.findUnique({
    where: { id: signalId },
    include: {
      influencer: true,
      socialPost: true,
      onchainEvent: true,
    },
  });

  if (!signal) throw new Error(`Signal ${signalId} not found`);

  // Récupérer le wallet
  const wallet = signal.walletAddress
    ? await prisma.wallet.findFirst({
        where: { address: signal.walletAddress, chain: "ethereum" },
      })
    : null;

  // Récupérer le score récidive
  const scoreRow = await prisma.$queryRaw<any[]>`
    SELECT score FROM influencer_scores WHERE "influencerId" = ${signal.influencerId} LIMIT 1
  `;

  const { getScoreLabel } = await import("../signals/recidivismScore");
  const recidivismScore = scoreRow[0]?.score ?? 0;

  // Construire le HTML
  const html = buildHtml({
    handle: signal.influencer.handle,
    walletAddress: signal.walletAddress ?? "unknown",
    ensName: wallet?.ensName ?? undefined,
    verifiedMethod: wallet?.verifiedMethod ?? "unknown",
    postUrl: signal.t0PostUrl ?? signal.socialPost?.postUrl ?? "unknown",
    postedAtUtc: signal.t0PostedAtUtc?.toISOString(),
    capturedAtUtc: signal.t0CapturedAtUtc?.toISOString() ?? signal.socialPost?.capturedAtUtc?.toISOString() ?? "unknown",
    textExcerpt: signal.socialPost?.textExcerpt ?? undefined,
    manifestSha256: signal.t0CapturedManifestSha256 ?? signal.socialPost?.manifestSha256 ?? undefined,
    screenshotSha256: signal.socialPost?.screenshotSha256 ?? undefined,
    htmlSha256: signal.socialPost?.htmlSha256 ?? undefined,
    txHash: signal.t1TxHash ?? undefined,
    blockNumber: signal.t1BlockNumber ?? undefined,
    blockTimeUtc: signal.t1BlockTimeUtc?.toISOString(),
    tokenAddress: signal.tokenAddress ?? undefined,
    tokenSymbol: undefined,
    amountRaw: signal.amountRaw ?? undefined,
    windowBucket: signal.windowBucket ?? undefined,
    windowMinutes: signal.windowMinutes ?? undefined,
    severity: signal.severity ?? undefined,
    confidence: signal.confidence?.toString() ?? undefined,
    soldPct: signal.soldPctOfHolding ?? undefined,
    recidivismScore,
    recidivismLabel: getScoreLabel(recidivismScore),
    notes: signal.notes ?? undefined,
    generatedAt: new Date().toISOString(),
  });

  const htmlBuffer = Buffer.from(html, "utf-8");
  const pdfSha256 = sha256(htmlBuffer);

  const storageKey = `evidence/casefiles/${signal.influencer.handle.replace(/^@/, "")}/${signalId}/casefile.html`;

  await evidenceStorage.put(storageKey, htmlBuffer, "text/html");

  // Upsert casefile en DB
  const existing = await prisma.$queryRaw<any[]>`
    SELECT id FROM casefiles WHERE "signalId" = ${signalId} LIMIT 1
  `;

  const caseFileId = existing[0]?.id ?? randomUUID();

  await prisma.$executeRaw`
    INSERT INTO casefiles (id, "signalId", "storageKey", "pdfSha256", status, "generatedAt", "createdAt")
    VALUES (${caseFileId}, ${signalId}, ${storageKey}, ${pdfSha256}, 'completed', NOW(), NOW())
    ON CONFLICT ("signalId") DO UPDATE SET
      "storageKey" = ${storageKey},
      "pdfSha256" = ${pdfSha256},
      status = 'completed',
      "generatedAt" = NOW()
  `;

  return { caseFileId, storageKey, pdfSha256, status: "completed" };
}
