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
    const reasons = summary.topReasons.length > 0
      ? summary.topReasons.slice(0, 3).map((r, i) => (i + 1) + ". " + r).join("\n")
      : null

    if (locale === "fr") {
      const intro = `Ce score de ${summary.tigerScore}/100 vient de signaux détectés directement dans les données du scan.`
      const body = reasons ? `${intro}
${reasons}` : `${intro} Plusieurs branches d'analyse ont contribué au résultat.`
      return { title: title("why_score", locale), body }
    }

    const intro = `This score of ${summary.tigerScore}/100 comes from signals found directly in the scan data.`
    const body = reasons ? `${intro}
${reasons}` : `${intro} Multiple analysis branches contributed to the result.`
    return { title: title("why_score", locale), body }
  },

  top_red_flags(summary, locale) {
    if (summary.topReasons.length === 0) return noData("top_red_flags", locale)
    const list = summary.topReasons.slice(0, 3).map((r, i) => (i + 1) + ". " + r).join("\n")
    if (locale === "fr") {
      return { title: title("top_red_flags", locale), body: `Voici ce que le scan a trouvé :
${list}` }
    }
    return { title: title("top_red_flags", locale), body: `Here is what the scan found:
${list}` }
  },

  what_to_do(summary, locale) {
    if (summary.whatToDoNow) {
      return { title: title("what_to_do", locale), body: summary.whatToDoNow }
    }
    const map: Record<string, Record<Locale, string>> = {
      LOW: {
        en: "No major flags right now. Still worth checking back if anything changes.",
        fr: "Pas de gros signal pour l’instant. Revérifiez si la situation évolue.",
      },
      MODERATE: {
        en: "Some signals here. Look at the red flags before doing anything.",
        fr: "Quelques signaux à surveiller. Regardez les alertes avant de faire quoi que ce soit.",
      },
      HIGH: {
        en: "High risk. Avoid interacting with this until you understand exactly what is flagged.",
        fr: "Risque élevé. Évitez toute interaction avant de comprendre ce qui est signalé.",
      },
      CRITICAL: {
        en: "Do not interact. Swap, sign, approve — none of it. The scan found serious issues.",
        fr: "N’interagissez pas. Ni swap, ni signature, ni approbation. Le scan a détecté des problèmes graves.",
      },
    }
    return { title: title("what_to_do", locale), body: map[summary.verdict][locale] }
  },

  deployer_risk(summary, locale) {
    if (!summary.deployerRisk || summary.deployerRisk === "NONE") return noData("deployer_risk", locale)
    const map: Record<string, Record<Locale, string>> = {
      MEDIUM: {
        en: "The wallet that created this token has some history worth noting. Not confirmed bad — but not clean either.",
        fr: "Le wallet qui a créé ce token a un historique qui mérite attention. Pas confirmé problématique — mais pas propre non plus.",
      },
      HIGH: {
        en: "The wallet that launched this token has been linked to other flagged projects. Same actor, different token.",
        fr: "Le wallet qui a lancé ce token a été lié à d’autres projets signalés. Même acteur, token différent.",
      },
    }
    return { title: title("deployer_risk", locale), body: map[summary.deployerRisk]?.[locale] ?? INSUFFICIENT_DATA[locale] }
  },

  holder_concentration(summary, locale) {
    if (summary.holderConcentration === undefined) return noData("holder_concentration", locale)
    const pct = summary.holderConcentration
    if (locale === "fr") {
      const level = pct >= 90 ? "C’est massif." : pct >= 70 ? "C’est beaucoup." : "C’est à surveiller."
      return {
        title: title("holder_concentration", locale),
        body: `${pct}% de ce token est dans très peu de wallets. ${level} Si ces wallets vendent en même temps, le prix s’effondre et vous ne pouvez pas sortir.`,
      }
    }
    const level = pct >= 90 ? "That is massive." : pct >= 70 ? "That is a lot." : "Worth keeping an eye on."
    return {
      title: title("holder_concentration", locale),
      body: `${pct}% of this token sits in very few wallets. ${level} If those wallets sell at the same time, the price crashes and you cannot get out.`,
    }
  },

  liquidity_risk(summary, locale) {
    if (!summary.liquidityRisk) return noData("liquidity_risk", locale)
    const map: Record<string, Record<Locale, string>> = {
      LOW: {
        en: "Liquidity looks okay right now. Getting in or out should not be a major problem.",
        fr: "La liquidité semble correcte pour l’instant. Entrer ou sortir ne devrait pas poser de gros problème.",
      },
      MEDIUM: {
        en: "Liquidity is thin. If you are moving a large amount, expect slippage — you may get less than expected.",
        fr: "La liquidité est faible. Pour un gros montant, attendez-vous à du slippage — vous obtiendrez moins que prévu.",
      },
      HIGH: {
        en: "Serious liquidity problem. Selling this token could be very difficult — or impossible at a fair price.",
        fr: "Problème de liquidité sérieux. Vendre ce token peut être très difficile — voire impossible à un prix correct.",
      },
    }
    return { title: title("liquidity_risk", locale), body: map[summary.liquidityRisk]?.[locale] ?? INSUFFICIENT_DATA[locale] }
  },

  recidivism(summary, locale) {
    if (!summary.recidivismFlag) return noData("recidivism", locale)
    if (locale === "fr") {
      return {
        title: title("recidivism", locale),
        body: "Un ou plusieurs acteurs liés à ce token ont déjà été signalés sur d’autres projets. Ce n’est pas une coïncidence — c’est un pattern.",
      }
    }
    return {
      title: title("recidivism", locale),
      body: "One or more actors linked to this token have been flagged on other projects before. This is not a coincidence — it is a pattern.",
    }
  },

  linked_projects(summary, locale) {
    if (!summary.linkedProjects || summary.linkedProjects.length === 0) return noData("linked_projects", locale)
    const list = summary.linkedProjects.join(", ")
    if (locale === "fr") {
      return {
        title: title("linked_projects", locale),
        body: `Ce token est connecté à d’autres projets ou wallets dans le scan : ${list}. Ces liens viennent de l’analyse on-chain — pas d’une supposition.`,
      }
    }
    return {
      title: title("linked_projects", locale),
      body: `This token is connected to other projects or wallets in the scan: ${list}. These links come from on-chain analysis — not guesswork.`,
    }
  },

  intel_vault(summary, locale) {
    if (!summary.intelVaultMatches || summary.intelVaultMatches === 0) return noData("intel_vault", locale)
    const count = summary.intelVaultMatches
    if (locale === "fr") {
      return {
        title: title("intel_vault", locale),
        body: `${count} correspondance${count > 1 ? "s" : ""} trouvée${count > 1 ? "s" : ""} dans l’Intel Vault INTERLIGENS. Ça signifie que cette adresse ou ses acteurs apparaissent dans des sources d’enquête documentées.`,
      }
    }
    return {
      title: title("intel_vault", locale),
      body: `${count} match${count > 1 ? "es" : ""} found in the INTERLIGENS Intel Vault. That means this address or its actors appear in documented investigative sources.`,
    }
  },
}

export function getAnswer(intent: ChipIntent, summary: AnalysisSummary, locale: Locale): AnswerBlock {
  const handler = handlers[intent]
  if (!handler) return { title: intent, body: INSUFFICIENT_DATA[locale] }
  return handler(summary, locale)
}
