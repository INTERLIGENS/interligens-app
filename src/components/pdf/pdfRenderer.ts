import type { ScanResult } from "@/app/api/scan/solana/route";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import type { I18n } from "@/lib/i18n/en";

export function getLang(lang?: string): I18n {
  return lang === "fr" ? fr : en;
}

function formatCurrency(val: number | null): string {
  if (val === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
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

function severityPill(sev: string): string {
  const bg = severityColor(sev);
  return `<span style="background:${bg}22;color:${bg};border:1px solid ${bg};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${sev}</span>`;
}

function statusPill(status: string, lang?: string): string {
  const label = lang === "fr" ? (status === "REFERENCED" ? "RÉFÉRENCÉ" : status === "CORROBORATED" ? "CORROBORÉ" : status) : status;
  return `<span style="background:#ea580c;color:#fff;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;">${label}</span>`;
}

function tierBadge(tier: string, t: I18n): string {
  const colors: Record<string, string> = { RED: "#dc2626", AMBER: "#f59e0b", GREEN: "#16a34a" };
  const bg = colors[tier] ?? "#6b7280";
  const label = tier === "RED" ? t.avoid : tier === "AMBER" ? t.caution : t.proceed;
  return `<span style="background:${bg};color:#fff;padding:6px 20px;border-radius:8px;font-size:16px;font-weight:900;letter-spacing:1px;">${label}</span>`;
}

export function renderCaseFilePDF(scan: ScanResult, lang?: string, graphReport?: any): string {
  const t = getLang(lang);
  const { off_chain, on_chain, risk, mint, scanned_at } = scan;
  const m = on_chain.markets;
  const year = new Date(scanned_at).getFullYear();

  const claimsRows = off_chain.claims.map((c) => {
    const rawClaim = (scan as any)._raw_claims?.find((r: any) => r.claim_id === c.id);
    const title = lang === "fr" ? (rawClaim?.title_fr ?? c.title) : c.title;
    return `
    <tr>
      <td style="font-weight:700;padding:8px 12px;">${c.id}</td>
      <td style="padding:8px 12px;">${title}</td>
      <td style="padding:8px 12px;">${severityPill(c.severity)}</td>
      <td style="padding:8px 12px;">${statusPill(c.status)}</td>
      <td style="padding:8px 12px;color:#374151;font-size:12px;">${c.category}</td>
    </tr>
  `;}).join("");

  const evidenceList = off_chain.claims.map((c) => {
    const rawClaim = (scan as any)._raw_claims?.find((r: any) => r.claim_id === c.id);
    const title = lang === "fr" ? (rawClaim?.title_fr ?? c.title) : c.title;
    const description = lang === "fr" ? (rawClaim?.description_fr ?? c.description) : c.description;
    return `
    <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid ${severityColor(c.severity)};">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="font-weight:800;font-size:14px;">${c.id} — ${title}</span>
        ${severityPill(c.severity)}
      </div>
      <p style="margin:0 0 8px;color:#374151;font-size:13px;line-height:1.6;">${description}</p>
      ${c.evidence_files.length > 0 ? `<div style="font-size:12px;color:#6b7280;">📎 ${c.evidence_files.map((f) => `<code>${f}</code>`).join(", ")}</div>` : ""}
      ${c.thread_url ? `<div style="font-size:12px;margin-top:6px;">🔗 <a href="${c.thread_url}" style="color:#3b82f6;">${c.thread_url}</a></div>` : ""}
    </div>
  `;}).join("");

  const detectiveUrls = off_chain.claims.filter((c) => c.thread_url).map((c) => `
    <tr>
      <td style="padding:8px 12px;font-weight:700;">${c.id}</td>
      <td style="padding:8px 12px;">${c.title}</td>
      <td style="padding:8px 12px;"><a href="${c.thread_url}" style="color:#3b82f6;font-size:11px;">${c.thread_url}</a></td>
      <td style="padding:8px 12px;">${statusPill(t.referenced)}</td>
    </tr>
  `).join("");

  const marketRows = [
    [t.source, m.source ? `<strong>${m.source.toUpperCase()}</strong>` : "—"],
    [t.dex, m.dex ?? "—"],
    [t.pool, m.primary_pool ? `<code style="font-size:10px;">${m.primary_pool}</code>` : "—"],
    [t.price, m.price !== null ? `$${m.price.toFixed(8)}` : "—"],
    [t.liquidity, formatCurrency(m.liquidity_usd)],
    [t.volume24h, formatCurrency(m.volume_24h_usd)],
    [t.fdv, formatCurrency(m.fdv_usd)],
    [t.poolUrl, m.url ? `<a href="${m.url}" style="color:#3b82f6;font-size:11px;">${m.url}</a>` : "—"],
  ].map(([k, v]) => `<tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${k}</td><td style="padding:8px 14px;">${v}</td></tr>`).join("");

  const sourcesBullets = t.sourcesMethodBullets.map((b) => `<li style="margin-bottom:8px;font-size:13px;color:#374151;">${b}</li>`).join("");

  const footer = `<div style="position:fixed;bottom:0;left:0;right:0;padding:10px 56px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:10px;color:#6b7280;text-align:center;">${t.footer(year)}</div>`;

  return `<!DOCTYPE html>
<html lang="${lang ?? "en"}">
<head>
<meta charset="UTF-8"/>
<title>INTERLIGENS CaseFile</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; font-feature-settings: "liga" 0, "clig" 0; }
body { font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#111; }
.page { width:794px; min-height:1123px; padding:48px 56px 80px; page-break-after:always; position:relative; }
h2 { font-size:20px; font-weight:800; margin-bottom:16px; color:#1e293b; }
table { width:100%; border-collapse:collapse; }
th { background:#1e293b; color:#fff; padding:10px 12px; text-align:left; font-size:12px; font-weight:700; }
td { border-bottom:1px solid #e5e7eb; font-size:13px; color:#1f2937; vertical-align:top; }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page" style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#f1f5f9;">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:32px;">
    <div style="width:44px;height:44px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;">🔍</div>
    <div>
      <div style="font-weight:900;font-size:20px;">INTERLIGENS</div>
      <div style="font-size:10px;color:#94a3b8;letter-spacing:2px;">BLOCKCHAIN INTELLIGENCE PLATFORM</div>
    </div>
  </div>
  <h1 style="font-size:40px;font-weight:900;color:#f1f5f9;margin-bottom:4px;">${t.title}</h1>
  <p style="color:#94a3b8;margin-bottom:8px;">${t.subtitle}</p>
  <p style="color:#7dd3fc;font-size:11px;margin-bottom:4px;">⚙ ${t.generatedBy}</p>
  <p style="color:#fb923c;font-size:11px;margin-bottom:32px;">🕵 ${t.detectiveRef}</p>

  <div style="background:#ffffff10;border:1px solid #ffffff20;border-radius:16px;padding:32px;margin-bottom:24px;">
    <div style="font-size:28px;font-weight:900;color:#f1f5f9;margin-bottom:8px;">BOTIFY <span style="font-size:16px;color:#94a3b8;">($BOTIFY)</span></div>
    <code style="font-size:11px;color:#7dd3fc;display:block;margin-bottom:20px;">${mint}</code>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;">
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${t.riskScore}</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:80px;height:80px;border-radius:50%;background:#dc2626;line-height:80px;text-align:center;font-size:28px;font-weight:900;color:#fff;">${risk.score}</div>
          ${tierBadge(risk.tier, t)}
        </div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${t.status}</div>
        <div style="font-size:20px;font-weight:700;">${off_chain.status}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${t.claims}</div>
        <div style="font-size:20px;font-weight:700;">${off_chain.claims.length} / 8</div>
      </div>
    </div>
  </div>
  <div style="background:#ffffff08;border-radius:12px;padding:20px;">
    <p style="color:#cbd5e1;font-size:13px;line-height:1.7;">${(lang === "fr" ? (scan as any).off_chain_fr?.summary : null) ?? off_chain.summary ?? t.noSummary}</p>
  </div>
  <div style="margin-top:24px;display:flex;justify-content:space-between;">
    <div style="font-size:13px;color:#7dd3fc;">${off_chain.case_id ?? "—"}</div>
    <div style="font-size:13px;color:#94a3b8;">${new Date(scanned_at).toUTCString()}</div>
  </div>
</div>

<!-- PAGE 2: CLAIMS STATUS -->
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">📋</span><h2 style="margin:0;">${t.claimsStatus}</h2></div>
  <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">${t.claimsSubtitle(risk.breakdown.claim_penalty, risk.breakdown.severity_multiplier, risk.score, off_chain.claims.length)}</p>
  <table>
    <thead><tr><th style="width:55px;">ID</th><th>${t.titleCol}</th><th style="width:110px;">Severity</th><th style="width:130px;">${t.status}</th><th style="width:160px;">Category</th></tr></thead>
    <tbody>${claimsRows}</tbody>
  </table>
  <div style="margin-top:24px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
    <strong style="color:#991b1b;">⚠ ${t.flags}:</strong>
    <span style="color:#991b1b;font-size:13px;"> ${risk.flags.join(" · ")}</span>
  </div>
</div>

<!-- PAGE 3: OFF-CHAIN EVIDENCE -->
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">🔎</span><h2 style="margin:0;">${t.offchainEvidence}</h2></div>
  ${evidenceList}
</div>

<!-- PAGE 4: DETECTIVE PACK -->
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="font-size:22px;">🕵</span><h2 style="margin:0;">${t.detectivePack}</h2></div>
  <div style="margin-bottom:20px;padding:12px 16px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;font-size:13px;">
    ${t.detectivePackSubtitle}
  </div>
  <table>
    <thead><tr><th style="width:55px;">${t.claimCol}</th><th>${t.titleCol}</th><th>${t.sourceCol}</th><th style="width:120px;">${t.tagCol}</th></tr></thead>
    <tbody>${detectiveUrls}</tbody>
  </table>
</div>

<!-- PAGE 5: MARKET SNAPSHOT -->
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">📊</span><h2 style="margin:0;">${t.marketSnapshot}</h2></div>
  <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">${t.source}: <strong>${m.source ? m.source.toUpperCase() : "—"}</strong></p>
  ${m.source === null
    ? `<div style="padding:24px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;">⚠️ ${t.marketUnavailable}</div>`
    : `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${marketRows}</tbody></table>`
  }
</div>

<!-- PAGE 6: SOURCES & METHOD -->
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">📚</span><h2 style="margin:0;">${t.sourcesMethod}</h2></div>
  <ul style="padding-left:20px;margin-bottom:32px;">${sourcesBullets}</ul>

  <h2 style="margin-bottom:16px;">🔁 ${t.howToReproduce}</h2>
  <table>
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.mint}</td><td style="padding:8px 14px;"><code style="font-size:11px;">${mint}</code></td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.timestamp}</td><td style="padding:8px 14px;">${new Date(scanned_at).toUTCString()}</td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.engine}</td><td style="padding:8px 14px;">TigerScore Engine v2 — CaseDB v1</td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.offchainSource}</td><td style="padding:8px 14px;">${off_chain.source}</td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.tier}</td><td style="padding:8px 14px;">${risk.tier}</td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.score}</td><td style="padding:8px 14px;">${risk.score}</td></tr>
      <tr><td style="padding:8px 14px;font-weight:600;color:#6b7280;">${t.claimsCount}</td><td style="padding:8px 14px;">${off_chain.claims.length}</td></tr>
    </tbody>
  </table>
</div>


<!-- PAGE 7: SCAM FAMILY GRAPH -->
${graphReport ? `
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">🕸</span><h2 style="margin:0;">${lang === "fr" ? "Famille de Scam — Graphe" : "Scam Family Graph"}</h2></div>
  <p style="color:#6b7280;font-size:12px;margin-bottom:20px;">${lang === "fr" ? "Analyse de clusters de wallets · heuristiques on-chain · Helius Developer" : "Wallet cluster analysis · on-chain heuristics · Helius Developer"} · ${lang === "fr" ? "Statut" : "Status"}: <strong style="color:#ea580c">${graphReport.overall_status}</strong></p>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
    ${[
      [lang === "fr" ? "Seeds" : "Seeds", `${graphReport.limits?.seeds_used ?? 0}/${graphReport.limits?.max_seeds ?? 50}`],
      [lang === "fr" ? "Txs analysées" : "Txs scanned", (graphReport.limits?.tx_fetched ?? 0).toLocaleString()],
      [lang === "fr" ? "Clusters" : "Clusters", graphReport.clusters?.length ?? 0],
      [lang === "fr" ? "Tokens liés" : "Related", graphReport.related_projects?.length ?? 0],
    ].map(([lbl, val]) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${lbl}</div><div style="font-size:20px;font-weight:800;color:#ea580c;">${val}</div></div>`).join("")}
  </div>

  <!-- Clusters table -->
  ${graphReport.clusters?.length > 0 ? `
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;color:#1e293b;">${lang==="fr"?"Clusters Détectés":"Clusters Detected"}</h3>
  <table style="margin-bottom:24px;">
    <thead><tr>
      <th style="width:160px;">${lang==="fr"?"Label":"Label"}</th>
      <th style="width:120px;">${lang==="fr"?"Heuristique":"Heuristic"}</th>
      <th style="width:60px;text-align:center;">${lang==="fr"?"Wallets":"Wallets"}</th>
      <th style="width:100px;text-align:center;">${lang==="fr"?"Statut":"Status"}</th>
      <th>Ref. TX</th>
    </tr></thead>
    <tbody>${(graphReport.clusters ?? []).slice(0,6).map((cl: any) => `
      <tr>
        <td style="padding:7px 10px;font-weight:600;font-size:12px;">${cl.label}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;font-family:monospace;">{{ shared_funder: "${lang==="fr"?"Financeur commun":"Shared Funder"}", co_trading: "Co-Trading", lp_overlap: "LP Overlap" }[cl.heuristic] ?? cl.heuristic}</td>
        <td style="padding:7px 10px;text-align:center;">${cl.wallets?.length ?? 0}</td>
        <td style="padding:7px 10px;text-align:center;"><span style="background:${cl.status==="CORROBORATED"?"#f9731620":"#6b728020"};color:${cl.status==="CORROBORATED"?"#ea580c":"#6b7280"};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">${cl.status}</span></td>
        <td style="padding:7px 10px;font-family:monospace;font-size:10px;color:#6b7280;">${cl.proofs?.[0]?.tx_signature?.slice(0,16) ?? "—"}…</td>
      </tr>`).join("")}
    </tbody>
  </table>` : `<p style="color:#6b7280;font-size:13px;margin-bottom:24px;">${lang==="fr"?"Aucun cluster détecté.":"No clusters detected."}</p>`}

  <!-- Related projects table -->
  ${graphReport.related_projects?.length > 0 ? `
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;color:#1e293b;">${lang==="fr"?"Projets Liés":"Related Projects"}</h3>
  <table>
    <thead><tr>
      <th>Token</th>
      <th style="width:80px;text-align:center;">${lang==="fr"?"Score":"Score"}</th>
      <th style="width:90px;text-align:center;">${lang==="fr"?"Wallets communs":"Shared wallets"}</th>
      <th>Signals</th>
      <th style="width:100px;text-align:center;">${lang==="fr"?"Statut":"Status"}</th>
    </tr></thead>
    <tbody>${(graphReport.related_projects ?? []).slice(0,8).map((p: any) => `
      <tr>
        <td style="padding:7px 10px;font-weight:600;">${p.symbol ? `${p.symbol} <span style="font-weight:400;color:#6b7280;font-size:11px;">${p.name??""}</span>` : `<code style="font-size:10px;">${p.mint?.slice(0,14)}…</code>`}</td>
        <td style="padding:7px 10px;text-align:center;font-weight:800;font-size:16px;color:${p.link_score>=70?"#dc2626":p.link_score>=40?"#ea580c":"#6b7280"};">${p.link_score}</td>
        <td style="padding:7px 10px;text-align:center;">${p.shared_wallets}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;">${(p.signals??[]).join(", ")}</td>
        <td style="padding:7px 10px;text-align:center;"><span style="background:${p.status==="CORROBORATED"?"#f9731620":"#6b728020"};color:${p.status==="CORROBORATED"?"#ea580c":"#6b7280"};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">${p.status}</span></td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  <div style="margin-top:24px;padding:12px 16px;background:#fef9ec;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#6b7280;">
    ${lang==="fr"
      ? "⚠ Les données RÉFÉRENCÉES sont observationnelles. Les données CORROBORÉES sont soutenues par des preuves de transactions on-chain. Cette analyse ne constitue pas un conseil financier ou juridique."
      : "⚠ REFERENCED data is observational only. CORROBORATED data is supported by on-chain transaction evidence. This analysis does not constitute financial or legal advice."}
  </div>
</div>` : `
<div class="page">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><span style="font-size:22px;">🕸</span><h2 style="margin:0;">${lang === "fr" ? "Famille de Scam — Graphe" : "Scam Family Graph"}</h2></div>
  <div style="padding:32px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;color:#6b7280;">
    <p style="font-size:16px;margin-bottom:8px;">📊</p>
    <p style="font-size:13px;">${lang === "fr" ? "Données graphe non disponibles pour ce token." : "Graph data unavailable for this token."}</p>
    <p style="font-size:11px;margin-top:8px;">${lang === "fr" ? "Relancez l'analyse avec HELIUS_API_KEY configuré." : "Re-run analysis with HELIUS_API_KEY configured."}</p>
  </div>
</div>`}

</body>
</html>`;
}
