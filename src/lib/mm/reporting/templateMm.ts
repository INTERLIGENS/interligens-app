// ─── MM forensic PDF template (Phase 10) ─────────────────────────────────
// Pure string-builder. Returns a self-contained HTML document with inline
// CSS ready for Puppeteer. Dark palette mirrors the CaseFile PDF style:
//   BG_DARK     #0A0C10
//   ACCENT_CYAN #00E5FF   ← PDF-only; the web app never uses cyan.
//   ACCENT_AMBER #FFB800
//   TEXT        #E6ECEF / muted #6B7280
//
// This module has ZERO I/O. It takes a fully-resolved snapshot (produced
// by pdfReport.ts) and produces the HTML. Tests pass in fixtures directly.

import type {
  MmAttribMethod,
  MmChain,
  MmClaimType,
  MmCredTier,
  MmRiskBand,
  MmSourceType,
  MmStatus,
} from "../types";

// ─── Input shape ──────────────────────────────────────────────────────────

export interface MmReportEntity {
  slug: string;
  name: string;
  legalName: string | null;
  jurisdiction: string | null;
  foundedYear: number | null;
  founders: string[];
  status: MmStatus;
  riskBand: MmRiskBand;
  defaultScore: number;
  publicSummary: string;
  publicSummaryFr: string | null;
  workflow: string;
  publishedAt: Date | string | null;
  updatedAt: Date | string;
}

export interface MmReportSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  sourceType: MmSourceType;
  credibilityTier: MmCredTier;
  publishedAt: Date | string | null;
}

export interface MmReportClaim {
  id: string;
  claimType: MmClaimType;
  text: string;
  textFr: string | null;
  jurisdiction: string | null;
  orderIndex: number;
  source: MmReportSource;
}

export interface MmReportAttribution {
  id: string;
  walletAddress: string;
  chain: MmChain;
  attributionMethod: MmAttribMethod;
  confidence: number;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  sourceTitle?: string | null;
}

export interface MmReportScanSummary {
  subjectId: string;
  chain: MmChain;
  displayScore: number;
  band: MmRiskBand;
  confidence: string;
  coverage: string;
  dominantDriver: string;
  computedAt: Date | string;
  signalsCount: number;
  topSignals: Array<{ type: string; severity: string; description?: string }>;
  detectorScores: Array<{ detectorType: string; score: number }>;
}

export interface MmReportClusterRelation {
  internalClusterId: string;
  memberCount: number;
  sharedTokens: string[];
  rootWallet: string;
  members: string[];
}

export interface MmReportInput {
  entity: MmReportEntity;
  claims: MmReportClaim[];
  attributions: MmReportAttribution[];
  scans: MmReportScanSummary[];
  clusters: MmReportClusterRelation[];
  generatedAt: Date | string;
}

// ─── Primitives ──────────────────────────────────────────────────────────

const BG_DARK = "#0A0C10";
const BG_CARD = "#11151C";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#E6ECEF";
const MUTED = "#8A93A1";
const ACCENT_CYAN = "#00E5FF";
const ACCENT_AMBER = "#FFB800";
const DANGER = "#EF4444";
const WARNING = "#F59E0B";

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function ellipsis(addr: string, head = 8, tail = 6): string {
  if (!addr || addr.length <= head + tail + 3) return addr;
  return addr.slice(0, head) + "…" + addr.slice(-tail);
}

function explorerLink(chain: MmChain, address: string): string {
  switch (chain) {
    case "SOLANA":
      return `https://solscan.io/account/${address}`;
    case "ETHEREUM":
      return `https://etherscan.io/address/${address}`;
    case "BASE":
      return `https://basescan.org/address/${address}`;
    case "ARBITRUM":
      return `https://arbiscan.io/address/${address}`;
    case "OPTIMISM":
      return `https://optimistic.etherscan.io/address/${address}`;
    case "BNB":
      return `https://bscscan.com/address/${address}`;
    case "POLYGON":
      return `https://polygonscan.com/address/${address}`;
    default:
      return `https://etherscan.io/address/${address}`;
  }
}

