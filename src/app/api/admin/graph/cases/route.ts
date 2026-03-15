import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'
import { enrichAddress } from '@/lib/graph/enrich'

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const cases = await prisma.graphCase.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { nodes: true, edges: true } } }
    })
    return NextResponse.json(cases)
  } catch (e: any) {
    console.error('[GRAPH GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { title, pivotAddress, chain, notes } = await req.json()
    if (!title || !pivotAddress || !chain) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const addr = pivotAddress.toLowerCase()
    const enrichedNodes = chain === 'evm' ? await enrichAddress(addr) : []

    const graphCase = await prisma.graphCase.create({
      data: {
        title,
        pivotAddress: addr,
        chain,
        notes,
        nodes: {
          create: [
            {
              type: 'wallet',
              label: addr,
              flagged: false,
              posX: 400,
              posY: 200,
              metadata: JSON.stringify({ isPivot: true })
            },
            ...enrichedNodes.map(n => ({
              ...n,
              metadata: JSON.stringify(n.metadata)
            }))
          ]
        }
      },
      include: { nodes: true, edges: true }
    })

    return NextResponse.json(graphCase, { status: 201 })
  } catch (e: any) {
    console.error('[GRAPH POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
