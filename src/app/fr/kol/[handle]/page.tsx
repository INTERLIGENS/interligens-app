'use client'
import KolNarrative from '@/components/kol/KolNarrative'
import CashoutProof from '@/components/kol/CashoutProof'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface KolPortefeuille {
  id: string; address: string; chain: string; label?: string; status: string
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
  wallets: KolPortefeuille[]; caseLinks: KolCaseLink[]
  riskFlag?: string; confidence?: string; bio?: string
}

const ROLE_COLOR: Record<string, string> = {
  paid_promoter: '#ef4444', advisor: '#f59e0b', promoter: '#f97316',
  dev: '#8b5cf6', insider: '#ec4899',
}
const ROLE_LABEL: Record<string, string> = {
  paid_promoter: 'PROMOTEUR RÉMUNÉRÉ — SOURCES CITÉES',
  advisor:       'CONSEILLER — SOURCES CITÉES',
  promoter:      'PROMOTEUR — SOURCES CITÉES',
  dev:           'DÉVELOPPEUR',
  insider:       'INITIÉ',
}
const CLAIM_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  verified_onchain:    { label: 'VÉRIFIÉ ON-CHAIN',      color: '#10b981', bg: '#10b98115' },
  source_attributed:   { label: 'SOURCE CITÉE',          color: '#3b82f6', bg: '#3b82f615' },
  analytical_estimate: { label: 'ESTIMATION ANALYTIQUE', color: '#f59e0b', bg: '#f59e0b15' },
}
const CONF_BADGE: Record<string, { label: string; color: string }> = {
  confirmed:      { label: 'CONFIRMÉ',   color: '#10b981' },
  strong_linkage: { label: 'LIEN FORT',  color: '#f59e0b' },
  provisional:    { label: 'PROVISOIRE', color: '#6b7280' },
}

