import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mint = searchParams.get('mint')
  if (!mint) return NextResponse.json({ clusters: [], related_projects: [], overall_status: 'NONE' })

  try {
    // Check our GraphCase DB first (try exact match, then case-insensitive)
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: mint },
      include: { nodes: true, edges: true }
    }) ?? await prisma.graphCase.findFirst({
      where: { pivotAddress: { equals: mint, mode: 'insensitive' } },
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
    // ─── BUILD 12 · S8 — UNE PANNE N'EST PAS UNE MESURE ──────────────────
    //
    // Ce `catch` rendait un 200 portant `overall_status: 'NONE'` — la valeur
    // FAVORABLE — accompagnée d'un champ `error`. Les trois consommateurs
    // serveur testent `graphRes.ok`, qui valait VRAI : une panne d'accès aux
    // données était donc lue comme une lignée MESURÉE à « aucune ».
    //
    // Mesuré le 2026-09-10 sur /api/v1/score, dans cet état exact :
    // `expectedMeasured` 3/3, `degraded: false`, `phantom_warning_level`
    // ALLOW — et un objet `coverage` IDENTIQUE AU CARACTÈRE PRÈS à celui
    // d'une lignée réellement mesurée à NONE. Le contrat servi ne pouvait pas
    // distinguer « mesuré, aucune lignée » de « jamais mesuré ».
    //
    // Le précédent est au dépôt, et il a été fermé du même côté — celui du
    // PRODUCTEUR. src/app/api/solana/holders/route.ts:24-30 :
    //
    //     « Un drapeau de succes qui ment est pire qu'une absence de drapeau. »
    //
    // Seul le STATUT cesse de mentir. `overall_status` disparaît du corps
    // d'erreur : une panne ne porte aucune valeur de lignée, pas même la
    // valeur neutre. La méthodologie de lignée n'est pas touchée.
    return NextResponse.json({
      clusters: [],
      related_projects: [],
      error: e.message,
      limits: { seeds_used: 0, max_seeds: 50, tx_fetched: 0, wallets_expanded_hop1: 0 },
      provider: { name: 'INTERLIGENS' },
      query: { hops: 1, days: 30 }
    }, { status: 500 })
  }
}
