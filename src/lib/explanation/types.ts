export type Verdict = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
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
}

export interface Chip {
  intent: ChipIntent
  label: string
}

export interface AnswerBlock {
  title: string
  body: string
}
