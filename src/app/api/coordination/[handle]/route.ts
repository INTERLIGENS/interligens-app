import { NextResponse } from 'next/server'
import { getCoordinationSignalsForProfile } from '@/lib/coordination'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, '')
  const result = await getCoordinationSignalsForProfile(h)
  if (!result || result.signals.length === 0) return NextResponse.json({ signals: [] })
  return NextResponse.json(result)
}
