/**
 * DOSSIER BOTIFY POLICE — compile tout en un seul HTML/PDF imprimable.
 *
 * Pulls:
 *   - EvidenceSnapshot (BOTIFY / BOTIFY-MAIN / GHOST) — images from R2
 *   - KolProfile + KolWallet for BOTIFY-tagged handles
 *   - KolProceedsEvent where tokenAddress = BOTIFY_MINT (all rows, desc)
 *   - BOTIFY_KOL_SCAN_REPORT.json (already on disk from previous session)
 *
 * Writes:
 *   CLE_USB_BOTIFY/
 *     DOSSIER_BOTIFY_POLICE_2026.html  (all images inline base64)
 *     DOSSIER_BOTIFY_POLICE_2026.pdf   (via playwright)
 *     BOTIFY_KOL_SCAN_REPORT.json      (copy)
 *
 * Usage:  npx tsx src/scripts/seed/buildBotifyDossier.ts
 *
 * No DB writes. Read-only. Idempotent.
 */

import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const OUTPUT_DIR = path.resolve(process.cwd(), "CLE_USB_BOTIFY");
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB hard cap per image

// R2 evidence bucket access — the public pub-interligens.r2.dev URLs now
// return 401, so we read objects directly via the S3 API.
let r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (r2Client) return r2Client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing");
  }
  r2Client = new S3Client({
    region: "auto",
    endpoint: "https://" + accountId + ".r2.cloudflarestorage.com",
    credentials: { accessKeyId, secretAccessKey },
  });
  return r2Client;
}
function getR2Bucket(): string {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME missing");
  return b;
}
function extractR2Key(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}
function mimeFromKey(key: string): string {
  const ext = key.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  return "application/octet-stream";
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function shortHash(h: string | null | undefined, n = 12): string {
  if (!h) return "—";
  if (h.length <= n + 4) return h;
  return h.slice(0, n) + "…" + h.slice(-4);
}

interface DownloadedImage {
  dataUri: string;
  sizeBytes: number;
}

async function downloadAsBase64(url: string): Promise<DownloadedImage | null> {
  // First try S3 direct (bypass 401 on public URLs). Fallback to fetch only
  // for URLs that don't look like R2 (unlikely in this dossier).
  const key = extractR2Key(url);
  if (key) {
    try {
      const out = await getR2Client().send(
        new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
      );
      if (!out.Body) {
        console.warn("[img] " + url + " -> empty body");
        return null;
      }
      const chunks: Buffer[] = [];
      // Body is an async iterable / Node Readable
      for await (const c of out.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(c));
      }
      const buf = Buffer.concat(chunks);
      if (buf.byteLength > MAX_IMAGE_BYTES) {
        console.warn(
          "[img] " + url + " too large (" + buf.byteLength + " bytes) — skipped",
        );
        return null;
      }
      const contentType = out.ContentType ?? mimeFromKey(key);
      const base64 = buf.toString("base64");
      return {
        dataUri: "data:" + contentType + ";base64," + base64,
        sizeBytes: buf.byteLength,
      };
    } catch (err) {
      console.warn(
        "[img] s3 " + key + " error: " + String(err).slice(0, 160),
      );
      return null;
    }
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[img] " + url + " -> HTTP " + res.status);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      console.warn(
        "[img] " + url + " too large (" + buf.byteLength + " bytes) — skipped"
      );
      return null;
    }
    const contentType =
      res.headers.get("content-type") ?? "application/octet-stream";
    const base64 = buf.toString("base64");
    return {
      dataUri: "data:" + contentType + ";base64," + base64,
      sizeBytes: buf.byteLength,
    };
  } catch (err) {
    console.warn("[img] " + url + " error: " + String(err).slice(0, 120));
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("[dossier] querying DB…");

  // ── EvidenceSnapshot ─────────────────────────────────────────────────
  const snapshots = await prisma.evidenceSnapshot.findMany({
    where: { relationKey: { in: ["BOTIFY", "BOTIFY-MAIN", "GHOST"] } },
    orderBy: [{ relationKey: "asc" }, { displayOrder: "asc" }],
  });
  console.log("[dossier] evidence snapshots:", snapshots.length);

  // ── KolProfile — BOTIFY-tagged handles ───────────────────────────────
  const botifyProfiles = await prisma.kolProfile.findMany({
    where: {
      OR: [
        { internalNote: { contains: "BOTIFY" } },
        { internalNote: { contains: "Arkham-confirmed BOTIFY" } },
      ],
    },
    include: { kolWallets: true },
    orderBy: { handle: "asc" },
  });
  console.log("[dossier] botify-tagged profiles:", botifyProfiles.length);

  // ── KolProceedsEvent BOTIFY — raw, ordered by amountUsd desc ─────────
  const proceeds = await prisma.$queryRaw<
    Array<{
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
    }>
  >`
    SELECT
      id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
      "tokenSymbol", "tokenAddress",
      "amountTokens"::float AS "amountTokens",
      "amountUsd"::float AS "amountUsd",
      "priceUsdAtTime"::float AS "priceUsdAtTime",
      "pricingSource", "eventType"
    FROM "KolProceedsEvent"
    WHERE "tokenAddress" = ${BOTIFY_MINT}
    ORDER BY "amountUsd" DESC NULLS LAST, "eventDate" ASC
  `;
  console.log("[dossier] botify proceeds events:", proceeds.length);

  // ── Aggregate totals ─────────────────────────────────────────────────
  const totalUsd = proceeds.reduce((s, e) => s + (e.amountUsd ?? 0), 0);
  const byHandle = new Map<string, { events: number; usd: number }>();
  for (const e of proceeds) {
    const cur = byHandle.get(e.kolHandle) ?? { events: 0, usd: 0 };
    cur.events += 1;
    cur.usd += e.amountUsd ?? 0;
    byHandle.set(e.kolHandle, cur);
  }

  // ── Download evidence images ─────────────────────────────────────────
  console.log("[dossier] downloading " + snapshots.filter((s) => s.imageUrl).length + " images…");
  const imageByUrl = new Map<string, DownloadedImage>();
  let totalImageBytes = 0;
  for (const snap of snapshots) {
    if (!snap.imageUrl) continue;
    const img = await downloadAsBase64(snap.imageUrl);
    if (img) {
      imageByUrl.set(snap.imageUrl, img);
      totalImageBytes += img.sizeBytes;
    }
  }
  console.log(
    "[dossier] images downloaded: " +
      imageByUrl.size +
      " (" +
      (totalImageBytes / 1024 / 1024).toFixed(1) +
      " MB total)"
  );

  // ── Load BOTIFY_KOL_SCAN_REPORT.json if present ──────────────────────
  const reportPath = path.resolve(process.cwd(), "BOTIFY_KOL_SCAN_REPORT.json");
  let scanReport: unknown = null;
  if (fs.existsSync(reportPath)) {
    scanReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    // Copy into USB folder
    fs.copyFileSync(reportPath, path.join(OUTPUT_DIR, "BOTIFY_KOL_SCAN_REPORT.json"));
  }

  // ── Build HTML ───────────────────────────────────────────────────────
  const generatedAt = new Date();
  const today = generatedAt.toISOString().slice(0, 10);

  const css = `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: #111;
      background: #fff;
      line-height: 1.55;
    }
    body { padding: 0 40px 60px; max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 26pt; margin: 0 0 4pt; font-weight: 900; letter-spacing: -0.01em; }
    h2 { font-size: 15pt; margin: 24pt 0 10pt; color: #000; border-bottom: 2px solid #000; padding-bottom: 4pt; }
    h3 { font-size: 12pt; margin: 16pt 0 6pt; color: #000; }
    p  { font-size: 10.5pt; margin: 6pt 0; }
    .small { font-size: 9pt; color: #555; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9.5pt; word-break: break-all; }
    .accent { color: #FF6B00; font-weight: 700; }
    .classification {
      display: inline-block;
      padding: 3pt 10pt;
      background: #000;
      color: #fff;
      font-size: 9pt;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .cover {
      margin-top: 40pt;
      padding: 40pt 0 30pt;
      border-top: 6pt solid #FF6B00;
      border-bottom: 2pt solid #000;
    }
    .cover .eyebrow {
      font-size: 10pt;
      color: #FF6B00;
      letter-spacing: 0.2em;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 8pt;
    }
    .cover .sub {
      font-size: 11pt;
      color: #444;
      margin-top: 12pt;
    }
    .cover .meta {
      margin-top: 24pt;
      display: flex;
      gap: 32pt;
      flex-wrap: wrap;
      font-size: 9pt;
      color: #555;
    }
    .cover .meta .k { text-transform: uppercase; letter-spacing: 0.1em; color: #000; font-weight: 700; font-size: 8pt; }
    .toc { border: 1px solid #ddd; padding: 14pt 20pt; margin: 20pt 0; }
    .toc h3 { margin-top: 0; }
    .toc ol { margin: 6pt 0 0 16pt; padding: 0; font-size: 10pt; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10pt;
      margin: 12pt 0;
    }
    .summary-card {
      border: 1px solid #ccc;
      padding: 10pt 12pt;
    }
    .summary-card .n {
      font-size: 18pt;
      font-weight: 900;
      color: #000;
    }
    .summary-card .l {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin-top: 2pt;
    }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 10pt 0; }
    th, td { border: 1px solid #bbb; padding: 5pt 7pt; text-align: left; vertical-align: top; }
    th { background: #f2f2f2; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; }
    td.num { text-align: right; font-family: ui-monospace, Menlo, Consolas, monospace; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .evidence-item {
      margin: 18pt 0;
      padding: 12pt;
      border: 1px solid #ddd;
      page-break-inside: avoid;
    }
    .evidence-label {
      font-size: 9pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #FF6B00;
      margin-bottom: 4pt;
    }
    .evidence-title { font-size: 12pt; font-weight: 700; margin-bottom: 4pt; }
    .evidence-caption { font-size: 10pt; color: #333; margin-bottom: 8pt; }
    .evidence-img {
      display: block;
      max-width: 100%;
      max-height: 520pt;
      border: 1px solid #888;
      margin: 8pt 0;
      object-fit: contain;
    }
    .evidence-meta { font-size: 8.5pt; color: #666; margin-top: 6pt; }
    .missing-image {
      padding: 16pt;
      background: #fff3e0;
      border: 1px dashed #FF6B00;
      font-size: 9pt;
      color: #444;
    }
    .footer {
      margin-top: 40pt;
      padding-top: 10pt;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #666;
    }
    @media print {
      @page { margin: 15mm 12mm 18mm 12mm; }
      body { padding: 0 10pt 40pt; }
      h2 { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
      .evidence-item { page-break-inside: avoid; }
      .page-break { page-break-before: always; }
    }
  `;

  // Summary cards
  const summaryHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="n">${escapeHtml(fmtUsd(totalUsd))}</div>
        <div class="l">Total USD documenté</div>
      </div>
      <div class="summary-card">
        <div class="n">${proceeds.length}</div>
        <div class="l">Evenements cashout</div>
      </div>
      <div class="summary-card">
        <div class="n">${byHandle.size}</div>
        <div class="l">KOLs avec activite</div>
      </div>
      <div class="summary-card">
        <div class="n">${snapshots.length}</div>
        <div class="l">Preuves archivees</div>
      </div>
    </div>
  `;

  // KOL summary table (aggregated per handle)
  const kolRows = Array.from(byHandle.entries())
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(
      ([handle, v]) => `
      <tr>
        <td>${escapeHtml(handle)}</td>
        <td class="num">${v.events}</td>
        <td class="num">${escapeHtml(fmtUsd(v.usd))}</td>
      </tr>
    `
    )
    .join("");

  // Full proceeds table (top 200 by USD)
  const TOP_PROCEEDS = 200;
  const proceedsRows = proceeds
    .slice(0, TOP_PROCEEDS)
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.kolHandle)}</td>
        <td>${escapeHtml(e.tokenSymbol ?? "")}</td>
        <td class="num">${escapeHtml(fmtUsd(e.amountUsd))}</td>
        <td class="mono">${escapeHtml(shortHash(e.txHash))}</td>
        <td>${escapeHtml(fmtDate(e.eventDate))}</td>
        <td>${escapeHtml(e.eventType ?? "")}</td>
        <td>${escapeHtml(e.pricingSource ?? "")}</td>
      </tr>
    `
    )
    .join("");

  // Evidence snapshots by relationKey
  function renderSnapshotSection(key: string, title: string): string {
    const rows = snapshots.filter((s) => s.relationKey === key);
    if (rows.length === 0) return "";
    const items = rows
      .map((s, idx) => {
        const img = s.imageUrl ? imageByUrl.get(s.imageUrl) : null;
        const imgBlock = img
          ? `<img class="evidence-img" src="${img.dataUri}" alt="${escapeHtml(s.title)}" />`
          : s.imageUrl
            ? `<div class="missing-image">Image non récupérée depuis R2 : ${escapeHtml(s.imageUrl)}</div>`
            : `<div class="missing-image">Aucune image liée à ce snapshot.</div>`;
        return `
          <div class="evidence-item">
            <div class="evidence-label">E-${key}-${String(idx + 1).padStart(2, "0")} · ${escapeHtml(s.snapshotType)}</div>
            <div class="evidence-title">${escapeHtml(s.title)}</div>
            <div class="evidence-caption">${escapeHtml(s.caption)}</div>
            ${imgBlock}
            <div class="evidence-meta">
              ${s.sourceLabel ? "Source : <b>" + escapeHtml(s.sourceLabel) + "</b>" : ""}
              ${s.sourceUrl ? ' · <a href="' + escapeHtml(s.sourceUrl) + '">' + escapeHtml(s.sourceUrl) + "</a>" : ""}
              ${s.observedAt ? " · Observé le : " + escapeHtml(fmtDate(s.observedAt)) : ""}
              · Review : ${escapeHtml(s.reviewStatus)}
            </div>
          </div>
        `;
      })
      .join("");
    return `
      <h3>${escapeHtml(title)} (${rows.length} entrées)</h3>
      ${items}
    `;
  }

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>DOSSIER BOTIFY — INTERLIGENS — ${today}</title>
<style>${css}</style>
</head>
<body>