export default function KOLPageFR() {
  const params = useParams()
  const handle = params?.handle as string
  const [kol, setKol] = useState<KOL | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!handle) return
    fetch('/api/kol/' + handle)
      .then(r => r.json())
      .then(d => { if (d.found) setKol(d.kol); else setNotFound(true) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [handle])

  const fmtUsd = (n?: number) => {
    if (!n) return 'Inconnu'
    return '$' + (n >= 1000000 ? (n/1000000).toFixed(1) + 'M' : n >= 1000 ? (n/1000).toFixed(0) + 'K' : n.toString())
  }
  const truncAddr = (a: string) => a.length > 20 ? a.slice(0, 8) + '...' + a.slice(-6) : a
  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => { setCopied(addr); setTimeout(() => setCopied(null), 1800) })
  }
  const explorerUrl = (addr: string, chain: string) =>
    chain === 'ETH' ? 'https://etherscan.io/address/' + addr : 'https://solscan.io/account/' + addr

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em' }}>CHARGEMENT DU PROFIL...</div>
    </div>
  )
  if (notFound || !kol) return (
    <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace' }}>PROFIL INTROUVABLE</div>
    </div>
  )

  const displayName = kol.displayName ?? kol.handle
  const followers = kol.followerCount ?? kol.followers

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>

      {/* HEADER */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/fr" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>PROFIL D'INTELLIGENCE DES RISQUES</span>
        {kol.verified && (
          <span style={{ marginLeft: 'auto', background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.15em' }}>
            ✓ VÉRIFIÉ
          </span>
        )}
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px' }}>

        {/* ID CARD */}
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
                ACTEUR À HAUT RISQUE · {kol.platform.toUpperCase()} · {kol.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: '#4b5563', fontFamily: 'monospace' }}>@{kol.handle}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{fmtUsd(kol.totalScammed ?? undefined)}</div>
              <div style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>Pertes estimées investisseurs</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a href={`/api/pdf/kol?handle=${kol.handle}&mode=retail`} target="_blank" style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 12px', borderRadius: 4, background: '#F85B05', color: '#fff', textDecoration: 'none' }}>
                  ↓ RAPPORT PUBLIC
                </a>
                <a href={`/api/pdf/kol?handle=${kol.handle}&mode=lawyer`} target="_blank" style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 12px', borderRadius: 4, background: '#0a0a0a', border: '1px solid #374151', color: '#9ca3af', textDecoration: 'none' }}>
                  ↓ VERSION JURIDIQUE
                </a>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: kol.notes ? 20 : 0 }}>
            {[
              { value: String(kol.rugCount), label: 'Cas liés à des rugs', color: '#ef4444' },
              { value: followers ? Math.round(followers/1000) + 'K' : '?', label: 'Audience touchée', color: '#f59e0b' },
              { value: String(kol?.wallets?.length ?? 0), label: 'Portefeuilles documentés', color: '#8b5cf6' },
              { value: String(kol?.caseLinks?.length ?? 0), label: 'Cas documentés', color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 18px', textAlign: 'center' as const, flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {kol.notes && (
            <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#94a3b8', borderLeft: '3px solid #4f46e5', lineHeight: 1.6 }}>
              {kol.notes}
            </div>
          )}
        </div>

        {/* PATTERN SUMMARY */}
        <KolNarrative kol={{ ...kol, followerCount: followers }} />

        {/* HISTORIQUE DES CAS */}
        {(kol?.caseLinks?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: '#1f2937', display: 'inline-block' }} />
              Historique des cas documentés
              <span style={{ flex: 1, height: 1, background: '#1f2937', display: 'inline-block' }} />
            </div>
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
                            {fmtUsd(c.paidUsd)} gains estimés
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
                      {(c.claimType === 'verified_onchain' || c.claimType === 'source_attributed') && (
                        <CashoutProof handle={kol.handle} caseId={c.caseId} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PORTEFEUILLES ASSOCIÉS */}
        {(kol?.wallets?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 1, background: '#1f2937', display: 'inline-block' }} />
              Portefeuilles associés — Registre on-chain
              <span style={{ flex: 1, height: 1, background: '#1f2937', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {kol.wallets.map(w => (
                <div key={w.id} style={{ background: '#0a0a0a', border: '1px solid #111827', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                  onClick={() => copyAddr(w.address)}>
                  <span style={{ background: '#3b82f615', color: '#3b82f6', padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', flexShrink: 0 }}>DOCUMENTÉ</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', flex: 1 }}>{truncAddr(w.address)}</span>
                  {w.label && <span style={{ fontSize: 10, color: '#4b5563', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{w.label}</span>}
                  <span style={{ background: '#1f2937', color: '#4b5563', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{w.chain}</span>
                  <span style={{ fontSize: 10, color: copied === w.address ? '#10b981' : '#374151', fontFamily: 'monospace', minWidth: 40, textAlign: 'right' as const }}>{copied === w.address ? '✓ copié' : 'copier'}</span>
                  <a href={explorerUrl(w.address, w.chain)} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize: 9, fontWeight: 900, color: '#F85B05', textDecoration: 'none', letterSpacing: '0.1em', whiteSpace: 'nowrap' as const }}>ON-CHAIN →</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STANDARD DE PREUVE */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1f293788', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 10 }}>STANDARD DE PREUVE — AVIS IMPORTANT</div>
          <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.75 }}>
            Ce profil est une synthèse analytique fondée sur des éléments de preuve, issus d'enregistrements publics de la blockchain, de communications publiques archivées et de sources tierces citées. Toutes les affirmations sont classées comme : (i) faits directement observables on-chain, (ii) déclarations publiques attribuées à des sources, ou (iii) inférences analytiques fondées sur une méthodologie divulguée. INTERLIGENS n'allègue aucune culpabilité pénale, intention ou responsabilité juridique. Les montants en USD sont des estimations méthodologiques. Les termes « haut risque », « lié », « associé », « lié à un rug » et « estimé » reflètent une classification analytique — et non des conclusions judiciaires.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {[
              ['VÉRIFIÉ ON-CHAIN',           '#10b981'],
              ['SOURCE CITÉE',               '#3b82f6'],
              ['ESTIMATION ANALYTIQUE',      '#f59e0b'],
              ['NON UNE DÉCISION JUDICIAIRE','#6b7280'],
            ].map(([label, color]) => (
              <span key={label} style={{ background: color + '15', border: '1px solid ' + color + '44', color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>{label}</span>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 10, color: '#1f2937', display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
            <a href="/fr/correction" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>Demander une correction →</a>
            <a href="/fr/methodology" style={{ color: '#374151', textDecoration: 'none', fontWeight: 700 }}>Voir la méthodologie →</a>
            <span>INTERLIGENS Delaware C-Corp · Ne constitue pas un conseil juridique · legal@interligens.com</span>
          </div>
        </div>

      </div>
    </div>
  )
}
