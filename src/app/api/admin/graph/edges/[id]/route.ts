import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError
  try {
    const { id } = await context.params
    await prisma.graphEdge.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