<div class="cover">
  <div class="eyebrow">INTERLIGENS · DOSSIER JUDICIAIRE</div>
  <h1>Dossier BOTIFY</h1>
  <div class="sub">
    Enquête on-chain + réseau KOL · Token $BOTIFY
    (<span class="mono">${BOTIFY_MINT}</span>)
  </div>
  <div class="sub">
    <span class="classification">CONFIDENTIEL — Usage judiciaire uniquement</span>
  </div>
  <div class="meta">
    <div>
      <div class="k">Généré le</div>
      <div>${today}</div>
    </div>
    <div>
      <div class="k">Total documenté</div>
      <div>${escapeHtml(fmtUsd(totalUsd))}</div>
    </div>
    <div>
      <div class="k">Événements DB</div>
      <div>${proceeds.length}</div>
    </div>
    <div>
      <div class="k">KOLs</div>
      <div>${byHandle.size}</div>
    </div>
    <div>
      <div class="k">Preuves</div>
      <div>${snapshots.length} (${imageByUrl.size} avec image)</div>
    </div>
  </div>
</div>

<div class="toc">
  <h3>Table des matières</h3>
  <ol>
    <li>Résumé exécutif</li>
    <li>Synthèse par KOL</li>
    <li>Tableau détaillé des cashouts on-chain (top ${TOP_PROCEEDS})</li>
    <li>Preuves photographiques — BOTIFY</li>
    <li>Preuves photographiques — BOTIFY-MAIN (document interne)</li>
    <li>Preuves photographiques — GHOST</li>
    <li>Annexe — Rapport scan automatisé</li>
  </ol>
