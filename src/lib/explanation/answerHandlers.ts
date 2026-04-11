import type { AnalysisSummary, AnswerBlock, ChipIntent, Locale } from './types'
import { ANSWER_TITLES, INSUFFICIENT_DATA } from './localization'

type Handler = (summary: AnalysisSummary, locale: Locale) => AnswerBlock

function title(intent: ChipIntent, locale: Locale): string {
  return ANSWER_TITLES[intent][locale]
}

function noData(intent: ChipIntent, locale: Locale): AnswerBlock {
  return { title: title(intent, locale), body: INSUFFICIENT_DATA[locale] }
}

// ── Data-driven WHY bullet builder ────────────────────────────────────────────
// Reads typed fields from the summary AND scans topReasons strings for known
// driver keywords. Emits at most 3 unique, data-specific bullets. Each bullet
// key (`kind`) can only fire once so we never repeat "liquidity" twice.

type BulletKind =
  | 'intel_vault'
  | 'recidivism'
  | 'deployer'
  | 'concentration'
  | 'liquidity'
  | 'exit_security'
  | 'pump_like'
  | 'known_bad'
  | 'launderer'
  | 'cluster'
  | 'reason_generic'

interface Bullet {
  kind: BulletKind
  text: string
}

function fmtPct(n: number): string {
  return (Math.round(n * 10) / 10).toString() + '%'
}

function reasonsBlob(summary: AnalysisSummary): string {
  // Concat topReasons + proofSnippets to run cheap keyword checks.
  const parts: string[] = []
  for (const r of summary.topReasons ?? []) parts.push(r)
  for (const p of summary.proofSnippets ?? []) parts.push(p)
  return parts.join(' \u00b7 ').toLowerCase()
}

