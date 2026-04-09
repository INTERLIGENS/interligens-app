'use client'
import BetaNav from "@/components/beta/BetaNav";
import KolNarrative from '@/components/kol/KolNarrative'
import CashoutProof from '@/components/kol/CashoutProof'
import ProceedsCard from '@/components/kol/ProceedsCard'
import LaundryTrailCard from '@/components/LaundryTrailCard'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface KolWallet {
  id: string; address: string; chain: string; label?: string; status: string
  confidence?: string
}
interface KolCaseLink {
  id: string; caseId: string; role: string; paidUsd?: number; evidence?: string
  claimType?: 'verified_onchain' | 'source_attributed' | 'analytical_estimate'
  confidenceLevel?: 'confirmed' | 'strong_linkage' | 'provisional'
  sourceUrl?: string; sourceLabel?: string; methodologyRef?: string
}
interface KOL {
  id: string; handle: string; platform: string; displayName?: string
  followers?: number; followerCount?: number; status: string
  totalScammed?: number; rugCount: number; notes?: string; verified: boolean
  wallets: KolWallet[]; caseLinks: KolCaseLink[]
  riskFlag?: string; confidence?: string; bio?: string
  summary?: string; observedBehaviorSummary?: string
  documentedFacts?: string; partialFacts?: string
  behaviorFlags?: string; evidenceDepth?: string
  completenessLevel?: string; profileStrength?: string
  proceedsCoverage?: string; walletAttributionStrength?: string
  totalDocumented?: number
  aliases?: { id: string; alias: string; type: string }[]
  tokenLinks?: { id: string; contractAddress: string; chain: string; tokenSymbol?: string; role: string }[]
  evidences?: { id: string; type: string; label: string; description?: string; sourceUrl?: string; dateFirst?: string }[]
}

const ROLE_COLOR: Record<string, string> = {
  paid_promoter: '#ef4444', advisor: '#f59e0b', promoter: '#f97316',
  dev: '#8b5cf6', insider: '#ec4899',
}
const ROLE_LABEL: Record<string, string> = {
  paid_promoter: 'PROMOTER — SOURCE-ATTRIBUTED', advisor: 'ADVISOR — SOURCE-ATTRIBUTED',
  promoter: 'PROMOTER — SOURCE-ATTRIBUTED', dev: 'DEVELOPER', insider: 'INSIDER',
}
const CLAIM_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  verified_onchain:    { label: 'VERIFIED ON-CHAIN',   color: '#10b981', bg: '#10b98115' },
  source_attributed:   { label: 'SOURCE-ATTRIBUTED',   color: '#3b82f6', bg: '#3b82f615' },
  analytical_estimate: { label: 'ANALYTICAL ESTIMATE', color: '#f59e0b', bg: '#f59e0b15' },
}
const CONF_BADGE: Record<string, { label: string; color: string }> = {
  confirmed:     { label: 'CONFIRMED',      color: '#10b981' },
  strong_linkage:{ label: 'STRONG LINKAGE', color: '#f59e0b' },
  provisional:   { label: 'PROVISIONAL',    color: '#6b7280' },
}

const DEPTH_BADGE: Record<string, { label: string; color: string }> = {
  comprehensive: { label: 'COMPREHENSIVE', color: '#10b981' },
  strong:        { label: 'STRONG',        color: '#3b82f6' },
  moderate:      { label: 'MODERATE',      color: '#f59e0b' },
  weak:          { label: 'WEAK',          color: '#6b7280' },
  none:          { label: '—',             color: '#374151' },
}
const COMPLETENESS_BADGE: Record<string, { label: string; color: string }> = {
  complete:    { label: 'COMPLETE',    color: '#10b981' },
  substantial: { label: 'SUBSTANTIAL', color: '#3b82f6' },
  partial:     { label: 'PARTIAL',     color: '#f59e0b' },
  incomplete:  { label: 'INCOMPLETE',  color: '#6b7280' },
}
const STRENGTH_BADGE: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'CONFIRMED', color: '#10b981' },
  high:      { label: 'HIGH',      color: '#3b82f6' },
  medium:    { label: 'MEDIUM',    color: '#f59e0b' },
  low:       { label: 'LOW',       color: '#6b7280' },
  none:      { label: '—',         color: '#374151' },
}

