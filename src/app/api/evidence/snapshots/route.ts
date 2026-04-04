import { NextRequest, NextResponse } from 'next/server'
import { getSnapshotsForDossier, getSnapshotsForProfile } from '@/lib/evidence/evidenceSnapshots'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const relationType = searchParams.get('relationType')
  const relationKey = searchParams.get('relationKey')

  if (!relationType || !relationKey) {
    return NextResponse.json({ error: 'relationType and relationKey required' }, { status: 400 })
  }

  const snapshots = relationType === 'profile'
    ? await getSnapshotsForProfile(relationKey)
    : await getSnapshotsForDossier(relationType, relationKey)

  return NextResponse.json({ snapshots })
}