function buildWhyBullets(summary: AnalysisSummary, locale: Locale): string[] {
  const blob = reasonsBlob(summary)
  const bullets: Bullet[] = []
  const seen = new Set<BulletKind>()

  const push = (kind: BulletKind, en: string, fr: string) => {
    if (seen.has(kind) || bullets.length >= 3) return
    seen.add(kind)
    bullets.push({ kind, text: locale === 'fr' ? fr : en })
  }

  // 1. Intel Vault match — strongest signal
  if (summary.intelVaultMatches && summary.intelVaultMatches > 0) {
    const n = summary.intelVaultMatches
    push(
      'intel_vault',
      `Appears in ${n} INTERLIGENS investigation source${n > 1 ? 's' : ''}.`,
      `Présent dans ${n} source${n > 1 ? 's' : ''} d'enquête INTERLIGENS.`
    )
  }

  // 2. Known-bad actor keyword in drivers
  if (/known.?bad|black.?list|flagged.?actor|acteur.?connu|liste.?noire/.test(blob)) {
    push(
      'known_bad',
      'Linked to an actor already documented in our case files.',
      'Lié à un acteur déjà documenté dans nos dossiers.'
    )
  }

  // 3. Recidivism flag — same actors, multiple projects
  if (summary.recidivismFlag) {
    push(
      'recidivism',
      'Same actors tied to other flagged projects — repeating pattern.',
      'Mêmes acteurs liés à d\u0027autres projets signalés — pattern récurrent.'
    )
  }

  // 4. Deployer risk
  if (summary.deployerRisk === 'HIGH') {
    push(
      'deployer',
      'The wallet that launched this token has a flagged history.',
      'Le wallet qui a lancé ce token a un historique signalé.'
    )
  } else if (summary.deployerRisk === 'MEDIUM') {
    push(
      'deployer',
      'The launching wallet has questionable history — not clean.',
      'Le wallet de lancement a un historique douteux — pas propre.'
    )
  }

  // 5. Laundry trail / cluster risk from keywords
  if (/laundry|laundering|mix(er|ed)|tornado|peel.?chain|blanchiment/.test(blob)) {
    push(
      'launderer',
      'Funds routed through laundering patterns (mixer or peel chains).',
      'Fonds routés via des patterns de blanchiment (mixer ou peel chain).'
    )
  }
  if (/cluster|co.?funded|shared.?wallet|wallet.?farm|cluster.?risque/.test(blob)) {
    push(
      'cluster',
      'This wallet is clustered with others we already track.',
      'Ce wallet est regroupé avec d\u0027autres wallets déjà sous surveillance.'
    )
  }

  // 6. Holder concentration
  if (typeof summary.holderConcentration === 'number' && summary.holderConcentration >= 60) {
    const pct = fmtPct(summary.holderConcentration)
    push(
      'concentration',
      `${pct} of supply sits in very few wallets — dump risk is high.`,
      `${pct} de l\u0027offre est dans très peu de wallets — gros risque de dump.`
    )
  }

  // 7. Liquidity risk
  if (summary.liquidityRisk === 'HIGH' || /no.?liquid|low.?liquid|pas.?de.?liquid|liquidité.?faible/.test(blob)) {
    push(
      'liquidity',
      'Liquidity is too thin — selling at a fair price may be impossible.',
      'Liquidité trop faible — vendre à un prix correct peut être impossible.'
    )
  } else if (summary.liquidityRisk === 'MEDIUM') {
    push(
      'liquidity',
      'Liquidity is thin — expect slippage on larger trades.',
      'Liquidité faible — attendez-vous à du slippage sur les gros trades.'
    )
  }

  // 8. Pump.fun / pump-like token
  if (/pump\.?fun|pump.?like|launch.?pad|fresh.?launch/.test(blob)) {
    push(
      'pump_like',
      'Fresh pump-style launch — the pattern we see before coordinated exits.',
      'Lancement pump-style récent — pattern typique d\u0027une sortie coordonnée.'
    )
  }

  // 9. Exit security flags (honeypot, mintable, tax, blacklist)
  if (summary.exitSecurityFlags && summary.exitSecurityFlags.length > 0) {
    const flags = summary.exitSecurityFlags.slice(0, 2).join(', ')
    push(
      'exit_security',
      `Exit security red flags: ${flags}.`,
      `Alertes de sortie : ${flags}.`
    )
  }

  // 10. Fallback — pick remaining topReasons until we have 3
  if (bullets.length < 3 && summary.topReasons && summary.topReasons.length > 0) {
    for (const r of summary.topReasons) {
      if (bullets.length >= 3) break
      const txt = r.trim()
      if (!txt) continue
      // Skip if we already covered the same topic via a structured bullet
      const lc = txt.toLowerCase()
      if (
        (seen.has('liquidity') && /liquid/.test(lc)) ||
        (seen.has('concentration') && /holder|concentration/.test(lc)) ||
        (seen.has('deployer') && /deploy|creator|launch.?wall/.test(lc)) ||
        (seen.has('recidivism') && /repeat|recid|again/.test(lc)) ||
        (seen.has('intel_vault') && /vault|investig/.test(lc))
      ) {
        continue
      }
      bullets.push({ kind: 'reason_generic', text: txt })
    }
  }

  return bullets.map(b => b.text)
}

const handlers: Record<ChipIntent, Handler> = {

  why_score(summary, locale) {
    const bullets = buildWhyBullets(summary, locale)

    if (bullets.length === 0) {
      // Absolute fallback — never empty, never crash
      const fallback = locale === 'fr'
        ? `Score ${summary.tigerScore}/100 basé sur l\u0027analyse on-chain.`
        : `Score ${summary.tigerScore}/100 based on on-chain analysis.`
      return { title: title('why_score', locale), body: fallback }
    }

    const numbered = bullets.map((b, i) => (i + 1) + '. ' + b).join('\n')

    if (locale === 'fr') {
      const intro = `Score ${summary.tigerScore}/100. Voici les signaux concrets derrière ce chiffre :`
      return { title: title('why_score', locale), body: `${intro}\n${numbered}` }
    }
    const intro = `Score ${summary.tigerScore}/100. Here are the specific signals behind it:`
    return { title: title('why_score', locale), body: `${intro}\n${numbered}` }
  },

  top_red_flags(summary, locale) {
    const bullets = buildWhyBullets(summary, locale)
    if (bullets.length === 0) return noData('top_red_flags', locale)
    const list = bullets.map((b, i) => (i + 1) + '. ' + b).join('\n')
    if (locale === 'fr') {
      return { title: title('top_red_flags', locale), body: `Voici ce que le scan a trouvé :\n${list}` }
    }
    return { title: title('top_red_flags', locale), body: `Here is what the scan found:\n${list}` }
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
