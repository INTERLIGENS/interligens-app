import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { id } = await context.params
    const { type, label, metadata, posX, posY, flagged } = await req.json()
    if (!type || !label) {
      return NextResponse.json({ error: 'Missing type or label' }, { status: 400 })
    }

    const node = await prisma.graphNode.create({
      data: {
        caseId: id,
        type,
        label,
        metadata: JSON.stringify(metadata ?? {}),
        posX: posX ?? 200,
        posY: posY ?? 200,
        flagged: flagged ?? false
      }
    })
    return NextResponse.json(node, { status: 201 })
  } catch (e: any) {
    console.error('[NODES POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
