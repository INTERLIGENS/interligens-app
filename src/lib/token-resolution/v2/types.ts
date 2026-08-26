// ─── Contrats de la résolution universelle V2 ──────────────────────────────
// UN type d'identité token pour tout le produit. Le repo en porte quatre
// aujourd'hui (recensé R0) : ResolvedTokenCandidate (marketProviders),
// TokenCandidate (scoreTokenCandidate), TokenResolution (osint/vision),
// MintResolution (shill-correlation). La V2 les remplace par la suite ; ce
// fichier ne les modifie pas.
//
// Principe : un candidat porte SES SOURCES et SES SIGNAUX, jamais une décision.
// La décision (status/confidence) est calculée en un seul endroit — confidence.ts.

import type { CanonicalChain } from "./chain";

// ─── Sources ──────────────────────────────────────────────────────────────
// Ordre de la liste = ordre d'autorité décroissante, utilisé tel quel par le
// classement des candidats. Toute source ajoutée doit être insérée à sa place.
export type CandidateSource =
  | "explicit_ca" // adresse présente dans la requête elle-même
  | "casefile" // token_casefiles, publishStatus='published'
  | "casefile_preset" // BOTIFY / VINE — pas de ligne DB
  | "curated" // KolTokenLink, visibility='public'
  | "ca_map" // table ticker→CA curée (src/lib/kol/proceeds.ts)
  | "mentions" // KolPromotionMention
  | "involvement" // KolTokenInvolvement
  | "launch_metric" // TokenLaunchMetric
  | "price_tracker" // TokenPriceTracker
  | "scan_aggregate" // TokenScanAggregate
  | "curated_draft" // KolTokenLink, visibility='draft' — INTERNE uniquement
  | "dexscreener"
  | "coingecko"
  | "onchain"; // existence du mint confirmée par RPC

export const SOURCE_AUTHORITY: readonly CandidateSource[] = [
  "explicit_ca",
  "casefile",
  "casefile_preset",
  "curated",
  "ca_map",
  "mentions",
  "involvement",
  "launch_metric",
  "price_tracker",
  "scan_aggregate",
  "curated_draft",
  "dexscreener",
  "coingecko",
  "onchain",
] as const;

/**
 * Sources qui ne doivent JAMAIS alimenter une réponse publique.
 * - curated_draft : l'invariant __tests__/security/koltokenlink-visibility-invariant
 *   impose une liste blanche visibility='public' sur toute lecture publique de
 *   KolTokenLink. La V2 lit les drafts pour le bridge (audience "internal") et
 *   les retire à la frontière publique — la liste blanche reste dans la requête SQL,
 *   ce filtre-ci est la seconde barrière.
 */
export const INTERNAL_ONLY_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "curated_draft",
]);

export type Audience = "public" | "internal";

// ─── Correspondance de symbole ────────────────────────────────────────────
// Reprend la sémantique de marketProviders.tickerMatchType (exact / prefix)
// et lui ajoute les deux cas que la V1 ne nommait pas.
export type MatchType = "exact" | "prefix" | "explicit_ca" | "unknown";

// ─── Signaux portés par un candidat ───────────────────────────────────────
// Tous facultatifs : un candidat n'est jamais rejeté pour un signal absent.
export interface CandidateSignals {
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  /** Nombre de KOL distincts reliés — AGRÉGAT. Jamais de handle en sortie publique. */
  kolCount: number;
  /** TokenScanAggregate.scanCount — popularité de scan, départage les ex æquo. */
  scanCount: number | null;
  /** Au moins un dossier publié pointe cette adresse. */
  hasPublishedCasefile: boolean;
  /** Références publiques des dossiers (ex. "IL-PND-LAB-001"). Non nominatif. */
  casefileRefs: string[];
  /** Existence du mint confirmée on-chain (RPC), indépendamment de tout marché. */
  onChainConfirmed: boolean;
  /** TokenPriceTracker.dumpPct — chute depuis le pic, en pourcentage. */
  dumpPct: number | null;
  /** TokenLaunchMetric — concentration des porteurs au lancement. */
  concentrationScore: number | null;
  holderCount: number | null;
  /** Mint pump.fun (suffixe littéral). */
  isPumpFun: boolean;
}

