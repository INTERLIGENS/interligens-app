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

const CAT_COLORS: Record<string,string> = {
  scammer:'#ef4444', team:'#f97316', kol:'#f59e0b',
  cex:'#3b82f6', mixer:'#8b5cf6', victim:'#6b7280', other:'#6b7280'
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

  const inp: React.CSSProperties = { background:'#1f2937', border:'1px solid #374151', borderRadius:6, color:'#f9fafb', padding:'7px 10px', fontSize:12, width:'100%' }
  const btn = (bg: string, sm=false): React.CSSProperties => ({ background:bg, border:'none', borderRadius:6, color:'#fff', padding:sm?'4px 10px':'8px 16px', fontSize:sm?10:12, fontWeight:600, cursor:'pointer' })

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

  const lbl = (t: string) => <label style={{ color:'#9ca3af', fontSize:11, display:'block', marginBottom:3 }}>{t}</label>

  return (
    <div style={{ minHeight:'100vh', background:'#030712', color:'#f9fafb', fontFamily:'Inter, sans-serif', padding:24 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#818cf8' }}>🏷 WALLET LABELS</div>
        <span style={{ background:'#1e1b4b', color:'#818cf8', border:'1px solid #3730a3', padding:'2px 10px', borderRadius:6, fontSize:11, fontWeight:700 }}>{labels.length} labels</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => { setShowForm(!showForm); setEditId(null) }} style={btn('#4f46e5')}>
            {showForm ? '✕ Cancel' : '+ Add label'}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ fontWeight:700, marginBottom:16, color:'#818cf8' }}>{editId ? 'Edit Label' : 'New Label'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
            <div>{lbl('Address')}<input style={inp} value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} placeholder="0x... or wallet" /></div>
            <div>{lbl('Chain')}<select style={inp} value={form.chain} onChange={e => setForm(p=>({...p,chain:e.target.value}))}>{CHAINS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div>{lbl('Label')}<input style={inp} value={form.label} onChange={e => setForm(p=>({...p,label:e.target.value}))} placeholder="Name / entity" /></div>
            <div>{lbl('Category')}<select style={inp} value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div>{lbl('Confidence')}<select style={inp} value={form.confidence} onChange={e => setForm(p=>({...p,confidence:e.target.value}))}>{CONFIDENCES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div>{lbl('Source')}<input style={inp} value={form.source} onChange={e => setForm(p=>({...p,source:e.target.value}))} placeholder="admin / etherscan / osint_pdf" /></div>
            <div>{lbl('Source URL')}<input style={inp} value={form.sourceUrl} onChange={e => setForm(p=>({...p,sourceUrl:e.target.value}))} placeholder="https://..." /></div>
            <div>{lbl('Notes')}<input style={inp} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" /></div>
            <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#9ca3af', cursor:'pointer' }}>
                <input type="checkbox" checked={form.verified} onChange={e => setForm(p=>({...p,verified:e.target.checked}))} />
                Verified (public)
              </label>
            </div>
          </div>
          <button onClick={save} style={btn('#059669')}>
            {editId ? '✓ Save changes' : '✓ Create label'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...inp, width:220 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address or name..." onKeyDown={e => e.key==='Enter' && fetchLabels()} />
        <button onClick={fetchLabels} style={btn('#374151', true)}>Search</button>
        <div style={{ display:'flex', gap:6 }}>
          {['all',...CATEGORIES].map(c => (
            <button key={c} onClick={() => setFilterCat(c)} style={{ ...btn(filterCat===c?(CAT_COLORS[c]??'#4f46e5'):'#1e293b', true), border:`1px solid ${filterCat===c?(CAT_COLORS[c]??'#4f46e5'):'#374151'}` }}>{c}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {['all','true','false'].map(v => (
            <button key={v} onClick={() => setFilterVerified(v)} style={{ ...btn(filterVerified===v?'#4f46e5':'#1e293b', true), border:`1px solid ${filterVerified===v?'#4f46e5':'#374151'}` }}>
              {v==='all'?'All':v==='true'?'✓ Verified':'⏳ Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#4b5563' }}>Loading...</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#0f172a', borderRadius:10, overflow:'hidden' }}>
          <thead>
            <tr style={{ background:'#1e293b' }}>
              {['Category','Label','Address','Chain','Confidence','Source','Status','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:'0.05em', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} style={{ borderBottom:'1px solid #1f2937' }}>
                <td style={{ padding:'10px 12px' }}>
                  <span style={{ background:(CAT_COLORS[l.category]??'#6b7280')+'22', color:CAT_COLORS[l.category]??'#6b7280', border:`1px solid ${CAT_COLORS[l.category]??'#6b7280'}`, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700 }}>{l.category}</span>
                </td>
                <td style={{ padding:'10px 12px', fontWeight:600, fontSize:12 }}>{l.label}</td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{l.address.slice(0,12)}...{l.address.slice(-6)}</td>
                <td style={{ padding:'10px 12px', fontSize:11, color:'#6b7280' }}>{l.chain}</td>
                <td style={{ padding:'10px 12px' }}>
                  <span style={{ background:l.confidence==='HIGH'?'#10b98122':l.confidence==='MEDIUM'?'#f59e0b22':'#ef444422', color:l.confidence==='HIGH'?'#10b981':l.confidence==='MEDIUM'?'#f59e0b':'#ef4444', padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700 }}>{l.confidence}</span>
                </td>
                <td style={{ padding:'10px 12px', fontSize:11, color:'#6b7280' }}>{l.source}</td>
                <td style={{ padding:'10px 12px' }}>
                  <button onClick={() => toggleVerified(l)} style={{ background:l.verified?'#10b98122':'#f59e0b22', color:l.verified?'#10b981':'#f59e0b', border:`1px solid ${l.verified?'#10b981':'#f59e0b'}`, padding:'2px 10px', borderRadius:4, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                    {l.verified ? '✓ Verified' : '⏳ Pending'}
                  </button>
                </td>
                <td style={{ padding:'10px 12px', display:'flex', gap:6 }}>
                  <button onClick={() => edit(l)} style={btn('#1d4ed8', true)}>Edit</button>
                  <button onClick={() => del(l.id)} style={btn('#ef444422', true)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign:'center', padding:40, color:'#4b5563' }}>No labels found</div>
      )}
    </div>
  )
}
