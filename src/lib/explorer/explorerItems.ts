import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { PUBLISHED_PROCEEDS_FILTER, redactProceeds } from '@/lib/kol/proceedsGate'
import { parseBehaviorFlags, type BehaviorFlagKey } from '@/lib/kol/behaviorFlags'
import { getSnapshotCountByDossier } from '@/lib/evidence/evidenceSnapshots'
import {
  PROFONDEUR_INDECIDABLE,
  profondeurLaPlusForte,
  rangDeProfondeur,
} from '@/lib/governance/invariants/evidenceDepth'
import { resumeGouverne } from '@/lib/governance/surfaces/explorer'

export type DossierKind = 'case' | 'launch' | 'platform'

export interface LinkedActor {
  handle: string
  displayName: string | null
  role: string
  tier: string | null
}

export interface DossierItem {
  id: string
  kind: DossierKind
  title: string
  summary: string | null
  primaryDate: string
  linkedActors: LinkedActor[]
  linkedActorsCount: number
  proceedsObservedTotal: number | null
  proceedsCoverage: string
  evidenceDepth: string
  strongestFlags: string[]
  documentationStatus: string
  href: string
  sharedActorGroup: boolean
  multiLaunchRecurrence: boolean
  multiLaunchCount?: number
  topCoordinationSignal?: { labelEn: string; labelFr: string; strength: string } | null
  snapshotCount: number
}

/**
 * ─── LES HUIT CHAMPS QUI NE SONT PLUS ÉMIS ─────────────────────────────
 *
 * Ce sont exactement les lignes de l'inventaire §4.B dont la colonne
 * « fondation gouvernée » valait 0/14 ou 0/9, et la table des fondations en
 * est l'unique autorité — pas cette liste, qui n'en est que la conséquence.
 *
 * ⚠ RIEN NE LES REMPLACE. Pas de `Under review`, pas de `N/A`, pas de
 * `[redacted]`, pas de phrase expliquant qu'une information a été retirée. Un
 * substitut recréerait un différentiel sur L'EXISTENCE de l'information —
 * c'est le même geste que le `summary` qui disparaît du pack du modèle plutôt
 * que d'y être voilé, troisième application.
 *
 * Les champs restent calculés EN INTERNE : `kind` sert au filtre structurel,
 * et le tri n'en dépend pas. Ce qui change est la PROJECTION SERVIE, et elle
 * a un seul point de passage — celui-ci.
 */
export const CHAMPS_NON_EMIS = [
  'kind',
  'evidenceDepth',
  'documentationStatus',
  'strongestFlags',
  'topCoordinationSignal',
  'sharedActorGroup',
  'multiLaunchRecurrence',
  'multiLaunchCount',
  'linkedActorsCount',
] as const

export type DossierServi = Omit<DossierItem, (typeof CHAMPS_NON_EMIS)[number]>

/** L'UNIQUE point où un dossier passe de l'interne au servi. */
export function projeterDossierServi(d: DossierItem): DossierServi {
  const servi: Record<string, unknown> = { ...d }
  for (const champ of CHAMPS_NON_EMIS) delete servi[champ]
  return servi as DossierServi
}

export interface ExplorerFilters {
  kind?: DossierKind
  search?: string
  hasProceeds?: boolean
  hasFlags?: boolean
}

// Published handle set — used to filter actors
async function getPublishedHandles(): Promise<Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null; proceedsPublication: string }>> {
  const profiles = await prisma.kolProfile.findMany({
    where: PUBLIC_KOL_FILTER,
    select: { handle: true, displayName: true, tier: true, evidenceDepth: true, behaviorFlags: true, totalDocumented: true, proceedsPublication: true },
  })
  return new Map(profiles.map(p => [p.handle, p]))
}

// ─── EVIDENCE_DEPTH_DOMAIN — l'ordre semantique ne vit plus ici ─────────
//
// Avant ce lot, ce fichier portait sa PROPRE table de rangs et
// snapshotSelectors.ts portait la sienne. Deux exemplaires de la meme
// semantique, tous deux avec un repli `?? 0` — et c'est ce repli qui fait
// retomber evidenceDepth = 'deep' sur 'none', donc RAVE-DUMP-APR2026
// (enquete ZachXBT, 17,8 M$ de pertes retail) sur un verdict public SIGNAL.
//
// La primitive metier est unique et vit dans src/lib/governance/invariants/.
// Prisma stocke la colonne ; il n'en invente pas la semantique.