</div>

<h2>1. Résumé exécutif</h2>
<p>
  Ce dossier compile l'ensemble des éléments on-chain, documentaires et
  réseau-sociaux liés au token <b>$BOTIFY</b> (mint
  <span class="mono">${BOTIFY_MINT}</span>), à ses allocations KOL
  divulguées dans un document interne, et aux opérations de cashout
  documentées par la plateforme INTERLIGENS.
</p>
${summaryHtml}
<p class="small">
  Les montants USD sont calculés à partir du SOL reçu lors de chaque
  vente on-chain, multiplié par un prix SOL de référence de 200 USD
  (window Jan-Fév 2025). Les entrées marquées <i>arkham_confirmed</i>
  proviennent de vérifications manuelles via Arkham Intelligence et
  sont les seules à porter un label CEX certifié.
</p>

<h2>2. Synthèse par KOL</h2>
<table>
  <thead>
    <tr><th>Handle</th><th>Events</th><th>Total USD</th></tr>
  </thead>
  <tbody>${kolRows || '<tr><td colspan="3">Aucun événement en DB</td></tr>'}</tbody>
</table>

<h2>3. Cashouts on-chain — tableau détaillé (top ${TOP_PROCEEDS})</h2>
<p class="small">
  Trié par montant USD décroissant. Les événements Arkham confirmés
  portent un <span class="mono">txHash</span> synthétique de la forme
  <span class="mono">arkham-handle-summary</span>.
