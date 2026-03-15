// INTERLIGENS — Graph Investigation PDF Template

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   '#10b981',
  MEDIUM: '#f59e0b',
  LOW:    '#ef4444',
}

const NODE_COLORS: Record<string, string> = {
  wallet:   '#3b82f6',
  cex:      '#f59e0b',
  person:   '#10b981',
  domain:   '#8b5cf6',
  social:   '#06b6d4',
  token:    '#f97316',
  contract: '#6366f1',
}

const NODE_ICONS: Record<string, string> = {
  wallet:   '💳',
  cex:      '🏦',
  person:   '👤',
  domain:   '🌐',
  social:   '📣',
  token:    '🪙',
  contract: '📄',
}

function ellip(s: string, max = 24): string {
  if (!s || s.length <= max) return s
  return s.slice(0, 10) + '...' + s.slice(-8)
}

export function renderGraphPDF(graphCase: any, lang: string, sha256: string): string {
  const isFr = lang === 'fr'
  const nodes = graphCase.nodes ?? []
  const edges = graphCase.edges ?? []
  const now = new Date().toUTCString()

  const highEdges = edges.filter((e: any) => e.confidence === 'HIGH').length
  const totalEdges = edges.length
  const uniqueTypes = new Set(nodes.map((n: any) => n.type)).size
  const flaggedNodes = nodes.filter((n: any) => n.flagged).length
  const corrobScore = Math.min(100, Math.round(
    (highEdges / Math.max(1, totalEdges)) * 40 +
    Math.min(uniqueTypes * 8, 32) +
    Math.min(flaggedNodes * 7, 28)
  ))

  const corrobColor = corrobScore >= 70 ? '#ef4444' : corrobScore >= 40 ? '#f59e0b' : '#10b981'
  const corrobLabel = corrobScore >= 70
    ? (isFr ? 'HAUTE CERTITUDE' : 'HIGH CERTAINTY')
    : corrobScore >= 40
    ? (isFr ? 'CERTITUDE MODEREE' : 'MODERATE CERTAINTY')
    : (isFr ? 'CERTITUDE FAIBLE' : 'LOW CERTAINTY')

  const nodeRows = nodes.map((n: any) => {
    const meta = (() => { try { return JSON.parse(n.metadata) } catch { return {} } })()
    const color = NODE_COLORS[n.type] ?? '#6b7280'
    const icon = NODE_ICONS[n.type] ?? '?'
    return `<tr>
      <td style="padding:10px 12px;"><span style="background:${color}22;color:${color};border:1px solid ${color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">${n.type.toUpperCase()}</span></td>
      <td style="padding:10px 12px;font-weight:600;font-size:12px;">${n.label}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:10px;color:#6b7280;">${meta.wallet ? ellip(meta.wallet) : meta.mint ? ellip(meta.mint) : '-'}</td>
      <td style="padding:10px 12px;text-align:center;">${n.flagged ? '<span style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">SUSPECT</span>' : '<span style="color:#6b7280;font-size:11px;">-</span>'}</td>
    </tr>`
  }).join('')

  const edgeRows = edges.map((e: any) => {
    const srcNode = nodes.find((n: any) => n.id === e.sourceId)
    const tgtNode = nodes.find((n: any) => n.id === e.targetId)
    const confColor = CONFIDENCE_COLORS[e.confidence] ?? '#6b7280'
    return `<tr>
      <td style="padding:8px 12px;font-size:12px;font-weight:600;">${srcNode?.label ? ellip(srcNode.label, 20) : '?'}</td>
      <td style="padding:8px 12px;text-align:center;"><span style="background:#1e293b;color:#818cf8;border:1px solid #334155;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;">${e.relation}</span></td>
      <td style="padding:8px 12px;font-size:12px;font-weight:600;">${tgtNode?.label ? ellip(tgtNode.label, 20) : '?'}</td>
      <td style="padding:8px 12px;text-align:center;"><span style="background:${confColor}22;color:${confColor};border:1px solid ${confColor};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">${e.confidence}</span></td>
      <td style="padding:8px 12px;font-size:10px;color:#6b7280;">${e.evidence ? ellip(e.evidence, 30) : '-'}</td>
    </tr>`
  }).join('')

  const typeGroups: Record<string, number> = {}
  nodes.forEach((n: any) => { typeGroups[n.type] = (typeGroups[n.type] ?? 0) + 1 })
  const typeCards = Object.entries(typeGroups).map(([type, count]) => {
    const color = NODE_COLORS[type] ?? '#6b7280'
    return `<div style="background:#0f172a;border:1px solid ${color}44;border-radius:10px;padding:14px 18px;text-align:center;min-width:90px;">
      <div style="font-size:20px;font-weight:900;color:${color};">${count}</div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${type}</div>
    </div>`
  }).join('')

  const footer = `<div style="position:fixed;bottom:0;left:0;right:0;padding:10px 56px;background:#0a0f1a;border-top:1px solid #1f2937;font-size:10px;color:#4b5563;display:flex;justify-content:space-between;"><span>INTERLIGENS - BLOCKCHAIN INTELLIGENCE - CONFIDENTIEL</span><span style="font-family:monospace;">SHA-256: ${sha256.slice(0,20)}...</span></div>`

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>INTERLIGENS Graph Report</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Helvetica Neue',Arial,sans-serif; background:#030712; color:#f9fafb; }
.page { width:794px; min-height:1123px; padding:48px 56px 80px; page-break-after:always; position:relative; }
h2 { font-size:18px; font-weight:800; margin-bottom:16px; color:#f9fafb; }
table { width:100%; border-collapse:collapse; }
th { background:#1e293b; color:#94a3b8; padding:10px 12px; text-align:left; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; }
td { border-bottom:1px solid #1f2937; vertical-align:top; }
</style>
</head>
<body>

<div class="page" style="background:linear-gradient(160deg,#030712 0%,#0f172a 50%,#1e1b4b 100%);">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:48px;">
    <div style="width:44px;height:44px;background:#4f46e5;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;">&#128279;</div>
    <div>
      <div style="font-weight:900;font-size:18px;letter-spacing:0.05em;">INTERLIGENS</div>
      <div style="font-size:9px;color:#4b5563;letter-spacing:0.2em;">BLOCKCHAIN INTELLIGENCE PLATFORM</div>
    </div>
    <div style="margin-left:auto;background:#ef444422;border:1px solid #ef4444;border-radius:6px;padding:4px 12px;font-size:10px;color:#ef4444;font-weight:700;">CONFIDENTIEL</div>
  </div>

  <div style="margin-bottom:40px;">
    <div style="font-size:11px;color:#4f46e5;font-weight:700;letter-spacing:0.2em;margin-bottom:12px;">INVESTIGATION GRAPH REPORT</div>
    <h1 style="font-size:36px;font-weight:900;color:#f9fafb;margin-bottom:8px;line-height:1.1;">${graphCase.title}</h1>
    <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">${isFr ? 'Genere le' : 'Generated'} ${now}</div>
    <div style="font-size:13px;color:#6b7280;">${isFr ? 'Chaine' : 'Chain'}: <strong style="color:#818cf8;">${graphCase.chain.toUpperCase()}</strong></div>
  </div>

  <div style="background:#0f172a;border:1px solid #1f2937;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
    <div style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:0.15em;margin-bottom:8px;">${isFr ? 'ADRESSE PIVOT' : 'PIVOT ADDRESS'}</div>
    <div style="font-family:monospace;font-size:13px;color:#7dd3fc;word-break:break-all;">${graphCase.pivotAddress}</div>
    ${graphCase.notes ? `<div style="margin-top:10px;font-size:12px;color:#6b7280;border-top:1px solid #1f2937;padding-top:10px;">${graphCase.notes}</div>` : ''}
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
    <div style="background:#0f172a;border:1px solid #1f2937;border-radius:10px;padding:20px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#818cf8;">${nodes.length}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">${isFr ? 'Entites' : 'Entities'}</div>
    </div>
    <div style="background:#0f172a;border:1px solid #1f2937;border-radius:10px;padding:20px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#818cf8;">${edges.length}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">${isFr ? 'Liens' : 'Links'}</div>
    </div>
    <div style="background:#0f172a;border:1px solid #1f2937;border-radius:10px;padding:20px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:${corrobColor};">${corrobScore}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">${isFr ? 'Corroboration' : 'Corroboration'}</div>
    </div>
  </div>

  <div style="background:${corrobColor}11;border:1px solid ${corrobColor}44;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="font-size:36px;font-weight:900;color:${corrobColor};">${corrobScore}<span style="font-size:16px;">/100</span></div>
      <div>
        <div style="font-size:14px;font-weight:800;color:${corrobColor};margin-bottom:4px;">${corrobLabel}</div>
        <div style="font-size:12px;color:#6b7280;">${highEdges} HIGH confidence · ${uniqueTypes} ${isFr ? 'types' : 'entity types'} · ${flaggedNodes} ${isFr ? 'suspects' : 'flagged'}</div>
      </div>
    </div>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap;">${typeCards}</div>

  <div style="position:absolute;bottom:32px;left:56px;right:56px;display:flex;justify-content:space-between;font-size:10px;color:#374151;">
    <span>INTERLIGENS Investigation Graph</span>
    <span style="font-family:monospace;">SHA-256: ${sha256}</span>
  </div>
</div>

<div class="page" style="background:#030712;">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
    <h2 style="margin:0;">${isFr ? 'Entites Identifiees' : 'Identified Entities'}</h2>
    <span style="margin-left:auto;background:#1e1b4b;color:#818cf8;border:1px solid #3730a3;padding:3px 12px;border-radius:6px;font-size:11px;font-weight:700;">${nodes.length}</span>
  </div>
  <table>
    <thead><tr>
      <th style="width:120px;">Type</th>
      <th>${isFr ? 'Label' : 'Label'}</th>
      <th>${isFr ? 'Adresse' : 'Address'}</th>
      <th style="width:110px;text-align:center;">Status</th>
    </tr></thead>
    <tbody>${nodeRows}</tbody>
  </table>
</div>

<div class="page" style="background:#030712;">
  ${footer}
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
    <h2 style="margin:0;">${isFr ? 'Liens et Evidences' : 'Links & Evidence'}</h2>
    <span style="margin-left:auto;background:#1e1b4b;color:#818cf8;border:1px solid #3730a3;padding:3px 12px;border-radius:6px;font-size:11px;font-weight:700;">${edges.length}</span>
  </div>
  <table>
    <thead><tr>
      <th>Source</th>
      <th style="width:130px;text-align:center;">Relation</th>
      <th>Target</th>
      <th style="width:90px;text-align:center;">Confidence</th>
      <th>Evidence</th>
    </tr></thead>
    <tbody>${edgeRows}</tbody>
  </table>
  <div style="margin-top:32px;padding:16px 20px;background:#0f172a;border:1px solid #1f2937;border-radius:8px;font-size:11px;color:#4b5563;line-height:1.6;">
    ${isFr ? 'Ce rapport ne constitue pas un conseil juridique ou financier. Usage reserve aux professionnels autorises.' : 'This report does not constitute legal or financial advice. For use by authorized professionals only.'}
  </div>
</div>

</body>
</html>`
}
