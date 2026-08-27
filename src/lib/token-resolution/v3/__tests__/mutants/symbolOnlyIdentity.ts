// ─── MUTANT — le gate « identité par symbole », réintroduit exprès ─────────
//
// Ce fichier n'est PAS du code de production. C'est un défaut délibéré, gardé
// vivant pour que l'invariant E5 reste vérifiable.
//
// Il reproduit le raisonnement que la V1 tenait et que la V3 interdit :
//   « plusieurs contrats portent $X ? prends le plus liquide, c'est $X. »
//
// Le test associé exige que assertContractIdentity LÈVE sur la sortie de ce
// mutant. Conséquence : si quelqu'un affaiblit un jour la règle réelle — en
// autorisant la résolution sur simple égalité de symbole — l'invariant cesse de
// lever, et le test du mutant devient ROUGE. Le mutant est le canari.

import { normalizeSymbol } from "../../symbol";
import type { Confidence, ResolutionStatus, TokenCandidate } from "../../types";

export interface MutantDecision {
  status: ResolutionStatus;
  confidence: Confidence;
  selected: TokenCandidate | null;
  candidates: TokenCandidate[];
  conflicts: never[];
}

/**
 * Décideur fautif : regroupe par SYMBOLE, élit le plus liquide, annonce HIGH.
 * Aucune notion de contrat, donc aucune notion d'identité.
 */
export function decideBySymbolOnly(candidates: TokenCandidate[]): MutantDecision {
  const bySymbol = new Map<string, TokenCandidate[]>();
  for (const c of candidates) {
    const s = normalizeSymbol(c.symbol);
    if (!s) continue;
    bySymbol.set(s, [...(bySymbol.get(s) ?? []), c]);
  }
  const biggestGroup = Array.from(bySymbol.values()).sort((a, b) => b.length - a.length)[0] ?? [];
  const winner =
    biggestGroup
      .slice()
      .sort((a, b) => (b.signals.liquidityUsd ?? -1) - (a.signals.liquidityUsd ?? -1))[0] ?? null;

  return {
    status: winner ? "RESOLVED" : "UNRESOLVED",
    confidence: winner ? "HIGH" : "LOW",
    selected: winner,
    candidates,
    conflicts: [],
  };
}
