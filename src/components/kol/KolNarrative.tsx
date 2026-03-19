'use client'
import React, { useState } from 'react'

interface NarrativeProps {
  kol: {
    displayName?: string
    handle: string
    rugCount: number
    totalScammed?: number
    followerCount?: number
    caseLinks: { caseId: string; role: string; paidUsd?: number; evidence?: string }[]
    wallets: { address: string; chain: string; label?: string }[]
  }
}

const extractCA = (text: string) => {
  const m = text.match(/CA:\s*([A-Za-z0-9]{32,44}(?:pump)?)/i)
  return m ? m[1] : null
}
const fmtUsd = (n?: number) => !n ? 'an unknown amount' : n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : '$' + (n/1000).toFixed(0) + 'K'

export default function KolNarrative({ kol }: NarrativeProps) {
  const [expanded, setExpanded] = useState(false)
  const devCases = kol.caseLinks.filter(c => c.role === 'dev')
  const promoterCases = kol.caseLinks.filter(c => c.role === 'paid_promoter' || c.role === 'promoter')
  const familyWallets = kol.wallets.filter(w => w.label?.toLowerCase().match(/mom|dad|family|carter/))
  const sentences: string[] = []
  if (kol.followerCount) sentences.push('@' + kol.handle + ' built a following of ' + Math.round(kol.followerCount/1000) + 'K people in the crypto space.')
  if (devCases.length > 0) sentences.push('Behind the scenes, they developed and launched ' + devCases.map(c => c.caseId).join(', ') + ' — tokens that collapsed shortly after launch.')
  if (promoterCases.length > 0) sentences.push('They were paid to promote ' + promoterCases.map(c => c.caseId).join(', ') + ', earning an estimated ' + fmtUsd(promoterCases.reduce((s,c) => s+(c.paidUsd??0),0)) + ' in the process.')
  if (familyWallets.length > 0) sentences.push('On-chain evidence shows ' + familyWallets.length + ' connected wallet(s) linked to family members received token allocations before public launch, then sold at peak price.')
  if (kol.totalScammed) sentences.push('Retail investors are estimated to have lost ' + fmtUsd(kol.totalScammed) + ' across ' + kol.rugCount + ' documented projects.')
  sentences.push('All wallet addresses and transactions are publicly verifiable on-chain. No allegation — only facts.')
  return (
    <div style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #08080f 100%)', border: '1px solid #4f46e533', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 20, background: '#4f46e5', borderRadius: 2 }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: '#4f46e5', letterSpacing: '0.2em' }}>WHAT HAPPENED — IN PLAIN ENGLISH</span>
      </div>
      <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.9 }}>
        {sentences.slice(0, expanded ? sentences.length : 3).map((s, i) => <span key={i}>{s}{' '}</span>)}
        {!expanded && sentences.length > 3 && <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Read more →</button>}
      </div>
      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {kol.caseLinks.map(c => {
            const ca = c.evidence ? extractCA(c.evidence) : null
            if (!ca) return null
            return <a key={c.caseId} href={'https://dexscreener.com/solana/' + ca} target="_blank" style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textDecoration: 'none' }}>{c.caseId} on DexScreener →</a>
          })}
          {kol.wallets.slice(0,2).map(w => <a key={w.address} href={'https://solscan.io/account/' + w.address} target="_blank" style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textDecoration: 'none' }}>{(w.label??'Wallet').split(' ')[0]} on Solscan →</a>)}
        </div>
      )}
      {expanded && <button onClick={() => setExpanded(false)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#374151', fontSize: 10, cursor: 'pointer', padding: 0 }}>Show less</button>}
    </div>
  )
}
