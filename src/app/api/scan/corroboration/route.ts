import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  if (!address) return NextResponse.json({ found: false })

  try {
    const addr = address.toLowerCase().trim()
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: addr },
      include: { nodes: true, edges: true }
    })

    if (!graphCase) return NextResponse.json({ found: false })

    const nodes = graphCase.nodes
    const edges = graphCase.edges
    const highEdges = edges.filter((e: any) => e.confidence === 'HIGH').length
    const uniqueTypes = new Set(nodes.map((n: any) => n.type)).size
    const flaggedNodes = nodes.filter((n: any) => n.flagged).length

    const score = Math.min(100, Math.round(
      (highEdges / Math.max(1, edges.length)) * 40 +
      Math.min(uniqueTypes * 8, 32) +
      Math.min(flaggedNodes * 7, 28)
    ))

    const label = score >= 70
      ? { en: 'HIGH CERTAINTY', fr: 'HAUTE CERTITUDE', color: '#ef4444' }
      : score >= 40
      ? { en: 'MODERATE', fr: 'MODÉRÉE', color: '#f59e0b' }
      : { en: 'LOW CERTAINTY', fr: 'FAIBLE', color: '#10b981' }

    return NextResponse.json({
      found: true,
      score,
      label,
      caseId: graphCase.id,
      caseTitle: graphCase.title,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      flaggedNodes,
      highEdges,
    })
  } catch (e: any) {
    return NextResponse.json({ found: false, error: e.message })
  }
}
