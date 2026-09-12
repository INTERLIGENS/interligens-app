'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import BetaNav from '@/components/beta/BetaNav'
import IntelligenceOverview from '@/components/explorer/IntelligenceOverview'

type Kind = '' | 'case' | 'launch' | 'platform'

interface Actor { handle: string; displayName: string | null; role: string; tier: string | null }
interface Dossier {
  id: string; kind: string; title: string; summary: string | null; primaryDate: string
  linkedActors: Actor[]
  proceedsObservedTotal: number | null; proceedsCoverage: string
  href: string
  snapshotCount?: number
}
interface Stats {
  publishedProfiles: number; minimumObservedProceeds: number
  documentedWallets: number; linkedLaunches: number; strongEvidenceCount: number
}

// Les quatre tables de libelles ont ete RETIREES avec leurs pastilles.

const KIND_TABS: { key: Kind; label: string }[] = [
  { key: '', label: 'TOUT' }, { key: 'case', label: 'CAS' }, { key: 'launch', label: 'LANCEMENTS' },
  { key: 'platform', label: 'PLATEFORME' },
]

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toLocaleString('fr-FR')
}
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) } catch { return '' }
}
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)

export default function ExplorerFR() {
  const [items, setItems] = useState<Dossier[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [kind, setKind] = useState<Kind>('')
  const [search, setSearch] = useState('')
  const [hasProceeds, setHasProceeds] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (kind) params.set('kind', kind)
    if (search) params.set('search', search)
    if (hasProceeds) params.set('hasProceeds', 'true')
    fetch('/api/explorer?' + params)
      .then(r => r.json())
      .then(d => {
        setItems((d.items ?? []).map((i: Dossier) => ({ ...i, href: i.href.replace('/en/', '/fr/') })))
        setStats(d.stats ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [kind, search, hasProceeds])

  useEffect(() => { load() }, [kind, hasProceeds, load])

  const proceedsText = (d: Dossier) => {
    if (!d.proceedsObservedTotal || d.proceedsObservedTotal === 0) return null
    if (d.proceedsCoverage === 'partial' || d.proceedsCoverage === 'estimated')
      return 'Min. ' + fmtUsd(d.proceedsObservedTotal) + ' observe \u2014 couverture partielle'
    return fmtUsd(d.proceedsObservedTotal) + ' documente'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#FF6B00', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 8 }}>EXPLORATEUR DE L'INTELLIGENCE SCAM</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Explorateur<span style={{ color: '#FF6B00' }}>.</span></h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
            Lancements documentes, clusters de cas et reseaux d'acteurs dans l'espace d'influence crypto.
          </p>
        </div>

        <IntelligenceOverview locale="fr" />

        {/* STATS */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, padding: '14px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
            {[
              { v: stats.publishedProfiles, l: 'PROFILS PUBLIES', c: '#F85B05' },
              { v: fmtUsd(stats.minimumObservedProceeds), l: 'MIN. PRODUITS OBSERVES', c: '#ef4444', r: true },
              { v: stats.documentedWallets, l: 'WALLETS DOCUMENTES', c: '#8b5cf6' },
              { v: stats.linkedLaunches, l: 'LANCEMENTS LIES', c: '#ec4899' },
              { v: stats.strongEvidenceCount, l: 'PREUVES SOLIDES', c: '#3b82f6' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, minWidth: 110 }}>
                <div style={{ color: s.c, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{s.r ? s.v : String(s.v)}</div>
                <div style={{ color: '#6b7280', fontSize: 9, letterSpacing: '0.12em', fontFamily: 'monospace' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {KIND_TABS.map(t => (
            <button key={t.key} onClick={() => setKind(t.key)} style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 14px', borderRadius: 4,
              cursor: 'pointer', border: 'none', background: kind === t.key ? '#F85B05' : '#111',
              color: kind === t.key ? '#fff' : '#4b5563', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: '#1e2330', margin: '0 4px' }} />
          <button onClick={() => setHasProceeds(!hasProceeds)} style={{
            fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', padding: '6px 12px', borderRadius: 4,
            cursor: 'pointer', border: hasProceeds ? '1px solid #10b98166' : '1px solid #1e2330',
            background: hasProceeds ? '#10b98115' : '#111', color: hasProceeds ? '#10b981' : '#4b5563',
          }}>AVEC PRODUITS</button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Rechercher cas ou acteur..." style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 4, padding: '6px 12px', color: '#f9fafb', fontSize: 12, fontFamily: 'monospace', outline: 'none', width: 180 }} />
            <button onClick={load} style={{ background: '#1e2330', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#6b7280', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>CHERCHER</button>
          </div>
        </div>

        {/* DOSSIER CARDS */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em', padding: '60px 0', textAlign: 'center' }}>CHARGEMENT...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', padding: '60px 0', textAlign: 'center' }}>AUCUN DOSSIER CORRESPONDANT</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map(d => {
              // ─── LES HUIT CHAMPS NE SONT PLUS SERVIS ──────────────────────
              // Les replis `??` d'ici auraient fait lire « CASE CLUSTER » aux
              // quatorze et « PARTIAL » aux quatorze. Une absence devenue
              // affirmation. RIEN NE LES REMPLACE : aucun substitut, sinon on
              // recree un differentiel sur L'EXISTENCE de l'information.
              const proceeds = proceedsText(d)
              const visibleActors = d.linkedActors.slice(0, 4)

              return (
                <Link key={d.id} href={d.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 12, padding: '24px 28px', transition: 'border-color 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2330')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {(d.snapshotCount ?? 0) > 0 && <Badge label={`${d.snapshotCount} preuves au dossier`} color="#3b82f6" />}
                      <span style={{ marginLeft: 'auto', color: '#374151', fontSize: 10, fontFamily: 'monospace' }}>{fmtDate(d.primaryDate)}</span>
                    </div>

                    <div style={{ fontSize: 22, fontWeight: 900, color: '#f9fafb', letterSpacing: '-0.01em', marginBottom: 6 }}>{d.title}</div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {visibleActors.map(a => (
                        <span key={a.handle} style={{ background: '#F85B0510', border: '1px solid #F85B0533', color: '#F85B05', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                          @{a.handle}
                        </span>
                      ))}
                    </div>

                    {d.summary && (
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 14, borderLeft: '2px solid #1e2330', paddingLeft: 12 }}>
                        {d.summary}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {proceeds && (
                        <span style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 800, fontSize: 14 }}>{proceeds}</span>
                      )}
                      <span style={{ marginLeft: 'auto', color: '#F85B05', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>VOIR DOSSIER {'\u2192'}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1e2330', paddingTop: 20, color: '#374151', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>Ne constitue pas un conseil financier {'\u2014'} INTERLIGENS Intelligence {'\u00a9'} 2026</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/fr/kol" style={{ color: '#4b5563', textDecoration: 'none' }}>CLASSEMENT {'\u2192'}</Link>
            <Link href="/fr/methodology" style={{ color: '#4b5563', textDecoration: 'none' }}>METHODOLOGIE {'\u2192'}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
