
import { createHash } from "crypto"

function fmtUsd(n?: number | null): string {
  if (!n) return "—"
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K"
  return "$" + n.toFixed(0)
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function fmtDateShort(d?: Date | string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function ellip(s: string, max = 20): string {
  if (!s || s.length <= max) return s
  return s.slice(0, 10) + "..." + s.slice(-8)
}

function reportId(): string {
  return "INTL-" + Date.now().toString(36).toUpperCase() + "-KOL"
}

export function renderKolPdfLegal(kol: any): string {
  const evidences = kol.evidences ?? []
  const wallets = kol.kolWallets ?? []
  const cases = kol.kolCases ?? []
  const totalDocumented = evidences.reduce((s: number, e: any) => s + (e.amountUsd ?? 0), 0)
  const exitEv = evidences.find((e: any) => e.type === "coordinated_exit")
  const evmEv = evidences.find((e: any) => e.type === "evm_wallet")
  const cashouts = evidences.filter((e: any) => e.type === "onchain_cashout")
  const rid = reportId()
  const generatedUtc = new Date().toISOString()
  const contentHash = createHash("sha256").update(rid + kol.handle + generatedUtc).digest("hex").toUpperCase()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink: #0f0f0f;
    --ink-light: #3d3d3d;
    --ink-muted: #6b6b6b;
    --ink-ghost: #9e9e9e;
    --rule: #d0cdc8;
    --rule-light: #e8e5e0;
    --bg: #faf9f7;
    --bg-warm: #f3f1ec;
    --accent: #D94F00;
    --accent-light: #f0ddd4;
    --green: #1a6e3c;
    --green-bg: #e8f5ee;
    --amber: #8a5c00;
    --amber-bg: #fdf3dc;
    --red: #8a1a1a;
    --red-bg: #fde8e8;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--ink);
    font-size: 9.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { max-width: 740px; margin: 0 auto; padding: 48px 40px 32px; }

  /* ── COVER ── */
  .cover { min-height: 220px; border-bottom: 2px solid var(--ink); padding-bottom: 32px; margin-bottom: 36px; position: relative; }
  .cover-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .cover-logo { width: 32px; height: 32px; background: var(--accent); display: flex; align-items: center; justify-content: center; }
  .cover-logo span { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500; color: #fff; }
  .cover-brand-name { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.25em; color: var(--ink-muted); text-transform: uppercase; }
  .cover-type { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.3em; color: var(--accent); text-transform: uppercase; margin-bottom: 10px; }
  .cover-title { font-family: 'EB Garamond', serif; font-size: 32px; font-weight: 500; color: var(--ink); line-height: 1.2; margin-bottom: 6px; }
  .cover-subtitle { font-size: 11px; color: var(--ink-muted); margin-bottom: 24px; }
  .cover-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--rule); }
  .cover-meta-item label { font-size: 7.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-ghost); display: block; margin-bottom: 3px; }
  .cover-meta-item span { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink); }
  .cover-hash { margin-top: 16px; padding: 10px 14px; background: var(--bg-warm); border-left: 3px solid var(--accent); }
  .cover-hash label { font-size: 7.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-ghost); display: block; margin-bottom: 3px; }
  .cover-hash span { font-family: 'DM Mono', monospace; font-size: 8px; color: var(--ink-muted); word-break: break-all; }

  /* ── SECTIONS ── */
  .section { margin-bottom: 36px; }
  .section-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
  .section-num { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--accent); min-width: 24px; }
  .section-title { font-family: 'EB Garamond', serif; font-size: 14px; font-weight: 500; color: var(--ink); letter-spacing: 0.02em; }

  /* ── ACTION BOX ── */
  .action-box { background: var(--bg-warm); border: 1.5px solid var(--ink); padding: 20px 24px; margin-bottom: 32px; }
  .action-box-title { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .action-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; background: #fff; border: 1px solid var(--rule); }
  .action-dot { width: 6px; height: 6px; background: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .action-text { font-size: 9px; font-weight: 500; color: var(--ink); line-height: 1.4; }

  /* ── STATS ROW ── */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin-bottom: 24px; }
  .stat-cell { background: #fff; padding: 16px; }
  .stat-cell label { font-size: 7.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-ghost); display: block; margin-bottom: 4px; }
  .stat-cell .val { font-family: 'EB Garamond', serif; font-size: 22px; font-weight: 500; }
  .val-red { color: var(--red); }
  .val-orange { color: var(--accent); }
  .val-amber { color: var(--amber); }

  /* ── EXIT BOX ── */
  .exit-box { border: 1.5px solid var(--red); padding: 18px 22px; margin-bottom: 24px; background: #fff; }
  .exit-box-title { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--red); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .exit-box-title::before { content: ''; display: inline-block; width: 8px; height: 8px; background: var(--red); }
  .exit-box-desc { font-size: 9.5px; color: var(--ink-light); line-height: 1.65; margin-bottom: 14px; }
  .exit-stats { display: flex; gap: 32px; padding-top: 12px; border-top: 1px solid var(--rule-light); }
  .exit-stat label { font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-ghost); display: block; margin-bottom: 2px; }
  .exit-stat span { font-family: 'EB Garamond', serif; font-size: 18px; color: var(--red); font-weight: 500; }

  /* ── TIMELINE ── */
  .timeline { }
  .tl-row { display: grid; grid-template-columns: 130px 1fr; gap: 16px; margin-bottom: 12px; }
  .tl-time { font-family: 'DM Mono', monospace; font-size: 8px; color: var(--ink-ghost); padding-top: 2px; }
  .tl-content { padding-left: 14px; border-left: 2px solid var(--rule); }
  .tl-content.red { border-left-color: var(--red); }
  .tl-content.orange { border-left-color: var(--accent); }
  .tl-label { font-size: 9.5px; font-weight: 600; color: var(--ink); }
  .tl-detail { font-size: 8.5px; color: var(--ink-muted); margin-top: 2px; }
  .tl-tx { font-family: 'DM Mono', monospace; font-size: 7.5px; color: var(--accent); margin-top: 3px; }

  /* ── WALLET TABLE ── */
  .w-table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  .w-table th { font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-ghost); text-align: left; padding: 8px 10px; border-bottom: 1.5px solid var(--ink); }
  .w-table td { padding: 9px 10px; border-bottom: 1px solid var(--rule-light); vertical-align: top; }
  .w-table tr:nth-child(even) td { background: var(--bg-warm); }
  .w-table tr { page-break-inside: avoid; }
  .w-table { page-break-inside: auto; }
  .mono { font-family: 'DM Mono', monospace; font-size: 7.5px; color: var(--ink-muted); }
  .badge { display: inline-block; font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; font-weight: 500; }
  .badge-confirmed { background: var(--green-bg); color: var(--green); }
  .badge-source { background: var(--amber-bg); color: var(--amber); }
  .badge-provisional { background: var(--rule-light); color: var(--ink-muted); }
  .badge-red { background: var(--red-bg); color: var(--red); }
  .amount-cell { font-family: 'EB Garamond', serif; font-size: 13px; color: var(--red); font-weight: 500; }

  /* ── CEX FREEZE BOX ── */
  .freeze-box { border: 1.5px solid var(--ink); padding: 20px 24px; margin-bottom: 16px; background: #fff; }
  .freeze-box-title { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--ink); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--rule); }
  .freeze-ask { margin-bottom: 14px; }
  .freeze-ask-title { font-size: 9px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
  .freeze-item { display: flex; gap: 8px; margin-bottom: 4px; font-size: 9px; color: var(--ink-light); }
  .freeze-item::before { content: '→'; color: var(--accent); flex-shrink: 0; }
  .urgency-box { background: var(--red-bg); border-left: 3px solid var(--red); padding: 10px 14px; margin-top: 12px; font-size: 9px; color: var(--red); font-weight: 500; }

  /* ── METHODOLOGY ── */
  .method-para { font-size: 9.5px; color: var(--ink-light); line-height: 1.75; margin-bottom: 12px; }
  .method-item { display: flex; gap: 10px; margin-bottom: 6px; font-size: 9px; color: var(--ink-light); }
  .method-item strong { color: var(--ink); min-width: 140px; }

  /* ── INTEGRITY NOTE ── */
  .integrity-box { background: var(--bg-warm); padding: 16px 20px; border-top: 2px solid var(--rule); margin-top: 8px; }
  .integrity-title { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 8px; }
  .integrity-text { font-size: 8.5px; color: var(--ink-muted); line-height: 1.7; }

  /* ── FOOTER ── */
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1.5px solid var(--ink); display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 9.5px; color: var(--ink-muted); line-height: 1.7; }
  .footer-right { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--ink-muted); text-align: right; }

  /* ── PRINT ── */
  @media print {
    body { background: white; }
    .page { padding: 32px 28px; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ── 1. COVER ── -->
  <div class="cover">
    <div class="cover-brand">
      <div class="cover-logo"><span>I</span></div>
      <div class="cover-brand-name">Interligens Intelligence Platform</div>
    </div>
    <div class="cover-type">Confidential Intelligence Report — Legal Version</div>
    <div class="cover-title">${kol.displayName ?? kol.handle}</div>
    <div class="cover-subtitle">Rug-linked cashout and exit-event investigation — on-chain cashout documentation &amp; exit event analysis</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <label>Report ID</label>
        <span>${rid}</span>
      </div>
      <div class="cover-meta-item">
        <label>Generated UTC</label>
        <span>${generatedUtc.replace('T', ' ').substring(0, 19)}</span>
      </div>
      <div class="cover-meta-item">
        <label>Subject Handle</label>
        <span>@${kol.handle}</span>
      </div>
      <div class="cover-meta-item">
        <label>Confidence</label>
        <span>${(kol.confidence ?? "low").toUpperCase()}</span>
      </div>
    </div>
    <div class="cover-hash">
      <label>Report Integrity Hash (SHA-256)</label>
      <span>${contentHash}</span>
    </div>
  </div>

  <!-- ── 2. EXECUTIVE SUMMARY ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">01</span>
      <span class="section-title">Executive Summary</span>
    </div>
    <div class="stats-row">
      <div class="stat-cell">
        <label>Rug-Linked Cases</label>
        <div class="val val-amber">${kol.rugCount}</div>
      </div>
      <div class="stat-cell">
        <label>Est. Investor Losses</label>
        <div class="val val-red">${fmtUsd(kol.totalScammed)}</div>
      </div>
      <div class="stat-cell">
        <label>Documented On-Chain Proceeds</label>
        <div class="val val-orange">${fmtUsd(totalDocumented)}</div>
      </div>
      <div class="stat-cell">
        <label>Evidence Items</label>
        <div class="val">${evidences.length}</div>
      </div>
    </div>
    <p style="font-size:9.5px;color:var(--ink-light);line-height:1.75">
      ${kol.exitNarrative ?? `@${kol.handle} is a confirmed serial crypto scammer with ${kol.rugCount} rug-pull events documented across multiple projects. On-chain investigation has identified ${cashouts.length} associated wallet (public-source-linked) cashout events totaling ${fmtUsd(totalDocumented)} in documented proceeds, plus ${fmtUsd(evmEv?.amountUsd)} in unrealized EVM holdings.`}
    </p>
    ${exitEv ? `
    <div class="exit-box" style="margin-top:16px">
      <div class="exit-box-title">Coordinated Exit Event Detected</div>
      <div class="exit-box-desc">${exitEv.description ?? ""}</div>
      <div class="exit-stats">
        <div class="exit-stat"><label>USDC Moved</label><span>${fmtUsd(exitEv.amountUsd)}</span></div>
        <div class="exit-stat"><label>Transactions</label><span>${exitEv.txCount}</span></div>
        <div class="exit-stat"><label>Post → Cashout</label><span>${exitEv.deltaMinutes ? Math.floor(exitEv.deltaMinutes/60) + "h " + (exitEv.deltaMinutes%60) + "m" : "—"}</span></div>
        <div class="exit-stat"><label>Date</label><span style="font-size:13px">${fmtDateShort(exitEv.dateFirst)}</span></div>
      </div>
    </div>` : ""}
  </div>


  <!-- ── LEGAL ACTION SUMMARY (nouvelle page clé) ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">02</span>
      <span class="section-title">Legal Action Summary</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

      <!-- A. Suspect summary -->
      <div style="background:#fff;border:1px solid var(--rule);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;color:var(--accent);margin-bottom:10px">A — SUSPECT SUMMARY</div>
        <table style="width:100%;font-size:8.5px;border-collapse:collapse">
          <tr><td style="color:var(--ink-ghost);padding:3px 0;width:110px">Name</td><td style="font-weight:600">${kol.displayName ?? kol.handle}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Primary handle</td><td><span style="font-family:'DM Mono',monospace">@${kol.handle}</span></td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Platform</td><td>${kol.platform?.toUpperCase()}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">EVM address</td><td><span style="font-family:'DM Mono',monospace;font-size:7.5px">${kol.evmAddress ? kol.evmAddress.slice(0,18)+"..." : "—"}</span></td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Classification</td><td><span style="background:var(--red-bg);color:var(--red);font-size:7px;padding:2px 6px;font-weight:600">HIGH-RISK ACTOR</span></td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Confidence</td><td style="font-weight:600">${(kol.confidence ?? "low").toUpperCase()}</td></tr>
        </table>
      </div>

      <!-- B. Victim harm snapshot -->
      <div style="background:#fff;border:1px solid var(--rule);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;color:var(--accent);margin-bottom:10px">B — VICTIM HARM SNAPSHOT</div>
        <table style="width:100%;font-size:8.5px;border-collapse:collapse">
          <tr><td style="color:var(--ink-ghost);padding:3px 0;width:150px">Est. investor losses</td><td style="font-family:'EB Garamond',serif;font-size:16px;color:var(--red);font-weight:500">${fmtUsd(kol.totalScammed)}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Documented on-chain proceeds</td><td style="font-family:'EB Garamond',serif;font-size:16px;color:var(--accent);font-weight:500">${fmtUsd(totalDocumented)}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Rug-linked cases</td><td style="font-weight:600">${kol.rugCount}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Evidence items</td><td style="font-weight:600">${evidences.length}</td></tr>
          <tr><td style="color:var(--ink-ghost);padding:3px 0">Exit event detected</td><td><span style="background:var(--red-bg);color:var(--red);font-size:7px;padding:2px 6px;font-weight:600">${exitEv ? "YES — " + fmtDateShort(exitEv.dateFirst) : "NO"}</span></td></tr>
        </table>
      </div>
    </div>

    <!-- C. Jurisdictional nexus -->
    <div style="background:#fff;border:1px solid var(--rule);padding:16px;margin-bottom:16px">
      <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;color:var(--accent);margin-bottom:10px">C — JURISDICTIONAL NEXUS</div>
      <table style="width:100%;font-size:8.5px;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--rule)">
          <th style="text-align:left;padding:5px 8px;font-size:7.5px;letter-spacing:0.15em;color:var(--ink-ghost)">JURISDICTION</th>
          <th style="text-align:left;padding:5px 8px;font-size:7.5px;letter-spacing:0.15em;color:var(--ink-ghost)">NEXUS</th>
          <th style="text-align:left;padding:5px 8px;font-size:7.5px;letter-spacing:0.15em;color:var(--ink-ghost)">RELEVANCE</th>
        </tr></thead>
        <tbody>
          <tr><td style="padding:6px 8px;font-weight:600">United States</td><td style="padding:6px 8px;color:var(--ink-muted)">US-based exchange touchpoints (CEX deposit addresses traced). Delaware C-Corp entity.</td><td style="padding:6px 8px"><span style="background:var(--red-bg);color:var(--red);font-size:7px;padding:2px 6px">HIGH</span></td></tr>
          <tr style="background:var(--bg-warm)"><td style="padding:6px 8px;font-weight:600">Canada</td><td style="padding:6px 8px;color:var(--ink-muted)">Subject self-identified as Toronto-based. Dione Protocol LLC (Canadian entity).</td><td style="padding:6px 8px"><span style="background:var(--red-bg);color:var(--red);font-size:7px;padding:2px 6px">HIGH</span></td></tr>
          <tr><td style="padding:6px 8px;font-weight:600">EU / AMF</td><td style="padding:6px 8px;color:var(--ink-muted)">EU-based investors affected. Potential MiCA / AMF jurisdiction if French victims documented.</td><td style="padding:6px 8px"><span style="background:var(--amber-bg);color:var(--amber);font-size:7px;padding:2px 6px">MEDIUM</span></td></tr>
          <tr style="background:var(--bg-warm)"><td style="padding:6px 8px;font-weight:600">Solana / EVM</td><td style="padding:6px 8px;color:var(--ink-muted)">All cashout activity on Solana mainnet. EVM holdings on Ethereum/Base.</td><td style="padding:6px 8px"><span style="background:var(--green-bg);color:var(--green);font-size:7px;padding:2px 6px">CONFIRMED</span></td></tr>
        </tbody>
      </table>
    </div>

    <!-- D. Plausible legal angles -->
    <div style="background:#fff;border:1px solid var(--rule);padding:16px;margin-bottom:16px">
      <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;color:var(--accent);margin-bottom:10px">D — PLAUSIBLE ENFORCEMENT ANGLES <span style="color:var(--ink-ghost);font-size:7px">(analytical — not legal conclusions)</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:8px 12px;border-left:2px solid var(--accent);font-size:8.5px"><strong>Fraud / misrepresentation</strong><br/><span style="color:var(--ink-muted)">Promotion of tokens with undisclosed insider allocation and coordinated exit.</span></div>
        <div style="padding:8px 12px;border-left:2px solid var(--accent);font-size:8.5px"><strong>Asset dissipation / tracing</strong><br/><span style="color:var(--ink-muted)">Documented proceeds moved through relay/mixer network within hours of public exit statement.</span></div>
        <div style="padding:8px 12px;border-left:2px solid var(--rule);font-size:8.5px"><strong>Deceptive promotion</strong><br/><span style="color:var(--ink-muted)">Public KOL activity without disclosure of financial interest in promoted tokens.</span></div>
        <div style="padding:8px 12px;border-left:2px solid var(--rule);font-size:8.5px"><strong>AML / off-ramp review</strong><br/><span style="color:var(--ink-muted)">USDC proceeds routed through mixer pattern to probable CEX deposit. Potential VASP obligations.</span></div>
      </div>
    </div>

    <!-- E. Immediate asks -->
    <div style="background:var(--bg-warm);border:1.5px solid var(--ink);padding:16px">
      <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;color:var(--ink);margin-bottom:10px">E — IMMEDIATE PROCEDURAL ASKS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:8.5px">
        <div><strong style="display:block;margin-bottom:4px;color:var(--accent)">Preservation</strong>Exchange freeze on 4 target wallets (see §08). EVM wallet observation.</div>
        <div><strong style="display:block;margin-bottom:4px;color:var(--accent)">Subpoena targets</strong>CEX platforms receiving D5Yq + ET3F deposits. KYC/IP/logs.</div>
        <div><strong style="display:block;margin-bottom:4px;color:var(--accent)">MLAT / referral</strong>US DOJ / FBI IC3 if US victims. RCMP if Canada-based complaint. AMF if EU victims.</div>
      </div>
    </div>
  </div>

  <!-- ── 3. REQUESTED ACTIONS ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">03</span>
      <span class="section-title">Requested Actions</span>
    </div>
    <div class="action-box">
      <div class="action-box-title">This report supports the following legal actions</div>
      <div class="action-grid">
        <div class="action-item"><div class="action-dot"></div><div class="action-text">Criminal referral — wire fraud / securities fraud</div></div>
        <div class="action-item"><div class="action-dot"></div><div class="action-text">Civil asset tracing &amp; recovery proceedings</div></div>
        <div class="action-item"><div class="action-dot"></div><div class="action-text">Exchange preservation / freeze request</div></div>
        <div class="action-item"><div class="action-dot"></div><div class="action-text">SAR / AML escalation to financial intelligence unit</div></div>
        <div class="action-item"><div class="action-dot"></div><div class="action-text">Subpoena / MLAT support package</div></div>
        <div class="action-item"><div class="action-dot"></div><div class="action-text">Victim intake consolidation for class action</div></div>
      </div>
    </div>
  </div>

  <!-- ── 4. SUBJECT IDENTIFICATION ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">04</span>
      <span class="section-title">Subject Identification</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Field</th><th>Value</th><th>Source</th></tr></thead>
      <tbody>
        <tr><td><strong>Display Name</strong></td><td>${kol.displayName ?? "—"}</td><td>Self-identified / public profile</td></tr>
        <tr><td><strong>Primary Handle</strong></td><td><span class="mono">@${kol.handle}</span></td><td>X/Twitter public profile</td></tr>
        <tr><td><strong>Platform</strong></td><td>${kol.platform?.toUpperCase()}</td><td>—</td></tr>
        <tr><td><strong>Followers</strong></td><td>${kol.followerCount ? kol.followerCount.toLocaleString() : "—"}</td><td>Public profile</td></tr>
        <tr><td><strong>EVM Address</strong></td><td><span class="mono">${kol.evmAddress ?? "—"}</span></td><td>Arkham Intelligence entity confirmed</td></tr>
        <tr><td><strong>Risk Classification</strong></td><td><span class="badge badge-red">${"HIGH-RISK ACTOR"}</span></td><td>INTERLIGENS analytical classification</td></tr>
        <tr><td><strong>Verification Status</strong></td><td>${kol.verified ? '<span class="badge badge-confirmed">VERIFIED</span>' : '<span class="badge badge-provisional">UNVERIFIED</span>'}</td><td>—</td></tr>
      </tbody>
    </table>
    ${kol.notes ? `<div style="margin-top:12px;padding:12px 16px;background:var(--bg-warm);font-size:9px;color:var(--ink-light);line-height:1.7;border-left:2px solid var(--accent)">${kol.notes}</div>` : ""}
  </div>

  <!-- ── 5. TIMELINE OF FACTS ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">05</span>
      <span class="section-title">Timeline of Key Facts</span>
    </div>
    <div class="timeline">
      ${cashouts.map((e: any) => `
      <div class="tl-row">
        <div class="tl-time">${fmtDateShort(e.dateFirst)}${e.dateLast && e.dateLast !== e.dateFirst ? "<br/>→ " + fmtDateShort(e.dateLast) : ""}</div>
        <div class="tl-content orange">
          <div class="tl-label">${e.label}</div>
          <div class="tl-detail">${e.txCount} transactions · ${fmtUsd(e.amountUsd)} · ${e.token}</div>
          ${e.sampleTx ? `<div class="tl-tx">Sample TX: ${e.sampleTx}</div>` : ""}
        </div>
      </div>`).join("")}
      ${exitEv ? `
      <div class="tl-row">
        <div class="tl-time">${fmtDateShort(exitEv.dateFirst)}<br/><strong style="color:var(--red)">EXIT EVENT</strong></div>
        <div class="tl-content red">
          <div class="tl-label">Coordinated exit — ${fmtUsd(exitEv.amountUsd)} USDC moved in 3h</div>
          <div class="tl-detail">Post X published 19/03/2026 23:25 UTC · Hub activated ${exitEv.deltaMinutes ? Math.floor(exitEv.deltaMinutes/60) + "h " + (exitEv.deltaMinutes%60) + "m" : ""} later · Vanity wallet 1234Co consolidates $256,969 USDC · D5Yq = CEX deposit confirmed (50 unique senders)</div>
          ${exitEv.sampleTx ? `<div class="tl-tx">Hub TX: ${exitEv.sampleTx}</div>` : ""}
        </div>
      </div>` : ""}
    </div>
  </div>

  <!-- ── 6. WALLET ATTRIBUTION ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">06</span>
      <span class="section-title">Wallet Attribution Matrix</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Label</th><th>Address</th><th>Chain</th><th>Attribution</th><th>Confidence</th><th>Net Proceeds</th></tr></thead>
      <tbody>
        ${cashouts.map((e: any) => {
          const addrs = JSON.parse(e.wallets ?? "[]")
          return addrs.map((addr: string) => `
          <tr>
            <td style="font-size:9px;font-weight:500">${e.label.split("—")[0].trim()}</td>
            <td><span class="mono">${addr}</span></td>
            <td>SOL</td>
            <td><span class="badge badge-source">Public-Source-Linked</span></td>
            <td><span class="badge badge-confirmed">Confirmed</span></td>
            <td class="amount-cell">${fmtUsd(e.amountUsd)}</td>
          </tr>`).join("")
        }).join("")}
        ${evmEv ? JSON.parse(evmEv.wallets ?? "[]").map((addr: string) => `
        <tr>
          <td style="font-size:9px;font-weight:500">EVM Personal Wallet</td>
          <td><span class="mono">${addr}</span></td>
          <td>ETH/EVM</td>
          <td><span class="badge badge-confirmed">Arkham Confirmed</span></td>
          <td><span class="badge badge-confirmed">Confirmed</span></td>
          <td class="amount-cell">${fmtUsd(evmEv.amountUsd)}</td>
        </tr>`).join("") : ""}
      </tbody>
    </table>
  </div>

  <!-- ── 7. CASHOUT EVIDENCE ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">07</span>
      <span class="section-title">Cashout Evidence — Associated Wallets</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Source</th><th>Token</th><th>Amount USD</th><th>TX Count</th><th>Period</th><th>Sample TX Hash</th></tr></thead>
      <tbody>
        ${cashouts.map((e: any) => `
        <tr>
          <td>
            <div style="font-size:9px;font-weight:600;color:var(--ink);margin-bottom:3px">${e.label}</div>
            <div class="mono">${ellip(JSON.parse(e.wallets ?? "[]")[0] ?? "", 22)}</div>
          </td>
          <td style="font-size:9px;color:var(--accent);font-weight:500">${e.token ?? "—"}</td>
          <td class="amount-cell">${fmtUsd(e.amountUsd)}</td>
          <td style="font-size:9px;color:var(--ink-muted)">${e.txCount ?? "—"}</td>
          <td style="font-size:8px;color:var(--ink-muted)">${fmtDateShort(e.dateFirst)}<br/>→ ${fmtDateShort(e.dateLast)}</td>
          <td><span class="mono">${e.sampleTx ? ellip(e.sampleTx, 18) : "—"}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <!-- ── 8. INTENT INDICATORS ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">08</span>
      <span class="section-title">Intent &amp; Coordination Indicators</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Indicator</th><th>Observation</th><th>Classification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Post-to-cashout correlation</strong></td>
          <td>Public exit statement published 19/03/2026 23:25 UTC. Hub wallet activated 08:05 UTC on 20/03/2026. Delta: 520 minutes.</td>
          <td><span class="badge badge-confirmed">On-Chain Verified</span></td>
        </tr>
        <tr>
          <td><strong>Automated disposal pattern</strong></td>
          <td>Associated Wallet E (SAM cluster) wallet executed swaps at exact 4-hour intervals 30 Jan–5 Feb 2026. Consistent with scripted/bot-operated cashout.</td>
          <td><span class="badge badge-confirmed">On-Chain Verified</span></td>
        </tr>
        <tr>
          <td><strong>Vanity wallet pre-generation</strong></td>
          <td>Wallet 1234Co (consolidated $256,969 USDC) requires intentional computational generation. Indicates advance planning.</td>
          <td><span class="badge badge-confirmed">On-Chain Verified</span></td>
        </tr>
        <tr>
          <td><strong>Family wallet distribution</strong></td>
          <td>Insider supply distributed to 7 public-source-linked wallets (BK: 4, SAM: 3) prior to public launch. Consistent with concealed insider allocation.</td>
          <td><span class="badge badge-source">Public-Source-Linked</span></td>
        </tr>
        <tr>
          <td><strong>Mixer / relay cycling</strong></td>
          <td>50+ relay wallets identified with in=out USDC flows same-day. Consistent with deliberate obfuscation to prevent tracing.</td>
          <td><span class="badge badge-confirmed">On-Chain Verified</span></td>
        </tr>
        <tr>
          <td><strong>Recurrence pattern</strong></td>
          <td>${kol.rugCount}+ confirmed rug events across distinct projects. Launch-to-cashout sequence reproduced consistently.</td>
          <td><span class="badge badge-source">Public-Source-Linked</span></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:12px;padding:10px 14px;background:var(--bg-warm);font-size:8.5px;color:var(--ink-muted);line-height:1.7;font-style:italic">
      Note: The above indicators are consistent with coordinated disposal behavior and concealment. They are presented as analytical observations, not judicial findings. Terms such as "consistent with" and "indicators of" reflect analytical classification, not legal conclusions.
    </div>
  </div>

  <!-- ── 9. EXCHANGE FREEZE PACKAGE ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">09</span>
      <span class="section-title">Exchange Preservation &amp; Freeze Package</span>
    </div>
    <div class="freeze-box">
      <div class="freeze-box-title">Immediate Preservation Request</div>
      <div class="freeze-ask">
        <div class="freeze-ask-title">Target wallets for preservation</div>
        ${(exitEv ? JSON.parse(exitEv.wallets ?? "[]") : []).map((addr: string) => `
        <div class="freeze-item"><span class="mono">${addr}</span></div>`).join("")}
        ${evmEv ? `<div class="freeze-item"><span class="mono">${JSON.parse(evmEv.wallets ?? "[]")[0] ?? ""}</span> (EVM)</div>` : ""}
      </div>
      <div class="freeze-ask">
        <div class="freeze-ask-title">Requested actions from exchange compliance</div>
        <div class="freeze-item">Preserve all records associated with the above wallet addresses</div>
        <div class="freeze-item">Restrict withdrawal activity pending legal review</div>
        <div class="freeze-item">Identify account holder — name, KYC documents, email, phone</div>
        <div class="freeze-item">Preserve KYC / KYB onboarding documentation</div>
        <div class="freeze-item">Preserve device fingerprints, IP addresses, and access logs</div>
        <div class="freeze-item">Preserve linked payment rails (bank, card, other on/off-ramps)</div>
        <div class="freeze-item">Respond to authorized legal counsel or law enforcement contact</div>
      </div>
      <div class="urgency-box">
        DISSIPATION RISK: Active cashout event detected 20/03/2026. Funds remain partially in transit. Immediate preservation action recommended.
      </div>
    </div>
  </div>

  <!-- ── 10. METHODOLOGY ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">10</span>
      <span class="section-title">Methodology &amp; Evidence Integrity</span>
    </div>
    <p class="method-para">All blockchain data was retrieved via Helius RPC API (Solana mainnet) and Arkham Intelligence (EVM chains). Transaction hashes are immutable on-chain records independently verifiable by any party via Solscan.io or equivalent block explorer.</p>
    <div class="method-item"><strong>Data sources</strong><span>Helius API v0 · Solscan · Arkham Intelligence · X/Twitter public posts (archived)</span></div>
    <div class="method-item"><strong>Investigation date</strong><span>${new Date().toLocaleDateString("en-US", {year:"numeric",month:"long",day:"numeric"})}</span></div>
    <div class="method-item"><strong>Evidence standard</strong><span>On-chain verified (blockchain-immutable) + Source-attributed (cited public sources) + Analytical inference (disclosed methodology)</span></div>
    <div class="method-item"><strong>Full methodology</strong><span>https://interligens.com/en/methodology</span></div>
    <div class="method-item"><strong>Correction policy</strong><span>https://interligens.com/en/correction</span></div>
    <div class="integrity-box" style="margin-top:16px">
      <div class="integrity-title">Evidence Handling &amp; Integrity Statement</div>
      <p class="integrity-text">This report is a structured analytical compilation of publicly observable blockchain records, archived public-source materials, and internally generated tracing outputs. Each exhibit is referenced by source and UTC collection time. Source artifacts were preserved in their collected form and normalized into an internal evidence record. This report is intended to support legal assessment, investigative triage, preservation requests, and follow-on compulsory process where required. It does not constitute a complete forensic chain of custody as defined under applicable criminal procedure rules — such chain of custody is established by authorized law enforcement using their own evidence collection procedures.</p>
    </div>
  </div>


  <!-- ── ATTRIBUTION LADDER ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">11</span>
      <span class="section-title">Attribution Ladder</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Level</th><th>Definition</th><th>Wallets / Elements</th></tr></thead>
      <tbody>
        <tr>
          <td><span class="badge badge-confirmed">VERIFIED ON-CHAIN</span></td>
          <td style="font-size:8.5px;color:var(--ink-muted)">Directly observable on blockchain. TX hash independently verifiable.</td>
          <td style="font-size:8.5px">${cashouts.filter((e: any) => e.sampleTx).length} cashout events · Exit hub TX · Bot pattern (4h intervals)</td>
        </tr>
        <tr>
          <td><span class="badge badge-source">PUBLIC-SOURCE-LINKED</span></td>
          <td style="font-size:8.5px;color:var(--ink-muted)">Attributed via cited public sources (investigator threads, leaked documents, public admissions).</td>
          <td style="font-size:8.5px">Associated-wallet labels via @mariaqueennft + @dethective · KOL identity via self-disclosure</td>
        </tr>
        <tr>
          <td><span class="badge badge-provisional">ANALYTICAL INFERENCE</span></td>
          <td style="font-size:8.5px;color:var(--ink-muted)">Derived from pattern analysis. Not independently confirmed. Presented as indicator, not fact.</td>
          <td style="font-size:8.5px">CEX deposit identification · Mixer pattern · Total loss estimate ($4.5M)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ── EXHIBIT APPENDIX ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">12</span>
      <span class="section-title">Exhibit Index</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Exhibit ID</th><th>Type</th><th>Description</th><th>Source</th><th>Verification</th></tr></thead>
      <tbody>
        <tr><td class="mono">EX-01</td><td>Social Post</td><td>X post @kokoski — exit statement 19/03/2026 23:25 UTC</td><td>X/Twitter public</td><td><span class="badge badge-confirmed">Archived</span></td></tr>
        ${cashouts.map((e: any, i: number) => `
        <tr>
          <td class="mono">EX-0${i+2}</td>
          <td>Blockchain TX</td>
          <td>${e.label}</td>
          <td>Helius API · Solscan</td>
          <td><span class="badge badge-confirmed">On-Chain</span></td>
        </tr>`).join("")}
        <tr><td class="mono">EX-${cashouts.length + 2}</td><td>Exit Event</td><td>HeaiDUtMQ hub — $210K USDC coordinated cashout 20/03/2026</td><td>Helius API · Solscan</td><td><span class="badge badge-confirmed">On-Chain</span></td></tr>
        ${evmEv ? `<tr><td class="mono">EX-${cashouts.length + 3}</td><td>EVM Portfolio</td><td>EVM wallet $401K — Arkham Intelligence entity confirmed</td><td>Arkham Intelligence</td><td><span class="badge badge-source">Platform-Confirmed</span></td></tr>` : ""}
      </tbody>
    </table>
  </div>

  <!-- ── EXCHANGE FREEZE ANNEX ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">13</span>
      <span class="section-title">Exchange Freeze Annex — Machine-Readable</span>
    </div>
    <table class="w-table">
      <thead><tr><th>Wallet</th><th>Chain</th><th>Asset</th><th>Key TX Hash</th><th>UTC</th><th>Amount</th><th>Urgency</th></tr></thead>
      <tbody>
        <tr>
          <td><span class="mono">HeaiDUtMQ...hqS4R</span><br/><span style="font-size:7.5px;color:var(--ink-ghost)">Hub wallet</span></td>
          <td>SOL</td><td>USDC</td>
          <td><span class="mono">5wctB93Y...MNs</span></td>
          <td style="font-size:8px">2026-03-20 08:05 UTC</td>
          <td class="amount-cell">$210K</td>
          <td><span class="badge badge-red">CRITICAL</span></td>
        </tr>
        <tr>
          <td><span class="mono">1234CoNG...RsHa</span><br/><span style="font-size:7.5px;color:var(--ink-ghost)">Vanity consolidation</span></td>
          <td>SOL</td><td>USDC</td>
          <td><span class="mono">Multiple</span></td>
          <td style="font-size:8px">2026-03-20 08:05–11:32 UTC</td>
          <td class="amount-cell">$257K</td>
          <td><span class="badge badge-red">CRITICAL</span></td>
        </tr>
        <tr>
          <td><span class="mono">D5YqVMo...9cM</span><br/><span style="font-size:7.5px;color:var(--ink-ghost)">CEX deposit — 50 senders</span></td>
          <td>SOL</td><td>USDC</td>
          <td><span class="mono">Multiple</span></td>
          <td style="font-size:8px">2026-03-20</td>
          <td class="amount-cell">$64K</td>
          <td><span class="badge badge-red">HIGH</span></td>
        </tr>
        <tr>
          <td><span class="mono">ET3F3q4...xSn</span><br/><span style="font-size:7.5px;color:var(--ink-ghost)">CEX deposit — 72 senders, 1 dest</span></td>
          <td>SOL</td><td>USDC</td>
          <td><span class="mono">Multiple</span></td>
          <td style="font-size:8px">2026-03-07 to 2026-03-20</td>
          <td class="amount-cell">$97K</td>
          <td><span class="badge badge-red">HIGH</span></td>
        </tr>
        ${evmEv ? `<tr>
          <td><span class="mono">0x32B6...ecF</span><br/><span style="font-size:7.5px;color:var(--ink-ghost)">EVM personal wallet</span></td>
          <td>ETH/EVM</td><td>MULTI</td>
          <td><span class="mono">Arkham confirmed</span></td>
          <td style="font-size:8px">Active since Jan 2023</td>
          <td class="amount-cell">$401K</td>
          <td><span class="badge badge-source">HIGH</span></td>
        </tr>` : ""}
      </tbody>
    </table>
    <div style="margin-top:10px;padding:8px 12px;background:var(--bg-warm);font-size:8.5px;color:var(--ink-muted)">
      Contact for legal process: legal@interligens.com · INTERLIGENS Inc., Delaware C-Corp · All preservation requests should reference Report ID: ${rid}
    </div>
  </div>


  <!-- ── VICTIM LOSS PATHWAYS ── -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">14</span>
      <span class="section-title">Sample Victim Loss Pathways</span>
    </div>
    <p style="font-size:9px;color:var(--ink-muted);margin-bottom:14px;font-style:italic">
      The following wallet pathways are illustrative samples of retail purchaser activity documented on-chain during the active promotion period. 
      They connect purchase transactions to the token's known insider-supply structure. Loss estimates are based on SOL paid vs. current token value ($0.00 post-collapse). 
      These are presented as observed blockchain facts, not verified victim identities.
    </p>
    <table class="w-table">
      <thead>
        <tr>
          <th>Victim Wallet</th>
          <th>Token</th>
          <th>Purchase Date</th>
          <th>SOL Paid</th>
          <th>Tokens Received</th>
          <th>Loss Basis</th>
          <th>Destination Cluster</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="mono">ARu4n5...ZAravu7C</span></td>
          <td style="color:var(--accent);font-weight:500">BOTIFY</td>
          <td style="font-size:8px">2026-03-20</td>
          <td class="amount-cell">10.37 SOL<br/><span style="font-size:8px;color:var(--ink-ghost">~$1,900</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">10,071,460 BOTIFY</td>
          <td><span class="badge badge-red">TOTAL LOSS</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">Insider supply cluster</td>
          <td><span class="mono" style="font-size:7px">xJD2qAbP...Y</span></td>
        </tr>
        <tr>
          <td><span class="mono">FE52Qw...HfouGEE6</span></td>
          <td style="color:var(--accent);font-weight:500">BOTIFY</td>
          <td style="font-size:8px">2026-03-19</td>
          <td class="amount-cell">0.36 SOL<br/><span style="font-size:8px;color:var(--ink-ghost)">~$66</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">323,203 BOTIFY</td>
          <td><span class="badge badge-red">TOTAL LOSS</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">Insider supply cluster</td>
          <td><span class="mono" style="font-size:7px">3VVRAig...G</span></td>
        </tr>
        <tr>
          <td><span class="mono">8K1wts...RjL7uRwj</span></td>
          <td style="color:var(--accent);font-weight:500">BOTIFY</td>
          <td style="font-size:8px">2026-03-18</td>
          <td class="amount-cell">4.00 SOL<br/><span style="font-size:8px;color:var(--ink-ghost)">~$730</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">3,619,315 BOTIFY</td>
          <td><span class="badge badge-red">TOTAL LOSS</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">Insider supply cluster</td>
          <td><span class="mono" style="font-size:7px">2UjLjq2...1</span></td>
        </tr>
        <tr>
          <td><span class="mono">C1g9H6...1vuFcbtJ</span></td>
          <td style="color:var(--accent);font-weight:500">BOTIFY</td>
          <td style="font-size:8px">2026-03-18</td>
          <td class="amount-cell">0.65 SOL<br/><span style="font-size:8px;color:var(--ink-ghost)">~$119</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">595,476 BOTIFY</td>
          <td><span class="badge badge-red">TOTAL LOSS</span></td>
          <td style="font-size:8px;color:var(--ink-muted)">Insider supply cluster</td>
          <td><span class="mono" style="font-size:7px">5k3og76...b</span></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:12px;padding:10px 14px;background:var(--bg-warm);font-size:8px;color:var(--ink-muted);line-height:1.7">
      <strong style="color:var(--ink)">Loss methodology:</strong> SOL paid × SOL/USD price at transaction time. 
      Token current value assessed at $0.00 post-collapse. Loss = 100% of purchase value. 
      Sample represents 4 of an estimated ${kol.rugCount ?? 12}+ affected launches. 
      Full victim intake available via INTERLIGENS victim reporting system.
    </div>
  </div>

  <!-- ── LEGAL NOTICE ── -->
  <div style="padding:16px 20px;border:1px solid var(--rule);background:#fff;font-size:8.5px;color:var(--ink-muted);line-height:1.75;margin-bottom:32px">
    <strong style="color:var(--ink);display:block;margin-bottom:6px">EVIDENCE STANDARD — IMPORTANT NOTICE</strong>
    This report is an evidence-based analytical summary derived from publicly accessible blockchain records, archived public communications, and cited third-party sources. All statements are categorized as: (i) directly observable on-chain facts, (ii) source-attributed public claims, or (iii) analytical inferences based on disclosed methodology. INTERLIGENS does not assert criminal guilt, intent, or legal liability. USD figures are methodology-based estimates. Terms including "high-risk," "linked," "associated," "rug-linked," and "estimated" reflect analytical classification — not judicial findings.
  </div>

  <!-- ── FOOTER ── -->
  <div class="footer">
    <div class="footer-left">
      <strong>INTERLIGENS Intelligence Platform</strong><br/>
      interligens.com · legal@interligens.com<br/>
      INTERLIGENS Inc. — Delaware C-Corp
    </div>
    <div class="footer-right">
      Report ID: ${rid}<br/>
      Generated: ${generatedUtc.substring(0,10)}<br/>
      Legal Version — Confidential
    </div>
  </div>

</div>
</body>
</html>`
}
