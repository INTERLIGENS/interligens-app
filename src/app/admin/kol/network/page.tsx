'use client'
import React, { useEffect, useState } from 'react'

const SOLSCAN = (addr: string) => 'https://solscan.io/account/' + addr
const ETHERSCAN = (addr: string) => 'https://etherscan.io/address/' + addr
const explorerUrl = (addr: string, chain: string) => chain === 'ETH' ? ETHERSCAN(addr) : SOLSCAN(addr)

const ROLE_COLOR: Record<string, string> = {
  dev: '#8b5cf6', paid_promoter: '#ef4444', advisor: '#f59e0b', promoter: '#f97316', insider: '#ec4899',
}

export default function KolNetworkPage() {
  const [data, setData] = useState<any>(null)
  const [publishability, setPublishability] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [adminToken, setAdminToken] = useState('')
  const [authed, setAuthed] = useState(false)

  const load = async (token: string) => {
    const res = await fetch('/api/admin/kol/network', { headers: { Authorization: 'Bearer ' + token } })
    if (res.ok) {
        const d = await res.json()
        setData(d)
        setAuthed(true)
        // Fetch publishability for each KOL
        const results: Record<string, any> = {}
        for (const kol of d.kols ?? []) {
          try {
            const pr = await fetch('/api/admin/kol/publishability?handle=' + kol.handle, { headers: { Authorization: 'Bearer ' + token } })
            if (pr.ok) results[kol.handle] = await pr.json()
          } catch {}
        }
        setPublishability(results)
      }
    setLoading(false)
  }

  useEffect(() => {
    const t = localStorage.getItem('admin_token') ?? ''
    if (t) { setAdminToken(t); load(t) }
    else setLoading(false)
  }, [])

  const fmtUsd = (n: number) => n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : n >= 1000 ? '$' + (n/1000).toFixed(0) + 'K' : '$' + n

  if (!authed && !loading) return (
    <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 12, padding: 32, width: 320 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#F85B05', letterSpacing: '0.2em', marginBottom: 16 }}>ADMIN TOKEN</div>
        <input type="password" value={adminToken} onChange={e => setAdminToken(e.target.value)}
          style={{ width: '100%', background: '#111', border: '1px solid #374151', borderRadius: 6, padding: '10px 12px', color: '#fff', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' as const }}
          placeholder="Enter admin token" />
        <button onClick={() => { localStorage.setItem('admin_token', adminToken); setLoading(true); load(adminToken) }}
          style={{ width: '100%', marginTop: 12, background: '#F85B05', color: '#000', fontWeight: 900, fontSize: 11, padding: '10px', borderRadius: 6, border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
          ACCESS
        </button>
      </div>
    </div>
  )

  if (loading) return <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontFamily: 'monospace', fontSize: 11 }}>LOADING NETWORK...</div>

  const selectedKol = data?.kols?.find((k: any) => k.handle === selected)
  const selectedWallets = data?.wallets?.filter((w: any) => w.kolHandle === selected) ?? []
  const selectedCases = data?.cases?.filter((c: any) => c.kolHandle === selected) ?? []
  const selectedConnections = data?.connections?.filter((c: any) => c.a === selected || c.b === selected) ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/admin" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em' }}>← ADMIN</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em' }}>KOL NETWORK — INTER-PROJECT LIAISON</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 10, color: '#374151' }}>{data?.kols?.length ?? 0} SCAMMERS</span>
          <span style={{ fontSize: 10, color: '#374151' }}>{data?.connections?.length ?? 0} CONNECTIONS</span>
          <span style={{ fontSize: 10, color: '#374151' }}>{Object.keys(data?.projectMap ?? {}).length} PROJECTS</span>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 49px)' }}>

        {/* LEFT — KOL list */}
        <div style={{ width: 280, borderRight: '1px solid #111827', overflowY: 'auto' as const, background: '#050505' }}>
          <div style={{ padding: '12px 16px', fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', borderBottom: '1px solid #111827' }}>CONFIRMED SCAMMERS</div>
          {(data?.kols ?? []).map((kol: any) => {
            const isSelected = selected === kol.handle
            const connections = (data?.connections ?? []).filter((c: any) => c.a === kol.handle || c.b === kol.handle)
            return (
              <div key={kol.handle} onClick={() => setSelected(isSelected ? null : kol.handle)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #0f172a', cursor: 'pointer', background: isSelected ? '#0f172a' : 'transparent', borderLeft: isSelected ? '3px solid #F85B05' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ef444422', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#ef4444', flexShrink: 0 }}>
                    {(kol.displayName ?? kol.handle)[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{kol.displayName}</div>
                    <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>@{kol.handle}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2 }}>
                    {kol.verified && <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 900 }}>✓ VERIFIED</span>}
                    {publishability[kol.handle] && (
                      <span style={{ fontSize: 7, fontWeight: 900, padding: '2px 6px', borderRadius: 3, background: publishability[kol.handle].publishable ? '#10b98122' : '#ef444422', color: publishability[kol.handle].publishable ? '#10b981' : '#ef4444' }}>
                        {publishability[kol.handle].publishable ? '● PUBLISHABLE' : '● BLOCKED'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>{kol.rugCount} rugs</span>
                  <span style={{ fontSize: 9, color: '#f59e0b' }}>{fmtUsd(kol.totalScammed)}</span>
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{kol.walletCount}w · {kol.caseCount}c</span>
                  {connections.length > 0 && <span style={{ fontSize: 9, color: '#8b5cf6' }}>{connections.length} links</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: 24 }}>
          {!selected ? (
            <div>
              {/* Project clusters */}
              <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 16 }}>PROJECT CLUSTERS — WHO WORKED TOGETHER</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                {Object.entries(data?.projectMap ?? {}).map(([project, handles]: [string, any]) => (
                  <div key={project} style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#f9fafb' }}>{project}</span>
                      <span style={{ fontSize: 9, color: '#374151' }}>{handles.length} actor{handles.length > 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {handles.map((h: string) => {
                        const k = (data?.kols ?? []).find((k: any) => k.handle === h)
                        const cases = (data?.cases ?? []).filter((c: any) => c.kolHandle === h && c.caseId === project)
                        return (
                          <div key={h} onClick={() => setSelected(h)}
                            style={{ background: '#111', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f9fafb' }}>{k?.displayName ?? h}</div>
                            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>@{h}</div>
                            {cases.map((c: any) => (
                              <div key={c.id} style={{ marginTop: 4 }}>
                                <span style={{ background: (ROLE_COLOR[c.role] ?? '#6b7280') + '22', color: ROLE_COLOR[c.role] ?? '#6b7280', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 3 }}>
                                  {c.role.toUpperCase().replace('_', ' ')}
                                </span>
                                {c.paidUsd && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 6 }}>{fmtUsd(c.paidUsd)}</span>}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* KOL detail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: '#ef444422', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                  {(selectedKol?.displayName ?? selected)[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{selectedKol?.displayName}</div>
                  <div style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>@{selected} · {selectedKol?.rugCount} rugs · {fmtUsd(selectedKol?.totalScammed ?? 0)}</div>
                </div>
                <a href={'/en/kol/' + selected} target="_blank" style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 900, color: '#F85B05', textDecoration: 'none', border: '1px solid #F85B0544', padding: '6px 14px', borderRadius: 6 }}>
                  PUBLIC PAGE →
                </a>
              </div>

              {/* Connections */}
              {selectedConnections.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>NETWORK CONNECTIONS</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {selectedConnections.map((conn: any, i: number) => {
                      const peer = conn.a === selected ? conn.b : conn.a
                      const peerKol = (data?.kols ?? []).find((k: any) => k.handle === peer)
                      return (
                        <div key={i} onClick={() => setSelected(peer)}
                          style={{ background: '#8b5cf622', border: '1px solid #8b5cf644', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{peerKol?.displayName ?? peer}</div>
                          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>via {conn.project}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Cases */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>CASES</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  {selectedCases.map((c: any) => (
                    <div key={c.id} style={{ background: '#0a0a0a', border: '1px solid ' + (ROLE_COLOR[c.role] ?? '#374151') + '33', borderRadius: 8, padding: '12px 16px', borderLeft: '3px solid ' + (ROLE_COLOR[c.role] ?? '#374151') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ background: (ROLE_COLOR[c.role] ?? '#374151') + '22', color: ROLE_COLOR[c.role] ?? '#6b7280', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 3 }}>{c.role.toUpperCase().replace('_', ' ')}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{c.caseId}</span>
                        {c.paidUsd && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ef4444', fontWeight: 900 }}>{fmtUsd(c.paidUsd)}</span>}
                      </div>
                      {c.evidence && <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', lineHeight: 1.5 }}>{c.evidence}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Wallets */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>WALLETS — ON-CHAIN PROOF</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  {selectedWallets.map((w: any) => (
                    <div key={w.id} style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: '#ef444422', color: '#ef4444', fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 3, flexShrink: 0 }}>ACTIVE</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', flex: 1 }}>{w.address}</span>
                      <span style={{ fontSize: 9, background: '#1f2937', color: '#4b5563', padding: '2px 6px', borderRadius: 3 }}>{w.chain}</span>
                      {w.label && <span style={{ fontSize: 10, color: '#4b5563', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{w.label}</span>}
                      <a href={explorerUrl(w.address, w.chain)} target="_blank" style={{ fontSize: 9, fontWeight: 900, color: '#F85B05', textDecoration: 'none', border: '1px solid #F85B0544', padding: '4px 10px', borderRadius: 4, whiteSpace: 'nowrap' as const }}>
                        ON-CHAIN →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