function statusBadge(status: MmStatus): { bg: string; label: string } {
  const L: Record<MmStatus, { bg: string; label: string }> = {
    CONVICTED: { bg: DANGER, label: "CONVICTED" },
    CHARGED: { bg: DANGER, label: "CHARGED" },
    SETTLED: { bg: WARNING, label: "SETTLED" },
    INVESTIGATED: { bg: WARNING, label: "INVESTIGATED" },
    DOCUMENTED: { bg: ACCENT_AMBER, label: "DOCUMENTED" },
    OBSERVED: { bg: MUTED, label: "OBSERVED" },
  };
  return L[status];
}

function bandColor(band: MmRiskBand): string {
  const L: Record<MmRiskBand, string> = {
    RED: DANGER,
    ORANGE: WARNING,
    YELLOW: ACCENT_AMBER,
    GREEN: "#22C55E",
  };
  return L[band];
}

function credTierLabel(tier: MmCredTier): string {
  return tier === "TIER_1" ? "TIER 1 · OFFICIAL" : tier === "TIER_2" ? "TIER 2 · PRESS" : "TIER 3 · OSINT";
}

function claimIcon(type: MmClaimType): string {
  if (type === "FACT") return "✓";
  if (type === "ALLEGATION") return "!";
  if (type === "INFERENCE") return "◈";
  return "↩";
}

// ─── Styles ──────────────────────────────────────────────────────────────

