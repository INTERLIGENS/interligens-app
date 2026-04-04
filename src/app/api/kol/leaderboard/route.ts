import { NextRequest, NextResponse } from 'next/server'
import {
  getLeaderboardProfiles,
  getLeaderboardStats,
  type LeaderboardSort,
} from '@/lib/kol/kolLeaderboard'

export const dynamic = 'force-dynamic'

const VALID_SORTS: LeaderboardSort[] = ['proceeds', 'evidence', 'completeness', 'flags', 'recent']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const sortRaw = searchParams.get('sort') ?? 'proceeds'
    const sort = VALID_SORTS.includes(sortRaw as LeaderboardSort)
      ? (sortRaw as LeaderboardSort)
      : 'proceeds'

    const filters = {
      sort,
      filterDepth: searchParams.get('filter_depth') ?? undefined,
      filterCompleteness: searchParams.get('filter_completeness') ?? undefined,
      filterHasProceeds: searchParams.get('filter_has_proceeds') === 'true' || undefined,
      filterHasFlags: searchParams.get('filter_has_flags') === 'true' || undefined,
      search: searchParams.get('search') ?? undefined,
    }

    const [profiles, stats] = await Promise.all([
      getLeaderboardProfiles(filters),
      getLeaderboardStats(),
    ])

    return NextResponse.json({
      profiles,
      stats,
      sort,
      filters: {
        depth: filters.filterDepth ?? null,
        completeness: filters.filterCompleteness ?? null,
        hasProceeds: filters.filterHasProceeds ?? null,
        hasFlags: filters.filterHasFlags ?? null,
        search: filters.search ?? null,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
