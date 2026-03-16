import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { id } = await context.params
  const data = await req.json()
  const label = await prisma.walletLabel.update({
    where: { id },
    data: { ...data, updatedAt: new Date() }
  })
  return NextResponse.json(label)
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { id } = await context.params
  await prisma.walletLabel.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
