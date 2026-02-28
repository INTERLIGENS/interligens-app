import type { ScanResult } from "@/app/api/scan/solana/route";

function formatCurrency(val: number | null): string {
  if (val === null) return "N/A";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function severityColor(s: string): string {
  switch (s) {
    case "CRITICAL": return "#dc2626";
    case "HIGH":     return "#ea580c";
    case "MEDIUM":   return "#d97706";
    case "LOW":      return "#65a30d";
    default:         return "#6b7280";
  }
}

function statusPill(status: string, severity: string): string {
  const bg = severityColor(severity);
  return `<span style="background:${bg};color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;">${status}</span>`;
}

function severityPill(sev: string): string {
  const bg = severityColor(sev);
  return `<span style="background:${bg}22;color:${bg};border:1px solid ${bg};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${sev}</span>`;
}

function tierBadge(tier: string): string {
  const colors: Record<string, string> = { RED: "#dc2626", AMBER: "#f59e0b", GREEN: "#16a34a" };
  const bg = colors[tier] ?? "#6b7280";
  return `<span style="background:${bg};color:#fff;padding:6px 20px;border-radius:8px;font-size:18px;font-weight:900;letter-spacing:1px;">${tier}</span>`;
}

export function renderCaseFilePDF(scan: ScanResult): string {
  const { off_chain, on_chain, risk, mint, scanned_at } = scan;
  const m = on_chain.markets;

  const claimsRows = off_chain.claims.map((c) => `
    <tr>
      <td style="font-weight:700;padding:8px 12px;">${c.id}</td>
      <td style="padding:8px 12px;">${c.title}</td>
      <td style="padding:8px 12px;">${severityPill(c.severity)}</td>
      <td style="padding:8px 12px;">${statusPill(c.status, c.severity)}</td>
      <td style="padding:8px 12px;color:#374151;font-size:12px;">${c.category}</td>
    </tr>
  `).join("");

  const evidenceList = off_chain.claims.map((c) => `
    <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid ${severityColor(c.severity)};">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="font-weight:800;font-size:14px;">${c.id} — ${c.title}</span>
        ${severityPill(c.severity)}
      </div>
      <p style="margin:0 0 8px;color:#374151;font-size:13px;line-height:1.6;">${c.description}</p>
      ${c.evidence_files.length > 0 ? `<div style="font-size:12px;color:#6b7280;">📎 ${c.evidence_files.map((f) => `<code>${f}</code>`).join(", ")}</div>` : ""}
      ${c.thread_url ? `<div style="font-size:12px;margin-top:6px;">🔗 <a href="${c.thread_url}" style="color:#3b82f6;">${c.thread_url}</a></div>` : ""}
    </div>
  `).join("");

  const detectiveUrls = off_chain.claims.filter((c) => c.thread_url).map((c) => `
    <tr>
      <td style="padding:8px 12px;font-weight:700;">${c.id}</td>
      <td style="padding:8px 12px;">${c.title}</td>
      <td style="padding:8px 12px;"><a href="${c.thread_url}" style="color:#3b82f6;font-size:12px;">${c.thread_url}</a></td>
      <td style="padding:8px 12px;"><span style="background:#dc2626;color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;">Referenced</span></td>
    </tr>
  `).join("");

  const marketRows = [
    ["Source", m.source ? `<strong>${m.source.toUpperCase()}</strong>` : "N/A"],
    ["DEX", m.dex ?? "N/A"],
    ["Primary Pool", m.primary_pool ? `<code>${m.primary_pool}</code>` : "N/A"],
    ["Price", m.price !== null ? `$${m.price.toFixed(8)}` : "N/A"],
    ["Liquidity (USD)", formatCurrency(m.liquidity_usd)],
    ["Volume 24h (USD)", formatCurrency(m.volume_24h_usd)],
    ["FDV (USD)", formatCurrency(m.fdv_usd)],
    ["Pool URL", m.url ? `<a href="${m.url}" style="color:#3b82f6;font-size:12px;">${m.url}</a>` : "N/A"],
    ["Cache Hit", m.cache_hit ? "Yes" : "No"],
  ].map(([k, v]) => `<tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${k}</td><td style="padding:8px 14px;">${v}</td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>INTERLIGENS CaseFile</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#111; }
.page { width:794px; min-height:1123px; padding:48px 56px; page-break-after:always; }
h2 { font-size:20px; font-weight:800; margin-bottom:16px; color:#1e293b; }
table { width:100%; border-collapse:collapse; }
th { background:#1e293b; color:#fff; padding:10px 12px; text-align:left; font-size:12px; font-weight:700; }
td { border-bottom:1px solid #e5e7eb; font-size:13px; color:#1f2937; }
</style>
</head>
<body>

<div class="page" style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#f1f5f9;">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:48px;">
    <div style="width:44px;height:44px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;">🔍</div>
    <div>
      <div style="font-weight:900;font-size:20px;">INTERLIGENS</div>
      <div style="font-size:10px;color:#94a3b8;letter-spacing:2px;">BLOCKCHAIN INTELLIGENCE PLATFORM</div>
    </div>
  </div>
  <h1 style="font-size:40px;font-weight:900;color:#f1f5f9;margin-bottom:8px;">CaseFile Report</h1>
  <p style="color:#94a3b8;margin-bottom:48px;">Confidential — For Internal Review Only</p>
  <div style="background:#ffffff10;border:1px solid #ffffff20;border-radius:16px;padding:32px;margin-bottom:32px;">
    <div style="font-size:28px;font-weight:900;color:#f1f5f9;margin-bottom:16px;">BOTIFY <span style="font-size:16px;color:#94a3b8;">($BOTIFY)</span></div>
    <code style="font-size:11px;color:#7dd3fc;display:block;margin-bottom:20px;">${mint}</code>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;">
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">RISK SCORE</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:80px;height:80px;border-radius:50%;background:#dc2626;line-height:80px;text-align:center;font-size:28px;font-weight:900;color:#fff;">${risk.score}</div>
          ${tierBadge(risk.tier)}
        </div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">STATUS</div>
        <div style="font-size:20px;font-weight:700;">${off_chain.status}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">CLAIMS</div>
        <div style="font-size:20px;font-weight:700;">${off_chain.claims.length} / 8</div>
      </div>
    </div>
  </div>
  <div style="background:#ffffff08;border-radius:12px;padding:20px;">
    <p style="color:#cbd5e1;font-size:13px;line-height:1.7;">${off_chain.summary ?? "No summary."}</p>
  </div>
  <div style="margin-top:40px;display:flex;justify-content:space-between;">
    <div style="font-size:13px;color:#7dd3fc;">${off_chain.case_id ?? "N/A"}</div>
    <div style="font-size:13px;color:#94a3b8;">${new Date(scanned_at).toUTCString()}</div>
  </div>
</div>

<div class="page">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">📋</span><h2 style="margin:0;">Claims Status</h2></div>
  <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">8 confirmed claims — score: penalty=${risk.breakdown.claim_penalty} × ${risk.breakdown.severity_multiplier} = <strong>${risk.score}</strong></p>
  <table>
    <thead><tr><th style="width:60px;">ID</th><th>Title</th><th style="width:110px;">Severity</th><th style="width:130px;">Status</th><th style="width:160px;">Category</th></tr></thead>
    <tbody>${claimsRows}</tbody>
  </table>
  <div style="margin-top:24px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
    <strong style="color:#991b1b;">⚠ Flags:</strong>
    <span style="color:#991b1b;font-size:13px;"> ${risk.flags.join(" · ")}</span>
  </div>
</div>

<div class="page">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">🔎</span><h2 style="margin:0;">Off-chain Evidence</h2></div>
  ${evidenceList}
</div>

<div class="page">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">🕵️</span><h2 style="margin:0;">Detective Evidence Pack</h2></div>
  <div style="margin-bottom:24px;padding:12px 16px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;">
    Toutes les URLs ci-dessous sont <span style="background:#dc2626;color:#fff;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:700;">Referenced</span>
  </div>
  <table>
    <thead><tr><th style="width:55px;">Claim</th><th>Title</th><th>Source URL</th><th style="width:120px;">Tag</th></tr></thead>
    <tbody>${detectiveUrls}</tbody>
  </table>
</div>

<div class="page">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">📊</span><h2 style="margin:0;">On-chain Market Snapshot</h2></div>
  <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">Source: <strong>${m.source ? m.source.toUpperCase() : "UNAVAILABLE"}</strong></p>
  ${m.source === null ? `<div style="padding:24px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;">⚠️ Market data unavailable — PDF generated without market metrics.</div>` : `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;"><div style="font-size:13px;color:#6b7280;">💰 Price</div><div style="font-size:24px;font-weight:800;color:#166534;">${m.price !== null ? `$${m.price.toFixed(8)}` : "N/A"}</div></div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;"><div style="font-size:13px;color:#6b7280;">💧 Liquidity</div><div style="font-size:24px;font-weight:800;color:#166534;">${formatCurrency(m.liquidity_usd)}</div></div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;"><div style="font-size:13px;color:#6b7280;">📈 Volume 24h</div><div style="font-size:24px;font-weight:800;color:#166534;">${formatCurrency(m.volume_24h_usd)}</div></div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;"><div style="font-size:13px;color:#6b7280;">🏦 FDV</div><div style="font-size:24px;font-weight:800;color:#166534;">${formatCurrency(m.fdv_usd)}</div></div>
  </div>
  <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${marketRows}</tbody></table>
  `}
</div>

</body>
</html>`;
}
