'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Node, Edge } from 'reactflow'
import dynamic from 'next/dynamic'

const GraphCanvas = dynamic(() => import('@/components/graph/GraphCanvas'), { ssr: false })

interface GraphNode { id: string; type: string; label: string; metadata: string; posX: number; posY: number; flagged: boolean }
interface GraphEdge { id: string; sourceId: string; targetId: string; relation: string; confidence: string; evidence?: string }
interface GraphCase { id: string; title: string; pivotAddress: string; chain: string; notes?: string; createdAt: string; nodes: GraphNode[]; edges: GraphEdge[]; _count?: { nodes: number; edges: number } }

const NODE_TYPES = ['wallet','cex','person','domain','social','token','contract']
const RELATIONS = ['funded_by','deployed','deposited_to','family_of','promoted','controls','linked_to','withdrew_from']
const CONFIDENCES = ['HIGH','MEDIUM','LOW']
const NODE_COLORS: Record<string, string> = { wallet:'#3b82f6', cex:'#f59e0b', person:'#10b981', domain:'#8b5cf6', social:'#06b6d4', token:'#f97316', contract:'#6366f1' }
const CONF_COLORS: Record<string, string> = { HIGH:'#10b981', MEDIUM:'#f59e0b', LOW:'#ef4444' }

const I18N = {
  en: { newCase:'+ New case', cancel:'✕ Cancel', cases:'CASES', noCase:'No case selected', noSub:'Create or select a case on the left', loading:'Loading...', addNode:'+ Add node', closePanel:'✕ Close', addBtn:'✓ Add', createBtn:'🚀 Create & enrich', tools:'TOOLS', caseTitle:'Case title', pivotAddr:'Pivot address', chain:'Chain', notes:'Notes', context:'Context...', type:'Type', labelAddr:'Label / address', placeholder:'0x... or name', suspect:'Mark as suspect', nextLink:'NEXT LINK (drag between nodes)', relation:'Relation', confidence:'Confidence', evidence:'Evidence (TX hash / URL)', selectedNode:'SELECTED NODE', graph:'Graph', list:'List', entities:'Entities', links:'Links', label:'Label / Identity', address:'Address', status:'Status', source:'Source', target:'Target', suspectBadge:'SUSPECT', nodes:'nodes', linksCount:'links' },
  fr: { newCase:'+ Nouveau dossier', cancel:'✕ Annuler', cases:'DOSSIERS', noCase:'Aucun dossier sélectionné', noSub:'Crée un dossier ou sélectionne-en un à gauche', loading:'Chargement...', addNode:'+ Ajouter un nœud', closePanel:'✕ Fermer', addBtn:'✓ Ajouter', createBtn:'🚀 Créer et enrichir', tools:'OUTILS', caseTitle:'Titre du dossier', pivotAddr:'Adresse pivot', chain:'Chaîne', notes:'Notes', context:'Contexte...', type:'Type', labelAddr:'Label / adresse', placeholder:'0x... ou nom', suspect:'Marqué comme suspect', nextLink:'PROCHAIN LIEN (glisser entre nœuds)', relation:'Relation', confidence:'Confiance', evidence:'Evidence (TX hash / URL)', selectedNode:'NŒUD SÉLECTIONNÉ', graph:'Graph', list:'Liste', entities:'Entités', links:'Liens', label:'Label / Identité', address:'Adresse', status:'Statut', source:'Source', target:'Cible', suspectBadge:'SUSPECT', nodes:'nœuds', linksCount:'liens' },
}

function toFlowNodes(nodes: GraphNode[]): Node[] {
  return nodes.map(n => ({ id: n.id, type: 'custom', position: { x: n.posX, y: n.posY }, data: { label: n.label, type: n.type, flagged: n.flagged, metadata: JSON.parse(n.metadata || '{}') } }))
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  const colors: Record<string,string> = { HIGH:'#10b981', MEDIUM:'#f59e0b', LOW:'#ef4444' }
  return edges.map(e => ({ id: e.id, source: e.sourceId, target: e.targetId, label: e.relation, style: { stroke: colors[e.confidence] ?? '#6b7280', strokeWidth: 2 }, labelStyle: { fill: '#f9fafb', fontSize: 10 }, labelBgStyle: { fill: '#1f2937' }, markerEnd: { type: 'arrowclosed' as any } }))
}

