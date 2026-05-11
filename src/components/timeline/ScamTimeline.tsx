'use client'
import React, { useEffect, useState } from 'react'

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
}

const RISK_LABELS: Record<string, Record<string, string>> = {
  en: { low: 'LOW RISK', medium: 'MEDIUM', high: 'HIGH RISK', critical: '⚠ CRITICAL' },
  fr: { low: 'FAIBLE', medium: 'MOYEN', high: 'ÉLEVÉ', critical: '⚠ CRITIQUE' },
}

interface Chapter {
  id: string
  order: number
  icon: string
  titleEn: string
  titleFr: string
  risk: string
  descEn: string
  descFr: string
  actors: { label: string; type: string; flagged: boolean; wallet: string }[]
  evidence: string | null
  flagCount: number
  redFlag?: boolean
}

interface TimelineData {
  found: boolean
  caseId?: string
  title?: string
  pivotAddress?: string
  chain?: string
  chapters?: Chapter[]
  stats?: { totalNodes: number; totalEdges: number; flaggedNodes: number; corrobScore: number; chain: string }
}

interface Props {
  data: TimelineData
  lang?: 'en' | 'fr'
}

function ellip(s: string, max = 20) { return s && s.length > max ? s.slice(0,10)+'...'+s.slice(-6) : s }

export default function ScamTimeline({ data, lang = 'en' }: Props) {
  const [activeChapter, setActiveChapter] = useState<string | null>(null)
  const [pageUrl, setPageUrl] = useState('')
  useEffect(() => { setPageUrl(window.location.href) }, [])
  const isFr = lang === 'fr'

  if (!data.found || !data.chapters) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', background: '#0f172a', borderRadius: 12, border: '1px solid #1f2937' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{isFr ? 'Aucune investigation trouvée' : 'No investigation found'}</div>
        <div style={{ fontSize: 12 }}>{isFr ? 'Ce token n\'a pas encore été analysé.' : 'This token has not been investigated yet.'}</div>
      </div>
    )
  }

  const { chapters, stats } = data
  const corrobColor = (stats?.corrobScore ?? 0) >= 70 ? '#ef4444' : (stats?.corrobScore ?? 0) >= 40 ? '#f59e0b' : '#10b981'

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#f9fafb' }}>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', border: '1px solid #312e81', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 4 }}>
              {isFr ? 'INVESTIGATION INTERLIGENS' : 'INTERLIGENS INVESTIGATION'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{data.title}</div>
            <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginTop: 4 }}>{ellip(data.pivotAddress ?? '', 32)} · {data.chain?.toUpperCase()}</div>
          </div>
          <div style={{ background: corrobColor + '22', border: `1px solid ${corrobColor}55`, borderRadius: 10, padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: corrobColor }}>{stats?.corrobScore}</div>
            <div style={{ fontSize: 10, color: corrobColor, fontWeight: 700 }}>{isFr ? 'CORROBORATION' : 'CORROBORATION'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: isFr ? 'Entités' : 'Entities', value: stats?.totalNodes },
            { label: isFr ? 'Liens' : 'Links', value: stats?.totalEdges },
            { label: isFr ? 'Suspects' : 'Suspects', value: stats?.flaggedNodes, color: '#ef4444' },
            { label: isFr ? 'Étapes' : 'Steps', value: chapters.length },
          ].map(s => (
            <div key={s.label} style={{ fontSize: 12, color: s.color ?? '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: s.color ?? '#f9fafb' }}>{s.value}</span> {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 27, top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, #312e81, #ef444444)', zIndex: 0 }} />

        {chapters.map((chapter, idx) => {
          const isActive = activeChapter === chapter.id
          const riskColor = RISK_COLORS[chapter.risk] ?? '#6b7280'
          const riskLabel = RISK_LABELS[lang][chapter.risk]
          const title = isFr ? chapter.titleFr : chapter.titleEn
          const desc = isFr ? chapter.descFr : chapter.descEn
          const isLast = idx === chapters.length - 1

          return (
            <div key={chapter.id} style={{ display: 'flex', gap: 16, marginBottom: isLast ? 0 : 20, position: 'relative', zIndex: 1 }}>
              {/* Circle */}
              <div
                onClick={() => setActiveChapter(isActive ? null : chapter.id)}
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: chapter.icon === '04' ? riskColor : (isActive ? riskColor : '#0f172a'),
                  border: `2px solid ${riskColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.05em',
                  cursor: 'pointer', flexShrink: 0,
                  color: chapter.icon === '04' ? '#fff' : riskColor,
                  boxShadow: chapter.icon === '04' ? `0 0 24px ${riskColor}99` : (isActive ? `0 0 20px ${riskColor}66` : 'none'),
                  transition: 'all 0.2s',
                }}
              >
                {chapter.icon}
              </div>

              {/* Content */}
              <div
                onClick={() => setActiveChapter(isActive ? null : chapter.id)}
                style={{
                  flex: 1, background: isActive ? '#0f172a' : '#0a0f1a',
                  border: `1px solid ${isActive ? riskColor + '88' : '#1f2937'}`,
                  borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
                  <span style={{ background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}44`, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{riskLabel}</span>
                  {chapter.redFlag && <span style={{ fontSize: 11 }}>🚩</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4b5563' }}>{isActive ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{desc}</div>

                {/* Expanded details */}
                {isActive && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${riskColor}33` }}>
                    {chapter.actors.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                          {isFr ? 'Acteurs identifiés' : 'Identified actors'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {chapter.actors.map((actor, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', borderRadius: 6, padding: '6px 10px' }}>
                              <span style={{ fontSize: 10, background: actor.flagged ? '#ef444422' : '#1f2937', color: actor.flagged ? '#ef4444' : '#6b7280', border: `1px solid ${actor.flagged ? '#ef4444' : '#374151'}`, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                                {actor.type.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: actor.flagged ? '#fca5a5' : '#f9fafb' }}>{actor.label}</span>
                              {actor.flagged && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠ SUSPECT</span>}
                              {actor.wallet && actor.wallet !== actor.label && (
                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4b5563', marginLeft: 'auto' }}>{ellip(actor.wallet)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {chapter.evidence && (
                      <div style={{ fontSize: 11, color: '#6b7280', background: '#0f172a', borderRadius: 6, padding: '6px 10px', fontFamily: 'monospace' }}>
                        📎 {isFr ? 'Evidence' : 'Evidence'}: {ellip(chapter.evidence, 60)}
                      </div>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(`${title}\n${desc}\n\nvia INTERLIGENS — app.interligens.com`) }}
                        style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 5, color: '#94a3b8', padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
                      >
                        📋 {isFr ? 'Copier' : 'Copy'}
                      </button>
                      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔴 ${title} — Evidence documented by INTERLIGENS\n\n${pageUrl}`)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 5, color: '#94a3b8', padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>X {isFr ? 'Partager' : 'Share'}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* RED FLAG SUMMARY */}
      <div style={{ marginTop: 24, background: '#ef444411', border: '1px solid #ef444433', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
          🚩 {isFr ? 'Red Flags Détectés' : 'Red Flags Detected'} ({chapters.filter(c => c.redFlag).length})
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
          {chapters.filter(c => c.redFlag).map(c => `• ${isFr ? c.titleFr : c.titleEn}`).join('\n')}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: '#6b7280' }}>
          {isFr
            ? 'Ce rapport est fourni à titre informatif uniquement et ne constitue pas un conseil juridique ou financier.'
            : 'This report is for informational purposes only and does not constitute legal or financial advice.'
          }
        </div>
      </div>
    </div>
  )
}
