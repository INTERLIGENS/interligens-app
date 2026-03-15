import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { id } = await context.params
    const { sourceId, targetId, relation, evidence, confidence } = await req.json()
    if (!sourceId || !targetId || !relation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const edge = await prisma.graphEdge.create({
      data: { caseId: id, sourceId, targetId, relation, evidence: evidence ?? null, confidence: confidence ?? 'MEDIUM' }
    })
    return NextResponse.json(edge, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
