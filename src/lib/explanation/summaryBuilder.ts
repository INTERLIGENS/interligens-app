import type { AnalysisSummary, Locale } from './types'
import { VERDICT_SUMMARY_INTRO } from './localization'

export function buildAnalysisSummaryText(
  summary: AnalysisSummary,
  locale: Locale
): string {
  const sentences: string[] = []

  // Sentence 1 — verdict intro with score
  const intro = VERDICT_SUMMARY_INTRO[summary.verdict][locale]
    .replace('{score}', String(summary.tigerScore))
  sentences.push(intro)

  // Sentence 2 — top reasons if present
  if (summary.topReasons.length > 0) {
    const reasons = summary.topReasons.slice(0, 2).join(locale === 'fr' ? ' et ' : ' and ')
    if (locale === 'fr') {
      sentences.push(`Les signaux principaux identifiés sont : ${reasons}.`)
    } else {
      sentences.push(`The main signals identified are: ${reasons}.`)
    }
  }

  // Sentence 3 — recidivism or deployer risk
  if (summary.recidivismFlag) {
    sentences.push(
      locale === 'fr'
        ? 'Un acteur derrière ce projet a été associé à des projets précédents signalés.'
        : 'An actor behind this project has been associated with previously flagged projects.'
    )
  } else if (summary.deployerRisk === 'HIGH') {
    sentences.push(
      locale === 'fr'
        ? "L'historique du déployeur présente des signaux à risque élevé."
        : 'The deployer history shows high-risk signals.'
    )
  } else if (summary.deployerRisk === 'MEDIUM') {
    sentences.push(
      locale === 'fr'
        ? "L'historique du déployeur présente certains signaux de vigilance."
        : 'The deployer history shows some signals worth monitoring.'
    )
  }

  // Sentence 4 — intel vault or liquidity (HIGH/CRITICAL only)
  if (
    (summary.verdict === 'HIGH' || summary.verdict === 'CRITICAL') &&
    summary.intelVaultMatches !== undefined &&
    summary.intelVaultMatches > 0
  ) {
    sentences.push(
      locale === 'fr'
        ? `${summary.intelVaultMatches} correspondance(s) ont été trouvée(s) dans l'Intel Vault.`
        : `${summary.intelVaultMatches} match(es) were found in the Intel Vault.`
    )
  } else if (summary.liquidityRisk === 'HIGH') {
    sentences.push(
      locale === 'fr'
        ? 'Le risque de liquidité est élevé, ce qui peut rendre la sortie de position difficile.'
        : 'Liquidity risk is high, which may make exiting a position difficult.'
    )
  }

  return sentences.slice(0, 4).join(' ')
}
