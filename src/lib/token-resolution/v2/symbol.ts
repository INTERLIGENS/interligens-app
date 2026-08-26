// ─── Symboles — une seule sémantique de correspondance ─────────────────────
// La V2 NE réimplémente PAS le matching de ticker. Elle importe les primitives
// déjà partagées par le scan public et le bridge (src/lib/marketProviders.ts,
// hors périmètre d'écriture) pour qu'« exact / préfixe / générique » veuille
// dire exactement la même chose partout. Cette dépendance est en LECTURE SEULE :
// aucun fichier de marketProviders n'est modifié par la V2.
//
// Ce qui est ajouté ici et n'existe pas en amont :
//   • la réduction des deux variantes de préfixe à un seul cas produit ;
//   • la reconnaissance d'un ticker générique, exposée au décideur.

import {
  GENERIC_TICKERS,
  normalizeSymbol as normalizeSymbolUpstream,
  tickerMatchType as tickerMatchTypeUpstream,
} from "@/lib/marketProviders";
import type { MatchType } from "./types";

/** Majuscules, sans "$", espaces, tirets ni soulignés. Primitive amont. */
export function normalizeSymbol(s: string | null | undefined): string {
  return normalizeSymbolUpstream(s);
}

/** Ticker de la liste noire (BTC, SOL, PEPE…) — jamais auto-résolu. */
export function isGenericTicker(s: string | null | undefined): boolean {
  return GENERIC_TICKERS.has(normalizeSymbol(s));
}

/**
 * Classe la correspondance entre le ticker demandé et le symbole d'un candidat.
 * "unknown" quand l'un des deux symboles manque : un candidat sans symbole
 * (mint confirmé on-chain mais pas encore indexé) reste un candidat légitime,
 * il ne peut simplement pas prétendre à une correspondance exacte.
 */
export function classifySymbolMatch(
  queryTicker: string | null | undefined,
  candidateSymbol: string | null | undefined,
): MatchType {
  const qn = normalizeSymbol(queryTicker);
  const sn = normalizeSymbol(candidateSymbol);
  if (!qn || !sn) return "unknown";
  const upstream = tickerMatchTypeUpstream(qn, sn);
  if (upstream === "exact") return "exact";
  if (upstream === null) return "unknown";
  // symbol_starts_with_query / query_starts_with_symbol — même conséquence
  // produit : correspondance partielle, jamais auto-résolue seule.
  return "prefix";
}

/** Rang de correspondance, du plus fort au plus faible. Total, sans ex æquo. */
export function matchRank(m: MatchType): number {
  switch (m) {
    case "explicit_ca":
      return 3;
    case "exact":
      return 2;
    case "prefix":
      return 1;
    default:
      return 0;
  }
}

/** Nettoie un ticker pour l'affichage : "$toes " → "TOES". */
export function cleanTicker(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/^\$+/, "").toUpperCase().trim();
}
