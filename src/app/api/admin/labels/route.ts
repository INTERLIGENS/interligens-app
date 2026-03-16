import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi as requireAdmin } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const category = searchParams.get('category')
  const verified = searchParams.get('verified')
  const chain = searchParams.get('chain')

  const where: any = {}
  if (address) where.address = { contains: address.toLowerCase() }
  if (category) where.category = category
  if (verified !== null) where.verified = verified === 'true'
  if (chain) where.chain = chain

  const labels = await prisma.walletLabel.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  return NextResponse.json(labels)
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { address, chain, label, category, confidence, source, sourceUrl, verified, notes } = await req.json()
    if (!address || !label || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check for duplicate
    const existing = await prisma.walletLabel.findFirst({
      where: { address: address.toLowerCase(), chain: chain ?? 'any' }
    })
    if (existing) {
      return NextResponse.json({ error: 'Label already exists for this address', existing }, { status: 409 })
    }

    const walletLabel = await prisma.walletLabel.create({
      data: {
        address: address.toLowerCase(),
        chain: chain ?? 'any',
        label,
        category,
        confidence: confidence ?? 'MEDIUM',
        source: source ?? 'admin',
        sourceUrl: sourceUrl ?? null,
        verified: verified ?? false,
        notes: notes ?? null,
      }
    })
    return NextResponse.json(walletLabel, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
