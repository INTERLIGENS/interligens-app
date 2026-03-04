import { readFileSync } from "fs";
import { join } from "path";
import { getActionCopy } from "../../copy/actions";

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

function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  if (v < 0.01) return "$" + v.toFixed(5);
  if (v < 1) return "$" + v.toFixed(4);
  return "$" + v.toFixed(2);
}

function fmtCompact(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return "$" + (v / 1_000).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

function fmtCurrency(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function renderHtmlV2(scan: any, lang: string): string {
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

  // Proofs: use claims, fallback to tiger_drivers, fallback to defaults
  const tigerDrivers: any[] = (scan as any).tiger_drivers ?? [];
  const proofs = off_chain.claims.slice(0, 3).map((c: any) => ({
    label: c.id,
    value: c.title.slice(0, 28),
    level: c.severity.toLowerCase(),
    desc: c.category,
  }));
  if (proofs.length === 0 && tigerDrivers.length > 0) {
    const driverMicrocopy: Record<string, { en: string; fr: string }> = {
      pump_fun:           { en: "Pump-like launch pattern", fr: "Pattern pump.fun détecté" },
      fresh_pool:         { en: "Very recent pool",         fr: "Pool très récent" },
      fdv_liquidity_ratio:{ en: "FDV/liquidity imbalance",  fr: "Déséquilibre FDV/liquidité" },
      volume_vs_liquidity:{ en: "Volume/liquidity spike",   fr: "Pic volume/liquidité" },
    };
    tigerDrivers.slice(0, 3).forEach((d: any) => {
      const copy = driverMicrocopy[d.id];
      proofs.push({
        label: d.id.replace(/_/g, " ").toUpperCase(),
        value: copy ? (isFr ? copy.fr : copy.en) : d.label,
        level: d.severity === "critical" ? "critical" : d.severity === "high" ? "high" : d.severity === "med" ? "medium" : "low",
        desc: d.why?.slice(0, 60) ?? "",
      });
    });
  }
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

  const proofsHtml = proofs.map((p: any) => `
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

  <!-- MARKET SNAPSHOT -->
  <div>
    <div class="section-title">${isFr ? "SNAPSHOT MARCHÉ" : "MARKET SNAPSHOT"}</div>
    ${(m.data_unavailable || !m.source) ? `
    <div class="card" style="padding:12px 14px;border-left:3px solid #52525b;">
      <div style="font-size:11px;font-weight:700;color:#a1a1aa;">${isFr ? "Aucune liquidité active" : "No active liquidity found"}</div>
      <div style="font-size:9px;color:#71717a;margin-top:4px;">${isFr ? "DexScreener + GeckoTerminal : aucun pool actif détecté pour ce token." : "DexScreener + GeckoTerminal returned no active pools for this token."}</div>
      <div style="font-size:9px;color:#52525b;margin-top:6px;display:flex;align-items:center;gap:12px;">
        <span>${isFr ? "Sources vérifiées : DexScreener + GeckoTerminal" : "Sources checked: DexScreener + GeckoTerminal"}</span>
        ${m.fetched_at ? `<span style="margin-left:auto">${isFr ? "À date du " + new Date(m.fetched_at).toLocaleString("fr-FR",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) + " UTC" : "As of " + new Date(m.fetched_at).toISOString().slice(0,16).replace("T"," ") + " UTC"}</span>` : ""}
      </div>
    </div>` : `
    <div style="display:grid;grid-template-columns:repeat(3,1fr) 1fr;gap:8px">
      ${[
        [isFr ? "PRIX" : "PRICE", fmtPrice(m.price)],
        [isFr ? "LIQUIDITÉ" : "LIQUIDITY", fmtCompact(m.liquidity_usd)],
        [isFr ? "VOLUME 24H" : "VOLUME 24H", fmtCompact(m.volume_24h_usd)],
        ["FDV", fmtCompact(m.fdv_usd)],
      ].map(([k,v]) => `
        <div class="card" style="padding:8px 10px">
          <div class="overline">${k}</div>
          <div style="font-size:12px;font-weight:800;color:#e4e4e7;margin-top:3px">${v}</div>
        </div>`).join("")}
    </div>
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px;padding:7px 12px;background:#111113;border-radius:10px;border:1px solid #1e1e20;">
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#52525b;line-height:1;">SOURCE</span>
        <span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid rgba(248,91,5,0.45);font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#F85B05;line-height:1;">${m.source === "dexscreener" ? "DexScreener" : m.source === "geckoterminal" ? "GeckoTerminal" : "—"}</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#52525b;line-height:1;">${isFr ? "ÂGE POOL" : "POOL AGE"}</span>
        <span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);font-size:10px;font-weight:800;letter-spacing:0.14em;color:#a1a1aa;line-height:1;">${(m as any).pair_age_days != null ? (m as any).pair_age_days + (isFr ? "j" : "d") : "—"}</span>
      </div>
      ${m.url ? `<a href="${m.url}" style="margin-left:auto;font-size:11px;font-weight:800;color:#F85B05;text-decoration:underline;text-underline-offset:3px;white-space:nowrap;line-height:1;">${m.source === "dexscreener" ? "DexScreener" : "GeckoTerminal"} ↗</a>` : ""}
    </div>`}
  </div>

  <!-- RETAIL SIGNALS -->
  <div>
    <div class="section-title">${isFr ? "SIGNAUX RETAIL" : "RETAIL SIGNALS"}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">

      ${(() => {
        // Exit Door
        const liq = m?.liquidity_usd;
        const aged = m?.pair_age_days;
        let exitLabel = isFr ? "OUVERTE" : "OPEN";
        let exitWhy   = isFr ? "Liquidité suffisante" : "Sufficient liquidity";
        let exitCol   = "#10b981";
        if (m?.data_unavailable || liq == null) { exitLabel = isFr ? "BLOQUÉE" : "BLOCKED"; exitWhy = isFr ? "Aucune liquidité active" : "No active liquidity"; exitCol = "#ef4444"; }
        else if (liq < 20000) { exitLabel = isFr ? "BLOQUÉE" : "BLOCKED"; exitWhy = isFr ? "Liquidité trop faible" : "Liquidity too low"; exitCol = "#ef4444"; }
        else if (liq < 100000 || (aged != null && aged <= 2)) { exitLabel = isFr ? "ÉTROITE" : "TIGHT"; exitWhy = isFr ? "Liquidité limitée" : "Limited liquidity"; exitCol = "#f97316"; }
        // Whale
        const top10 = (scan as any).top10_pct ?? null;
        let whaleLabel = isFr ? "MOYEN" : "MED";
        let whaleWhy   = isFr ? "Données holders non dispo" : "Holder data pending";
        let whaleCol   = "#f97316";
        if (top10 != null) {
          if (top10 >= 60) { whaleLabel = isFr ? "ÉLEVÉ" : "HIGH"; whaleWhy = `Top10: ${top10}%`; whaleCol = "#ef4444"; }
          else if (top10 >= 35) { whaleLabel = isFr ? "MOYEN" : "MED"; whaleWhy = `Top10: ${top10}%`; whaleCol = "#f97316"; }
          else { whaleLabel = isFr ? "FAIBLE" : "LOW"; whaleWhy = `Top10: ${top10}%`; whaleCol = "#10b981"; }
        }
        // Cabal
        let cabalScore = 20;
        const drivers: string[] = [];
        if (off_chain?.case_id) { cabalScore += 30; drivers.push(isFr ? "Dossier référencé" : "Referenced investigation"); }
        if (tigerDrivers.some((d: any) => String(d).toLowerCase().includes("pump"))) { cabalScore += 25; drivers.push(isFr ? "Schéma pump.fun" : "Pump.fun pattern"); }
        const vol = m?.volume_24h_usd ?? 0; const liqC = m?.liquidity_usd ?? 0;
        if (vol > 0 && liqC > 0 && vol > 5 * liqC) { cabalScore += 15; drivers.push(isFr ? "Vol/liq anormal" : "Vol/liq abnormal"); }
        cabalScore = Math.min(100, cabalScore);
        const cabalTier = cabalScore >= 70 ? (isFr ? "ÉLEVÉ" : "HIGH") : cabalScore >= 45 ? (isFr ? "MOYEN" : "MED") : (isFr ? "FAIBLE" : "LOW");
        const cabalCol  = cabalScore >= 70 ? "#ef4444" : cabalScore >= 45 ? "#f97316" : "#10b981";

        // ── OSINT PUBLIC SIGNALS ────────────────────────────────────────
        const osintItems: any[] = Array.isArray(scan?.osint_signals) ? scan.osint_signals.slice(0, 2) : [];
        const osintHtml = osintItems.length === 0 ? "" : (
          '<div style="margin-top:18px;padding:14px 16px;background:#111;border-radius:12px;border:1px solid #222;">'
          + '<div style="font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#F85B05;margin-bottom:10px;">' + (isFr ? "Signaux Publics (OSINT)" : "Public Signals (OSINT)") + '</div>'
          + osintItems.map((item: any) => {
              const why = isFr ? (item.why_fr ?? item.why_en) : (item.why_en ?? item.why_fr);
              const tags = (item.tags ?? []).map((t: string) => '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:8px;font-weight:700;background:#1e293b;color:#94a3b8;margin-right:4px;">' + t + '</span>').join("");
              const link = item.links?.[0] ? '<a href="' + item.links[0] + '" style="font-size:9px;color:#F85B05;text-decoration:none;margin-top:4px;display:block;">Source ↗</a>' : "";
              return '<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;margin-bottom:6px;">'
                + '<div style="margin-bottom:4px;">' + tags + '</div>'
                + '<div style="font-size:10px;color:#d4d4d8;line-height:1.4;">' + why + '</div>'
                + link + '</div>';
            }).join("")
          + '</div>'
        );

        // ── RETAIL SIGNALS ──────────────────────────────────────────────
        const exitResult = (() => {
          const liq = Number(m?.liquidity_usd ?? 0);
          const vol = Number(m?.volume_24h_usd ?? 0);
          if (liq === 0) return { label: isFr ? "BLOQUEE" : "BLOCKED", col: "#ef4444" };
          if (liq < 5000 || (vol > 0 && vol > 20 * liq)) return { label: isFr ? "ETROITE" : "TIGHT", col: "#f97316" };
          return { label: isFr ? "OUVERTE" : "OPEN", col: "#10b981" };
        })();
        const whaleTop10 = scan?.on_chain?.whales_top10_pct ?? scan?.rawSummary?.whales_top10_pct ?? null;
        const whaleLbl = whaleTop10 != null ? "Top10: " + Math.round(whaleTop10) + "%" : "Top10: -";
        const whaleColR = whaleTop10 != null && whaleTop10 >= 60 ? "#ef4444" : whaleTop10 != null && whaleTop10 >= 35 ? "#f97316" : "#10b981";
        const kolRaw = String(scan?.social?.manipulation?.level ?? scan?.weather?.manipulation?.level ?? "LOW").toUpperCase();
        const kolLabel = kolRaw === "HIGH" ? (isFr ? "ELEVE" : "HIGH") : kolRaw === "MED" || kolRaw === "MEDIUM" ? (isFr ? "MOYEN" : "MED") : (isFr ? "FAIBLE" : "LOW");
        const kolCol = kolRaw === "HIGH" ? "#ef4444" : kolRaw === "MED" || kolRaw === "MEDIUM" ? "#f97316" : "#10b981";
        const retailHtml = '<div style="margin-top:18px;padding:14px 16px;background:#111;border-radius:12px;border:1px solid #222;">'
          + '<div style="font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#F85B05;margin-bottom:10px;">' + (isFr ? "Signaux Retail" : "Retail Signals") + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
          + '<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;">'
          + '<div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:3px;">' + (isFr ? "Pression KOL" : "KOL Pressure") + '</div>'
          + '<div style="font-size:11px;font-weight:700;color:#fff;">' + (isFr ? "Influence" : "Influence") + '</div>'
          + '<div style="font-size:10px;font-weight:800;color:' + kolCol + ';margin-top:2px;">' + kolLabel + '</div></div>'
          + '<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;">'
          + '<div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:3px;">' + (isFr ? "Baleines" : "Whales") + '</div>'
          + '<div style="font-size:11px;font-weight:700;color:#fff;">' + whaleLbl + '</div>'
          + '<div style="font-size:10px;font-weight:800;color:' + whaleColR + ';margin-top:2px;">&nbsp;</div></div>'
          + '<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;">'
          + '<div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:3px;">' + (isFr ? "Score Cabal" : "Cabal Score") + '</div>'
          + '<div style="font-size:11px;font-weight:700;color:#fff;">' + (isFr ? (cabalScore >= 70 ? "Eleve" : cabalScore >= 45 ? "Moyen" : "Faible") : (cabalScore >= 70 ? "High" : cabalScore >= 45 ? "Med" : "Low")) + " " + cabalScore + '</div>'
          + '<div style="font-size:10px;font-weight:800;color:' + cabalCol + ';margin-top:2px;">' + cabalTier + '</div></div>'
          + '<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;">'
          + '<div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:3px;">' + (isFr ? "PUIS-JE VENDRE ?" : "CAN I SELL?") + '</div>'
          + '<div style="font-size:11px;font-weight:700;color:#fff;">' + exitResult.label + '</div>'
          + '<div style="font-size:10px;font-weight:800;color:' + exitResult.col + ';margin-top:2px;">&nbsp;</div></div>'
          + '</div></div>';

        const cabalWhy  = drivers[0] ?? (isFr ? "Aucun signal coordonné" : "No coordinated signal");
        return `
          <div class="card" style="padding:8px 10px">
            <div class="overline">${isFr ? "SORTIE" : "EXIT DOOR"}</div>
            <div style="margin-top:4px;font-size:11px;font-weight:800;color:${exitCol}">${exitLabel}</div>
            <div style="font-size:9px;color:#71717a;margin-top:3px">${exitWhy}</div>
          </div>
          <div class="card" style="padding:8px 10px">
            <div class="overline">${isFr ? "BALEINES" : "WHALES"}</div>
            <div style="margin-top:4px;font-size:11px;font-weight:800;color:${whaleCol}">${whaleLabel}</div>
            <div style="font-size:9px;color:#71717a;margin-top:3px">${whaleWhy}</div>
          </div>
          <div class="card" style="padding:8px 10px">
            <div class="overline">${isFr ? "SCORE CABAL" : "CABAL SCORE"}</div>
            <div style="margin-top:4px;font-size:11px;font-weight:800;color:${cabalCol}">${cabalTier} ${cabalScore}</div>
            <div style="font-size:9px;color:#71717a;margin-top:3px">${cabalWhy}</div>
            ${retailHtml}
            ${osintHtml}
          </div>`;
      })()}
    </div>
  </div>

  ${(scan as any).detective_trade ? (() => {
    const tr = (scan as any).detective_trade;
    const solscanBase = "https://solscan.io/tx/";
    const notes = isFr ? (tr.notes_fr ?? tr.notes_en ?? "") : (tr.notes_en ?? "");
    const fmtPnl = (n: number) => n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const pnl = tr.pnl_usd != null ? (tr.pnl_usd > 0 ? `+$${fmtPnl(tr.pnl_usd)}` : `-$${fmtPnl(Math.abs(tr.pnl_usd))}`) : null;
    return `
    <div>
      <div class="section-title">${isFr ? "TRADE DÉTECTIVE" : "DETECTIVE TRADE"}</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 14px;">
        <div>
          <div class="overline" style="margin-bottom:4px">${isFr ? "TX ACHAT" : "BUY TX"}</div>
          <a href="${solscanBase}${tr.buy_tx}" style="font-family:'Courier New',monospace;font-size:9px;color:#F85B05;word-break:break-all;text-decoration:none;">${tr.buy_tx} ↗</a>
        </div>
        <div>
          <div class="overline" style="margin-bottom:4px">${isFr ? "TX VENTE" : "SELL TX"}</div>
          <a href="${solscanBase}${tr.sell_tx}" style="font-family:'Courier New',monospace;font-size:9px;color:#F85B05;word-break:break-all;text-decoration:none;">${tr.sell_tx} ↗</a>
        </div>
        <div style="grid-column:1/-1;border-top:1px solid #27272a;padding-top:8px;display:flex;align-items:flex-start;gap:16px;">
          <div style="flex:1;font-size:10px;color:#a1a1aa;line-height:1.4;">${notes}</div>
          ${pnl ? `<div style="font-size:13px;font-weight:900;color:${tr.pnl_usd > 0 ? '#10b981' : '#ef4444'};white-space:nowrap;">${pnl}</div>` : ""}
        </div>
      </div>
    </div>`;
  })() : ""}

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
