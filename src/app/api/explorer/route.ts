import { NextRequest, NextResponse } from 'next/server'
import { getExplorerTimeline, getExplorerStats, type DossierKind } from '@/lib/explorer/explorerItems'

export const dynamic = 'force-dynamic'

const VALID_KINDS: DossierKind[] = ['case', 'launch']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const kindRaw = searchParams.get('kind')
    const kind = kindRaw && VALID_KINDS.includes(kindRaw as DossierKind)
      ? (kindRaw as DossierKind)
      : undefined

    const filters = {
      kind,
      search: searchParams.get('search') ?? undefined,
      hasProceeds: searchParams.get('hasProceeds') === 'true' || undefined,
      hasFlags: searchParams.get('hasFlags') === 'true' || undefined,
    }

    const [items, stats] = await Promise.all([
      getExplorerTimeline(filters),
      getExplorerStats(),
    ])

    return NextResponse.json({ items, stats, filters: {
      kind: kind ?? null,
      search: filters.search ?? null,
      hasProceeds: filters.hasProceeds ?? null,
      hasFlags: filters.hasFlags ?? null,
    }})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
