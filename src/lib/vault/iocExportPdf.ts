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
  return iso.slice(0, 10);
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
        <td style="color:#888;font-size:9px;">${idx + 1}</td>
        <td><span class="badge">${esc(ioc.type)}</span></td>
        <td style="font-family:monospace;font-size:9px;word-break:break-all;">${esc(ioc.value.slice(0, 120))}${ioc.value.length > 120 ? "…" : ""}</td>
        <td>${esc(ioc.chain)}</td>
        <td>${fmt(ioc.firstSeen)}</td>
        <td><span class="pub-badge pub-${ioc.publishability.toLowerCase()}">${esc(ioc.publishability)}</span></td>
        <td style="font-size:9px;color:#888;">${esc(ioc.notes?.slice(0, 60))}</td>
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
        <td style="color:#888;font-size:9px;">${idx + 1}</td>
        <td>${esc(s?.title ?? ioc.value)}</td>
        <td>${esc(s?.sourceType ?? "OTHER")}</td>
        <td style="font-family:monospace;font-size:8px;">${esc(s?.contentHashSha256?.slice(0, 32))}…</td>
        <td>${fmt(ioc.firstSeen)}</td>
        <td><span class="pub-badge pub-${ioc.publishability.toLowerCase()}">${esc(ioc.publishability)}</span></td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>INTERLIGENS — Investigative Annex — ${esc(p.caseId)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #000; color: #fff; font-size: 10px; line-height: 1.4; }
  .page { padding: 0; }

  .header { border-bottom: 3px solid #FF6B00; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #fff; }
  .header-left .subtitle { color: #FF6B00; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
  .header-right { text-align: right; font-size: 9px; color: #888; line-height: 1.8; }
  .header-right strong { color: #FF6B00; }

  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
  .meta-card { background: #111; border: 1px solid #2a2a2a; border-left: 3px solid #FF6B00; padding: 10px; }
  .meta-card .val { font-size: 20px; font-weight: 900; color: #FF6B00; }
  .meta-card .lbl { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #FF6B00; border-bottom: 1px solid #2a2a2a; padding-bottom: 5px; margin-bottom: 10px; }

  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #1a1a1a; color: #FF6B00; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 6px 7px; text-align: left; font-size: 8px; }
  td { padding: 5px 7px; border-bottom: 1px solid #111; vertical-align: top; }
  tr:nth-child(even) td { background: #080808; }

  .badge { display: inline-block; background: #1a1a1a; border: 1px solid #FF6B00; color: #FF6B00; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 700; white-space: nowrap; }
  .pub-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 700; white-space: nowrap; }
  .pub-publishable { background: #003d1a; color: #00C853; border: 1px solid #00C853; }
  .pub-shareable { background: #1a1a00; color: #FFB800; border: 1px solid #FFB800; }
  .pub-private { background: #1a0000; color: #FF3B5C; border: 1px solid #FF3B5C; }
  .pub-redacted { background: #1a1a1a; color: #888; border: 1px solid #555; }

  .methodology { background: #0a0a0a; border: 1px solid #2a2a2a; border-left: 3px solid #FF6B00; padding: 10px; font-size: 9px; color: #888; margin-bottom: 18px; line-height: 1.6; }
  .caution { background: #0a0000; border: 1px solid rgba(255,59,92,0.3); padding: 8px 10px; font-size: 9px; color: rgba(255,59,92,0.9); margin-bottom: 18px; line-height: 1.6; }
  .excluded-notice { background: #0a0a0a; border: 1px solid #2a2a2a; padding: 8px 10px; font-size: 9px; color: #888; margin-bottom: 14px; }
  .hash-block { font-family: monospace; font-size: 8.5px; color: #FF6B00; word-break: break-all; background: #111; border: 1px solid #2a2a2a; padding: 6px 10px; margin-top: 6px; }

  .footer { border-top: 1px solid #2a2a2a; padding-top: 8px; margin-top: 22px; display: flex; justify-content: space-between; color: #444; font-size: 8px; }
  .empty { color: #444; font-style: italic; padding: 10px 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <div style="color:#888;font-size:8px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">
        INTERLIGENS — Investigative Annex
      </div>
      <h1>Indicators of Concern</h1>
      <div class="subtitle">Source-Attributed Evidence Compilation</div>
    </div>
    <div class="header-right">
      <strong>Case ID</strong><br>${esc(p.caseId)}<br><br>
      <strong>Generated</strong><br>${fmt(p.generatedAt)}<br><br>
      <strong>Prepared by</strong><br>${esc(p.generatedBy)}
    </div>
  </div>

  <div class="caution">
    <strong>LEGAL CAUTION —</strong> This annex documents observed on-chain activity, source-attributed indicators, and snapshot records compiled during an investigative process. It does not assert criminal liability, establish legal proof, or constitute financial advice. All indicators are annotated with their publication status. This is investigative material only.
  </div>

  <div class="methodology">
    <strong>Methodology —</strong> Indicators were extracted from on-chain data and investigator-annotated entities. Evidence snapshots were recorded with SHA-256 integrity hashes at capture time. Confidence values reflect investigator assessment on a 0–100 scale. Publication status reflects whether the indicator was assessed as private, shareable, or suitable for publication.
  </div>

  <div class="meta-grid">
    <div class="meta-card">
      <div class="val">${indicators.length}</div>
      <div class="lbl">Documented indicators</div>
    </div>
    <div class="meta-card">
      <div class="val">${snapshotIocs.length}</div>
      <div class="lbl">Evidence snapshots</div>
    </div>
    <div class="meta-card">
      <div class="val">${p.privateExcluded}</div>
      <div class="lbl">Private material excluded</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Export Integrity Hash — SHA-256</div>
    <div style="font-size:9px;color:#888;">This hash covers all indicators included in this annex. It does not certify external source authenticity.</div>
    <div class="hash-block">${esc(p.exportHashSha256)}</div>
  </div>

  ${
    indicators.length > 0
      ? `<div class="section">
    <div class="section-title">Documented Indicators (${indicators.length})</div>
    <table>
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>Value</th>
        <th>Chain</th>
        <th>First Observed</th>
        <th>Publication Status</th>
        <th>Notes</th>
      </tr>
      ${indicatorRows}
    </table>
  </div>`
      : `<div class="section">
    <div class="section-title">Documented Indicators</div>
    <div class="empty">No indicators meet the publication filter for this export.</div>
  </div>`
  }

  ${
    snapshotIocs.length > 0
      ? `<div class="section">
    <div class="section-title">Evidence Snapshots (${snapshotIocs.length})</div>
    <div style="font-size:9px;color:#888;margin-bottom:8px;">Snapshot record hashes prove integrity of records at capture time — not authenticity of the referenced source.</div>
    <table>
      <tr>
        <th>#</th>
        <th>Title</th>
        <th>Source Type</th>
        <th>Snapshot Record Hash (truncated)</th>
        <th>Captured At</th>
        <th>Publication Status</th>
      </tr>
      ${snapshotRows}
    </table>
  </div>`
      : ""
  }

  ${
    p.privateExcluded > 0
      ? `<div class="excluded-notice">
    <strong>Excluded private material:</strong> ${p.privateExcluded} indicator(s) with PRIVATE status were excluded from this annex. Their existence is noted but their content is not disclosed here.
  </div>`
      : ""
  }

  <div class="footer">
    <span>INTERLIGENS — app.interligens.com</span>
    <span>Case ${esc(p.caseId)} — ${fmt(p.generatedAt)}</span>
    <span>Evidence-based investigative material. Not a legal determination. Not financial advice.</span>
  </div>

</div>
</body>
</html>`;
}

/**
 * Generates a PDF buffer via Puppeteer. Requires puppeteer-core + @sparticuz/chromium-min.
 * Falls back to null if chromium is unavailable — callers should handle gracefully.
 */
export async function renderPoliceAnnexPdf(html: string): Promise<Buffer> {
  // Dynamic imports keep this out of the edge runtime
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
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
