// ─── Contrats de la résolution universelle V3 ──────────────────────────────
// V3 corrige trois erreurs de cadrage de la V2 :
//
//   E5  l'identité d'un token est (chain, contract). JAMAIS le symbole.
//       Deux candidats au même symbole sur deux contrats différents sont deux
//       tokens différents — pas un token avec deux avis.
//   D2  le temps est une contrainte d'identité, pas un bonus de confiance. Un
//       mint créé après l'observation ne PEUT PAS être le token observé.
//   M   la chaîne est déclarée par l'appelant. Le module n'a aucune préférence
//       pour Solana : « SOL d'abord » était une préférence cachée qui décidait
//       à la place des consommateurs.
//
// Principe conservé de la V2 : un candidat porte SES SOURCES et SES SIGNAUX,
// jamais une décision. La décision vit dans confidence.ts, seul.

import type { CanonicalChain } from "./chain";

// ─── Sources ──────────────────────────────────────────────────────────────
// Ordre = autorité décroissante. Toute source ajoutée prend sa place ici.
export type CandidateSource =
  | "explicit_ca" // adresse présente dans la requête elle-même
  | "casefile" // token_casefiles, publishStatus='published'
  | "casefile_preset" // BOTIFY / VINE — pas de ligne DB
  | "curated" // KolTokenLink, visibility='public' — tier CURATED de la V1
  | "ca_map" // index caseId→contrat (src/lib/kol/proceeds.ts) — JAMAIS par ticker, cf. UR-12
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

export const INTERNAL_ONLY_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "curated_draft",
]);

/**
 * Sources qui ne portent AUCUNE donnée de marché.
 * CoinGecko en fait partie : son résultat est une liste de contrats par
 * plateforme, sans liquidité ni volume. La V1 lui fabriquait pourtant
 * `matchType:'exact'` ET `lowLiquidity:false` en dur, ce qui suffisait à
 * `decideResolution` pour auto-résoudre — cf. cas doctrinal I3. En V3 une
 * source sans marché ne peut jamais satisfaire un seuil de liquidité :
 * l'absence de donnée n'est pas une donnée favorable.
 */
export const MARKETLESS_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "coingecko",
  "onchain",
  "ca_map",
  "casefile_preset",
]);

export type Audience = "public" | "internal";

/** Périmètre de chaînes déclaré par un appelant. Vide = aucune restriction. */
export type CanonicalChainList = readonly CanonicalChain[];

// ─── Correspondance de symbole ────────────────────────────────────────────
// ATTENTION : matchType mesure une RESSEMBLANCE DE NOM. Ce n'est pas une
// mesure d'identité. Voir E5 — deux contrats au même symbole restent deux
// tokens. matchType sert à ORDONNER, jamais à IDENTIFIER.
export type MatchType = "exact" | "prefix" | "explicit_ca" | "unknown";

// ─── Temps ────────────────────────────────────────────────────────────────
/**
 * Compatibilité entre la date de naissance d'un candidat et la date
 * d'observation (le tweet, la capture, le scan).
 *   "compatible"   le candidat existait déjà au moment observé
 *   "impossible"   le candidat est né APRÈS — il ne peut pas être le token vu
 *   "unknown"      aucune date de naissance connue — ne conclut rien
 */
export type TemporalVerdict = "compatible" | "impossible" | "unknown";

export type ExclusionReason =
  | "temporally_impossible" // né après l'observation (D2)
  | "chain_not_allowed" // hors des chaînes déclarées par l'appelant
  | "invalid_address"
  | "internal_source_in_public_output";

export interface CandidateExclusion {
  reason: ExclusionReason;
  detail: string;
}

// ─── Signaux ──────────────────────────────────────────────────────────────
export interface CandidateSignals {
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  /** Nombre de KOL distincts reliés — AGRÉGAT. Jamais de handle en sortie. */
  kolCount: number;
  scanCount: number | null;
  hasPublishedCasefile: boolean;
  casefileRefs: string[];
  onChainConfirmed: boolean;
  dumpPct: number | null;
  concentrationScore: number | null;
  holderCount: number | null;
  isPumpFun: boolean;
  /**
   * Première existence attestée du contrat, en millisecondes epoch.
   * D2 : c'est la borne basse de son âge. Provenance dans firstSeenSource,
   * parce qu'une paire DexScreener et une ligne curée ne valent pas la même
   * chose comme preuve d'antériorité.
   */
  firstSeenAt: number | null;
  firstSeenSource: CandidateSource | null;
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
    firstSeenAt: null,
    firstSeenSource: null,
  };
}