const FLAG_LABELS: Record<string, string> = {
  REPEATED_CASHOUT:       'Repeated cashout pattern',
  MULTI_HOP_TRANSFER:     'Multi-hop transfer obfuscation',
  CROSS_CASE_RECURRENCE:  'Recurrence across multiple cases',
  MULTI_LAUNCH_LINKED:    'Linked to multiple token launches',
  LAUNDERING_INDICATORS:  'Laundering indicators detected',
  KNOWN_LINKED_WALLETS:   'Known linked wallets identified',
  COORDINATED_PROMOTION:  'Coordinated promotion activity',
}

function parseFlags(raw?: string): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function KOLPage() {
  const params = useParams()
  const handle = params?.handle as string
  const [kol, setKol] = useState<KOL | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [laundryTrail, setLaundryTrail] = useState<any>(null)
  const [cluster, setCluster] = useState<any>(null)
  const [coordination, setCoordination] = useState<any>(null)
  const [transparency, setTransparency] = useState<any[]>([])

  useEffect(() => {
    if (!handle) return
    fetch('/api/kol/' + handle)
      .then(r => r.json())
      .then(d => { if (d.found) setKol(d.kol); else setNotFound(true) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    fetch('/api/laundry/' + handle)
      .then(r => r.json())
      .then(d => { if (d) setLaundryTrail(d) })
      .catch(() => {})
    fetch('/api/cluster/' + handle)
      .then(r => r.json())
      .then(d => { if (d && d.relatedActors?.length > 0) setCluster(d) })
      .catch(() => {})
    fetch('/api/coordination/' + handle)
      .then(r => r.json())
      .then(d => { if (d && d.signals?.length > 0) setCoordination(d) })
      .catch(() => {})
    fetch('/api/transparency/wallets?handle=' + handle)
      .then(r => r.json())
      .then(d => { if (d?.wallets?.length > 0) setTransparency(d.wallets) })
      .catch(() => {})
  }, [handle])

  const fmtUsd = (n?: number) => {
    if (!n) return 'Unknown'
    return '$' + (n >= 1000000 ? (n/1000000).toFixed(1) + 'M' : n >= 1000 ? (n/1000).toFixed(0) + 'K' : n.toString())
  }
  const truncAddr = (a: string) => a.length > 20 ? a.slice(0, 8) + '...' + a.slice(-6) : a
  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => { setCopied(addr); setTimeout(() => setCopied(null), 1800) })
  }
  const explorerUrl = (addr: string, chain: string) =>
    chain === 'ETH' ? 'https://etherscan.io/address/' + addr : 'https://solscan.io/account/' + addr

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em' }}>LOADING PROFILE...</div>
    </div>
  )
  if (notFound || !kol) return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace' }}>PROFILE NOT FOUND</div>
    </div>
  )

  const displayName = kol.displayName ?? kol.handle
  const followers = kol.followerCount ?? kol.followers
  const flags = parseFlags(kol.behaviorFlags)
  const depth = DEPTH_BADGE[kol.evidenceDepth ?? 'none'] ?? DEPTH_BADGE.none
  const comp = COMPLETENESS_BADGE[kol.completenessLevel ?? 'incomplete'] ?? COMPLETENESS_BADGE.incomplete
  const walletStr = STRENGTH_BADGE[kol.walletAttributionStrength ?? 'none'] ?? STRENGTH_BADGE.none
  const hasProceeds = (kol.totalDocumented ?? 0) > 0
  const hasLaundry = !!laundryTrail

  // Section header helper
  const SectionHeader = ({ children }: { children: string }) => (
    <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 24, height: 1, background: '#1f2937', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: '#1f2937', display: 'inline-block' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── ID CARD ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0505 0%, #0d0202 100%)',
          border: '1px solid #ef444422', borderRadius: 16, padding: '32px', marginBottom: 28,
          position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(239,68,68,0.06)'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, #ef4444 40%, #f97316 60%, transparent 100%)' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 12, background: 'linear-gradient(135deg, #ef444433, #0f0202)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontFamily: 'monospace', fontWeight: 900, color: '#ef4444', flexShrink: 0 }}>
              {displayName[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 6 }}>
                HIGH-RISK ACTOR · {kol.platform.toUpperCase()} · {kol.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: '#4b5563', fontFamily: 'monospace', marginBottom: 8 }}>@{kol.handle}</div>
              {/* Aliases */}
              {(kol.aliases?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {kol.aliases!.map(a => (
                    <span key={a.id} style={{ background: '#4b556315', color: '#6b7280', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, fontFamily: 'monospace' }}>
                      @{a.alias}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{fmtUsd(kol.totalScammed ?? undefined)}</div>
              <div style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>Est. Investor Losses</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a href={`/api/pdf/kol?handle=${kol.handle}&mode=retail`} target="_blank" style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 12px', borderRadius: 4, background: '#F85B05', color: '#fff', textDecoration: 'none' }}>
                  ↓ PUBLIC REPORT
                </a>
                <a href={`/api/pdf/kol?handle=${kol.handle}&mode=lawyer`} target="_blank" style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 12px', borderRadius: 4, background: '#0a0a0a', border: '1px solid #374151', color: '#9ca3af', textDecoration: 'none' }}>
                  ↓ LEGAL VERSION
                </a>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 20 }}>
            {[
              { value: String(kol.rugCount), label: 'Rug-Linked Cases', color: '#ef4444' },
              { value: followers ? Math.round(followers/1000) + 'K' : '?', label: 'Audience Reached', color: '#f59e0b' },
              { value: String(kol?.wallets?.length ?? 0), label: 'Wallets Documented', color: '#8b5cf6' },
              { value: String(kol?.caseLinks?.length ?? 0), label: 'Documented Cases', color: '#3b82f6' },
              { value: String(kol?.evidences?.length ?? 0), label: 'Evidence Items', color: '#F85B05' },
              { value: String(kol?.tokenLinks?.length ?? 0), label: 'Token Links', color: '#ec4899' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 18px', textAlign: 'center' as const, flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Density badges row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: kol.notes ? 20 : 0 }}>
            <span style={{ background: depth.color + '15', border: '1px solid ' + depth.color + '44', color: depth.color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>
              EVIDENCE: {depth.label}
            </span>
            <span style={{ background: comp.color + '15', border: '1px solid ' + comp.color + '44', color: comp.color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>
              COMPLETENESS: {comp.label}
            </span>
            <span style={{ background: walletStr.color + '15', border: '1px solid ' + walletStr.color + '44', color: walletStr.color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>
              WALLET ATTRIB: {walletStr.label}
            </span>
            {hasProceeds && (
              <span style={{ background: '#10b98115', border: '1px solid #10b98144', color: '#10b981', fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>
                PROCEEDS: {fmtUsd(kol.totalDocumented)}
              </span>
            )}
            {hasLaundry && (
              <span style={{ background: '#ef444415', border: '1px solid #ef444444', color: '#ef4444', fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>
                LAUNDRY TRAIL DETECTED
              </span>
            )}
          </div>

          {kol.notes && (
            <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#94a3b8', borderLeft: '3px solid #4f46e5', lineHeight: 1.6 }}>
              {kol.notes}
            </div>
          )}
        </div>

        {/* ── FACTUAL SUMMARY ── */}
        {kol.summary && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Factual Summary</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '18px 22px', fontSize: 13, color: '#d1d5db', lineHeight: 1.75 }}>
              {kol.summary}
            </div>
          </div>
        )}

        {/* ── DOCUMENTED FACTS ── */}
        {kol.documentedFacts && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Documented Facts</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #10b98133', borderLeft: '3px solid #10b981', borderRadius: 10, padding: '18px 22px', fontSize: 13, color: '#d1d5db', lineHeight: 1.75 }}>
              {kol.documentedFacts}
            </div>
          </div>
        )}

        {/* ── PARTIAL / INCOMPLETE FACTS ── */}
        {kol.partialFacts && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Incomplete / Pending Investigation</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #f59e0b33', borderLeft: '3px solid #f59e0b', borderRadius: 10, padding: '18px 22px' }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em', marginBottom: 8 }}>
                THE FOLLOWING ELEMENTS ARE INCOMPLETE OR UNDER INVESTIGATION
              </div>
              <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.75 }}>
                {kol.partialFacts}
              </div>
            </div>
          </div>
        )}

        {/* ── BEHAVIOR FLAGS ── */}
        {flags.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Detected Behavior Patterns</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flags.map(flag => (
                <div key={flag} style={{ background: '#0d1117', border: '1px solid #f9731633', borderRadius: 8, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 600 }}>
                    {FLAG_LABELS[flag] ?? flag}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 8, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    {flag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RELATED ACTORS ── */}
        {cluster && cluster.relatedActors.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Related Actors</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>{cluster.overlapSummary}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {cluster.relatedActors.map((a: any) => (
                  <a key={a.handle} href={`/en/kol/${a.handle}`} style={{ background: '#F85B0510', border: '1px solid #F85B0533', color: '#F85B05', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 5, fontFamily: 'monospace', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#F85B0533')}
                  >@{a.handle}</a>
                ))}
              </div>
              {cluster.relatedLaunches.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ color: '#4b5563', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', fontFamily: 'monospace', paddingTop: 3 }}>LAUNCHES:</span>
                  {cluster.relatedLaunches.map((t: string) => (
                    <span key={t} style={{ background: '#8b5cf615', color: '#8b5cf6', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 3, fontFamily: 'monospace' }}>{t}</span>
                  ))}
                </div>
              )}
              {cluster.relatedCases.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ color: '#4b5563', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', fontFamily: 'monospace', paddingTop: 3 }}>CASES:</span>
                  {cluster.relatedCases.map((c: string) => (
                    <span key={c} style={{ background: '#ef444415', color: '#ef4444', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 3, fontFamily: 'monospace' }}>{c}</span>
                  ))}
                </div>
              )}
              {cluster.clusterSignals.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, borderTop: '1px solid #1e2330', paddingTop: 12 }}>
                  {cluster.clusterSignals.slice(0, 3).map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.strength === 'strong' ? '#ef4444' : s.strength === 'moderate' ? '#f97316' : '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#d1d5db' }}>{s.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 8, color: '#374151', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{s.strength.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COORDINATION SIGNALS ── */}
        {coordination && coordination.signals.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Coordination Signals</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>{coordination.summaryEn}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {coordination.signals.slice(0, 4).map((s: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.strength === 'strong' ? '#ef4444' : s.strength === 'moderate' ? '#f97316' : '#6b7280', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#f9fafb', fontWeight: 600 }}>{s.labelEn}</div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{s.reasonSummary}</div>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.1em', color: s.strength === 'strong' ? '#ef4444' : s.strength === 'moderate' ? '#f97316' : '#6b7280' }}>{s.strength.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PATTERN SUMMARY (KolNarrative) ── */}
        <KolNarrative kol={{ ...kol, followerCount: followers }} />

        {/* ── DOCUMENTED CASE HISTORY ── */}
        <ProceedsCard handle={kol.handle} lang="en" />

        {laundryTrail && <LaundryTrailCard laundryTrail={laundryTrail} lang="en" />}

        {(kol?.caseLinks?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Documented Case History</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {kol.caseLinks.map((c, i) => {
                const roleColor = ROLE_COLOR[c.role] ?? '#6b7280'
                const roleLabel = ROLE_LABEL[c.role] ?? c.role.toUpperCase().replace('_', ' ')
                const claimBadge = c.claimType ? CLAIM_BADGE[c.claimType] : null
                const confBadge = c.confidenceLevel ? CONF_BADGE[c.confidenceLevel] : null
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: roleColor + '22', border: '2px solid ' + roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: roleColor, fontFamily: 'monospace' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, background: '#0a0a0a', border: '1px solid ' + roleColor + '33', borderRadius: 10, padding: '14px 18px', borderLeft: '3px solid ' + roleColor }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
                        <span style={{ background: roleColor + '22', color: roleColor, padding: '3px 10px', borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: '0.15em' }}>{roleLabel}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#f9fafb', fontWeight: 700 }}>{c.caseId}</span>
                        {claimBadge && <span style={{ background: claimBadge.bg, color: claimBadge.color, padding: '2px 8px', borderRadius: 3, fontSize: 8, fontWeight: 900, letterSpacing: '0.1em' }}>{claimBadge.label}</span>}
                        {confBadge && <span style={{ background: confBadge.color + '15', color: confBadge.color, padding: '2px 8px', borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{confBadge.label}</span>}
                        {c.paidUsd && (
                          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#ef4444', fontWeight: 900, fontFamily: 'monospace' }}>
                            {fmtUsd(c.paidUsd)} est. proceeds
                          </span>
                        )}
                      </div>
                      {c.evidence && (
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>{c.evidence}</div>
                      )}
                      {c.sourceUrl && (
                        <a href={c.sourceUrl} target="_blank" style={{ display: 'inline-block', marginTop: 8, fontSize: 9, color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
                          {c.sourceLabel ?? 'Source'} →
                        </a>
                      )}
                      <CashoutProof handle={kol.handle} caseId={c.caseId} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ASSOCIATED WALLETS ── */}
        {(kol?.wallets?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Associated Wallets — On-Chain Record</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {kol.wallets.map(w => (
                <div key={w.id} style={{ background: '#0a0a0a', border: '1px solid #111827', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                  onClick={() => copyAddr(w.address)}>
                  <span style={{ background: '#3b82f615', color: '#3b82f6', padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', flexShrink: 0 }}>DOCUMENTED</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', flex: 1 }}>{truncAddr(w.address)}</span>
                  {w.label && <span style={{ fontSize: 10, color: '#4b5563', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{w.label}</span>}
                  {w.confidence && (
                    <span style={{ background: (STRENGTH_BADGE[w.confidence]?.color ?? '#6b7280') + '15', color: STRENGTH_BADGE[w.confidence]?.color ?? '#6b7280', padding: '2px 6px', borderRadius: 3, fontSize: 8, fontWeight: 900, letterSpacing: '0.1em' }}>
                      {w.confidence.toUpperCase()}
                    </span>
                  )}
                  <span style={{ background: '#1f2937', color: '#4b5563', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{w.chain}</span>
                  <span style={{ fontSize: 10, color: copied === w.address ? '#10b981' : '#374151', fontFamily: 'monospace', minWidth: 40, textAlign: 'right' as const }}>{copied === w.address ? '✓ copied' : 'copy'}</span>
                  <a href={explorerUrl(w.address, w.chain)} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize: 9, fontWeight: 900, color: '#F85B05', textDecoration: 'none', letterSpacing: '0.1em', whiteSpace: 'nowrap' as const }}>ON-CHAIN →</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LAST REVIEWED ── */}
        {(kol as any).last_reviewed_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 16px', background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em' }}>LAST REVIEWED</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4b5563' }}>
              {new Date((kol as any).last_reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {(kol as any).version_note && (
              <span style={{ fontSize: 10, color: '#6b7280', borderLeft: '1px solid #1f2937', paddingLeft: 12 }}>{(kol as any).version_note}</span>
            )}
          </div>
        )}

        {/* ── VOLUNTARY DISCLOSURE ── */}
        {transparency.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>Voluntary Disclosure</SectionHeader>
            <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                This actor has voluntarily submitted wallet addresses for public monitoring.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {transparency.map((w: any) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0a0a0a', borderRadius: 6 }}>
                    <span style={{ background: '#4b556315', color: '#6b7280', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{w.chain}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{w.address.length > 20 ? w.address.slice(0, 8) + '...' + w.address.slice(-6) : w.address}</span>
                    {w.label && <span style={{ fontSize: 10, color: '#4b5563' }}>{w.label}</span>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: '#374151', fontFamily: 'monospace', letterSpacing: '0.1em' }}>SELF-SUBMITTED — NOT OSINT ATTRIBUTED</div>
            </div>
          </div>
        )}

        {/* ── EVIDENCE STANDARD ── */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1f293788', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 10 }}>EVIDENCE STANDARD — IMPORTANT NOTICE</div>
          <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.75 }}>
            This profile is an evidence-based analytical summary derived from publicly accessible blockchain records, archived public communications, and cited third-party sources. All statements are categorized as: (i) directly observable on-chain facts, (ii) source-attributed public claims, or (iii) analytical inferences based on disclosed methodology. INTERLIGENS does not assert criminal guilt, intent, or legal liability. USD figures are methodology-based estimates. Terms including "high-risk," "linked," "associated," "rug-linked," and "estimated" reflect analytical classification — not judicial findings.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {[
              ['VERIFIED ON-CHAIN', '#10b981'],
              ['SOURCE-ATTRIBUTED', '#3b82f6'],
              ['ANALYTICAL ESTIMATE', '#f59e0b'],
              ['NOT A JUDICIAL FINDING', '#6b7280'],
            ].map(([label, color]) => (
              <span key={label} style={{ background: color + '15', border: '1px solid ' + color + '44', color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>{label}</span>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: '#1f2937', display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
            <a href="/en/correction" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>Request a correction →</a>
            <a href="/en/methodology" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>View methodology →</a>
            <span>INTERLIGENS Delaware C-Corp · Not legal advice · legal@interligens.com</span>
          </div>
        </div>

        {/* CROSS-NAV */}
        <div style={{ marginTop: 40, borderTop: '1px solid #1a1a1a', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#27272a', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>See also</span>
          <a href="/scan" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Scan &rarr;</a>
          <a href="/en/kol" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>KOL Registry &rarr;</a>
          <a href="/en/explorer" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Case Explorer &rarr;</a>
        </div>

      </div>
    </div>
  )
}
