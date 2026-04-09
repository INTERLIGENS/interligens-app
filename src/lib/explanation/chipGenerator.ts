import type { AnalysisSummary, Chip, ChipIntent, Locale } from './types'
import { CHIP_LABELS } from './localization'

const SIGNAL_CHIP_PRIORITY: ChipIntent[] = [
  'deployer_risk',
  'holder_concentration',
  'liquidity_risk',
  'recidivism',
  'linked_projects',
  'intel_vault',
]

function hasSignal(summary: AnalysisSummary, intent: ChipIntent): boolean {
  switch (intent) {
    case 'deployer_risk':
      return summary.deployerRisk !== undefined && summary.deployerRisk !== 'NONE'
    case 'holder_concentration':
      return summary.holderConcentration !== undefined
    case 'liquidity_risk':
      return summary.liquidityRisk !== undefined
    case 'recidivism':
      return summary.recidivismFlag === true
    case 'linked_projects':
      return (summary.linkedProjects?.length ?? 0) > 0
    case 'intel_vault':
      return (summary.intelVaultMatches ?? 0) > 0
    default:
      return false
  }
}

function makeChip(intent: ChipIntent, locale: Locale): Chip {
  return { intent, label: CHIP_LABELS[intent][locale] }
}

export function generateChips(summary: AnalysisSummary, locale: Locale): Chip[] {
  const chips: Chip[] = []

  // Slot 1 — always
  chips.push(makeChip('why_score', locale))

  // Slot 2 — always
  chips.push(makeChip('top_red_flags', locale))

  // Slot 3 — always
  chips.push(makeChip('what_to_do', locale))

  // Slot 4 — first available signal, fallback to linked_projects
  let found = false
  for (const intent of SIGNAL_CHIP_PRIORITY) {
    if (hasSignal(summary, intent)) {
      chips.push(makeChip(intent, locale))
      found = true
      break
    }
  }
  if (!found) {
    chips.push(makeChip('linked_projects', locale))
  }

  return chips.slice(0, 4)
}
