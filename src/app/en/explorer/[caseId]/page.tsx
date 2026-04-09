'use client'
import BetaNav from "@/components/beta/BetaNav";
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Actor { handle: string; displayName: string | null; role: string; tier: string | null }
interface Signal { type: string; labelEn: string; strength: string; reasonSummary: string }
interface Snapshot { id: string; snapshotType: string; title: string; caption: string; sourceLabel: string | null; observedAt: string | null; imageUrl: string | null }

const SNAP_TYPE: Record<string, { l: string; c: string }> = {
  document_excerpt: { l: 'DOCUMENT', c: '#3b82f6' },
  tweet_post:       { l: 'SOCIAL POST', c: '#F85B05' },
  evidence_image:   { l: 'ON-CHAIN', c: '#10b981' },
  other:            { l: 'EVIDENCE', c: '#6b7280' },
}

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)

const fmtDate = (d: string | null) => {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return null }
}

export default function CaseDossierPage() {
  const params = useParams()
  const caseId = params?.caseId as string
  const [dossier, setDossier] = useState<any>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [coordination, setCoordination] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!caseId) return
    // Fetch dossier from explorer
    fetch('/api/explorer?kind=case&search=' + encodeURIComponent(caseId))
      .then(r => r.json())
      .then(d => {
        const match = (d.items ?? []).find((i: any) => i.title === caseId)
        if (match) setDossier(match)
      })
      .catch(() => {})

    // Fetch snapshots
    fetch('/api/evidence/snapshots?relationType=case&relationKey=' + encodeURIComponent(caseId))
      .then(r => r.json())
      .then(d => setSnapshots(d.snapshots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em' }}>LOADING DOSSIER...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px' }}>
        {/* TITLE */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Badge label="CASE CLUSTER" color="#ef4444" />
            {dossier?.documentationStatus && <Badge label={dossier.documentationStatus.toUpperCase()} color={dossier.documentationStatus === 'documented' ? '#10b981' : '#f59e0b'} />}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>{caseId}</h1>
          {dossier?.summary && <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>{dossier.summary}</p>}
        </div>

        {/* LINKED ACTORS */}
        {dossier?.linkedActors?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 12 }}>LINKED ACTORS ({dossier.linkedActorsCount})</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dossier.linkedActors.map((a: Actor) => (
                <a key={a.handle} href={`/en/kol/${a.handle}`} style={{ background: '#F85B0510', border: '1px solid #F85B0533', color: '#F85B05', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 5, fontFamily: 'monospace', textDecoration: 'none' }}>
                  @{a.handle}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* COORDINATION SIGNALS */}
        {dossier?.strongestFlags?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 12 }}>COORDINATION SIGNALS</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dossier.strongestFlags.map((f: string) => (
                <Badge key={f} label={f.replace(/_/g, ' ')} color="#f97316" />
              ))}
            </div>
          </div>
        )}

        {/* EVIDENCE SNAPSHOTS */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 16 }}>EVIDENCE ON FILE ({snapshots.length})</div>

          {snapshots.length === 0 ? (
            <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '24px', textAlign: 'center', color: '#374151', fontSize: 12, fontFamily: 'monospace' }}>
              No approved evidence snapshots yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {snapshots.map(snap => {
                const st = SNAP_TYPE[snap.snapshotType] ?? SNAP_TYPE.other
                const date = fmtDate(snap.observedAt)
                return (
                  <div key={snap.id} style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Image area or placeholder */}
                    {snap.imageUrl ? (
                      <div style={{ width: '100%', height: 200, background: `url(${snap.imageUrl}) center/cover no-repeat` }} />
                    ) : (
                      <div style={{ width: '100%', height: 120, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        <span style={{ color: '#374151', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em' }}>EVIDENCE ON FILE</span>
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ padding: '18px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Badge label={st.l} color={st.c} />
                        {date && <span style={{ color: '#374151', fontSize: 10, fontFamily: 'monospace' }}>{date}</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', marginBottom: 6 }}>{snap.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{snap.caption}</div>
                      {snap.sourceLabel && (
                        <div style={{ marginTop: 10, fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>
                          Source: {snap.sourceLabel}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1e2330', paddingTop: 20, color: '#374151', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>Not financial advice {'\u2014'} INTERLIGENS Intelligence {'\u00a9'} 2026</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/en/explorer" style={{ color: '#4b5563', textDecoration: 'none' }}>EXPLORER {'\u2192'}</a>
            <a href="/en/methodology" style={{ color: '#4b5563', textDecoration: 'none' }}>METHODOLOGY {'\u2192'}</a>
            <a href="/en/kol" style={{ color: '#4b5563', textDecoration: 'none' }}>LEADERBOARD {'\u2192'}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