export function emptySignals(): CandidateSignals {
  return {
    liquidityUsd: null,
    volume24hUsd: null,
    kolCount: 0,
    scanCount: null,
    hasPublishedCasefile: false,
    casefileRefs: [],
    onChainConfirmed: false,
    dumpPct: null,
    concentrationScore: null,
    holderCount: null,
    isPumpFun: false,
  };
}

// ─── Candidat ─────────────────────────────────────────────────────────────
export interface TokenCandidate {
  chain: CanonicalChain;
  /** Adresse normalisée (EVM en minuscules, base58 tel quel). */
  address: string;
  symbol: string | null;
  name: string | null;
  matchType: MatchType;
  /** Sources ayant produit ce candidat, triées par autorité décroissante. */
  sources: CandidateSource[];
  signals: CandidateSignals;
  /**
   * Chaîne déduite de la forme de l'adresse faute de colonne exploitable
   * (lignes chain='unknown'). Trace d'audit — la chaîne reste utilisable.
   */
  chainInferred: boolean;
}

/** Ce qu'une source produit avant fusion. Une source ne décide de rien. */
export interface RawCandidate {
  chain: CanonicalChain;
  address: string;
  symbol?: string | null;
  name?: string | null;
  matchType?: MatchType;
  source: CandidateSource;
  chainInferred?: boolean;
  signals?: Partial<CandidateSignals>;
}

// ─── Requête ──────────────────────────────────────────────────────────────
export interface ResolutionRequest {
  /** Cashtag ou ticker, avec ou sans "$". */
  ticker?: string | null;
  /** Adresses brutes candidates (post, formulaire, capture). Ordre significatif. */
  addresses?: string[] | null;
  /** Texte brut d'où extraire d'éventuelles adresses. */
  rawText?: string | null;
  chainHint?: string | null;
  /** Contexte d'enquête — jamais renvoyé au public. */
  kolHandle?: string | null;
  watcherCampaignId?: string | null;
  postTimestamp?: Date | null;
  /**
   * "public" : sortie destinée à une surface retail. Filtre les sources internes.
   * "internal" : bridge / admin / enquête.
   * Pas de valeur par défaut implicite — l'appelant DOIT choisir.
   */
  audience: Audience;
}

// ─── Résultat ─────────────────────────────────────────────────────────────
export type ResolutionStatus = "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "CONFLICT";
export type Confidence = "LOW" | "MODERATE" | "HIGH";

export type ResolutionMethod =
  | "explicit_ca"
  | "casefile"
  | "curated"
  | "ca_map"
  | "mentions"
  | "internal_ranked"
  | "dexscreener_exact"
  | "dexscreener_ranked"
  | "coingecko"
  | "onchain"
  | "none";

export type ConflictKind =
  | "ticker_vs_address" // le CA du post ne porte pas le ticker annoncé
  | "multiple_exact" // plusieurs tokens portent exactement ce symbole
  | "cross_chain" // même symbole sur plusieurs chaînes, aucune dominante
  | "internal_vs_market"; // la source curée et le marché ne pointent pas la même adresse

export interface ResolutionConflict {
  kind: ConflictKind;
  detail: string;
  /** Clés d'identité (chain:address) des candidats en désaccord. */
  between: string[];
}

export interface ResolutionTelemetry {
  dexScreenerCalls: number;
  heliusCalls: number;
  coinGeckoCalls: number;
  dbQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

export function emptyTelemetry(): ResolutionTelemetry {
  return {
    dexScreenerCalls: 0,
    heliusCalls: 0,
    coinGeckoCalls: 0,
    dbQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
}

export interface TokenResolution {
  status: ResolutionStatus;
  confidence: Confidence;
  method: ResolutionMethod;
  /** Candidat retenu — non null si et seulement si status === "RESOLVED". */
  selected: TokenCandidate | null;
  /** Tous les candidats, classés. Contient le retenu quand il existe. */
  candidates: TokenCandidate[];
  conflicts: ResolutionConflict[];
  /** Ce que la résolution n'a PAS pu établir. Jamais silencieux. */
  limitations: string[];
  telemetry: ResolutionTelemetry;
  audience: Audience;
}
