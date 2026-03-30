import type { AnalysisSummary, AnswerBlock, ChipIntent, Locale } from './types'
import { ANSWER_TITLES, INSUFFICIENT_DATA } from './localization'

type Handler = (summary: AnalysisSummary, locale: Locale) => AnswerBlock

function title(intent: ChipIntent, locale: Locale): string {
  return ANSWER_TITLES[intent][locale]
}

function noData(intent: ChipIntent, locale: Locale): AnswerBlock {
  return { title: title(intent, locale), body: INSUFFICIENT_DATA[locale] }
}

const handlers: Record<ChipIntent, Handler> = {
  why_score(summary, locale) {
    const reasons =
      summary.topReasons.length > 0
        ? summary.topReasons.join('; ')
        : locale === 'fr' ? 'plusieurs signaux combinés' : 'multiple combined signals'
    const body =
      locale === 'fr'
        ? `Le TigerScore™ de ${summary.tigerScore}/100 reflète l'analyse combinée de plusieurs branches d'intelligence. Les principaux contributeurs sont : ${reasons}.`
        : `The TigerScore™ of ${summary.tigerScore}/100 reflects the combined analysis across multiple intelligence branches. The main contributors are: ${reasons}.`
    return { title: title('why_score', locale), body }
  },

  top_red_flags(summary, locale) {
    if (summary.topReasons.length === 0) return noData('top_red_flags', locale)
    const list = summary.topReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')
    const intro = locale === 'fr' ? 'Le scan a identifié les signaux suivants :' : 'The scan identified the following signals:'
    return { title: title('top_red_flags', locale), body: `${intro}\n${list}` }
  },

  what_to_do(summary, locale) {
    if (summary.whatToDoNow) {
      return { title: title('what_to_do', locale), body: summary.whatToDoNow }
    }
    const body: Record<string, Record<Locale, string>> = {
      LOW: {
        en: 'The scan result is low risk. Continue monitoring as conditions may change.',
        fr: 'Le résultat du scan est à faible risque. Continuez à surveiller, les conditions peuvent évoluer.',
      },
      MODERATE: {
        en: 'Exercise caution. Review the flagged signals before making any decision.',
        fr: 'Faites preuve de prudence. Examinez les signaux relevés avant toute décision.',
      },
      HIGH: {
        en: 'High risk detected. Avoid interaction until the flagged signals are resolved or independently verified.',
        fr: "Risque élevé détecté. Évitez toute interaction jusqu'à ce que les signaux soient résolus ou vérifiés de façon indépendante.",
      },
      CRITICAL: {
        en: 'Critical risk indicators were found. Strongly avoid interaction with this contract or token.',
        fr: 'Des indicateurs de risque critiques ont été relevés. Évitez fortement toute interaction avec ce contrat ou token.',
      },
    }
    return { title: title('what_to_do', locale), body: body[summary.verdict][locale] }
  },

  deployer_risk(summary, locale) {
    if (!summary.deployerRisk || summary.deployerRisk === 'NONE') return noData('deployer_risk', locale)
    const level: Record<string, Record<Locale, string>> = {
      MEDIUM: {
        en: 'The deployer has some signals in their history that warrant attention. This does not confirm malicious intent but reduces confidence.',
        fr: "Le déployeur présente certains signaux dans son historique qui méritent attention. Cela ne confirme pas une intention malveillante mais réduit la confiance.",
      },
      HIGH: {
        en: 'The deployer shows high-risk historical behavior. Previous contracts or wallets linked to this deployer have been flagged.',
        fr: 'Le déployeur présente un comportement historique à haut risque. Des contrats ou wallets précédents liés à ce déployeur ont été signalés.',
      },
    }
    return { title: title('deployer_risk', locale), body: level[summary.deployerRisk]?.[locale] ?? INSUFFICIENT_DATA[locale] }
  },

  holder_concentration(summary, locale) {
    if (summary.holderConcentration === undefined) return noData('holder_concentration', locale)
    const pct = summary.holderConcentration
    const body =
      locale === 'fr'
        ? `${pct}% des tokens sont concentrés dans un petit nombre de wallets. Une forte concentration augmente le risque de dump coordonné.`
        : `${pct}% of tokens are concentrated in a small number of wallets. High concentration increases the risk of a coordinated dump.`
    return { title: title('holder_concentration', locale), body }
  },

  liquidity_risk(summary, locale) {
    if (!summary.liquidityRisk) return noData('liquidity_risk', locale)
    const level: Record<string, Record<Locale, string>> = {
      LOW: {
        en: 'Liquidity appears adequate. Entry and exit risk from liquidity is currently low.',
        fr: "La liquidité semble adéquate. Le risque d'entrée et de sortie lié à la liquidité est actuellement faible.",
      },
      MEDIUM: {
        en: 'Liquidity is moderate. Large transactions may be impacted by slippage or thin order depth.',
        fr: 'La liquidité est modérée. Les transactions importantes peuvent être impactées par le slippage ou la profondeur limitée.',
      },
      HIGH: {
        en: 'Liquidity risk is high. Exiting a position may be difficult or costly under current conditions.',
        fr: "Le risque de liquidité est élevé. Sortir d'une position peut être difficile ou coûteux dans les conditions actuelles.",
      },
    }
    return { title: title('liquidity_risk', locale), body: level[summary.liquidityRisk]?.[locale] ?? INSUFFICIENT_DATA[locale] }
  },

  recidivism(summary, locale) {
    if (!summary.recidivismFlag) return noData('recidivism', locale)
    const body =
      locale === 'fr'
        ? "Un ou plusieurs acteurs liés à ce projet ont été associés à des projets précédemment signalés. Ce signal indique un comportement répété et augmente significativement le niveau de risque."
        : 'One or more actors linked to this project have been associated with previously flagged projects. This signal indicates repeated behavior and significantly increases risk level.'
    return { title: title('recidivism', locale), body }
  },

  linked_projects(summary, locale) {
    if (!summary.linkedProjects || summary.linkedProjects.length === 0) return noData('linked_projects', locale)
    const list = summary.linkedProjects.join(', ')
    const body =
      locale === 'fr'
        ? `Les projets liés suivants ont été identifiés : ${list}. Ces connexions proviennent de l'analyse des wallets et des comportements on-chain.`
        : `The following linked projects were identified: ${list}. These connections come from wallet graph analysis and on-chain behavior.`
    return { title: title('linked_projects', locale), body }
  },

  intel_vault(summary, locale) {
    if (summary.intelVaultMatches === undefined || summary.intelVaultMatches === 0) return noData('intel_vault', locale)
    const count = summary.intelVaultMatches
    const body =
      locale === 'fr'
        ? `L'Intel Vault a trouvé ${count} correspondance(s) avec des entrées de menaces connues, des listes de surveillance ou des signalements d'enquêteurs.`
        : `The Intel Vault found ${count} match(es) against known threat entries, watchlists, or investigator reports.`
    return { title: title('intel_vault', locale), body }
  },
}

export function getAnswer(intent: ChipIntent, summary: AnalysisSummary, locale: Locale): AnswerBlock {
  const handler = handlers[intent]
  if (!handler) return { title: intent, body: INSUFFICIENT_DATA[locale] }
  return handler(summary, locale)
}
