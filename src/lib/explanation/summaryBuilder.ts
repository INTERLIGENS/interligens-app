import type { AnalysisSummary, Locale } from './types'

export function buildAnalysisSummaryText(summary: AnalysisSummary, locale: Locale): string {
  return locale === "fr" ? buildFr(summary) : buildEn(summary)
}

function buildEn(s: AnalysisSummary): string {
  const lines: string[] = []
  switch (s.verdict) {
    case "LOW":      lines.push(`Score ${s.tigerScore}/100. Relatively clean — no major flags from this scan.`); break
    case "MODERATE": lines.push(`Score ${s.tigerScore}/100. Some signals here worth checking before you do anything.`); break
    case "HIGH":     lines.push(`Score ${s.tigerScore}/100. This looks rough — the scan flagged several serious signals.`); break
    case "CRITICAL": lines.push(`Score ${s.tigerScore}/100. This is bad. The scan found critical risk indicators.`); break
  }
  if (s.topReasons.length > 0) {
    const shown = s.topReasons.slice(0, 2).join(" and ")
    lines.push(`The main signals are: ${shown}.`)
  }
  if (s.recidivismFlag) {
    lines.push("The wallet behind this has been flagged before on other projects.")
  } else if (s.deployerRisk === "HIGH") {
    lines.push("The wallet that launched this token has a flagged history.")
  } else if (typeof s.holderConcentration === "number" && s.holderConcentration >= 80) {
    lines.push(`${s.holderConcentration}% of this token sits in very few wallets.`)
  } else if (s.intelVaultMatches && s.intelVaultMatches > 0) {
    lines.push(`This address matched ${s.intelVaultMatches} source${s.intelVaultMatches > 1 ? "s" : ""} in the INTERLIGENS Intel Vault.`)
  } else if (s.exitSecurityFlags && s.exitSecurityFlags.length > 0) {
    lines.push(`Exit security flags detected: ${s.exitSecurityFlags.slice(0, 2).join(", ")}.`)
  }
  return lines.join(" ")
}

function buildFr(s: AnalysisSummary): string {
  const lines: string[] = []
  switch (s.verdict) {
    case "LOW":      lines.push(`Score ${s.tigerScore}/100. Plutôt propre — pas de gros signal dans ce scan.`); break
    case "MODERATE": lines.push(`Score ${s.tigerScore}/100. Quelques signaux à vérifier avant de faire quoi que ce soit.`); break
    case "HIGH":     lines.push(`Score ${s.tigerScore}/100. Ça craint — le scan a relevé plusieurs signaux sérieux.`); break
    case "CRITICAL": lines.push(`Score ${s.tigerScore}/100. C’est grave. Le scan a détecté des indicateurs de risque critiques.`); break
  }
  if (s.topReasons.length > 0) {
    const shown = s.topReasons.slice(0, 2).join(" et ")
    lines.push(`Les signaux principaux : ${shown}.`)
  }
  if (s.recidivismFlag) {
    lines.push("Le wallet derrière ce token a déjà été signalé sur d’autres projets.")
  } else if (s.deployerRisk === "HIGH") {
    lines.push("Le wallet qui a lancé ce token a un historique signalé.")
  } else if (typeof s.holderConcentration === "number" && s.holderConcentration >= 80) {
    lines.push(`${s.holderConcentration}% de ce token est dans très peu de wallets.`)
  } else if (s.intelVaultMatches && s.intelVaultMatches > 0) {
    lines.push(`Cette adresse correspond à ${s.intelVaultMatches} source${s.intelVaultMatches > 1 ? "s" : ""} dans l’Intel Vault INTERLIGENS.`)
  } else if (s.exitSecurityFlags && s.exitSecurityFlags.length > 0) {
    lines.push(`Signaux de sortie détectés : ${s.exitSecurityFlags.slice(0, 2).join(", ")}.`)
  }
  return lines.join(" ")
}
