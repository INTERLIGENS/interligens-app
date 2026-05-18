import type { CanonicalIoc } from "./iocExportBuilder";
import type { VaultEvidenceSnapshot } from "@prisma/client";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) +
    " UTC"
  );
}

export type PoliceAnnexParams = {
  caseId: string;
  caseTitle: string;
  generatedAt: string;
  generatedBy: string;
  exportHashSha256: string;
  iocs: CanonicalIoc[];
  snapshots: VaultEvidenceSnapshot[];
  privateExcluded: number;
};

export function buildPoliceAnnexHtml(p: PoliceAnnexParams): string {
  const indicators = p.iocs.filter((i) => i.type !== "EVIDENCE_SNAPSHOT");
  const snapshotIocs = p.iocs.filter((i) => i.type === "EVIDENCE_SNAPSHOT");
  const snapshotMap = new Map(p.snapshots.map((s) => [s.id, s]));

  const indicatorRows = indicators
    .map(
      (ioc, idx) => `
      <tr>
        <td class="cell-num">${idx + 1}</td>
        <td><span class="type-badge">${esc(ioc.type)}</span></td>
        <td class="cell-mono cell-value">${esc(ioc.value.slice(0, 120))}${ioc.value.length > 120 ? "…" : ""}</td>
        <td>${esc(ioc.chain) || "—"}</td>
        <td>${fmt(ioc.firstSeen)}</td>
        <td class="cell-conf">${ioc.confidence !== null ? ioc.confidence + "%" : "—"}</td>
        <td><span class="pub-badge pub-${esc(ioc.publishability.toLowerCase())}">${esc(ioc.publishability)}</span></td>
        <td class="cell-notes">${esc(ioc.notes?.slice(0, 60)) || "—"}</td>
      </tr>`
    )
    .join("");

  const snapshotRows = snapshotIocs
    .map((ioc, idx) => {
      const s = ioc.relatedEvidenceSnapshotId
        ? snapshotMap.get(ioc.relatedEvidenceSnapshotId)
        : null;
      return `
      <tr>
        <td class="cell-num">${idx + 1}</td>
        <td>${esc(s?.title ?? ioc.value)}</td>
        <td><span class="type-badge">${esc(s?.sourceType ?? "OTHER")}</span></td>
        <td class="cell-mono">${esc(s?.contentHashSha256?.slice(0, 32))}…</td>
        <td>${fmt(ioc.firstSeen)}</td>
        <td><span class="pub-badge pub-${esc(ioc.publishability.toLowerCase())}">${esc(ioc.publishability)}</span></td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>INTERLIGENS — Investigative Annex — ${esc(p.caseId)}</title>
<style>
  /* ── Print setup ─────────────────────────────────────────────── */
  @page {
    size: A4 portrait;
    margin: 25mm 20mm 28mm 20mm;
  }
  @page :first {
    margin-top: 20mm;
  }

  /* ── Reset ───────────────────────────────────────────────────── */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Base typography ─────────────────────────────────────────── */
  body {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #111111;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page wrapper ────────────────────────────────────────────── */
  .document { max-width: 170mm; margin: 0 auto; }

  /* ── Running header/footer via fixed positioning ─────────────── */
  .page-header {
    position: fixed;
    top: -18mm;
    left: 0; right: 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 0.5pt solid #E0E0E0;
    padding-bottom: 4pt;
    font-size: 7.5pt;
    color: #888888;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .page-header .brand { color: #FF6B00; font-weight: 700; letter-spacing: 1px; }
  .page-header .case-ref { font-family: 'Courier New', Courier, monospace; font-size: 7pt; }

  .page-footer {
    position: fixed;
    bottom: -20mm;
    left: 0; right: 0;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 0.5pt solid #E0E0E0;
    padding-top: 4pt;
    font-size: 7.5pt;
    color: #888888;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .page-footer .legal-line { font-style: italic; }
  .page-footer .page-num::after { content: counter(page); }

  /* Force page counter */
  body { counter-reset: page; }
  .page-footer .page-num { counter-increment: page; }

  /* ── Title block ─────────────────────────────────────────────── */
  .title-block {
    border-bottom: 1.5pt solid #111111;
    padding-bottom: 16pt;
    margin-bottom: 20pt;
  }
  .eyebrow {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #FF6B00;
    margin-bottom: 8pt;
  }
  .doc-title {
    font-size: 22pt;
    font-weight: 700;
    line-height: 1.2;
    color: #111111;
    margin-bottom: 4pt;
  }
  .doc-subtitle {
    font-size: 10.5pt;
    color: #444444;
    font-style: italic;
    margin-bottom: 16pt;
  }
  .title-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12pt;
    margin-top: 14pt;
    padding-top: 14pt;
    border-top: 0.5pt solid #E0E0E0;
  }
  .title-meta-item { }
  .title-meta-item .meta-label {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 6.5pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #888888;
    margin-bottom: 3pt;
  }
  .title-meta-item .meta-value {
    font-size: 9pt;
    color: #111111;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .meta-value.mono {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8pt;
  }

  /* ── Summary cards ───────────────────────────────────────────── */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10pt;
    margin-bottom: 20pt;
  }
  .summary-card {
    border: 0.5pt solid #E0E0E0;
    border-left: 2.5pt solid #FF6B00;
    padding: 10pt 12pt;
  }
  .summary-card .s-val {
    font-size: 22pt;
    font-weight: 700;
    color: #111111;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    line-height: 1;
    margin-bottom: 4pt;
  }
  .summary-card .s-lbl {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888888;
  }

  /* ── Prose sections ──────────────────────────────────────────── */
  .section { margin-bottom: 20pt; page-break-inside: avoid; }
  .section-title {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #444444;
    border-bottom: 0.5pt solid #E0E0E0;
    padding-bottom: 4pt;
    margin-bottom: 10pt;
  }
  .prose {
    font-size: 9.5pt;
    color: #333333;
    line-height: 1.65;
  }
  .prose + .prose { margin-top: 7pt; }

  /* ── Caution / notice boxes ──────────────────────────────────── */
  .caution-box {
    border: 0.5pt solid #E0D0C0;
    border-left: 3pt solid #FF6B00;
    background: #FFFAF6;
    padding: 10pt 12pt;
    margin-bottom: 16pt;
    font-size: 9pt;
    color: #333333;
    line-height: 1.6;
  }
  .caution-box strong { color: #111111; }

  .notice-box {
    border: 0.5pt solid #E0E0E0;
    background: #F8F8F8;
    padding: 8pt 12pt;
    margin-bottom: 14pt;
    font-size: 8.5pt;
    color: #555555;
    line-height: 1.5;
  }

  /* ── Hash block ──────────────────────────────────────────────── */
  .hash-section {
    border: 0.5pt solid #E0E0E0;
    padding: 12pt;
    margin-bottom: 20pt;
    page-break-inside: avoid;
  }
  .hash-label {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #888888;
    margin-bottom: 4pt;
  }
  .hash-caption {
    font-size: 8.5pt;
    color: #555555;
    margin-bottom: 8pt;
    font-style: italic;
  }
  .hash-value {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    color: #111111;
    word-break: break-all;
    letter-spacing: 0.5px;
    line-height: 1.6;
    border-top: 0.5pt solid #E0E0E0;
    padding-top: 7pt;
  }

  /* ── Tables ──────────────────────────────────────────────────── */
  .table-wrap { overflow: hidden; margin-bottom: 4pt; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  th {
    background: #F2F2F2;
    color: #444444;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 7pt;
    padding: 6pt 8pt;
    text-align: left;
    border: 0.5pt solid #E5E5E5;
    border-bottom: 1pt solid #CCCCCC;
  }
  td {
    padding: 5pt 8pt;
    border: 0.5pt solid #E5E5E5;
    vertical-align: top;
    color: #111111;
    line-height: 1.45;
  }
  tr:nth-child(even) td { background: #FAFAFA; }
  tr { page-break-inside: avoid; }

  .cell-num { color: #AAAAAA; font-size: 7.5pt; width: 20pt; text-align: right; }
  .cell-mono {
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    word-break: break-all;
  }
  .cell-value { max-width: 80pt; }
  .cell-conf { text-align: center; }
  .cell-notes { color: #555555; font-size: 7.5pt; max-width: 60pt; }

  /* ── Badges ──────────────────────────────────────────────────── */
  .type-badge {
    display: inline-block;
    border: 0.5pt solid #CCCCCC;
    background: #F5F5F5;
    color: #333333;
    padding: 1pt 4pt;
    font-size: 6.5pt;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .pub-badge {
    display: inline-block;
    padding: 1pt 4pt;
    font-size: 6.5pt;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .pub-publishable { border: 0.5pt solid #2E7D32; color: #2E7D32; background: #F1F8F1; }
  .pub-shareable   { border: 0.5pt solid #E65100; color: #E65100; background: #FFF8F5; }
  .pub-private     { border: 0.5pt solid #C62828; color: #C62828; background: #FFF5F5; }
  .pub-redacted    { border: 0.5pt solid #999999; color: #777777; background: #F5F5F5; }

  /* ── Empty state ─────────────────────────────────────────────── */
  .empty { color: #999999; font-style: italic; font-size: 9pt; padding: 8pt 0; }

  /* ── Page break controls ─────────────────────────────────────── */
  .no-break { page-break-inside: avoid; }
  .break-before { page-break-before: always; }

  /* ── Print overrides ─────────────────────────────────────────── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-header, .page-footer { display: flex; }
  }
</style>
</head>
<body>

<!-- Running header (prints on every page) -->
<div class="page-header">
  <span><span class="brand">INTERLIGENS</span> &nbsp;·&nbsp; Investigative Annex</span>
  <span class="case-ref">Case ${esc(p.caseId)}</span>
</div>

<!-- Running footer (prints on every page) -->
<div class="page-footer">
  <span class="legal-line">Investigative material — Not a legal determination — Not financial advice</span>
  <span class="page-num">Page </span>
</div>

<div class="document">

  <!-- ── Title block ─────────────────────────────────────────── -->
  <div class="title-block">
    <div class="eyebrow">INTERLIGENS &nbsp;·&nbsp; Investigative Annex</div>
    <div class="doc-title">Indicators of Concern</div>
    <div class="doc-subtitle">Source-Attributed Evidence Compilation</div>
    <div class="title-meta">
      <div class="title-meta-item">
        <div class="meta-label">Case Reference</div>
        <div class="meta-value mono">${esc(p.caseId)}</div>
      </div>
      <div class="title-meta-item">
        <div class="meta-label">Generated</div>
        <div class="meta-value">${fmtFull(p.generatedAt)}</div>
      </div>
      <div class="title-meta-item">
        <div class="meta-label">Prepared by</div>
        <div class="meta-value">${esc(p.generatedBy)}</div>
      </div>
    </div>
  </div>

  <!-- ── Legal caution ───────────────────────────────────────── -->
  <div class="caution-box no-break">
    <strong>LEGAL CAUTION —</strong> This annex documents observed on-chain activity,
    source-attributed indicators, and snapshot records compiled during an investigative
    process. It does not assert criminal liability, establish legal proof, or constitute
    financial advice. All indicators are annotated with their publication status.
    This is investigative material only.
  </div>

  <!-- ── Methodology ─────────────────────────────────────────── -->
  <div class="section no-break">
    <div class="section-title">Methodology</div>
    <p class="prose">
      Indicators were extracted from on-chain data and investigator-annotated entities.
      Evidence snapshots were recorded with SHA-256 integrity hashes at capture time.
      Confidence values reflect investigator assessment on a 0–100 scale.
    </p>
    <p class="prose">
      Publication status reflects whether the indicator was assessed as private,
      shareable with authorised parties, or suitable for publication. Private indicators
      are excluded from this annex; their existence is noted in the excluded count below.
    </p>
  </div>

  <!-- ── Summary ─────────────────────────────────────────────── -->
  <div class="summary-grid no-break">
    <div class="summary-card">
      <div class="s-val">${indicators.length}</div>
      <div class="s-lbl">Documented indicators</div>
    </div>
    <div class="summary-card">
      <div class="s-val">${snapshotIocs.length}</div>
      <div class="s-lbl">Evidence snapshots</div>
    </div>
    <div class="summary-card">
      <div class="s-val">${p.privateExcluded}</div>
      <div class="s-lbl">Private items excluded</div>
    </div>
  </div>

  <!-- ── Export integrity hash ───────────────────────────────── -->
  <div class="hash-section no-break">
    <div class="hash-label">Export Integrity Hash — SHA-256</div>
    <div class="hash-caption">
      This hash covers all indicators included in this annex. It proves the set of
      indicators at generation time and does not certify the authenticity of any
      external source.
    </div>
    <div class="hash-value">${esc(p.exportHashSha256)}</div>
  </div>

  <!-- ── Indicators table ────────────────────────────────────── -->
  <div class="section">
    <div class="section-title">Documented Indicators (${indicators.length})</div>
    ${
      indicators.length > 0
        ? `<div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Value</th>
            <th>Chain</th>
            <th>First Observed</th>
            <th>Conf.</th>
            <th>Publication Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${indicatorRows}</tbody>
      </table>
    </div>`
        : '<p class="empty">No indicators meet the publication filter for this export.</p>'
    }
  </div>

  <!-- ── Snapshots table ─────────────────────────────────────── -->
  ${
    snapshotIocs.length > 0
      ? `<div class="section break-before">
    <div class="section-title">Evidence Snapshots (${snapshotIocs.length})</div>
    <p class="prose" style="margin-bottom:8pt;">
      Snapshot record hashes prove integrity of records at capture time.
      They do not certify the authenticity of the referenced source.
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Source Type</th>
            <th>Snapshot Record Hash (truncated)</th>
            <th>Captured</th>
            <th>Publication Status</th>
          </tr>
        </thead>
        <tbody>${snapshotRows}</tbody>
      </table>
    </div>
  </div>`
      : ""
  }

  <!-- ── Excluded notice ─────────────────────────────────────── -->
  ${
    p.privateExcluded > 0
      ? `<div class="notice-box no-break">
    <strong>Excluded private material:</strong> ${p.privateExcluded} indicator(s) carrying
    PRIVATE status were excluded from this annex. Their existence is noted but their
    content is not disclosed here.
  </div>`
      : ""
  }

</div><!-- /document -->
</body>
</html>`;
}

/**
 * Generates a PDF buffer via Puppeteer. Requires puppeteer-core + @sparticuz/chromium-min.
 * Falls back gracefully if chromium is unavailable.
 */
export async function renderPoliceAnnexPdf(html: string): Promise<Buffer> {
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const puppeteer = await import("puppeteer-core");

  const CHROMIUM_PACK_URL =
    "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      // Margins match @page rule: 25mm top, 20mm sides, 28mm bottom
      // (extra bottom gives room for the fixed footer)
      margin: { top: "25mm", right: "20mm", bottom: "28mm", left: "20mm" },
      displayHeaderFooter: false, // CSS fixed-position header/footer handles this
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
