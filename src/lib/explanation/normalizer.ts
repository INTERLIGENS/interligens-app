import type { AnalysisSummary, Verdict } from './types'

// Adapts NormalizedScan (from demo page) → AnalysisSummary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeToAnalysisSummary(raw: Record<string, any>): AnalysisSummary {
  const score = Number(raw?.score ?? 0)

  // ── CC-OFFLINE-296 · B — LE PONT D'AUTORITÉ ──────────────────────────────
  //
  // ██  LES RENDERERS PROJETTENT UNE AUTORITÉ. ILS NE LA CRÉENT PAS.        ██
  //
  // `risk.coverage.sufficient` est produit par `api/scan/solana`. Il est LU
  // ici, jamais dérivé : c'est la même frontière que la présentation retail
  // consomme depuis CC-OFFLINE-292, portée jusqu'à la couche d'explication.
  const coverageSufficient: boolean | undefined = raw?.risk?.coverage?.sufficient

  const verdict = tierToVerdict(raw?.tier, score, coverageSufficient)

  // topReasons: extract from proofs where level is high or medium
  const proofs: any[] = Array.isArray(raw?.proofs) ? raw.proofs : []
  const topReasons = proofs
    .filter((p) => p.level === 'high' || p.level === 'medium')
    .map((p) => p.riskDescription)
    .filter(Boolean)
    .slice(0, 3)

  // exitSecurityFlags: proofs where level is high
  const exitSecurityFlags = proofs
    .filter((p) => p.level === 'high')
    .map((p) => p.label)
    .filter(Boolean)

  // whatToDoNow: first recommendation
  //
  // ⛔ CC-OFFLINE-296 · B2 — `recommendations` vient de `getActionCopy`, qui
  //    est SÉLECTIONNÉ SUR LE PALIER. Sous une couverture insuffisante, le
  //    palier permissif ne fonde aucun conseil — la recommandation n'est donc
  //    pas TRANSPORTÉE. Elle n'est ni réécrite, ni remplacée ici : le
  //    gestionnaire de chips choisira la copie de l'état réel.
  const recommendations: string[] = Array.isArray(raw?.recommendations) ? raw.recommendations : []
  const whatToDoNow = verdict === 'UNVERIFIED' ? undefined : (recommendations[0] ?? undefined)

  return {
    address: String(raw?.address ?? raw?.rawSummary?.address ?? ''),
    chain: String(raw?.chain ?? 'Unknown'),
    tigerScore: score,
    verdict,
    topReasons,
    exitSecurityFlags: exitSecurityFlags.length > 0 ? exitSecurityFlags : undefined,
    whatToDoNow,
    // These require deeper scan data not yet in NormalizedScan — undefined for Phase 1A
    holderConcentration: undefined,
    deployerRisk: undefined,
    recidivismFlag: undefined,
    linkedProjects: undefined,
    liquidityRisk: undefined,
    intelVaultMatches: undefined,
    proofSnippets: undefined,
    coverageSufficient,
  }
}

/**
 * CC-OFFLINE-296 · B — LA TRADUCTION D'UN PALIER EN ÉTAT ÉPISTÉMIQUE.
 *
 * ⛔ UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE. `RED → CRITICAL` et `ORANGE → HIGH`
 *    traversent intacts, quelle que soit la couverture. La couverture
 *    RESTREINT une permission ; elle ne réduit pas une gravité établie, et
 *    elle ne masque aucune preuve négative réelle.
 *
 * ⛔ AUCUN SEUIL N'EST DÉPLACÉ. Les bornes 70 / 40 du repli sont celles qui
 *    étaient là. Seule la LECTURE PERMISSIVE — celle qui n'a rien d'autre
 *    qu'un palier vert — est conditionnée à un appui positif.
 *
 * `UNKNOWN` bascule aussi : il retombait auparavant sur le repli par score
 * (`score` valant 0) et rendait donc `LOW` — « pas de score » devenait
 * « plutôt propre ». C'est la même faute, sur l'autre entrée.
 */
function tierToVerdict(tier?: string, score?: number, coverageSufficient?: boolean): Verdict {
  const t = String(tier ?? '').toUpperCase()
  if (t === 'RED')    return 'CRITICAL'
  if (t === 'ORANGE') return 'HIGH'
  const couvertureInsuffisante = coverageSufficient === false
  if (t === 'UNKNOWN') return 'UNVERIFIED'
  if (t === 'GREEN')  return couvertureInsuffisante ? 'UNVERIFIED' : 'LOW'
  // fallback by score
  const s = Number(score ?? 0)
  if (s >= 70) return 'CRITICAL'
  if (s >= 40) return 'HIGH'
  return couvertureInsuffisante ? 'UNVERIFIED' : 'LOW'
}