</p>
<table>
  <thead>
    <tr>
      <th>Handle</th>
      <th>Token</th>
      <th>USD</th>
      <th>TX hash</th>
      <th>Date</th>
      <th>Type</th>
      <th>Source prix</th>
    </tr>
  </thead>
  <tbody>${proceedsRows || '<tr><td colspan="7">Aucun événement</td></tr>'}</tbody>
</table>
<p class="small">
  Seuls les ${Math.min(TOP_PROCEEDS, proceeds.length)} premiers événements
  sont affichés ici. La table complète contient ${proceeds.length} lignes
  et est incluse dans <span class="mono">BOTIFY_KOL_SCAN_REPORT.json</span>.
</p>

<div class="page-break"></div>
<h2>4. Preuves photographiques — BOTIFY</h2>
${renderSnapshotSection("BOTIFY", "BOTIFY — Tweets, captures, document interne")}

<div class="page-break"></div>
<h2>5. Preuves photographiques — BOTIFY-MAIN</h2>
${renderSnapshotSection("BOTIFY-MAIN", "BOTIFY-MAIN — Document interne (pages PDF)")}

<div class="page-break"></div>
<h2>6. Preuves photographiques — GHOST</h2>
${renderSnapshotSection("GHOST", "GHOST — Tweets et captures liées à l'écosystème")}