/**
 * Fail-closed : une seule valeur hors domaine rend le marqueur
 * d'indecidabilite, qui n'a lui-meme AUCUN rang. Rien ne se replie sur 'none'.
 */
function profondeurDuDossier(depths: string[]): string {
  const agregee = profondeurLaPlusForte(depths)
  if (agregee.ok) return agregee.valeur
  console.warn('[explorer] evidenceDepth hors domaine gouverne', { horsDomaine: agregee.horsDomaine })
  return PROFONDEUR_INDECIDABLE
}

/**
 * Le statut de documentation derive du RANG, donc il ferme aussi. Un dossier
 * dont la profondeur est illisible n'est ni documented ni partial : on ne le
 * sait pas, et 'partial' serait une affirmation.
 */
function statutDeDocumentation(profondeur: string): string {
  const rang = rangDeProfondeur(profondeur)
  if (rang === null) return PROFONDEUR_INDECIDABLE
  return rang >= 3 ? 'documented' : 'partial'
}

export async function getCaseDossiers(published: Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null; proceedsPublication: string }>): Promise<DossierItem[]> {
  const cases = await prisma.kolCase.findMany({
    select: { id: true, caseId: true, kolHandle: true, role: true, paidUsd: true, evidence: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by caseId
  const grouped = new Map<string, typeof cases>()
  for (const c of cases) {
    const arr = grouped.get(c.caseId) || []
    arr.push(c)
    grouped.set(c.caseId, arr)
  }

  const dossiers: DossierItem[] = []

  for (const [caseId, entries] of grouped) {
    // Collectés pour la condition de saut UNIQUEMENT — jamais émis (voir la boucle).
    const actors: LinkedActor[] = []
    const depths: string[] = []
    const allFlags: Set<string> = new Set()
    const evidenceSnippets: string[] = []
    // Use on-chain totalDocumented from profiles, not analytical paidUsd
    const seenHandles = new Set<string>()
    let totalProceeds = 0
    let hasProceeds = false

    for (const e of entries) {
      const profile = published.get(e.kolHandle)
      if (!profile) continue // skip unpublished

      // ─── LA RELATION PERSONNE ↔ DOSSIER « CASE » N'A AUCUNE FONDATION ───
      //
      // « Publication authority of both endpoints does not establish
      //   publication authority of the relation between them. A governed
      //   relation requires its own foundation/admissibility. »
      //
      // `profile` est publié — `PUBLIC_KOL_FILTER` vient de le vérifier. Mais
      // `KolProfile.publishStatus` fonde « cette personne peut être publiée »,
      // JAMAIS « cette personne est liée à CE dossier ».
      //
      // Le porteur de la relation est la ligne `KolCase`, et elle ne porte
      // AUCUNE colonne de décision : ni publishStatus, ni visibility, ni
      // isPublic, ni reviewStatus. Seulement `lastReviewedAt`, un horodatage.
      // Mesuré sur `prisma/schema.prod.prisma`, et la requête ci-dessus
      // n'applique d'ailleurs aucun filtre. Il n'y a pas de fondation à
      // trouver : il ne peut pas y en avoir.
      //
      // La relation « launch » est traitée à l'opposé, et pour la même raison :
      // `KolTokenLink` porte `visibility`, la ligne EST la relation, et
      // `visibility='public'` est l'une des cinq décisions du référentiel. Elle
      // fonde donc son propre lien, et les acteurs y restent.
      //
      // ⚠ AUCUN SUBSTITUT. Pas d'« actors under review », pas de compteur à
      // zéro, pas de pastille vide : tout cela révélerait l'existence de
      // relations retenues.
      //
      // La collecte ci-dessous est CONSERVÉE, et elle ne sert qu'à une chose :
      // la condition de saut plus bas. « Aucun acteur publié → le dossier n'est
      // pas servi » est une règle de CONTAINMENT, et elle est inchangée — c'est
      // elle qui écarte 105 groupes de tokens sur 114. La retirer aurait fait
      // disparaître les quatre dossiers « case » en entier, ce que le ruling ne
      // demande pas : il porte sur la RELATION, pas sur l'existence du dossier.
      //
      // Ce qui change est l'ÉMISSION : `linkedActors` part à vide. Et comme le
      // filtre de recherche s'applique aux items RENDUS, il ne peut plus
      // bissecter la relation non fondée.
      actors.push({
        handle: e.kolHandle,
        displayName: profile.displayName,
        role: e.role,
        tier: profile.tier,
      })
      depths.push(profile.evidenceDepth)
      for (const f of parseBehaviorFlags(profile.behaviorFlags)) allFlags.add(f)
      if (e.evidence) evidenceSnippets.push(e.evidence)

      // Sum totalDocumented per unique handle (avoid double-counting).
      // P0 containment — redactProceeds rend null si la publication du montant
      // est retiree : le dossier n'agrege alors plus rien pour cet acteur.
      const publishedProceeds = redactProceeds(profile, profile.totalDocumented)
      if (!seenHandles.has(e.kolHandle) && publishedProceeds != null && publishedProceeds > 0) {
        totalProceeds += publishedProceeds
        hasProceeds = true
        seenHandles.add(e.kolHandle)
      }
    }

    // Skip dossiers with zero published actors
    if (actors.length === 0) continue

    const bestDepth = profondeurDuDossier(depths)
    const docStatus = statutDeDocumentation(bestDepth)

    dossiers.push({
      id: `case-${caseId}`,
      kind: 'case',
      title: caseId,
      // `KolCase.evidence` n'a aucune fondation possible : la table ne porte ni
      // publishStatus, ni visibility, ni isPublic. Les quatre dossiers servis
      // portent « Under investigation », « cross-ref @lynk0x ongoing »,
      // « Source: mariaqueennft » et « Master controller qiwu.eth ».
      summary: resumeGouverne(
        'KolCase.evidence',
        evidenceSnippets.length > 0 ? evidenceSnippets.slice(0, 2).join(' | ') : null,
        null,
      ),
      primaryDate: entries[0].createdAt.toISOString(),
      // La relation n'a pas de fondation propre : elle n'est pas émise.
      // Vide, sans substitut, et pour les quatre dossiers sans exception.
      linkedActors: [],
      linkedActorsCount: actors.length,
      proceedsObservedTotal: hasProceeds ? totalProceeds : null,
      proceedsCoverage: 'partial',
      evidenceDepth: bestDepth,
      strongestFlags: [...allFlags].slice(0, 5),
      documentationStatus: docStatus,
      href: `/en/explorer/${caseId}`,
      sharedActorGroup: false,
      multiLaunchRecurrence: false,
      snapshotCount: 0,
    })
  }

  return dossiers
}

export async function getLaunchDossiers(published: Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null; proceedsPublication: string }>): Promise<DossierItem[]> {
  const tokens = await prisma.kolTokenLink.findMany({
    // Evidence Intake Bridge (S8): only public curated links surface publicly —
    // never bridge drafts (visibility='draft') or rejected ones.
    where: { visibility: 'public' },
    select: { id: true, tokenSymbol: true, contractAddress: true, chain: true, kolHandle: true, role: true, note: true, caseId: true, documentationStatus: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by tokenSymbol ?? contractAddress
  const grouped = new Map<string, typeof tokens>()
  for (const t of tokens) {
    const key = t.tokenSymbol ?? t.contractAddress
    const arr = grouped.get(key) || []
    arr.push(t)
    grouped.set(key, arr)
  }

  const dossiers: DossierItem[] = []

  for (const [tokenKey, entries] of grouped) {
    const actors: LinkedActor[] = []
    const depths: string[] = []
    const allFlags: Set<string> = new Set()
    const notes: string[] = []
    let bestDocStatus = 'partial'
    const DOC_ORDER: Record<string, number> = { partial: 0, documented: 1, confirmed: 2 }

    for (const e of entries) {
      // Skip review-status links from public display
      if (e.documentationStatus === 'review') continue
      const profile = published.get(e.kolHandle)
      if (!profile) continue
      actors.push({ handle: e.kolHandle, displayName: profile.displayName, role: e.role, tier: profile.tier })
      depths.push(profile.evidenceDepth)
      for (const f of parseBehaviorFlags(profile.behaviorFlags)) allFlags.add(f)
      if (e.note) notes.push(e.note)
      if ((DOC_ORDER[e.documentationStatus ?? 'partial'] ?? 0) > (DOC_ORDER[bestDocStatus] ?? 0)) {
        bestDocStatus = e.documentationStatus ?? 'partial'
      }
    }

    if (actors.length === 0) continue

    const chain = entries[0].chain
    const bestDepth = profondeurDuDossier(depths)
    const caseId = entries.find(e => e.caseId)?.caseId ?? null

    dossiers.push({
      id: `launch-${tokenKey}`,
      kind: 'launch',
      title: `${tokenKey} (${chain})`,
      // `KolTokenLink.visibility='public'` autorise le LIEN, jamais la prose de
      // la note. Neuf dossiers « launch » sur neuf portent du contenu interne,
      // zéro propre — dont « Dad wallet received full supply allocation and
      // dumped », qui est servi PAR ICI et pas par KolCase.evidence.
      summary: resumeGouverne(
        'KolTokenLink.note',
        notes.length > 0 ? notes.slice(0, 2).join(' | ') : null,
        null,
      ),
      primaryDate: entries[0].createdAt.toISOString(),
      linkedActors: actors,
      linkedActorsCount: actors.length,
      proceedsObservedTotal: null,
      proceedsCoverage: 'none',
      evidenceDepth: bestDepth,
      strongestFlags: [...allFlags].slice(0, 5),
      documentationStatus: bestDocStatus,
      href: `/en/kol/${actors[0].handle}`,
      sharedActorGroup: false,
      multiLaunchRecurrence: false,
      snapshotCount: 0,
    })
  }

  return dossiers
}

// Platform-fraud casefiles (Ponzi networks, fake exchanges, …). These have
// no token and no KOL actors, so they bypass the KolCase/KolProfile join
// entirely — they are read straight from the dedicated platform_casefiles
// table and mapped onto the shared DossierItem shape with kind 'platform'.
export async function getPlatformCaseDossiers(): Promise<DossierItem[]> {
  const rows = await prisma.platformCaseFile.findMany({
    where: { publishStatus: 'published' },
    orderBy: { publishedDate: 'desc' },
  })

  return rows.map((r): DossierItem => ({
    id: `platform-${r.ref}`,
    kind: 'platform',
    title: r.codename,
    // Le SEUL résumé gouverné du corpus : `PlatformCaseFile.publishStatus`
    // vaut 'published' (le `where` ci-dessus), et cette décision porte bien sur
    // le dossier dont on rend le résumé.
    summary: resumeGouverne('PlatformCaseFile.summary', r.summary ?? r.title, r.publishStatus),
    primaryDate: (r.publishedDate ?? r.createdAt).toISOString(),
    linkedActors: [],
    linkedActorsCount: 0,
    proceedsObservedTotal: r.confirmedLossUsd ?? null,
    proceedsCoverage: 'documented',
    evidenceDepth: 'comprehensive',
    strongestFlags: [],
    documentationStatus: 'documented',
    href: `/en/cases/${r.codename.toLowerCase()}`,
    sharedActorGroup: false,
    multiLaunchRecurrence: false,
    topCoordinationSignal: null,
    snapshotCount: 0,
  }))
}

export async function getExplorerTimeline(filters: ExplorerFilters = {}) {
  const published = await getPublishedHandles()

  const [caseDossiers, launchDossiers, platformDossiers] = await Promise.all([
    getCaseDossiers(published),
    getLaunchDossiers(published),
    getPlatformCaseDossiers(),
  ])

  let items = [...caseDossiers, ...launchDossiers, ...platformDossiers]

  // Cross-dossier analysis: detect shared actor groups across launches
  const launchActorSets = launchDossiers.map(d => new Set(d.linkedActors.map(a => a.handle)))
  for (let i = 0; i < launchDossiers.length; i++) {
    const actorsI = launchActorSets[i]
    let sharedCount = 0
    for (let j = 0; j < launchDossiers.length; j++) {
      if (i === j) continue
      const overlap = [...actorsI].filter(h => launchActorSets[j].has(h))
      if (overlap.length >= 2) sharedCount++
    }
    if (sharedCount > 0) {
      launchDossiers[i].sharedActorGroup = true
      launchDossiers[i].multiLaunchRecurrence = true
      launchDossiers[i].multiLaunchCount = sharedCount + 1
    }
  }
  // Same for case dossiers
  const caseActorSets = caseDossiers.map(d => new Set(d.linkedActors.map(a => a.handle)))
  for (let i = 0; i < caseDossiers.length; i++) {
    const actorsI = caseActorSets[i]
    let sharedCount = 0
    for (let j = 0; j < caseDossiers.length; j++) {
      if (i === j) continue
      const overlap = [...actorsI].filter(h => caseActorSets[j].has(h))
      if (overlap.length >= 2) sharedCount++
    }
    if (sharedCount > 0) {
      caseDossiers[i].sharedActorGroup = true
      caseDossiers[i].multiLaunchRecurrence = true
      caseDossiers[i].multiLaunchCount = sharedCount + 1
    }
  }

  // Enrich with snapshot counts
  const allRelationKeys = items.map(i => i.title)
  const snapCounts = await getSnapshotCountByDossier(allRelationKeys)
  for (const item of items) {
    item.snapshotCount = snapCounts.get(item.title) ?? 0
  }

  // La dérivation de `topCoordinationSignal` a été RETIRÉE avec le champ. Elle
  // se nourrissait de `linkedActorsCount`, `strongestFlags` et
  // `multiLaunchRecurrence` — trois champs qui ne sont plus émis. La garder
  // aurait été du travail mort, et surtout une invitation à ré-émettre.

  items.sort((a, b) => new Date(b.primaryDate).getTime() - new Date(a.primaryDate).getTime())

  // Apply filters
  if (filters.kind) items = items.filter(i => i.kind === filters.kind)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.linkedActors.some(a => a.handle.toLowerCase().includes(q))
    )
  }
  if (filters.hasProceeds) items = items.filter(i => (i.proceedsObservedTotal ?? 0) > 0)

  // ── `hasFlags` EST RETIRÉ, ET CE N'EST PAS UN OUBLI ────────────────────
  //
  // `strongestFlags` cesse d'être émis : aucune décision ne fonde une
  // propagation de comportement d'une PERSONNE vers un DOSSIER (E8). Mais un
  // filtre est une émission PAR BISSECTION : `?hasFlags=true` aurait continué
  // de dire QUELS dossiers en portent, sans que le champ soit servi. Retirer
  // le champ en gardant le filtre aurait donc créé l'oracle que le retrait
  // ferme — exactement la cinquième vérification.
  //
  // Le paramètre reste accepté par la route (chemin gelé) et devient INERTE.
  // Son retrait appartient au patch de route.
  //
  // Le filtre `kind` reste, lui, et c'est mesuré : il est structurel
  // (launch / case / platform), l'appelant le NOMME, et il ne bissecte
  // aucune assertion portant sur une personne. La page de détail en dépend.

  return items.map(projeterDossierServi)
}

export async function getExplorerStats() {
  const where = { ...PUBLIC_KOL_FILTER }

  const [publishedProfiles, proceedsAgg, documentedWallets, linkedLaunches, strongEvidenceCount] = await Promise.all([
    prisma.kolProfile.count({ where }),
    prisma.kolProfile.aggregate({
      // P0 containment — l'agregat public ne somme que des montants publies.
      where: { ...where, ...PUBLISHED_PROCEEDS_FILTER, totalDocumented: { not: null, gt: 0 } },
      _sum: { totalDocumented: true },
    }),
    prisma.kolWallet.count({ where: { isPubliclyUsable: true, kol: where } }),
    // P0-2 — le compteur public « launches » filtrait sur le profil (kol: where)
    // mais pas sur le lien : il comptait les drafts, et compterait les archives.
    prisma.kolTokenLink.findMany({ where: { kol: where, visibility: 'public' }, select: { tokenSymbol: true }, distinct: ['tokenSymbol'] }).then(r => r.length),
    prisma.kolProfile.count({ where: { ...where, evidenceDepth: { in: ['strong', 'comprehensive'] } } }),
  ])

  return {
    publishedProfiles,
    minimumObservedProceeds: proceedsAgg._sum.totalDocumented ?? 0,
    documentedWallets,
    linkedLaunches,
    strongEvidenceCount,
  }
}
