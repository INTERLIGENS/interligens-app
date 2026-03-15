'use client'
import React, { useCallback, useRef } from 'react'
import ReactFlow, {
  Node, Edge, Connection, addEdge,
  useNodesState, useEdgesState,
  Background, Controls, MiniMap,
  NodeTypes, Handle, Position,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

const NODE_COLORS: Record<string, string> = {
  wallet:   '#3b82f6',
  cex:      '#f59e0b',
  person:   '#10b981',
  domain:   '#8b5cf6',
  social:   '#06b6d4',
  token:    '#f97316',
  contract: '#6366f1',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   '#10b981',
  MEDIUM: '#f59e0b',
  LOW:    '#ef4444',
}

function WalletNode({ data }: { data: any }) {
  const isPivot = data.metadata?.isPivot
  const color = NODE_COLORS[data.type] ?? '#6b7280'
  return (
    <div style={{
      background: isPivot ? '#1e1b4b' : '#111827',
      border: `2px solid ${isPivot ? '#818cf8' : color}`,
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 180,
      boxShadow: isPivot ? '0 0 20px rgba(129,140,248,0.4)' : '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          background: color,
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          textTransform: 'uppercase'
        }}>{data.type}</span>
        {data.flagged && <span style={{ color: '#ef4444', fontSize: 12 }}>⚠</span>}
        {isPivot && <span style={{ color: '#818cf8', fontSize: 10, fontWeight: 700 }}>PIVOT</span>}
      </div>
      <div style={{
        color: '#f9fafb',
        fontSize: 12,
        marginTop: 6,
        fontFamily: 'monospace',
        wordBreak: 'break-all',
        maxWidth: 200
      }}>
        {data.label.length > 32 ? data.label.slice(0, 16) + '...' + data.label.slice(-8) : data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { custom: WalletNode }

interface GraphCanvasProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onConnect: (params: Connection & { relation?: string; confidence?: string; evidence?: string }) => void
  onNodeDragStop: (node: Node) => void
  onNodeClick: (node: Node) => void
  pendingEdge: { relation: string; confidence: string; evidence: string } | null
}

export default function GraphCanvas({
  initialNodes,
  initialEdges,
  onConnect,
  onNodeDragStop,
  onNodeClick,
  pendingEdge
}: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const connectingRef = useRef<Connection | null>(null)

  const handleConnect = useCallback((params: Connection) => {
    const relation = pendingEdge?.relation ?? 'linked_to'
    const confidence = pendingEdge?.confidence ?? 'MEDIUM'
    const evidence = pendingEdge?.evidence ?? ''
    const newEdge = {
      ...params,
      id: `e-${params.source}-${params.target}`,
      label: relation,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: CONFIDENCE_COLORS[confidence] ?? '#6b7280', strokeWidth: 2 },
      labelStyle: { fill: '#f9fafb', fontSize: 10 },
      labelBgStyle: { fill: '#1f2937' },
    }
    setEdges(eds => addEdge(newEdge, eds))
    onConnect({ ...params, relation, confidence, evidence })
  }, [pendingEdge, onConnect, setEdges])

  // Sync external nodes/edges changes
  React.useEffect(() => { setNodes(initialNodes) }, [initialNodes])
  React.useEffect(() => { setEdges(initialEdges) }, [initialEdges])

  return (
    <div style={{ width: '100%', height: '100%', background: '#030712' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={(_, node) => onNodeDragStop(node)}
        onNodeClick={(_, node) => onNodeClick(node)}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#1f2937" gap={20} />
        <Controls style={{ background: '#111827', border: '1px solid #374151' }} />
        <MiniMap
          style={{ background: '#111827', border: '1px solid #374151' }}
          nodeColor={n => NODE_COLORS[(n.data as any)?.type] ?? '#6b7280'}
        />
      </ReactFlow>
    </div>
  )
}
