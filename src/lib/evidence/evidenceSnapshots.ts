import { prisma } from '@/lib/prisma'

export interface EvidenceSnapshotItem {
  id: string
  relationType: string
  relationKey: string
  snapshotType: string
  imageUrl: string | null
  title: string
  caption: string
  sourceLabel: string | null
  sourceUrl: string | null
  observedAt: string | null
  displayOrder: number
}

export async function getSnapshotsForDossier(
  relationType: string,
  relationKey: string,
): Promise<EvidenceSnapshotItem[]> {
  const rows = await prisma.evidenceSnapshot.findMany({
    where: { relationType, relationKey, isPublic: true, reviewStatus: 'approved' },
    orderBy: { displayOrder: 'asc' },
  })
  return rows.map(r => ({
    id: r.id,
    relationType: r.relationType,
    relationKey: r.relationKey,
    snapshotType: r.snapshotType,
    imageUrl: r.imageUrl,
    title: r.title,
    caption: r.caption,
    sourceLabel: r.sourceLabel,
    sourceUrl: r.sourceUrl,
    observedAt: r.observedAt?.toISOString() ?? null,
    displayOrder: r.displayOrder,
  }))
}

export async function getSnapshotsForProfile(handle: string): Promise<EvidenceSnapshotItem[]> {
  const rows = await prisma.evidenceSnapshot.findMany({
    where: { relationType: 'profile', relationKey: handle, isPublic: true, reviewStatus: 'approved' },
    orderBy: { displayOrder: 'asc' },
  })
  return rows.map(r => ({
    id: r.id,
    relationType: r.relationType,
    relationKey: r.relationKey,
    snapshotType: r.snapshotType,
    imageUrl: r.imageUrl,
    title: r.title,
    caption: r.caption,
    sourceLabel: r.sourceLabel,
    sourceUrl: r.sourceUrl,
    observedAt: r.observedAt?.toISOString() ?? null,
    displayOrder: r.displayOrder,
  }))
}

export async function getSnapshotCountByDossier(
  relationKeys: string[],
): Promise<Map<string, number>> {
  if (relationKeys.length === 0) return new Map()
  const counts = await prisma.evidenceSnapshot.groupBy({
    by: ['relationKey'],
    where: { relationKey: { in: relationKeys }, isPublic: true, reviewStatus: 'approved' },
    _count: true,
  })
  return new Map(counts.map(c => [c.relationKey, c._count]))
}
