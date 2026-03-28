'use client'
import React, { useState } from 'react'

interface CashoutProofProps {
  handle: string
  caseId: string
  tokenCA?: string
}

const CA_MAP: Record<string, string | null> = {
  'BOTIFY-MAIN':   'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb',
  'GHOST-RUG':     'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb',
  'DIONE-RUG':     'De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump',
  'SERIAL-12RUGS': 'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb',
}

export default function CashoutProof({ handle, caseId, tokenCA }: CashoutProofProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (data) { setOpen(!open); return }
    setLoading(true)
    try {
      const ca = tokenCA ?? (CA_MAP as any)[caseId] ?? null
      const url = '/api/kol/' + handle + '/cashout' + (ca ? '?ca=' + encodeURIComponent(ca) : '')
      const res = await fetch(url)
      const d = await res.json()
      setData(d)
      setOpen(true)
    } catch {}
    setLoading(false)
  }

  const fmtDate = (iso: string) => iso.slice(0, 10)
  const truncAddr = (a: string) => a ? a.slice(0, 8) + '...' + a.slice(-4) : '—'

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={load} disabled={loading}
        style={{ background: 'none', border: '1px solid #1f2937', borderRadius: 5, padding: '5px 14px', fontSize: 9, fontWeight: 900, color: loading ? '#374151' : '#F85B05', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
        {loading ? 'LOADING...' : open ? '▲ HIDE CASHOUT PROOF' : '▼ CASHOUT PROOF ON-CHAIN →'}
      </button>

      {open && data?.found && (
        <div style={{ marginTop: 10, background: '#050505', border: '1px solid #1f2937', borderRadius: 8, overflow: 'hidden' }}>

          {/* Summary */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #0f172a', display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>{data.receives?.length ?? 0}</div>
              <div style={{ fontSize: 8, color: '#374151', letterSpacing: '0.1em' }}>TRANSFERS IN</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>{data.sells?.length ?? 0}</div>
              <div style={{ fontSize: 8, color: '#374151', letterSpacing: '0.1em' }}>SELL / SWAP TX</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>{data.total ?? 0}</div>
              <div style={{ fontSize: 8, color: '#374151', letterSpacing: '0.1em' }}>TOTAL TX</div>
            </div>
          </div>

          {/* Receives */}
          {(data.receives ?? []).slice(0, 5).map((tx: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #0f172a' }}>
              <span style={{ background: '#10b98122', color: '#10b981', fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 3, flexShrink: 0 }}>IN</span>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>{Number(tx.tokenAmount).toLocaleString()} tokens</span>
              <span style={{ fontSize: 9, color: '#374151' }}>{fmtDate(tx.date)}</span>
              <span style={{ fontSize: 9, color: '#4b5563' }}>from {truncAddr(tx.from)}</span>
              <a href={tx.solscanUrl} target="_blank" style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 900, color: '#F85B05', textDecoration: 'none', fontFamily: 'monospace', flexShrink: 0 }}>TX →</a>
            </div>
          ))}

          {/* Sells */}
          {(data.sells ?? []).slice(0, 8).map((tx: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #0f172a' }}>
              <span style={{ background: '#ef444422', color: '#ef4444', fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 3, flexShrink: 0 }}>OUT</span>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{Number(tx.tokenAmount).toLocaleString()} tokens</span>
              <span style={{ fontSize: 9, color: '#374151' }}>{fmtDate(tx.date)}</span>
              <span style={{ fontSize: 9, color: '#4b5563' }}>{truncAddr(tx.walletAddress)}</span>
              <a href={tx.solscanUrl} target="_blank" style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 900, color: '#F85B05', textDecoration: 'none', fontFamily: 'monospace', flexShrink: 0 }}>TX →</a>
            </div>
          ))}

          {data.total === 0 && (
            <div style={{ padding: '16px', fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>No transactions found for known token CAs on these wallets.</div>
          )}
        </div>
      )}
    </div>
  )
}
