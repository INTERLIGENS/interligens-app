'use client'
import React, { useState, useEffect } from 'react'

const CATEGORIES = ['scammer','team','kol','cex','mixer','victim','other']
const CONFIDENCES = ['HIGH','MEDIUM','LOW']
const CHAINS = ['solana','evm','any']

interface Label {
  id: string
  address: string
  chain: string
  label: string
  category: string
  confidence: string
  source: string
  sourceUrl?: string
  verified: boolean
  notes?: string
  createdAt: string
}

export default function LabelsAdminPage() {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterVerified, setFilterVerified] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)

  const [form, setForm] = useState({ address:'', chain:'solana', label:'', category:'scammer', confidence:'HIGH', source:'admin', sourceUrl:'', verified:true, notes:'' })

  async function fetchLabels() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCat !== 'all') params.set('category', filterCat)
    if (filterVerified !== 'all') params.set('verified', filterVerified)
    if (search) params.set('address', search)
    const r = await fetch('/api/admin/labels?' + params.toString())
    if (r.ok) setLabels(await r.json())
    setLoading(false)
  }

  useEffect(() => { fetchLabels() }, [filterCat, filterVerified])

  async function save() {
    const method = editId ? 'PATCH' : 'POST'
    const url = editId ? `/api/admin/labels/${editId}` : '/api/admin/labels'
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    if (r.ok) { setShowForm(false); setEditId(null); setForm({ address:'', chain:'solana', label:'', category:'scammer', confidence:'HIGH', source:'admin', sourceUrl:'', verified:true, notes:'' }); fetchLabels() }
    else { const e = await r.json(); alert(e.error ?? 'Error') }
  }

  async function toggleVerified(l: Label) {
    await fetch(`/api/admin/labels/${l.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ verified: !l.verified }) })
    fetchLabels()
  }

  async function del(id: string) {
    if (!confirm('Delete this label?')) return
    await fetch(`/api/admin/labels/${id}`, { method:'DELETE' })
    fetchLabels()
  }

  function edit(l: Label) {
    setForm({ address:l.address, chain:l.chain, label:l.label, category:l.category, confidence:l.confidence, source:l.source, sourceUrl:l.sourceUrl??'', verified:l.verified, notes:l.notes??'' })
    setEditId(l.id)
    setShowForm(true)
  }

  const filtered = labels.filter(l =>
    (!search || l.address.includes(search.toLowerCase()) || l.label.toLowerCase().includes(search.toLowerCase()))
  )

  const inpCls = "w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
  const lbl = (t: string) => <label className="text-xs text-gray-500 mb-1 block">{t}</label>

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">Wallet Labels</h1>
            <p className="text-gray-400 text-sm">{labels.length} labels</p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setEditId(null) }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition">
            {showForm ? '✕ Cancel' : '+ Add label'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{editId ? 'Edit Label' : 'New Label'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>{lbl('Address')}<input className={inpCls} value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} placeholder="0x... or wallet" /></div>
              <div>{lbl('Chain')}<select className={inpCls} value={form.chain} onChange={e => setForm(p=>({...p,chain:e.target.value}))}>{CHAINS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div>{lbl('Label')}<input className={inpCls} value={form.label} onChange={e => setForm(p=>({...p,label:e.target.value}))} placeholder="Name / entity" /></div>
              <div>{lbl('Category')}<select className={inpCls} value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div>{lbl('Confidence')}<select className={inpCls} value={form.confidence} onChange={e => setForm(p=>({...p,confidence:e.target.value}))}>{CONFIDENCES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div>{lbl('Source')}<input className={inpCls} value={form.source} onChange={e => setForm(p=>({...p,source:e.target.value}))} placeholder="admin / etherscan / osint_pdf" /></div>
              <div>{lbl('Source URL')}<input className={inpCls} value={form.sourceUrl} onChange={e => setForm(p=>({...p,sourceUrl:e.target.value}))} placeholder="https://..." /></div>
              <div>{lbl('Notes')}<input className={inpCls} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={form.verified} onChange={e => setForm(p=>({...p,verified:e.target.checked}))} />
                  Verified (public)
                </label>
              </div>
            </div>
            <button onClick={save}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition">
              {editId ? '✓ Save changes' : '✓ Create label'}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <input className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 w-56" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address or name..." onKeyDown={e => e.key==='Enter' && fetchLabels()} />
            <button onClick={fetchLabels} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 transition">Search</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all',...CATEGORIES].map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterCat===c ? "bg-orange-500 text-black" : "bg-[#1a1a1a] text-gray-300 hover:bg-gray-700"}`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all','true','false'].map(v => (
              <button key={v} onClick={() => setFilterVerified(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterVerified===v ? "bg-orange-500 text-black" : "bg-[#1a1a1a] text-gray-300 hover:bg-gray-700"}`}>
                {v==='all'?'All':v==='true'?'✓ Verified':'⏳ Pending'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  {['Category','Label','Address','Chain','Confidence','Source','Status','Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-gray-800 hover:bg-[#0a0a0a]/50 transition">
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-gray-300 font-semibold">{l.category}</span>
                    </td>
                    <td className="py-2 px-3 font-semibold">{l.label}</td>
                    <td className="py-2 px-3 font-mono text-xs text-gray-500">{l.address.slice(0,12)}...{l.address.slice(-6)}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{l.chain}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] font-semibold ${l.confidence==='HIGH'?'text-green-400':l.confidence==='MEDIUM'?'text-orange-400':'text-red-400'}`}>{l.confidence}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{l.source}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => toggleVerified(l)}
                        className={`inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] font-semibold ${l.verified?'text-green-400':'text-orange-400'} hover:bg-gray-700 transition`}>
                        {l.verified ? '✓ Verified' : '⏳ Pending'}
                      </button>
                    </td>
                    <td className="py-2 px-3 flex gap-1">
                      <button onClick={() => edit(l)} className="px-2 py-1 rounded text-xs bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 transition">Edit</button>
                      <button onClick={() => del(l.id)} className="px-2 py-1 rounded text-xs bg-[#1a1a1a] text-red-400 hover:bg-gray-700 transition">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500">No labels found</div>
        )}
      </div>
    </div>
  )
}
