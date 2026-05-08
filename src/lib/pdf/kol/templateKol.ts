
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

function ellip(s: string, max = 24): string {
  if (s.length <= max) return s
  return s.slice(0, 10) + "..." + s.slice(-10)
}

function solscanTx(tx: string): string {
  return `https://solscan.io/tx/${tx}`
}

export function renderKolPdf(kol: any, mode: string, laundryTrail?: any, lang: string = "en"): string {
  const isLawyer = mode === "lawyer"
  const evidences = kol.evidences ?? []
  const wallets = kol.kolWallets ?? []
  const cases = kol.kolCases ?? []

  const totalDocumented = kol.totalDocumented ?? evidences.reduce((s: number, e: any) => s + (e.amountUsd ?? 0), 0)
  const exitEv = evidences.find((e: any) => e.type === "coordinated_exit")
  const evmEv = evidences.find((e: any) => e.type === "evm_wallet")
  const cashouts = evidences.filter((e: any) => e.type === "onchain_cashout")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; background: #050505; color: #f1f5f9; font-size: 11px; line-height: 1.6; }
  .page { max-width: 760px; margin: 0 auto; padding: 32px; }

  /* Header */
  .header { border-bottom: 2px solid #F85B05; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 8px; letter-spacing: 0.4em; color: #F85B05; margin-bottom: 6px; }
  .title { font-size: 22px; font-weight: 900; color: #f1f5f9; letter-spacing: -0.02em; }
  .subtitle { font-size: 10px; color: #4b5563; margin-top: 4px; }
  .meta-row { display: flex; gap: 24px; margin-top: 12px; }
  .meta-item { }
  .meta-label { font-size: 8px; color: #374151; letter-spacing: 0.2em; }
  .meta-value { font-size: 13px; font-weight: 900; color: #f1f5f9; }

  /* Risk badge */
  .risk-confirmed { color: #ef4444; background: #ef444415; padding: 3px 10px; border-radius: 3px; font-size: 8px; font-weight: 900; letter-spacing: 0.2em; display: inline-block; }

  /* Section */
  .section { margin-bottom: 28px; }
  .section-title { font-size: 8px; font-weight: 900; color: #374151; letter-spacing: 0.3em; margin-bottom: 12px; border-bottom: 1px solid #111; padding-bottom: 6px; }

  /* Summary boxes */
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-box { background: #0a0a0a; border: 1px solid #1f2937; border-radius: 8px; padding: 14px; }
  .stat-label { font-size: 8px; color: #374151; letter-spacing: 0.15em; }
  .stat-value { font-size: 18px; font-weight: 900; margin-top: 2px; }
  .red { color: #ef4444; }
  .orange { color: #F85B05; }
  .amber { color: #f59e0b; }
  .green { color: #10b981; }

  /* Timeline */
  .timeline { }
  .tl-item { display: flex; gap: 16px; margin-bottom: 14px; }
  .tl-dot { width: 8px; height: 8px; border-radius: 50%; background: #F85B05; margin-top: 4px; flex-shrink: 0; }
  .tl-dot-red { background: #ef4444; }
  .tl-date { font-size: 9px; color: #4b5563; min-width: 90px; }
  .tl-content { }
  .tl-label { font-size: 11px; font-weight: 700; color: #f1f5f9; }
  .tl-desc { font-size: 9px; color: #6b7280; margin-top: 2px; }

  /* Evidence table */
  .ev-table { width: 100%; border-collapse: collapse; }
  .ev-table th { font-size: 8px; color: #374151; letter-spacing: 0.15em; text-align: left; padding: 6px 8px; border-bottom: 1px solid #1f2937; }
  .ev-table td { font-size: 10px; padding: 8px; border-bottom: 1px solid #0d0d0d; vertical-align: top; }
  .ev-table tr:hover td { background: #0a0a0a; }
  .tx-link { color: #F85B05; font-size: 8px; text-decoration: none; }
  .amount { font-weight: 900; color: #ef4444; }

  /* Wallet graph */
  .wallet-row { background: #0a0a0a; border: 1px solid #1f2937; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .wallet-addr { font-size: 9px; color: #9ca3af; font-family: monospace; }
  .wallet-label { font-size: 9px; font-weight: 700; color: #f1f5f9; }
  .wallet-chain { font-size: 8px; color: #374151; }

  /* Exit event */
  .exit-box { background: #0d0000; border: 1px solid #ef444430; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .exit-title { font-size: 10px; font-weight: 900; color: #ef4444; letter-spacing: 0.15em; margin-bottom: 8px; }
  .exit-row { display: flex; gap: 32px; }
  .exit-stat { }
  .exit-stat-label { font-size: 8px; color: #6b7280; }
  .exit-stat-value { font-size: 14px; font-weight: 900; color: #ef4444; }

  /* Legal notice */
  .legal { background: #0a0a0a; border: 1px solid #1f2937; border-radius: 6px; padding: 14px; font-size: 9px; color: #374151; line-height: 1.7; margin-top: 28px; }
  .legal strong { color: #4b5563; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #111; display: flex; justify-content: space-between; font-size: 8px; color: #1f2937; }

  /* Lawyer-only */
  .lawyer-badge { background: #F85B0520; border: 1px solid #F85B05; color: #F85B05; font-size: 8px; padding: 2px 8px; border-radius: 3px; display: inline-block; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">INTERLIGENS — INTELLIGENCE REPORT — ${isLawyer ? "LEGAL VERSION" : "PUBLIC SUMMARY"}</div>
    <div class="title">${kol.displayName ?? kol.handle}</div>
    <div class="subtitle">@${kol.handle} · ${kol.platform.toUpperCase()} · Generated ${new Date().toLocaleDateString("en-US", {year:"numeric",month:"long",day:"numeric"})}</div>
    <div class="meta-row">
      <div class="meta-item">
        <div class="meta-label">RISK STATUS</div>
        <div><span class="risk-confirmed">${kol.riskFlag?.replace("_"," ").toUpperCase()}</span></div>
      </div>
      <div class="meta-item">
        <div class="meta-label">CONFIDENCE</div>
        <div class="meta-value">${(kol.confidence ?? "low").toUpperCase()}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">VERIFIED</div>
        <div class="meta-value" style="color:${kol.verified ? "#10b981" : "#ef4444"}">${kol.verified ? "YES" : "NO"}</div>
      </div>
    </div>
  </div>

  <!-- SUMMARY STATS -->
  <div class="summary-grid">
    <div class="stat-box">
      <div class="stat-label">RUGS CONFIRMED</div>
      <div class="stat-value amber">${kol.rugCount}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">TOTAL SCAMMED</div>
      <div class="stat-value red">${fmtUsd(kol.totalScammed)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">DOCUMENTED ON-CHAIN</div>
      <div class="stat-value orange">${fmtUsd(totalDocumented)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">EVIDENCE ITEMS</div>
      <div class="stat-value" style="color:#f1f5f9">${evidences.length}</div>
    </div>
  </div>

  ${exitEv ? `
  <!-- EXIT EVENT -->
  <div class="exit-box">
    <div class="exit-title">⚠ COORDINATED EXIT EVENT DETECTED</div>
    <div style="font-size:10px;color:#9ca3af;margin-bottom:10px;">${exitEv.description ?? ""}</div>
    <div class="exit-row">
      <div class="exit-stat">
        <div class="exit-stat-label">USDC MOVED</div>
        <div class="exit-stat-value">${fmtUsd(exitEv.amountUsd)}</div>
      </div>
      <div class="exit-stat">
        <div class="exit-stat-label">TX COUNT</div>
        <div class="exit-stat-value">${exitEv.txCount}</div>
      </div>
      <div class="exit-stat">
        <div class="exit-stat-label">POST → CASHOUT DELAY</div>
        <div class="exit-stat-value">${exitEv.deltaMinutes ? Math.floor(exitEv.deltaMinutes / 60) + "h " + (exitEv.deltaMinutes % 60) + "min" : "—"}</div>
      </div>
      <div class="exit-stat">
        <div class="exit-stat-label">DATE</div>
        <div class="exit-stat-value" style="font-size:11px">${fmtDate(exitEv.dateFirst)}</div>
      </div>
    </div>
    ${exitEv.twitterPost ? `<div style="margin-top:10px;font-size:9px;color:#6b7280;">Exit post: <a href="${exitEv.twitterPost}" style="color:#F85B05">${exitEv.twitterPost}</a></div>` : ""}
  </div>
  ` : ""}

  <!-- CASHOUT EVIDENCE -->
  <div class="section">
    <div class="section-title">CASHOUT EVIDENCE — FAMILY WALLETS</div>
    <table class="ev-table">
      <thead>
        <tr>
          <th>WALLET / SOURCE</th>
          <th>TOKEN</th>
          <th>AMOUNT USD</th>
          <th>TX COUNT</th>
          <th>PERIOD</th>
          ${isLawyer ? "<th>SAMPLE TX</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${cashouts.map((e: any) => `
        <tr>
          <td>
            <div style="font-weight:700;color:#f1f5f9">${e.label}</div>
            ${isLawyer ? `<div class="wallet-addr">${JSON.parse(e.wallets ?? "[]")[0] ?? ""}</div>` : ""}
          </td>
          <td style="color:#F85B05">${e.token ?? "—"}</td>
          <td class="amount">${fmtUsd(e.amountUsd)}</td>
          <td style="color:#9ca3af">${e.txCount ?? "—"}</td>
          <td style="color:#6b7280;font-size:9px">${fmtDate(e.dateFirst)}<br/>→ ${fmtDate(e.dateLast)}</td>
          ${isLawyer ? `<td><a href="https://solscan.io/tx/${e.sampleTx ?? ""}" class="tx-link">${ellip(e.sampleTx ?? "—", 20)}</a></td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  ${laundryTrail ? `
  <!-- LAUNDRY TRAIL -->
  <div class="section">
    <div class="section-title">LAUNDRY TRAIL</div>
    <div style="margin-bottom:10px;">
      <span style="font-size:8px;color:#374151;letter-spacing:0.15em;">SIGNALS DETECTED: </span>
      ${laundryTrail.signals.map((s: any) => {
        const colors: Record<string, string> = { FRAG: '#f59e0b', BRIDGE: '#FF6B00', MIXER: '#ef4444', PRIV: '#ef4444', DEG: '#f59e0b', CASH: '#f59e0b' }
        const color = colors[s.family] ?? '#6b7280'
        const label = s.confirmed ? s.family : ('~' + s.family)
        const desc = !s.confirmed && s.family === 'MIXER' ? 'mixer-adjacent routing observed' : ''
        return `<span style="background:${color}20;border:1px solid ${color}55;color:${color};font-size:9px;font-weight:900;padding:2px 8px;border-radius:3px;letter-spacing:0.1em;margin-right:6px;${!s.confirmed ? 'opacity:0.6;' : ''}">${label}</span>${desc ? `<span style="font-size:8px;color:#6b7280;margin-right:8px;">(${desc})</span>` : ''}`
      }).join('')}
    </div>
    <div style="margin-bottom:6px;">
      <span style="font-size:8px;color:#374151;letter-spacing:0.15em;">TRAIL TYPE: </span>
      <span style="font-size:10px;color:#f1f5f9;">${laundryTrail.trailType}</span>
    </div>
    <div style="margin-bottom:6px;">
      <span style="font-size:8px;color:#374151;letter-spacing:0.15em;">LAUNDRY RISK: </span>
      <span style="font-size:10px;font-weight:900;color:${laundryTrail.laundryRisk === 'CRITICAL' || laundryTrail.laundryRisk === 'HIGH' ? '#ef4444' : laundryTrail.laundryRisk === 'MODERATE' ? '#f59e0b' : '#10b981'}">${laundryTrail.laundryRisk}</span>
    </div>
    <div style="margin-bottom:10px;">
      <span style="font-size:8px;color:#374151;letter-spacing:0.15em;">RECOVERY DIFFICULTY: </span>
      <span style="font-size:10px;font-weight:900;color:${laundryTrail.recoveryDifficulty === 'SEVERE' ? '#ef4444' : laundryTrail.recoveryDifficulty === 'PARTIAL' ? '#f59e0b' : '#10b981'}">${laundryTrail.recoveryDifficulty}</span>${laundryTrail.trailBreakHop ? ` <span style="font-size:9px;color:#6b7280;">— trail breaks at hop ${laundryTrail.trailBreakHop}</span>` : ''}
    </div>
    ${(() => { const nar = lang === 'fr' ? (laundryTrail.narrativeTextFr ?? laundryTrail.narrativeText) : laundryTrail.narrativeText; return nar ? `<div style="font-size:10px;color:#9ca3af;line-height:1.7;margin-bottom:10px;">${nar}</div>` : '' })()}
    <div style="font-size:9px;color:#374151;font-style:italic;">${lang === 'fr' ? (laundryTrail.evidenceNoteFr ?? laundryTrail.evidenceNote) : laundryTrail.evidenceNote}</div>
  </div>
  ` : ''}

  ${evmEv ? `
  <!-- EVM WALLET -->
  <div class="section">
    <div class="section-title">EVM WALLET — UNREALIZED HOLDINGS</div>
    <div class="wallet-row">
      <div>
        <div class="wallet-label">Ethereum/EVM — Arkham Intelligence Confirmed</div>
        <div class="wallet-addr">${JSON.parse(evmEv.wallets ?? "[]")[0] ?? ""}</div>
      </div>
      <div style="text-align:right">
        <div class="stat-label">PORTFOLIO VALUE</div>
        <div style="font-size:16px;font-weight:900;color:#F85B05">${fmtUsd(evmEv.amountUsd)}</div>
        <div style="font-size:8px;color:#374151">${evmEv.description?.split(".")[0] ?? ""}</div>
      </div>
    </div>
  </div>
  ` : ""}

  ${isLawyer ? `
  <!-- LAWYER: FULL WALLET GRAPH -->
  <div class="section">
    <div class="section-title">WALLET NETWORK — FULL GRAPH</div>
    <div class="lawyer-badge">LEGAL VERSION — ALL WALLET ADDRESSES</div>
    ${wallets.map((w: any) => `
    <div class="wallet-row">
      <div>
        <div class="wallet-label">${w.label ?? "Unlabeled"}</div>
        <div class="wallet-addr">${w.address}</div>
      </div>
      <div style="text-align:right">
        <div class="wallet-chain">${w.chain}</div>
        <div style="font-size:8px;color:${w.status === "active" ? "#10b981" : "#6b7280"}">${w.status?.toUpperCase()}</div>
      </div>
    </div>`).join("")}
  </div>

  <!-- LAWYER: METHODOLOGY -->
  <div class="section">
    <div class="section-title">INVESTIGATION METHODOLOGY</div>
    <div style="font-size:10px;color:#6b7280;line-height:1.8">
      <p>All blockchain data was retrieved via Helius RPC API (Solana) and Arkham Intelligence (EVM). 
      Transaction hashes are immutable on-chain records verifiable by any party via Solscan.io.</p>
      <br/>
      <p><strong style="color:#9ca3af">Data sources:</strong> Helius API v0 · Solscan · Arkham Intelligence · X/Twitter public posts</p>
      <p><strong style="color:#9ca3af">Investigation date:</strong> ${new Date().toLocaleDateString("en-US", {year:"numeric",month:"long",day:"numeric"})}</p>
      <p><strong style="color:#9ca3af">Evidence standard:</strong> On-chain verified (blockchain-immutable) + Source-attributed (cited public sources)</p>
      <p><strong style="color:#9ca3af">Full methodology:</strong> https://interligens.com/en/methodology</p>
    </div>
  </div>
  ` : ""}

  <!-- LEGAL NOTICE -->
  <div class="legal">
    <strong>EVIDENCE STANDARD — IMPORTANT NOTICE</strong><br/>
    This report is an evidence-based analytical summary derived from publicly accessible blockchain records, 
    archived public communications, and cited third-party sources. All statements are categorized as: 
    (i) directly observable on-chain facts, (ii) source-attributed public claims, or 
    (iii) analytical inferences based on disclosed methodology. INTERLIGENS does not assert criminal guilt, 
    intent, or legal liability. USD figures are methodology-based estimates. Terms including "high-risk," 
    "linked," "associated," and "estimated" reflect analytical classification — not judicial findings.
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>INTERLIGENS Intelligence Platform — interligens.com</span>
    <span>Report: ${kol.handle} · ${isLawyer ? "Legal Version" : "Public Summary"} · ${new Date().toISOString().split("T")[0]}</span>
  </div>

</div>
</body>
</html>`
}