<div class="page-break"></div>
<h2>7. Annexe — Rapport scan automatisé</h2>
<p class="small">
  Rapport produit par <span class="mono">src/scripts/seed/botifyKolScan.ts</span>
  lors du scan Helius + seed Arkham. Le JSON complet est également
  disponible sur la clé USB.
</p>
<pre class="mono" style="background:#f8f8f8; padding:10pt; font-size:8pt; white-space:pre-wrap; word-break:break-all;">
${escapeHtml(scanReport ? JSON.stringify(scanReport, null, 2) : "Rapport non trouvé.")}
</pre>

<div class="footer">
  Généré automatiquement par INTERLIGENS — ${today} ·
  Source : base <span class="mono">ep-square-band</span> ·
  Scripts : botifyKolScan.ts + buildBotifyDossier.ts
</div>

</body>
</html>`;

  const htmlPath = path.join(OUTPUT_DIR, "DOSSIER_BOTIFY_POLICE_2026.html");
  fs.writeFileSync(htmlPath, html, "utf8");
  const htmlSize = fs.statSync(htmlPath).size;
  console.log(
    "[dossier] wrote " +
      htmlPath +
      " (" +
      (htmlSize / 1024 / 1024).toFixed(1) +
      " MB)"
  );

  // ── Generate PDF via Playwright Chromium ─────────────────────────────
  console.log("[dossier] generating PDF via playwright chromium…");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
  const pdfPath = path.join(OUTPUT_DIR, "DOSSIER_BOTIFY_POLICE_2026.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "18mm", left: "12mm", right: "12mm" },
  });
  await browser.close();
  const pdfSize = fs.statSync(pdfPath).size;
  console.log(
    "[dossier] wrote " +
      pdfPath +
      " (" +
      (pdfSize / 1024 / 1024).toFixed(1) +
      " MB)"
  );

  // ── Final report ─────────────────────────────────────────────────────
  console.log("");
  console.log("=== DOSSIER BOTIFY FINAL ===");
  console.log("Output directory: " + OUTPUT_DIR);
  console.log("Files:");
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    const st = fs.statSync(path.join(OUTPUT_DIR, f));
    console.log("  " + f + " (" + (st.size / 1024).toFixed(0) + " KB)");
  }
  console.log("Snapshots: " + snapshots.length + " (" + imageByUrl.size + " images intégrées)");
  console.log("Proceeds events: " + proceeds.length);
  console.log("KOL handles: " + byHandle.size);
  console.log("Total USD documented: " + fmtUsd(totalUsd));
  console.log("HTML size: " + (htmlSize / 1024 / 1024).toFixed(1) + " MB");
  console.log("PDF size:  " + (pdfSize / 1024 / 1024).toFixed(1) + " MB");
  console.log("Image bytes downloaded: " + (totalImageBytes / 1024 / 1024).toFixed(1) + " MB");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[dossier] fatal", err);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
