import { NextRequest, NextResponse } from 'next/server'
import { getExplorerTimeline, getExplorerStats, type DossierKind } from '@/lib/explorer/explorerItems'

export const dynamic = 'force-dynamic'

const VALID_KINDS: DossierKind[] = ['case', 'launch', 'platform']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const kindRaw = searchParams.get('kind')
    const kind = kindRaw && VALID_KINDS.includes(kindRaw as DossierKind)
      ? (kindRaw as DossierKind)
      : undefined

    // ── `hasFlags` N'EST PLUS ACCEPTÉ ───────────────────────────────────────
    //
    // `strongestFlags` a cessé d'être émis : aucune décision ne fonde une
    // propagation de comportement d'une PERSONNE vers un DOSSIER (E8). Mais un
    // filtre est une émission PAR BISSECTION — `?hasFlags=true` aurait continué
    // de dire QUELS dossiers en portent, sans que le champ soit servi, et aurait
    // donc rouvert exactement l'oracle que le retrait ferme.
    //
    // Le filtre est déjà INERTE dans `explorerItems` ; son retrait de la
    // frontière appartient à ce fichier, et le voici. Le paramètre n'est plus
    // lu : la question ne peut plus être posée, pas seulement plus répondue.
    //
    // `kind` reste, et c'est mesuré : il est structurel (launch / case /
    // platform), l'appelant le NOMME, il ne bissecte aucune assertion portant
    // sur une personne, et la page de détail en dépend.
    const filters = {
      kind,
      search: searchParams.get('search') ?? undefined,
      hasProceeds: searchParams.get('hasProceeds') === 'true' || undefined,
    }

    const [items, stats] = await Promise.all([
      getExplorerTimeline(filters),
      getExplorerStats(),
    ])

    return NextResponse.json({ items, stats, filters: {
      kind: kind ?? null,
      search: filters.search ?? null,
      hasProceeds: filters.hasProceeds ?? null,
    }})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