// ─── Candidat ─────────────────────────────────────────────────────────────
export interface TokenCandidate {
  /** IDENTITÉ — (chain, address). Rien d'autre n'identifie un token. */
  chain: CanonicalChain;
  address: string;
  /** Étiquette. N'identifie rien. */
  symbol: string | null;
  name: string | null;
  matchType: MatchType;
  sources: CandidateSource[];
  signals: CandidateSignals;
  chainInferred: boolean;
  temporal: TemporalVerdict;
  /** Renseigné ⇒ le candidat est écarté et ne peut plus être sélectionné. */
  excluded?: CandidateExclusion;
}

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
  ticker?: string | null;
  addresses?: string[] | null;
  rawText?: string | null;
  /**
   * Chaînes que l'APPELANT sait traiter. Obligatoire, sans valeur par défaut :
   * un module qui ne scanne que Solana et un module multi-chaînes n'ont pas la
   * même réponse correcte, et ce n'est pas au résolveur d'en décider.
   * Un token trouvé hors de cette liste est RÉSOLU quand même, marqué
   * UNSUPPORTED_BY_CALLER — jamais rendu introuvable.
   */
  allowedChains: readonly CanonicalChain[];
  /**
   * Indication de chaîne pour désambiguïser une adresse EVM. Ne restreint rien.
   */
  chainHint?: string | null;
  /**
   * D2 — instant de l'OBSERVATION : date du tweet, de la capture, du scan.
   * Un contrat né après cette date ne peut pas être le token observé.
   */
  observedAt?: Date | null;
  kolHandle?: string | null;
  watcherCampaignId?: string | null;
  /**
   * UR-12 — identifiants de DOSSIER d'enquête (KolCase.caseId), quand
   * l'appelant en détient. Jamais des tickers : l'index des dossiers ne porte
   * pas de symbole, et « SERIAL-12RUGS » est un motif d'enquête, pas un token.
   * Voir sources/caseIndex.ts.
   */
  caseIds?: readonly string[];
  audience: Audience;
}

// ─── Résultat ─────────────────────────────────────────────────────────────
export type ResolutionStatus = "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "CONFLICT";
export type Confidence = "LOW" | "MODERATE" | "HIGH";

/**
 * L'asset est identifié mais l'appelant ne sait pas le traiter. Ce n'est PAS
 * un échec de résolution : renvoyer NOT_FOUND ferait croire que le token
 * n'existe pas, et l'utilisateur conclurait à tort.
 */
export type CallerSupport = "supported" | "unsupported_by_caller";

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
  /** E5 — même symbole, contrats différents. L'identité est le contrat. */
  | "contract_identity"
  /** L'adresse fournie ne porte pas le ticker annoncé, un autre token le porte. */
  | "ticker_vs_address"
  /** Même symbole exact, même chaîne, contrats différents. */
  | "multiple_exact"
  /** Même symbole sur plusieurs chaînes. */
  | "cross_chain"
  /** La source curée et le marché ne pointent pas le même contrat. */
  | "internal_vs_market"
  /** D2 — le seul candidat plausible est temporellement impossible. */
  | "temporal_impossibility";

export interface ResolutionConflict {
  kind: ConflictKind;
  detail: string;
  /** Clés d'identité (chain:address) des candidats en désaccord. */
  between: string[];
}

export interface ProviderCallCounts {
  dexScreener: number;
  helius: number;
  coinGecko: number;
  hyperliquid: number;
}

export interface ResolutionTelemetry {
  /** Appels sortants effectivement partis, par provider. */
  providerCalls: ProviderCallCounts;
  /** Appels évités par le cache, par provider. */
  providerCacheHits: ProviderCallCounts;
  dbQueries: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEntries: number;
  /** Requêtes refusées par le plafond d'exécution — jamais silencieuses. */
  budgetRefusals: number;
}

export function emptyProviderCalls(): ProviderCallCounts {
  return { dexScreener: 0, helius: 0, coinGecko: 0, hyperliquid: 0 };
}

export function emptyTelemetry(): ResolutionTelemetry {
  return {
    providerCalls: emptyProviderCalls(),
    providerCacheHits: emptyProviderCalls(),
    dbQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheEntries: 0,
    budgetRefusals: 0,
  };
}

export interface TokenResolution {
  status: ResolutionStatus;
  confidence: Confidence;
  method: ResolutionMethod;
  callerSupport: CallerSupport;
  selected: TokenCandidate | null;
  /** Candidats retenus, classés. */
  candidates: TokenCandidate[];
  /** Candidats ÉCARTÉS et pourquoi. Jamais perdus en silence. */
  excluded: TokenCandidate[];
  conflicts: ResolutionConflict[];
  limitations: string[];
  telemetry: ResolutionTelemetry;
  audience: Audience;
}
