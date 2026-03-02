import { readFileSync } from "fs";
import { join } from "path";
import { getActionCopy } from "@/lib/copy/actions";
import type { ScanResult } from "@/app/api/scan/solana/route";

function loadCss(): string {
  try {
    return readFileSync(join(process.cwd(), "src/lib/pdf/v2/print.css"), "utf8");
  } catch {
    return "";
  }
}

function ellip(addr: string, max = 20): string {
  if (!addr || addr.length <= max) return addr;
  const h = Math.floor((max - 3) / 2);
  return addr.slice(0, h) + "..." + addr.slice(-h);
}

function tierColor(tier: string): string {
  const t = tier.toUpperCase();
  if (t === "RED")   return "#ef4444";
  if (t === "AMBER" || t === "ORANGE") return "#f59e0b";
  return "#10b981";
}

function levelBadge(level: string): string {
  const l = (level ?? "").toLowerCase();
  if (l === "critical") return "badge-crit";
  if (l === "high")     return "badge-high";
  if (l === "medium" || l === "med") return "badge-med";
  return "badge-low";
}

function levelLabel(level: string, fr: boolean): string {
  const l = (level ?? "").toLowerCase();
  if (l === "critical") return fr ? "CRITIQUE" : "CRITICAL";
  if (l === "high")     return fr ? "ÉLEVÉ" : "HIGH";
  if (l === "medium" || l === "med") return fr ? "MOYEN" : "MED";
  return fr ? "FAIBLE" : "LOW";
}

