import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { id } = await context.params
    const graphCase = await prisma.graphCase.findUnique({
      where: { id },
      include: { nodes: true, edges: true }
    })
    if (!graphCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(graphCase)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { id } = await context.params
  await prisma.graphCase.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
