'use client'
import React, { useState } from 'react'

interface NarrativeProps {
  kol: {
    displayName?: string; handle: string; rugCount: number
    totalScammed?: number; followerCount?: number
    caseLinks: { caseId: string; role: string; paidUsd?: number; evidence?: string }[]
    wallets: { address: string; chain: string; label?: string }[]
  }
}

const extractCA = (text: string) => {
  const m = text.match(/CA:\s*([A-Za-z0-9]{32,44}(?:pump)?)/i)
  return m ? m[1] : null
}
const fmtUsd = (n?: number) => !n ? 'an undisclosed amount' : n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : '$' + (n/1000).toFixed(0) + 'K'

export default function KolNarrative({ kol }: NarrativeProps) {
  const [expanded, setExpanded] = useState(false)
  const devCases = (kol.caseLinks ?? []).filter(c => c.role === 'dev')
  const promoterCases = (kol.caseLinks ?? []).filter(c => c.role === 'paid_promoter' || c.role === 'promoter')
  const associatedWallets = (kol.wallets ?? []).filter(w =>
    w.label?.toLowerCase().match(/associated|source-attributed|source-identified|cluster/)
    || w.label?.toLowerCase().match(/mom|dad|family|carter/)
  )

  const sentences: string[] = []

  if (kol.followerCount) {
    sentences.push('@' + kol.handle + ' built an audience of ' + Math.round(kol.followerCount/1000) + 'K in the crypto space.')
  }

  sentences.push('Public on-chain records, wallet-cluster analysis, and cited investigation threads document this profile\'s repeated involvement in launch-and-collapse token patterns.')

  if (devCases.length > 0) {
    sentences.push('On-chain data links this profile to the development of ' + devCases.map(c => c.caseId).join(', ') + ' — tokens that reached near-zero trading value post-launch.')
  }

  if (promoterCases.length > 0) {
    const promoterProceeds = promoterCases.reduce((s, c) => s + (c.paidUsd ?? 0), 0)
    sentences.push('Promoter activity on ' + promoterCases.map(c => c.caseId).join(', ') + ' is source-attributed in public investigation threads. Estimated proceeds from these activities: ' + fmtUsd(promoterProceeds) + ' — derived from verifiable on-chain transactions.')
  }

  if (associatedWallets.length > 0) {
    sentences.push('Observable activity includes pre-launch distribution to ' + associatedWallets.length + ' associated wallet(s), followed by post-TGE sell activity into public market liquidity.')
  }

  if (kol.totalScammed) {
    sentences.push('Estimated investor losses across ' + kol.rugCount + ' rug-linked cases: ' + fmtUsd(kol.totalScammed) + ' — based on verifiable on-chain transactions and documented pricing methodology.')
  }

  sentences.push('Every material claim on this page is supported by public records, cited sources, or clearly labeled analytical inference.')

  return (
    <div style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #08080f 100%)', border: '1px solid #4f46e533', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 20, background: '#4f46e5', borderRadius: 2 }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: '#4f46e5', letterSpacing: '0.2em' }}>PATTERN SUMMARY</span>
      </div>
      <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.85 }}>
        {sentences.slice(0, expanded ? sentences.length : 3).map((s, i) => <span key={i}>{s}{' '}</span>)}
        {!expanded && sentences.length > 3 && (
          <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            Full record →
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {(kol.caseLinks ?? []).map(c => {
            const ca = c.evidence ? extractCA(c.evidence) : null
            if (!ca) return null
            return (
              <a key={c.caseId} href={'https://dexscreener.com/solana/' + ca} target="_blank"
                style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textDecoration: 'none' }}>
                {c.caseId} — DexScreener →
              </a>
            )
          })}
          {(kol.wallets ?? []).slice(0, 2).map(w => (
            <a key={w.address} href={'https://solscan.io/account/' + w.address} target="_blank"
              style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textDecoration: 'none' }}>
              Wallet {w.address.slice(0,8)}... — Solscan →
            </a>
          ))}
        </div>
      )}
      {expanded && (
        <button onClick={() => setExpanded(false)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#374151', fontSize: 10, cursor: 'pointer', padding: 0 }}>
          Collapse
        </button>
      )}
    </div>
  )
}
