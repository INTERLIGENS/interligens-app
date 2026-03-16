import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mint = searchParams.get('mint')
  if (!mint) return NextResponse.json({ clusters: [], related_projects: [], overall_status: 'NONE' })

  try {
    // Check our GraphCase DB first
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: mint.toLowerCase() },
      include: { nodes: true, edges: true }
    })

    if (graphCase) {
      const nodes = graphCase.nodes
      const edges = graphCase.edges

      // Build clusters from our edges
      let clusterIdx = 0
    const clusters: any[] = []
      const relationGroups: Record<string, any[]> = {}

      for (const edge of edges) {
        if (!relationGroups[edge.relation]) relationGroups[edge.relation] = []
        relationGroups[edge.relation].push(edge)
      }

      // funded_by → shared_funder cluster
      if (relationGroups['funded_by']?.length > 0) {
        const fundedEdges = relationGroups['funded_by']
        const funders = [...new Set(fundedEdges.map(e => e.sourceId))]
        clusters.push({
          id: `cluster_${clusterIdx++}`,
          label: `${funders.length} shared funder${funders.length > 1 ? 's' : ''} detected`,
          heuristic: 'shared_funder',
          strength: fundedEdges.length >= 4 ? 'STRONG' : 'MODERATE',
          status: 'CORROBORATED',
          wallets: fundedEdges.map(e => {
            const node = nodes.find(n => n.id === e.targetId)
            return node?.label ?? e.targetId
          }),
          proofs: fundedEdges.slice(0, 3).map(e => ({
            type: 'funded_by',
            tx_signature: e.evidence ?? 'internal_doc',
            timestamp: Date.now() / 1000,
            detail: `${nodes.find(n => n.id === e.sourceId)?.label ?? 'team'} → ${nodes.find(n => n.id === e.targetId)?.label ?? 'wallet'}`
          }))
        })
      }

      // controls → coordinated control cluster
      if (relationGroups['controls']?.length > 2) {
        const controlEdges = relationGroups['controls']
        clusters.push({
          id: `cluster_${clusterIdx++}`,
          label: `${controlEdges.length} wallets under coordinated control`,
          heuristic: 'co_trading',
          strength: 'STRONG',
          status: 'CORROBORATED',
          wallets: controlEdges.map(e => nodes.find(n => n.id === e.targetId)?.label ?? e.targetId),
          proofs: controlEdges.slice(0, 3).map(e => ({
            type: 'controls',
            tx_signature: e.evidence ?? 'internal_doc',
            timestamp: Date.now() / 1000,
            detail: `controls: ${nodes.find(n => n.id === e.targetId)?.label ?? 'wallet'}`
          }))
        })
      }

      // promoted → related projects
      const promoEdges = relationGroups['promoted'] ?? []
      const related_projects = promoEdges.map(e => {
        const node = nodes.find(n => n.id === e.sourceId)
        return {
          mint: node?.label ?? e.sourceId,
          symbol: node?.type === 'social' ? 'KOL' : 'DOMAIN',
          name: node?.label ?? '',
          status: 'CORROBORATED',
          link_score: 85,
          shared_wallets: 1,
          signals: ['promoted', e.confidence === 'HIGH' ? 'undisclosed_paid_promo' : 'suspected_promo']
        }
      })

      // Flagged nodes as additional signal
      const flaggedNodes = nodes.filter(n => n.flagged)

      return NextResponse.json({
        clusters,
        related_projects,
        overall_status: clusters.length > 0 ? 'CONFIRMED' : flaggedNodes.length > 0 ? 'REFERENCED' : 'NONE',
        source: 'interligens_graph_db',
        case_id: graphCase.id,
        case_title: graphCase.title,
        flagged_count: flaggedNodes.length,
        total_nodes: nodes.length,
        total_edges: edges.length,
        limits: {
          seeds_used: 1,
          max_seeds: 50,
          tx_fetched: edges.length,
          wallets_expanded_hop1: nodes.length,
        },
        provider: { name: 'INTERLIGENS Graph DB' },
        query: { hops: 1, days: 30 }
      })
    }

    // No GraphCase found — return empty
    return NextResponse.json({
      clusters: [],
      related_projects: [],
      overall_status: 'NONE',
      source: 'no_data',
      limits: { seeds_used: 0, max_seeds: 50, tx_fetched: 0, wallets_expanded_hop1: 0 },
      provider: { name: 'INTERLIGENS' },
      query: { hops: 1, days: 30 }
    })

  } catch (e: any) {
    console.error('[GRAPH ROUTE]', e)
    return NextResponse.json({
      clusters: [],
      related_projects: [],
      overall_status: 'NONE',
      error: e.message,
      limits: { seeds_used: 0, max_seeds: 50, tx_fetched: 0, wallets_expanded_hop1: 0 },
      provider: { name: 'INTERLIGENS' },
      query: { hops: 1, days: 30 }
    })
  }
}