function baseStyles(): string {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  html, body {
    background: ${BG_DARK};
    color: ${TEXT};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif;
    font-size: 11.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    page-break-after: always;
    padding: 32pt 40pt;
    min-height: 297mm;
    width: 210mm;
  }
  .page:last-child { page-break-after: auto; }

  h1 { font-size: 28pt; font-weight: 900; letter-spacing: -0.5pt; color: ${TEXT}; }
  h2 { font-size: 11pt; letter-spacing: 3pt; font-weight: 900; color: ${ACCENT_CYAN}; text-transform: uppercase; margin-bottom: 12pt; }
  h3 { font-size: 13pt; font-weight: 800; color: ${TEXT}; margin-top: 18pt; margin-bottom: 6pt; }

  .small { font-size: 8.5pt; color: ${MUTED}; letter-spacing: 1pt; text-transform: uppercase; font-weight: 700; }
  .muted { color: ${MUTED}; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5pt; }

  .badge {
    display: inline-block;
    padding: 3pt 8pt;
    font-size: 8pt;
    letter-spacing: 2pt;
    font-weight: 900;
    text-transform: uppercase;
    border-radius: 2pt;
    color: #000;
  }

  .card {
    background: ${BG_CARD};
    border: 1pt solid ${BORDER};
    border-radius: 3pt;
    padding: 14pt;
    margin-bottom: 10pt;
  }

  .kv {
    display: grid;
    grid-template-columns: 160pt 1fr;
    gap: 6pt 14pt;
    font-size: 10.5pt;
  }
  .kv dt { color: ${MUTED}; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 1.5pt; font-weight: 700; }
  .kv dd { color: ${TEXT}; }

  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { padding: 6pt 9pt; border-bottom: 1pt solid ${BORDER}; text-align: left; }
  th { color: ${MUTED}; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 1.5pt; font-weight: 700; }

  .claim {
    display: flex;
    gap: 12pt;
    padding: 12pt 0;
    border-top: 1pt solid ${BORDER};
  }
  .claim:first-child { border-top: none; }
  .claim-icon {
    width: 22pt; height: 22pt;
    border: 1pt solid ${ACCENT_CYAN};
    color: ${ACCENT_CYAN};
    border-radius: 3pt;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; flex-shrink: 0;
  }
  .claim-icon.allegation { border-color: ${ACCENT_AMBER}; color: ${ACCENT_AMBER}; }
  .claim-icon.inference  { border-color: #A78BFA; color: #A78BFA; }
  .claim-icon.response   { border-color: ${WARNING}; color: ${WARNING}; }
  .claim-body { flex: 1; }
  .claim-head {
    font-size: 8pt; letter-spacing: 2pt; font-weight: 900;
    color: ${ACCENT_CYAN}; text-transform: uppercase; margin-bottom: 4pt;
  }
  .claim-head.allegation { color: ${ACCENT_AMBER}; }
  .claim-head.inference  { color: #A78BFA; }
  .claim-head.response   { color: ${WARNING}; }
  .claim-source {
    font-size: 9pt; color: ${ACCENT_CYAN}; margin-top: 4pt;
  }

  footer {
    color: ${MUTED};
    font-size: 8.5pt;
    border-top: 1pt solid ${BORDER};
    padding-top: 12pt;
    margin-top: 24pt;
  }
  `;
}

// ─── Page sections ───────────────────────────────────────────────────────

function coverPage(input: MmReportInput): string {
  const st = statusBadge(input.entity.status);
  const bandColorHex = bandColor(input.entity.riskBand);
  return `
  <section class="page" style="display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      <div style="display:flex;align-items:center;gap:10pt;margin-bottom:40pt;">
        <span style="font-size:11pt;letter-spacing:6pt;font-weight:900;color:${ACCENT_AMBER};">INTERLIGENS</span>
        <span style="font-size:10pt;letter-spacing:4pt;color:${MUTED};">/ MM INTELLIGENCE</span>
      </div>
      <div class="small" style="color:${ACCENT_CYAN};margin-bottom:16pt;">MARKET MAKER INTELLIGENCE REPORT</div>
      <h1 style="font-size:44pt;letter-spacing:-1pt;line-height:1.02;">${escapeHtml(input.entity.name)}</h1>
      ${input.entity.legalName && input.entity.legalName !== input.entity.name
        ? `<div style="color:${MUTED};font-size:11pt;margin-top:8pt;">${escapeHtml(input.entity.legalName)}</div>`
        : ""}
      <div style="display:flex;gap:10pt;margin-top:28pt;">
        <span class="badge" style="background:${st.bg};">${st.label}</span>
        <span class="badge" style="background:${bandColorHex};color:#000;">${input.entity.riskBand}</span>
        <span class="badge" style="background:${ACCENT_CYAN};">SCORE ${input.entity.defaultScore}</span>
      </div>
    </div>
    <div>
      <div class="small" style="margin-bottom:6pt;">Generated</div>
      <div style="font-size:13pt;">${fmtDate(input.generatedAt)}</div>
      <div class="small" style="color:${WARNING};margin-top:20pt;">CONFIDENTIEL — INTERLIGENS</div>
    </div>
  </section>
  `;
}

function executiveSummary(input: MmReportInput): string {
  const e = input.entity;
  return `
  <section class="page">
    <h2>Résumé exécutif</h2>
    <div class="card">
      <dl class="kv">
        <dt>Nom légal</dt><dd>${escapeHtml(e.legalName ?? e.name)}</dd>
        <dt>Juridiction</dt><dd>${escapeHtml(e.jurisdiction ?? "—")}</dd>
        <dt>Fondée en</dt><dd>${e.foundedYear ?? "—"}</dd>
        <dt>Fondateurs</dt><dd>${e.founders.length ? escapeHtml(e.founders.join(", ")) : "—"}</dd>
        <dt>Statut procédural</dt><dd><span class="badge" style="background:${statusBadge(e.status).bg};">${statusBadge(e.status).label}</span></dd>
        <dt>Risk band</dt><dd><span class="badge" style="background:${bandColor(e.riskBand)};color:#000;">${e.riskBand}</span> — score par défaut ${e.defaultScore}</dd>
        <dt>Wallets attribués</dt><dd>${input.attributions.length}</dd>
        <dt>Signaux détectés</dt><dd>${input.scans.reduce((s, x) => s + x.signalsCount, 0)}</dd>
      </dl>
    </div>
    <h3>Synthèse publique</h3>
    <p style="color:${TEXT};">${escapeHtml(e.publicSummaryFr ?? e.publicSummary)}</p>
  </section>
  `;
}

function claimSection(
  title: string,
  iconClass: "fact" | "allegation" | "inference" | "response",
  label: string,
  claims: MmReportClaim[],
): string {
  if (claims.length === 0) return "";
  return `
  <section class="page">
    <h2>${escapeHtml(title)}</h2>
    <div class="card" style="padding:0;">
      ${claims
        .map((c) => {
          const text = c.textFr ?? c.text;
          return `
      <div class="claim" style="padding-left:14pt;padding-right:14pt;">
        <div class="claim-icon ${iconClass}">${claimIcon(c.claimType)}</div>
        <div class="claim-body">
          <div class="claim-head ${iconClass}">${label}${c.jurisdiction ? " · " + escapeHtml(c.jurisdiction) : ""}</div>
          <div>${escapeHtml(text)}</div>
          <div class="claim-source">→ ${escapeHtml(c.source.publisher)} — ${escapeHtml(c.source.title)} (${credTierLabel(c.source.credibilityTier)})</div>
        </div>
      </div>`;
        })
        .join("")}
    </div>
  </section>
  `;
}

function walletsSection(input: MmReportInput): string {
  const rows = input.attributions
    .filter((a) => a.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence);
  if (rows.length === 0) {
    return `
    <section class="page">
      <h2>Wallets attribués</h2>
      <p class="muted">Aucun wallet attribué à cette entité avec confidence ≥ 0.70.</p>
    </section>`;
  }
  return `
  <section class="page">
    <h2>Wallets attribués (${rows.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Adresse</th>
          <th>Chain</th>
          <th>Méthode</th>
          <th>Confiance</th>
          <th>Attribution</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (a) => `
        <tr>
          <td class="mono"><a style="color:${ACCENT_CYAN};text-decoration:none;" href="${explorerLink(a.chain, a.walletAddress)}">${escapeHtml(ellipsis(a.walletAddress))}</a></td>
          <td>${a.chain}</td>
          <td>${escapeHtml(a.attributionMethod)}</td>
          <td>${(a.confidence * 100).toFixed(0)}%</td>
          <td class="muted">${fmtDate(a.reviewedAt ?? a.createdAt)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </section>
  `;
}

function scansSection(input: MmReportInput): string {
  if (input.scans.length === 0) return "";
  return `
  <section class="page">
    <h2>Résultats de scan</h2>
    ${input.scans
      .slice(0, 12)
      .map(
        (s) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6pt;">
        <span class="mono" style="color:${ACCENT_CYAN};">${escapeHtml(ellipsis(s.subjectId))} · ${s.chain}</span>
        <span><span class="badge" style="background:${bandColor(s.band)};color:#000;">${s.band}</span>
              <span class="badge" style="background:${ACCENT_CYAN};">SCORE ${s.displayScore}</span></span>
      </div>
      <div class="muted" style="font-size:9.5pt;margin-bottom:8pt;">
        Confiance ${escapeHtml(s.confidence)} · Coverage ${escapeHtml(s.coverage)} · ${escapeHtml(s.dominantDriver)}
        · Calculé ${fmtDate(s.computedAt)}
      </div>
      ${
        s.detectorScores.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:6pt;margin-bottom:8pt;">
              ${s.detectorScores
                .map(
                  (d) => `<span class="badge" style="background:${BORDER};color:${TEXT};font-weight:700;">${escapeHtml(d.detectorType)}:${d.score}</span>`,
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        s.topSignals.length
          ? `<div class="small">Signaux</div>
             <ul style="list-style:none;padding:0;margin-top:4pt;">
               ${s.topSignals
                 .slice(0, 6)
                 .map(
                   (sig) => `
               <li style="padding:4pt 0;border-top:1pt solid ${BORDER};">
                 <span class="badge" style="background:${sig.severity === "HIGH" || sig.severity === "CRITICAL" ? DANGER : ACCENT_AMBER};color:#000;font-size:7pt;">${escapeHtml(sig.severity)}</span>
                 <strong style="margin-left:6pt;">${escapeHtml(sig.type)}</strong>
                 ${sig.description ? `<span class="muted"> — ${escapeHtml(sig.description)}</span>` : ""}
               </li>`,
                 )
                 .join("")}
             </ul>`
          : ""
      }
    </div>`,
      )
      .join("")}
  </section>
  `;
}

function clusterSection(input: MmReportInput): string {
  if (input.clusters.length === 0) return "";
  return `
  <section class="page">
    <h2>Cluster map</h2>
    <p class="muted" style="margin-bottom:12pt;">Graphe de funding réduit — chaque cluster est un internalClusterId anonyme regroupant des wallets partageant une racine de funding commune.</p>
    ${input.clusters
      .slice(0, 8)
      .map(
        (c) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;">
        <span class="mono" style="color:${ACCENT_CYAN};">${escapeHtml(c.internalClusterId)}</span>
        <span class="muted">${c.memberCount} membres · ${c.sharedTokens.length} token(s) partagé(s)</span>
      </div>
      <div style="margin-top:8pt;font-size:9pt;">
        <div class="small" style="color:${ACCENT_AMBER};">Root</div>
        <div class="mono">${escapeHtml(ellipsis(c.rootWallet))}</div>
        <div class="small" style="margin-top:8pt;color:${ACCENT_AMBER};">Members</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4pt 12pt;">
          ${c.members
            .slice(0, 14)
            .map(
              (m) => `<span class="mono">↳ ${escapeHtml(ellipsis(m))}</span>`,
            )
            .join("")}
          ${
            c.members.length > 14
              ? `<span class="muted">…and ${c.members.length - 14} more</span>`
              : ""
          }
        </div>
      </div>
    </div>`,
      )
      .join("")}
  </section>
  `;
}

function methodologyPage(input: MmReportInput): string {
  return `
  <section class="page">
    <h2>Méthodologie &amp; mentions</h2>
    <p>Ce rapport est produit par INTERLIGENS à titre informatif, à partir de
    sources publiques et d'analyses algorithmiques on-chain. Il ne constitue
    pas un conseil juridique, financier ou fiscal. Les <em>claims</em> sont
    typées (<strong>FACT</strong>, <strong>ALLEGATION</strong>,
    <strong>INFERENCE</strong>, <strong>RESPONSE</strong>) et sourcées à un
    document identifiable.</p>
    <p style="margin-top:10pt;">Le <strong>Registry</strong> (module éditorial)
    et le <strong>Pattern Engine</strong> (module algorithmique) sont
    strictement séparés. Les détecteurs on-chain n'émettent jamais le nom
    d'une entité — toute attribution passe par le registre éditorial, avec
    review humaine et droit de réponse institutionnalisé.</p>
    <p style="margin-top:10pt;">Les percentiles par cohorte (chain, age,
    liquidity tier) sont recalibrés quotidiennement. Les wallets déjà flaggés
    avec haute confiance sont exclus du calcul pour éviter la contamination.</p>
    <h3>Droit de réponse</h3>
    <p>Toute entité listée peut contester une fiche, une claim ou une
    attribution via <strong style="color:${ACCENT_CYAN};">legal@interligens.com</strong>
    ou l'endpoint <span class="mono">POST /api/v1/mm/challenge</span>.
    Vérification d'identité obligatoire (DKIM sur le domaine officiel, plus
    document signé pour les entités Tier A).</p>
    <h3>Dernière mise à jour</h3>
    <p class="muted">Données entité à jour au ${fmtDate(input.entity.updatedAt)}.
    Rapport généré le ${fmtDate(input.generatedAt)}.</p>
    <footer>
      INTERLIGENS Inc. — Delaware C-Corporation · Hébergé par Vercel Inc. ·
      Ce rapport est strictement confidentiel. Sa reproduction même partielle
      sans autorisation expresse d'INTERLIGENS est interdite.
    </footer>
  </section>
  `;
}

// ─── Entry point ─────────────────────────────────────────────────────────

export function renderMmReportHtml(input: MmReportInput): string {
  const facts = input.claims.filter((c) => c.claimType === "FACT");
  const allegations = input.claims.filter((c) => c.claimType === "ALLEGATION");
  const inferences = input.claims.filter((c) => c.claimType === "INFERENCE");
  const responses = input.claims.filter((c) => c.claimType === "RESPONSE");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>MM Report — ${escapeHtml(input.entity.name)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
${coverPage(input)}
${executiveSummary(input)}
${claimSection("Statut procédural", "fact", "FACT", facts)}
${claimSection("Éléments documentés", "allegation", "ALLEGATION", allegations)}
${claimSection("Inférences &amp; corroborations", "inference", "INFERENCE", inferences)}
${claimSection("Position adverse", "response", "RESPONSE", responses)}
${walletsSection(input)}
${scansSection(input)}
${clusterSection(input)}
${methodologyPage(input)}
</body>
</html>`;
}
