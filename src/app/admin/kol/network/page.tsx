'use client'
import React, { useEffect, useState } from 'react'

const SOLSCAN = (addr: string) => 'https://solscan.io/account/' + addr
const ETHERSCAN = (addr: string) => 'https://etherscan.io/address/' + addr
const explorerUrl = (addr: string, chain: string) => chain === 'ETH' ? ETHERSCAN(addr) : SOLSCAN(addr)

export default function KolNetworkPage() {
  const [data, setData] = useState<any>(null)
  const [publishability, setPublishability] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [adminToken, setAdminToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [investigating, setInvestigating] = useState<string | null>(null)
  const [investigateResults, setInvestigateResults] = useState<Record<string, any>>({})

  const investigate = async (handle: string) => {
    setInvestigating(handle)
    try {
      const res = await fetch('/api/admin/kol/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ handle })
      })
      const d = await res.json()
      setInvestigateResults(prev => ({ ...prev, [handle]: d }))
    } catch(e) { console.error(e) }
    setInvestigating(null)
  }

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
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-80 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Admin Token</h2>
        <input type="password" value={adminToken} onChange={e => setAdminToken(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono"
          placeholder="Enter admin token" />
        <button onClick={() => { localStorage.setItem('admin_token', adminToken); setLoading(true); load(adminToken) }}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm">
          ACCESS
        </button>
      </div>
    </div>
  )

  if (loading) return <div className="min-h-screen bg-gray-950 text-gray-500 flex items-center justify-center font-mono text-xs">LOADING NETWORK...</div>

  const selectedKol = data?.kols?.find((k: any) => k.handle === selected)
  const selectedWallets = data?.wallets?.filter((w: any) => w.kolHandle === selected) ?? []
  const selectedCases = data?.cases?.filter((c: any) => c.kolHandle === selected) ?? []
  const selectedConnections = data?.connections?.filter((c: any) => c.a === selected || c.b === selected) ?? []

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <a href="/admin" className="text-orange-400 hover:text-orange-300 text-xs font-semibold transition">← ADMIN</a>
        <span className="text-gray-500">·</span>
        <span className="text-gray-400 text-xs uppercase tracking-wider">KOL NETWORK — INTER-PROJECT LIAISON</span>
        <div className="ml-auto flex gap-4">
          <span className="text-xs text-gray-500">{data?.kols?.length ?? 0} SCAMMERS</span>
          <span className="text-xs text-gray-500">{data?.connections?.length ?? 0} CONNECTIONS</span>
          <span className="text-xs text-gray-500">{Object.keys(data?.projectMap ?? {}).length} PROJECTS</span>
        </div>
      </div>

      <div className="flex h-[calc(100vh-49px)]">

        {/* LEFT — KOL list */}
        <div className="w-72 border-r border-gray-800 overflow-y-auto bg-gray-900">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">CONFIRMED SCAMMERS</div>
          {(data?.kols ?? []).map((kol: any) => {
            const isSelected = selected === kol.handle
            const connections = (data?.connections ?? []).filter((c: any) => c.a === kol.handle || c.b === kol.handle)
            return (
              <div key={kol.handle} onClick={() => setSelected(isSelected ? null : kol.handle)}
                className={`px-4 py-3 border-b border-gray-800 cursor-pointer transition ${isSelected ? "bg-gray-800 border-l-[3px] border-l-orange-500" : "border-l-[3px] border-l-transparent hover:bg-gray-900/50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-orange-400 flex-shrink-0">
                    {(kol.displayName ?? kol.handle)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{kol.displayName}</div>
                    <div className="text-xs text-gray-500 font-mono">@{kol.handle}</div>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-1">
                    {kol.verified && <span className="text-[9px] text-green-400 font-bold">✓ VERIFIED</span>}
                    {publishability[kol.handle] && (
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-gray-800 ${publishability[kol.handle].publishable ? "text-green-400" : "text-red-400"}`}>
                        {publishability[kol.handle].publishable ? '● PUB' : '● BLOCKED'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] text-red-400 font-semibold">{kol.rugCount} rugs</span>
                  <button
                    onClick={e => { e.stopPropagation(); investigate(kol.handle) }}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded bg-transparent border-none cursor-pointer transition ${investigating === kol.handle ? "text-orange-400" : "text-gray-500 hover:text-orange-400"}`}>
                    {investigating === kol.handle ? '⟳' : '🔍'} {investigating === kol.handle ? 'scanning...' : 'investigate'}
                    {investigateResults[kol.handle] ? ' ✓' : ''}
                  </button>

                  <span className="text-[10px] text-orange-400">{fmtUsd(kol.totalScammed)}</span>
                  <span className="text-[10px] text-gray-500">{kol.walletCount}w · {kol.caseCount}c</span>
                  {connections.length > 0 && <span className="text-[10px] text-orange-300">{connections.length} links</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div>
              {/* Project clusters */}
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">PROJECT CLUSTERS — WHO WORKED TOGETHER</div>
              <div className="flex flex-col gap-3">
                {Object.entries(data?.projectMap ?? {}).map(([project, handles]: [string, any]) => (
                  <div key={project} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-sm font-bold text-white">{project}</span>
                      <span className="text-xs text-gray-500">{handles.length} actor{handles.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {handles.map((h: string) => {
                        const k = (data?.kols ?? []).find((k: any) => k.handle === h)
                        const cases = (data?.cases ?? []).filter((c: any) => c.kolHandle === h && c.caseId === project)
                        return (
                          <div key={h} onClick={() => setSelected(h)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-500 transition">
                            <div className="text-xs font-semibold text-white">{k?.displayName ?? h}</div>
                            <div className="text-[10px] text-gray-500 font-mono">@{h}</div>
                            {cases.map((c: any) => (
                              <div key={c.id} className="mt-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[9px] bg-gray-800 text-gray-300 font-bold">
                                  {c.role.toUpperCase().replace('_', ' ')}
                                </span>
                                {c.paidUsd && <span className="text-[10px] text-red-400 ml-1">{fmtUsd(c.paidUsd)}</span>}
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
            <div className="space-y-6">
              {/* KOL detail */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-800 border-2 border-orange-500 flex items-center justify-center text-xl font-bold text-orange-400">
                  {(selectedKol?.displayName ?? selected)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xl font-bold">{selectedKol?.displayName}</div>
                  <div className="text-xs text-gray-500 font-mono">@{selected} · {selectedKol?.rugCount} rugs · {fmtUsd(selectedKol?.totalScammed ?? 0)}</div>
                </div>
                <a href={'/en/kol/' + selected} target="_blank" className="ml-auto text-xs font-semibold text-orange-400 hover:text-orange-300 transition border border-gray-800 px-3 py-1.5 rounded-lg">
                  PUBLIC PAGE →
                </a>
              </div>

              {/* Connections */}
              {selectedConnections.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">NETWORK CONNECTIONS</div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedConnections.map((conn: any, i: number) => {
                      const peer = conn.a === selected ? conn.b : conn.a
                      const peerKol = (data?.kols ?? []).find((k: any) => k.handle === peer)
                      return (
                        <div key={i} onClick={() => setSelected(peer)}
                          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-500 transition">
                          <div className="text-xs font-semibold text-orange-400">{peerKol?.displayName ?? peer}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">via {conn.project}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Cases */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">CASES</div>
                <div className="flex flex-col gap-2">
                  {selectedCases.map((c: any) => (
                    <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 border-l-[3px] border-l-orange-500">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 font-bold">{c.role.toUpperCase().replace('_', ' ')}</span>
                        <span className="font-mono text-sm font-semibold">{c.caseId}</span>
                        {c.paidUsd && <span className="ml-auto text-sm text-red-400 font-bold">{fmtUsd(c.paidUsd)}</span>}
                      </div>
                      {c.evidence && <div className="text-xs text-gray-500 font-mono leading-relaxed">{c.evidence}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Wallets */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">WALLETS — ON-CHAIN PROOF</div>
                <div className="flex flex-col gap-1">
                  {selectedWallets.map((w: any) => (
                    <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-800 text-red-400 font-bold flex-shrink-0">ACTIVE</span>
                      <span className="font-mono text-xs text-gray-400 flex-1">{w.address}</span>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-500">{w.chain}</span>
                      {w.label && <span className="text-xs text-gray-500 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{w.label}</span>}
                      <a href={explorerUrl(w.address, w.chain)} target="_blank" className="text-[10px] font-bold text-orange-400 hover:text-orange-300 transition border border-gray-800 px-2 py-1 rounded whitespace-nowrap">
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
