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

function toFlowNodes(nodes: GraphNode[]): Node[] {
  return nodes.map(n => ({
    id: n.id,
    type: 'custom',
    position: { x: n.posX, y: n.posY },
    data: { label: n.label, type: n.type, flagged: n.flagged, metadata: JSON.parse(n.metadata || '{}') }
  }))
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  const colors: Record<string,string> = { HIGH:'#10b981', MEDIUM:'#f59e0b', LOW:'#ef4444' }
  return edges.map(e => ({
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    label: e.relation,
    style: { stroke: colors[e.confidence] ?? '#6b7280', strokeWidth: 2 },
    labelStyle: { fill: '#f9fafb', fontSize: 10 },
    labelBgStyle: { fill: '#1f2937' },
    markerEnd: { type: 'arrowclosed' as any }
  }))
}

export default function GraphPage() {
  const [cases, setCases] = useState<GraphCase[]>([])
  const [activeCase, setActiveCase] = useState<GraphCase | null>(null)
  const [loading, setLoading] = useState(false)

  // New case form
  const [newTitle, setNewTitle] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newChain, setNewChain] = useState('evm')
  const [newNotes, setNewNotes] = useState('')
  const [showNewCase, setShowNewCase] = useState(false)

  // New node form
  const [showNewNode, setShowNewNode] = useState(false)
  const [nodeType, setNodeType] = useState('wallet')
  const [nodeLabel, setNodeLabel] = useState('')
  const [nodeFlagged, setNodeFlagged] = useState(false)

  // Edge config
  const [pendingEdge, setPendingEdge] = useState({ relation: 'funded_by', confidence: 'MEDIUM', evidence: '' })

  // Selected node
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const inputStyle: React.CSSProperties = {
    background: '#1f2937', border: '1px solid #374151', borderRadius: 6,
    color: '#f9fafb', padding: '6px 10px', fontSize: 12, width: '100%'
  }
  const btnStyle = (color: string): React.CSSProperties => ({
    background: color, border: 'none', borderRadius: 6, color: '#fff',
    padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%'
  })

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
    const r = await fetch('/api/admin/graph/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, pivotAddress: newAddress, chain: newChain, notes: newNotes })
    })
    if (r.ok) {
      const created = await r.json()
      setActiveCase(created)
      setShowNewCase(false)
      setNewTitle(''); setNewAddress(''); setNewNotes('')
      fetchCases()
    }
    setLoading(false)
  }

  async function addNode() {
    if (!activeCase || !nodeLabel) return
    const r = await fetch(`/api/admin/graph/cases/${activeCase.id}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: nodeType, label: nodeLabel, flagged: nodeFlagged, posX: 300, posY: 300 })
    })
    if (r.ok) {
      await loadCase(activeCase.id)
      setNodeLabel(''); setShowNewNode(false)
    }
  }

  const handleConnect = useCallback(async (params: any) => {
    if (!activeCase) return
    await fetch(`/api/admin/graph/cases/${activeCase.id}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: params.source,
        targetId: params.target,
        relation: params.relation ?? pendingEdge.relation,
        confidence: params.confidence ?? pendingEdge.confidence,
        evidence: params.evidence ?? pendingEdge.evidence
      })
    })
    await loadCase(activeCase.id)
  }, [activeCase, pendingEdge])

  const handleNodeDragStop = useCallback(async (node: Node) => {
    // Save position (via PATCH — optionnel pour la V1, on ignore silencieusement)
  }, [])

  const label = (txt: string) => (
    <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 3 }}>{txt}</label>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>

      {/* ── PANEL GAUCHE ── */}
      <div style={{ width: 280, minWidth: 280, borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🔗</span>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', color: '#818cf8' }}>INVESTIGATION GRAPH</span>
          </div>
          <button onClick={() => setShowNewCase(v => !v)} style={btnStyle('#4f46e5')}>
            {showNewCase ? '✕ Annuler' : '+ Nouveau dossier'}
          </button>
        </div>

        {/* New case form */}
        {showNewCase && (
          <div style={{ padding: 14, borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {label('Titre du dossier')}
            <input style={inputStyle} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: BOTIFY Scam Investigation" />
            {label('Adresse pivot')}
            <input style={inputStyle} value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." />
            {label('Chaîne')}
            <select style={inputStyle} value={newChain} onChange={e => setNewChain(e.target.value)}>
              <option value="evm">EVM (Ethereum, BSC...)</option>
              <option value="solana">Solana</option>
            </select>
            {label('Notes')}
            <input style={inputStyle} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Contexte..." />
            <button onClick={createCase} disabled={loading} style={btnStyle('#059669')}>
              {loading ? 'Création...' : '🚀 Créer et enrichir'}
            </button>
          </div>
        )}

        {/* Cases list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Dossiers ({cases.length})
          </div>
          {cases.map(c => (
            <div key={c.id}
              onClick={() => loadCase(c.id)}
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                background: activeCase?.id === c.id ? '#1e1b4b' : '#111827',
                border: `1px solid ${activeCase?.id === c.id ? '#4f46e5' : '#1f2937'}`,
                transition: 'all 0.15s'
              }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{c.title}</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
                {c.pivotAddress.slice(0,10)}...{c.pivotAddress.slice(-6)}
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3 }}>
                {c._count?.nodes ?? 0} nœuds · {c._count?.edges ?? 0} liens
              </div>
            </div>
          ))}
        </div>

        {/* Active case tools */}
        {activeCase && (
          <div style={{ borderTop: '1px solid #1f2937', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Outils — {activeCase.title}
            </div>

            {/* Add node */}
            <button onClick={() => setShowNewNode(v => !v)} style={btnStyle('#1d4ed8')}>
              {showNewNode ? '✕ Fermer' : '+ Ajouter un nœud'}
            </button>
            {showNewNode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {label('Type')}
                <select style={inputStyle} value={nodeType} onChange={e => setNodeType(e.target.value)}>
                  {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {label('Label / adresse')}
                <input style={inputStyle} value={nodeLabel} onChange={e => setNodeLabel(e.target.value)} placeholder="0x... ou nom" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>
                  <input type="checkbox" checked={nodeFlagged} onChange={e => setNodeFlagged(e.target.checked)} />
                  Marqué comme suspect
                </label>
                <button onClick={addNode} style={btnStyle('#059669')}>✓ Ajouter</button>
              </div>
            )}

            {/* Edge config */}
            <div style={{ background: '#0f172a', borderRadius: 6, padding: 10, border: '1px solid #1f2937' }}>
              <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>PROCHAIN LIEN (glisser entre nœuds)</div>
              {label('Relation')}
              <select style={{...inputStyle, marginBottom: 6}} value={pendingEdge.relation} onChange={e => setPendingEdge(p => ({...p, relation: e.target.value}))}>
                {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {label('Confiance')}
              <select style={{...inputStyle, marginBottom: 6}} value={pendingEdge.confidence} onChange={e => setPendingEdge(p => ({...p, confidence: e.target.value}))}>
                {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {label('Evidence (TX hash / URL)')}
              <input style={inputStyle} value={pendingEdge.evidence} onChange={e => setPendingEdge(p => ({...p, evidence: e.target.value}))} placeholder="0x... ou https://..." />
            </div>

            {/* Selected node info */}
            {selectedNode && (
              <div style={{ background: '#0f172a', borderRadius: 6, padding: 10, border: '1px solid #374151' }}>
                <div style={{ color: '#818cf8', fontSize: 10, fontWeight: 600, marginBottom: 4 }}>NŒUD SÉLECTIONNÉ</div>
                <div style={{ fontSize: 11, color: '#f9fafb', wordBreak: 'break-all' }}>{(selectedNode.data as any).label}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Type: {(selectedNode.data as any).type}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CANVAS ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!activeCase ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#374151' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucun dossier sélectionné</div>
            <div style={{ fontSize: 13 }}>Crée un dossier ou sélectionne-en un à gauche</div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ color: '#818cf8', fontSize: 14 }}>Chargement...</div>
          </div>
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

        {activeCase && (
          <div style={{ position: 'absolute', top: 16, left: 16, background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 14px', zIndex: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>{activeCase.title}</div>
            <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{activeCase.pivotAddress.slice(0,12)}... · {activeCase.chain.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
              {activeCase.nodes.length} nœuds · {activeCase.edges.length} liens
            </div>
          </div>
        )}


        {activeCase && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10, display: 'flex', gap: 8 }}>
            <a href={'/api/admin/graph/cases/' + activeCase.id + '/pdf?lang=en'} target="_blank" rel="noreferrer" style={{ background: '#4f46e5', borderRadius: 6, color: '#fff', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Export PDF EN</a>
            <a href={'/api/admin/graph/cases/' + activeCase.id + '/pdf?lang=fr'} target="_blank" rel="noreferrer" style={{ background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 6, color: '#818cf8', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Export PDF FR</a>
          </div>
        )}
      </div>
    </div>
  )
}
