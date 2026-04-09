'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ScamTimeline from '@/components/timeline/ScamTimeline'

export default function TimelinePage() {
  const params = useParams()
  const address = params?.address as string
  const locale = params?.locale as string
  const lang = (locale === 'fr' ? 'fr' : 'en') as 'en' | 'fr'
  const isFr = lang === 'fr'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    if (!address) return
    setLoading(true)
    fetch(`/api/scan/timeline/${address}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [address])

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>

      {/* TOP NAV */}
      <div style={{ borderBottom: '1px solid #1f2937', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href={`/${locale}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: '#4f46e5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔗</div>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#f9fafb', letterSpacing: '0.05em' }}>INTERLIGENS</span>
          </div>
        </a>
        <div style={{ width: 1, height: 20, background: '#1f2937' }} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {isFr ? 'Suivi de l\'argent' : 'Follow the Money'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href={`/en/scan/${address}/timeline`} style={{ fontSize: 11, color: lang === 'en' ? '#818cf8' : '#6b7280', fontWeight: 700, textDecoration: 'none' }}>EN</a>
          <a href={`/fr/scan/${address}/timeline`} style={{ fontSize: 11, color: lang === 'fr' ? '#818cf8' : '#6b7280', fontWeight: 700, textDecoration: 'none' }}>FR</a>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>

        {/* PAGE TITLE */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 8 }}>
            {isFr ? 'SUIVI DE L\'ARGENT' : 'FOLLOW THE MONEY'}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 8 }}>
            {isFr ? 'Comment ce scam s\'est déroulé' : 'How this scam unfolded'}
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' }}>{address}</div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #1f2937', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#6b7280', fontSize: 13 }}>{isFr ? 'Analyse en cours...' : 'Analyzing...'}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <ScamTimeline data={data ?? { found: false }} lang={lang} />
        )}

        {/* BACK TO SCAN */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <a href={"/" + locale + "/scan?addr=" + address} style={{ display: "inline-block", background: "#1e293b", border: "1px solid #374151", borderRadius: 8, color: "#94a3b8", padding: "10px 20px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>{isFr ? "Retour au scan" : "Back to scan"}</a>
        </div>
      </div>
    </div>
  )
}
