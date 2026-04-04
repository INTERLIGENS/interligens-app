import { NextResponse } from 'next/server'
import { getRelatedActorsForProfile } from '@/lib/cluster/clusterRisk'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, '')

  const result = await getRelatedActorsForProfile(h)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json(result)
}