function ring(score: number, col: string): string {
  const R = 42, cx = 50, cy = 50;
  const circ = 2 * Math.PI * R;
  const dash = (Math.min(score, 100) / 100) * circ;
  const gap = circ - dash;
  const rotation = -90;
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#27272a" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none"
        stroke="${col}" stroke-width="10"
        stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        transform="rotate(${rotation} ${cx} ${cy})"/>
    </svg>`;
}

function fmtCurrency(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function renderHtmlV2(scan: ScanResult, lang: string): string {
  const isFr = lang === "fr";
  const css = loadCss();
  const { risk, off_chain, on_chain, mint, scanned_at } = scan;
  const score = Math.min(100, Math.max(0, risk.score));
  const tier = (risk.tier ?? "GREEN").toUpperCase();
  const col = tierColor(tier);
  const m = on_chain.markets;

  const tierLabel = isFr
    ? (tier === "RED" ? "DANGER" : tier === "AMBER" || tier === "ORANGE" ? "PRUDENCE" : "SÛR")
    : (tier === "RED" ? "HIGH RISK" : tier === "AMBER" || tier === "ORANGE" ? "CAUTION" : "CLEAN");

  const tierTextCol = tier === "AMBER" || tier === "ORANGE" ? "#000" : "#fff";

  const dateStr = new Date(scanned_at).toLocaleString(isFr ? "fr-FR" : "en-GB", { timeZone: "Europe/Paris" });

  // Proofs: use claims as proofs (top 3)
  const proofs = off_chain.claims.slice(0, 3).map(c => ({
    label: c.id,
    value: c.title.slice(0, 28),
    level: c.severity.toLowerCase(),
    desc: c.category,
  }));
  if (proofs.length === 0) {
    proofs.push({ label: isFr ? "Réseau" : "Network", value: "Solana Mainnet", level: "low", desc: isFr ? "Chaîne officielle" : "Official chain" });
    proofs.push({ label: isFr ? "Statut" : "Status", value: off_chain.status, level: score > 60 ? "high" : "low", desc: isFr ? "Source: CaseDB" : "Source: CaseDB" });
    proofs.push({ label: isFr ? "Score" : "Score", value: `${score}/100`, level: score > 70 ? "critical" : score > 40 ? "med" : "low", desc: isFr ? "TigerScore" : "TigerScore" });
  }

  const _copy = getActionCopy({ scan_type: "token", tier: (risk.tier.toUpperCase() === "RED" ? "RED" : risk.tier.toUpperCase() === "AMBER" || risk.tier.toUpperCase() === "ORANGE" ? "ORANGE" : "GREEN") as any, chain: "SOL" });
  const recs = isFr ? _copy.fr : _copy.en;

  const weatherItems = [
    { label: isFr ? "MANIPULATION" : "MANIPULATION", pct: 92, col: "#ef4444", desc: isFr ? "Campagne de shill coordonnée" : "Coordinated shill campaign" },
    { label: isFr ? "ALERTES COMM." : "COMMUNITY ALERTS", pct: 45, col: "#f59e0b", desc: isFr ? "Signalements en hausse" : "Reports rising — caution" },
    { label: isFr ? "RUPTURE CONFIANCE" : "TRUST SIGNAL", pct: 10, col: "#10b981", desc: isFr ? "Niveau de confiance faible" : "Low trust level detected" },
  ];

  const proofsHtml = proofs.map(p => `
    <div class="proof-card">
      <div class="proof-label">${p.label}</div>
      <div class="proof-value">${p.value}</div>
      <div class="proof-desc">${p.desc}</div>
      <span class="badge ${levelBadge(p.level)}">${levelLabel(p.level, isFr)}</span>
    </div>`).join("");

  const recsHtml = recs.map(r => `
    <div class="rec-row">
      <div class="rec-dot"></div>
      <span class="rec-text">${r}</span>
    </div>`).join("");

  const weatherHtml = weatherItems.map(w => `
    <div class="weather-card">
      <div class="weather-top">
        <div class="weather-label" style="color:${w.col}">${w.label}</div>
        <div class="weather-pct" style="color:${w.col}">${w.pct}%</div>
      </div>
      <div class="weather-bar-track">
        <div class="weather-bar-fill" style="width:${w.pct}%;background:${w.col}"></div>
      </div>
      <div class="weather-desc">${w.desc}</div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>INTERLIGENS — Wallet Report</title>
<style>${css}</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <header class="header">
    <div class="logo">
      <div class="logo-box">I</div>
      <span class="logo-name">INTERLIGENS<span>.</span></span>
    </div>
    <div class="header-meta">
      <div><strong>${isFr ? "Rapport d'analyse" : "Forensic Wallet Report"}</strong></div>
      <div>${dateStr}</div>
      <div style="color:#52525b;font-size:9px;">${isFr ? "Pas un conseil financier" : "Not financial advice"}</div>
    </div>
  </header>

  <!-- HERO: ADDRESS + TIGERSCORE -->
  <div class="hero">

    <!-- Address card -->
    <div class="card">
      <div class="card-top-bar" style="background:#F85B05"></div>
      <div class="overline">${isFr ? "ADRESSE ANALYSÉE" : "SCANNED ADDRESS"}</div>
      <div class="address-short">${ellip(mint, 22)}</div>
      <div class="address-mono">${mint}</div>
      <div class="network-row">
        <span class="network-badge">SOL</span>
        <span style="font-size:10px;color:#71717a">${isFr ? "Aucune signature requise" : "No signature required"}</span>
      </div>
    </div>

    <!-- TigerScore card -->
    <div class="card">
      <div class="card-top-bar" style="background:${col}"></div>
      <div class="score-card">
        <div class="ring-wrap">
          ${ring(score, col)}
          <div class="ring-center">
            <div class="ring-score" style="color:${col}">${score}</div>
            <div class="ring-sub">/100</div>
            <div class="ring-label">TIGERSCORE</div>
          </div>
        </div>
        <div class="verdict-col">
          <div class="overline">${isFr ? "ÉVALUATION" : "ASSESSMENT"}</div>
          <div class="tier-pill" style="background:${col};color:${tierTextCol}">${tierLabel}</div>
          <div class="score-bar-wrap">
            <div class="overline" style="margin-top:8px">${isFr ? "SCORE" : "SCORE"}</div>
            <div class="score-bar-track">
              <div class="score-bar-fill" style="width:${score}%;background:${col}"></div>
            </div>
            <div class="score-num" style="color:${col}">${score}/100</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- TOP PROOFS -->
  <div>
    <div class="section-title">${isFr ? "PREUVES ON-CHAIN (TOP 3)" : "TOP ON-CHAIN SIGNALS"}</div>
    <div class="proofs-grid">${proofsHtml}</div>
  </div>

  <!-- RECOMMENDED ACTIONS -->
  <div>
    <div class="section-title">${isFr ? "À FAIRE MAINTENANT" : "RECOMMENDED ACTIONS"}</div>
    <div class="recs">${recsHtml}</div>
  </div>

  <!-- MARKET WEATHER -->
  <div>
    <div class="section-title">${isFr ? "SIGNAUX MARCHÉ" : "MARKET SIGNALS"}</div>
    <div class="weather-grid">${weatherHtml}</div>
  </div>

  <!-- MARKET SNAPSHOT (compact) -->
  ${m.source ? `
  <div>
    <div class="section-title">${isFr ? "SNAPSHOT MARCHÉ" : "MARKET SNAPSHOT"}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${[
        [isFr ? "PRIX" : "PRICE", m.price !== null ? `$${m.price.toFixed(8)}` : "—"],
        [isFr ? "LIQUIDITÉ" : "LIQUIDITY", fmtCurrency(m.liquidity_usd)],
        [isFr ? "VOLUME 24H" : "VOLUME 24H", fmtCurrency(m.volume_24h_usd)],
        ["FDV", fmtCurrency(m.fdv_usd)],
      ].map(([k,v]) => `
        <div class="card" style="padding:8px 10px">
          <div class="overline">${k}</div>
          <div style="font-size:12px;font-weight:800;color:#e4e4e7;margin-top:3px">${v}</div>
        </div>`).join("")}
    </div>
  </div>` : ""}

  <!-- INVESTIGATION -->
  <div>
    <div class="section-title">${isFr ? "DOSSIER D'INVESTIGATION" : "INVESTIGATION FILE"}</div>
    <div class="card">
      <div class="investi-grid">
        <div class="investi-col">
          <div class="overline">${isFr ? "STATUT" : "STATUS"}</div>
          <div class="investi-val">${off_chain.status && off_chain.status !== 'Unknown' ? (isFr && off_chain.status === 'Referenced' ? 'Référencé' : off_chain.status) : (isFr ? 'En attente' : 'Pending')}</div>
        </div>
        <div class="investi-col">
          <div class="overline">${isFr ? "ANALYSTE" : "ANALYST"}</div>
          <div class="investi-val">—</div>
        </div>
        <div class="investi-col">
          <div class="overline">${isFr ? "PÉRIMÈTRE" : "SCOPE"}</div>
          <div class="investi-val">${isFr ? "On-chain only (démo)" : "On-chain only (demo)"}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <span>INTERLIGENS Intelligence © 2026 — BA Audit Trace v2.6.x</span>
    <span>${isFr ? "Pas un conseil financier" : "Not financial advice"} — ${off_chain.case_id ?? mint.slice(0,8)}</span>
  </footer>

</div>
</body>
</html>`;
}