function ellip(s: string, max = 22) { return s && s.length > max ? s.slice(0,10)+'...'+s.slice(-6) : s }

export default function GraphPage() {
  const [cases, setCases] = useState<GraphCase[]>([])
  const [activeCase, setActiveCase] = useState<GraphCase | null>(null)
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newChain, setNewChain] = useState('evm')
  const [newNotes, setNewNotes] = useState('')
  const [showNewCase, setShowNewCase] = useState(false)
  const [showNewNode, setShowNewNode] = useState(false)
  const [nodeType, setNodeType] = useState('wallet')
  const [nodeLabel, setNodeLabel] = useState('')
  const [nodeFlagged, setNodeFlagged] = useState(false)
  const [pendingEdge, setPendingEdge] = useState({ relation: 'funded_by', confidence: 'MEDIUM', evidence: '' })
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [viewMode, setViewMode] = useState<'graph'|'list'>('graph')
  const [lang, setLang] = useState<'en'|'fr'>('en')

  const t = I18N[lang]

  const inputStyle: React.CSSProperties = { background:'#1f2937', border:'1px solid #374151', borderRadius:6, color:'#f9fafb', padding:'6px 10px', fontSize:12, width:'100%' }
  const btnStyle = (color: string): React.CSSProperties => ({ background:color, border:'none', borderRadius:6, color:'#fff', padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', width:'100%' })
  const lbl = (txt: string) => <label style={{ color:'#9ca3af', fontSize:11, display:'block', marginBottom:3 }}>{txt}</label>

  async function fetchCases() {
    const r = await fetch('/api/admin/graph/cases')
    if (r.ok) setCases(await r.json())
  }

  async function loadCase(id: string) {
    setLoading(true)
    const r = await fetch(`/api/admin/graph/cases/${id}`)
    if (r.ok) setActiveCase(await r.json())
    setLoading(false)
  }

  useEffect(() => { fetchCases() }, [])

  async function createCase() {
    if (!newTitle || !newAddress) return
    setLoading(true)
    const r = await fetch('/api/admin/graph/cases', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:newTitle, pivotAddress:newAddress, chain:newChain, notes:newNotes }) })
    if (r.ok) { const created = await r.json(); setActiveCase(created); setShowNewCase(false); setNewTitle(''); setNewAddress(''); setNewNotes(''); fetchCases() }
    setLoading(false)
  }

  async function addNode() {
    if (!activeCase || !nodeLabel) return
    const r = await fetch(`/api/admin/graph/cases/${activeCase.id}/nodes`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:nodeType, label:nodeLabel, flagged:nodeFlagged, posX:300, posY:300 }) })
    if (r.ok) { await loadCase(activeCase.id); setNodeLabel(''); setShowNewNode(false) }
  }

  const handleConnect = useCallback(async (params: any) => {
    if (!activeCase) return
    await fetch(`/api/admin/graph/cases/${activeCase.id}/edges`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sourceId:params.source, targetId:params.target, relation:params.relation??pendingEdge.relation, confidence:params.confidence??pendingEdge.confidence, evidence:params.evidence??pendingEdge.evidence }) })
    await loadCase(activeCase.id)
  }, [activeCase, pendingEdge])

  const handleNodeDragStop = useCallback(async (_node: Node) => {}, [])

  const thStyle: React.CSSProperties = { background:'#1e293b', color:'#94a3b8', padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', borderBottom:'1px solid #374151' }
  const tdStyle: React.CSSProperties = { padding:'10px 12px', borderBottom:'1px solid #1f2937', fontSize:12, verticalAlign:'top' }

  const ListView = () => {
    if (!activeCase) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#374151', fontSize:13 }}>{t.noCase}</div>
    return (
      <div style={{ flex:1, overflowY:'auto', padding:24, background:'#030712', height:'100%' }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:16 }}>🗂</span>
            <span style={{ fontWeight:700, fontSize:14, color:'#f9fafb' }}>{t.entities}</span>
            <span style={{ background:'#1e1b4b', color:'#818cf8', border:'1px solid #3730a3', padding:'2px 10px', borderRadius:6, fontSize:11, fontWeight:700 }}>{activeCase.nodes.length}</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'#0f172a', borderRadius:10, overflow:'hidden' }}>
            <thead><tr>
              <th style={{ ...thStyle, width:110 }}>{t.type}</th>
              <th style={thStyle}>{t.label}</th>
              <th style={thStyle}>{t.address}</th>
              <th style={{ ...thStyle, width:110, textAlign:'center' }}>{t.status}</th>
            </tr></thead>
            <tbody>
              {activeCase.nodes.map((n: any) => {
                const meta = (() => { try { return JSON.parse(n.metadata) } catch { return {} } })()
                const color = NODE_COLORS[n.type] ?? '#6b7280'
                return (
                  <tr key={n.id}>
                    <td style={tdStyle}><span style={{ background:color+'22', color, border:`1px solid ${color}`, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700 }}>{n.type.toUpperCase()}</span></td>
                    <td style={{ ...tdStyle, fontWeight:600, color:'#f9fafb' }}>{n.label}</td>
                    <td style={{ ...tdStyle, fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{meta.wallet ? ellip(meta.wallet) : meta.mint ? ellip(meta.mint) : '—'}</td>
                    <td style={{ ...tdStyle, textAlign:'center' }}>{n.flagged ? <span style={{ background:'#ef444422', color:'#ef4444', border:'1px solid #ef4444', padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700 }}>⚠ {t.suspectBadge}</span> : <span style={{ color:'#4b5563', fontSize:11 }}>—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:16 }}>🔗</span>
            <span style={{ fontWeight:700, fontSize:14, color:'#f9fafb' }}>{t.links}</span>
            <span style={{ background:'#1e1b4b', color:'#818cf8', border:'1px solid #3730a3', padding:'2px 10px', borderRadius:6, fontSize:11, fontWeight:700 }}>{activeCase.edges.length}</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'#0f172a', borderRadius:10, overflow:'hidden' }}>
            <thead><tr>
              <th style={thStyle}>{t.source}</th>
              <th style={{ ...thStyle, width:130, textAlign:'center' }}>{t.relation}</th>
              <th style={thStyle}>{t.target}</th>
              <th style={{ ...thStyle, width:90, textAlign:'center' }}>{t.confidence}</th>
              <th style={thStyle}>{t.evidence}</th>
            </tr></thead>
            <tbody>
              {activeCase.edges.map((e: any) => {
                const src = activeCase.nodes.find((n: any) => n.id === e.sourceId)
                const tgt = activeCase.nodes.find((n: any) => n.id === e.targetId)
                const confColor = CONF_COLORS[e.confidence] ?? '#6b7280'
                return (
                  <tr key={e.id}>
                    <td style={{ ...tdStyle, fontWeight:600, color:'#f9fafb' }}>{src?.label ? ellip(src.label, 22) : '?'}</td>
                    <td style={{ ...tdStyle, textAlign:'center' }}><span style={{ background:'#1e293b', color:'#818cf8', border:'1px solid #334155', padding:'3px 10px', borderRadius:4, fontSize:10, fontWeight:700 }}>{e.relation}</span></td>
                    <td style={{ ...tdStyle, fontWeight:600, color:'#f9fafb' }}>{tgt?.label ? ellip(tgt.label, 22) : '?'}</td>
                    <td style={{ ...tdStyle, textAlign:'center' }}><span style={{ background:confColor+'22', color:confColor, border:`1px solid ${confColor}`, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700 }}>{e.confidence}</span></td>
                    <td style={{ ...tdStyle, fontSize:10, color:'#6b7280' }}>{e.evidence ? ellip(e.evidence, 28) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'#030712', color:'#f9fafb', fontFamily:'Inter, sans-serif' }}>

      {/* LEFT PANEL */}
      <div style={{ width:280, minWidth:280, borderRight:'1px solid #1f2937', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #1f2937' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:16 }}>🔗</span>
            <span style={{ fontWeight:700, fontSize:13, letterSpacing:'0.05em', color:'#818cf8' }}>INVESTIGATION GRAPH</span>
          </div>
          <button onClick={() => setShowNewCase(v => !v)} style={btnStyle('#4f46e5')}>
            {showNewCase ? t.cancel : t.newCase}
          </button>
        </div>

        {showNewCase && (
          <div style={{ padding:14, borderBottom:'1px solid #1f2937', display:'flex', flexDirection:'column', gap:8 }}>
            {lbl(t.caseTitle)}
            <input style={inputStyle} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: BOTIFY Scam Investigation" />
            {lbl(t.pivotAddr)}
            <input style={inputStyle} value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." />
            {lbl(t.chain)}
            <select style={inputStyle} value={newChain} onChange={e => setNewChain(e.target.value)}>
              <option value="evm">EVM (Ethereum, BSC...)</option>
              <option value="solana">Solana</option>
            </select>
            {lbl(t.notes)}
            <input style={inputStyle} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder={t.context} />
            <button onClick={createCase} disabled={loading} style={btnStyle('#059669')}>{loading ? '...' : t.createBtn}</button>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          <div style={{ color:'#6b7280', fontSize:10, fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {t.cases} ({cases.length})
          </div>
          {cases.map(c => (
            <div key={c.id} onClick={() => loadCase(c.id)} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6, cursor:'pointer', background:activeCase?.id===c.id?'#1e1b4b':'#111827', border:`1px solid ${activeCase?.id===c.id?'#4f46e5':'#1f2937'}` }}>
              <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{c.title}</div>
              <div style={{ fontSize:10, color:'#6b7280', fontFamily:'monospace' }}>{c.pivotAddress.slice(0,10)}...{c.pivotAddress.slice(-6)}</div>
              <div style={{ fontSize:10, color:'#4b5563', marginTop:3 }}>{c._count?.nodes??0} {t.nodes} · {c._count?.edges??0} {t.linksCount}</div>
            </div>
          ))}
        </div>

        {activeCase && (
          <div style={{ borderTop:'1px solid #1f2937', padding:14, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ color:'#6b7280', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              {t.tools} — {activeCase.title}
            </div>
            <button onClick={() => setShowNewNode(v => !v)} style={btnStyle('#1d4ed8')}>{showNewNode ? t.closePanel : t.addNode}</button>
            {showNewNode && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {lbl(t.type)}
                <select style={inputStyle} value={nodeType} onChange={e => setNodeType(e.target.value)}>
                  {NODE_TYPES.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                </select>
                {lbl(t.labelAddr)}
                <input style={inputStyle} value={nodeLabel} onChange={e => setNodeLabel(e.target.value)} placeholder={t.placeholder} />
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#9ca3af', cursor:'pointer' }}>
                  <input type="checkbox" checked={nodeFlagged} onChange={e => setNodeFlagged(e.target.checked)} />
                  {t.suspect}
                </label>
                <button onClick={addNode} style={btnStyle('#059669')}>{t.addBtn}</button>
              </div>
            )}
            <div style={{ background:'#0f172a', borderRadius:6, padding:10, border:'1px solid #1f2937' }}>
              <div style={{ color:'#6b7280', fontSize:10, marginBottom:6, fontWeight:600 }}>{t.nextLink}</div>
              {lbl(t.relation)}
              <select style={{ ...inputStyle, marginBottom:6 }} value={pendingEdge.relation} onChange={e => setPendingEdge(p => ({...p, relation:e.target.value}))}>
                {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {lbl(t.confidence)}
              <select style={{ ...inputStyle, marginBottom:6 }} value={pendingEdge.confidence} onChange={e => setPendingEdge(p => ({...p, confidence:e.target.value}))}>
                {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {lbl(t.evidence)}
              <input style={inputStyle} value={pendingEdge.evidence} onChange={e => setPendingEdge(p => ({...p, evidence:e.target.value}))} placeholder="0x... ou https://..." />
            </div>
            {selectedNode && (
              <div style={{ background:'#0f172a', borderRadius:6, padding:10, border:'1px solid #374151' }}>
                <div style={{ color:'#818cf8', fontSize:10, fontWeight:600, marginBottom:4 }}>{t.selectedNode}</div>
                <div style={{ fontSize:11, color:'#f9fafb', wordBreak:'break-all' }}>{(selectedNode.data as any).label}</div>
                <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{t.type}: {(selectedNode.data as any).type}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MAIN AREA */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* TOPBAR */}
        <div style={{ height:44, background:'#0a0f1a', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', padding:'0 16px', gap:8, flexShrink:0 }}>
          {activeCase && <>
            <button onClick={() => setViewMode('graph')} style={{ background:viewMode==='graph'?'#4f46e5':'#1e293b', border:`1px solid ${viewMode==='graph'?'#4f46e5':'#374151'}`, borderRadius:6, color:'#fff', padding:'4px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.graph}</button>
            <button onClick={() => setViewMode('list')} style={{ background:viewMode==='list'?'#4f46e5':'#1e293b', border:`1px solid ${viewMode==='list'?'#4f46e5':'#374151'}`, borderRadius:6, color:'#fff', padding:'4px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.list}</button>
          </>}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            {activeCase && <>
              <a href={'/api/admin/graph/cases/' + activeCase.id + '/pdf?lang=en'} target="_blank" rel="noreferrer" style={{ background:'#4f46e5', borderRadius:5, color:'#fff', padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'none' }}>PDF EN</a>
              <a href={'/api/admin/graph/cases/' + activeCase.id + '/pdf?lang=fr'} target="_blank" rel="noreferrer" style={{ background:'#1e1b4b', border:'1px solid #4f46e5', borderRadius:5, color:'#818cf8', padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'none' }}>PDF FR</a>
              <div style={{ width:1, height:20, background:'#1f2937', margin:'0 4px' }} />
            </>}
            <button onClick={() => setLang('en')} style={{ background:lang==='en'?'#1e293b':'transparent', border:`1px solid ${lang==='en'?'#818cf8':'#374151'}`, borderRadius:4, color:lang==='en'?'#818cf8':'#6b7280', padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>EN</button>
            <button onClick={() => setLang('fr')} style={{ background:lang==='fr'?'#1e293b':'transparent', border:`1px solid ${lang==='fr'?'#818cf8':'#374151'}`, borderRadius:4, color:lang==='fr'?'#818cf8':'#6b7280', padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>FR</button>
          </div>
        </div>

        {/* CANVAS or LIST */}
        <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {!activeCase ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#374151' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🔗</div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>{t.noCase}</div>
              <div style={{ fontSize:13 }}>{t.noSub}</div>
            </div>
          ) : loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
              <div style={{ color:'#818cf8', fontSize:14 }}>{t.loading}</div>
            </div>
          ) : viewMode === 'list' ? (
            <ListView />
          ) : (
            <GraphCanvas
              initialNodes={toFlowNodes(activeCase.nodes)}
              initialEdges={toFlowEdges(activeCase.edges)}
              onConnect={handleConnect}
              onNodeDragStop={handleNodeDragStop}
              onNodeClick={node => setSelectedNode(node)}
              pendingEdge={pendingEdge}
            />
          )}

          {activeCase && viewMode === 'graph' && (
            <div style={{ position:'absolute', top:16, left:16, background:'#0f172a', border:'1px solid #1f2937', borderRadius:8, padding:'8px 14px', zIndex:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#818cf8' }}>{activeCase.title}</div>
              <div style={{ fontSize:10, color:'#6b7280', fontFamily:'monospace' }}>{activeCase.pivotAddress.slice(0,12)}... · {activeCase.chain.toUpperCase()}</div>
              <div style={{ fontSize:10, color:'#4b5563', marginTop:2 }}>{activeCase.nodes.length} {t.nodes} · {activeCase.edges.length} {t.linksCount}</div>
            </div>
          )}


        </div>
      </div>
    </div>
  )
}
