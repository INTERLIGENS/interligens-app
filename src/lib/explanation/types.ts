// ─── CC-OFFLINE-296 · B — L'ÉTAT ÉPISTÉMIQUE EST UN VERDICT ────────────────
//
// ██  UNKNOWN ≠ LOW ≠ CLEAN ≠ SAFE ≠ ALLOW.                                ██
//
// Le témoin humain a mesuré, sur le servi, « Score 20/100. Relatively clean —
// no major flags from this scan. » sous un bandeau UNVERIFIED. La cause n'est
// pas la phrase : c'est que `tierToVerdict` traduisait un GREEN NON COUVERT en
// `LOW`, et que TOUS les consommateurs en aval — résumé, chips, et le PROMPT
// SYSTÈME d'un LLM — projetaient cette traduction.
//
//   LE LLM NE PEUT PAS RECEVOIR UNE AFFIRMATION PLUS FORTE QUE L'AUTORITÉ
//   QUI LUI FOURNIT SON CONTEXTE.
//
// `UNVERIFIED` n'est pas une classification de risque nouvelle : c'est le même
// état que la bannière retail projette déjà depuis CC-OFFLINE-284, porté
// jusqu'ici. Une gravité, elle, n'est jamais relâchée — HIGH et CRITICAL ne
// basculent pas.
export type Verdict = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNVERIFIED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type DeployerRisk = 'NONE' | 'MEDIUM' | 'HIGH'
export type Locale = 'en' | 'fr'

export type ChipIntent =
  | 'why_score'
  | 'top_red_flags'
  | 'what_to_do'
  | 'deployer_risk'
  | 'holder_concentration'
  | 'liquidity_risk'
  | 'recidivism'
  | 'linked_projects'
  | 'intel_vault'

export interface AnalysisSummary {
  address: string
  chain: string
  tigerScore: number
  verdict: Verdict
  topReasons: string[]
  holderConcentration?: number
  deployerRisk?: DeployerRisk
  recidivismFlag?: boolean
  linkedProjects?: string[]
  liquidityRisk?: RiskLevel
  intelVaultMatches?: number
  exitSecurityFlags?: string[]
  proofSnippets?: string[]
  whatToDoNow?: string
  /**
   * CC-OFFLINE-296 · B — L'AUTORITÉ DE COUVERTURE, TRANSPORTÉE.
   *
   * Produite en amont par la route de scan (`risk.coverage.sufficient`) et
   * RECOPIÉE par `normalizeToAnalysisSummary`. Elle n'est ni recalculée, ni
   * devinée, ni complétée en aval.
   *
   * `undefined` = aucune autorité de couverture n'accompagne ce scan (les
   * chaînes EVM) ⇒ comportement historique intact. `false` ≠ `undefined` :
   * NOT_ESTABLISHED n'est pas ABSENT.
   *
   * Ce champ voyage aussi dans le `JSON.stringify(summary)` du prompt système
   * d'Ask INTERLIGENS : l'état épistémique y est donc DIT, pas déduit.
   */
  coverageSufficient?: boolean
}

export interface Chip {
  intent: ChipIntent
  label: string
}

export interface AnswerBlock {
  title: string
  body: string
}
