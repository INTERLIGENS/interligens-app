// ─── HOOK SHADOW — V3 tourne à côté de V1, et n'est JAMAIS consommé ────────
//
// V1 (`resolveCanonicalToken`) reste le résolveur canonique du bridge : c'est
// lui, et lui seul, qui décide s'il y a un draft, quel mint, quelle confiance.
// V3 tourne EN PARALLÈLE sur la même entrée, son verdict est JOURNALISÉ puis
// JETÉ. Aucun consommateur — ni TigerScore, ni REFLEX, ni la publication, ni
// Decision — ne voit ce qui sort d'ici.
//
// Pourquoi une ombre plutôt qu'une bascule : V3 change des verdicts. On mesure
// COMBIEN et LESQUELS sur du trafic réel avant d'y toucher, plutôt que de
// découvrir l'écart en production sur des dossiers publiés.
//
// ─── GARANTIES ────────────────────────────────────────────────────────────
//   • Ne renvoie jamais rien que l'appelant puisse consommer : le type de retour
//     est une ligne de journal, pas une résolution.
//   • Ne lève JAMAIS. Toute erreur devient une comparaison marquée `v3_error`.
//     Une ombre qui casse le chemin qu'elle observe est pire que pas d'ombre.
//   • Lecture seule en base, aucune écriture, aucune table, aucune migration :
//     la comparaison sort sur le journal applicatif.
//   • Zéro donnée nominative. Ni handle KOL, ni identifiant de campagne ou de
//     candidat, ni texte du post — seulement le ticker, les adresses de contrat
//     (données publiques de chaîne) et des compteurs.
//
// ─── COÛT ─────────────────────────────────────────────────────────────────
// `allowedChains: ["SOL"]` cadre V3 sur le périmètre que le bridge traite déjà :
// pas de sondage EVM, pas de chaîne que V1 n'aurait pas regardée. Les appels
// restants sont réels et comptés — `providerUsage` les remonte à chaque ligne,
// pour que la facture soit lisible avant l'arbitrage de bascule.

import { resolveToken } from "@/lib/token-resolution/v3/resolve";
import { POLICY_VERSION } from "@/lib/token-resolution/v3/policy";
import { prismaDbClient } from "@/lib/token-resolution/v3/sources/db";
import { createProviderContext } from "@/lib/token-resolution/v3/providers";
import { ResolutionCache } from "@/lib/token-resolution/v3/providers/cache";
import { emptyTelemetry } from "@/lib/token-resolution/v3/types";
import type { TokenResolution } from "@/lib/token-resolution/v3/types";
import type { CanonicalTokenResolution } from "@/lib/token-resolution/resolveCanonicalToken";

/** Le bridge ne traite que Solana : déclarer plus ferait payer des sondages inutiles. */
export const SHADOW_ALLOWED_CHAINS = ["SOL"] as const;

export const SHADOW_LOG_TAG = "[token-resolution:shadow]";

/**
 * Coupe-circuit. L'ombre tourne par défaut — c'est l'objet du hook — et
 * `TOKEN_RESOLUTION_V3_SHADOW=0` l'éteint sans redéploiement de code.
 *
 * Il existe pour UNE raison précise. V3 et V1 tapent les mêmes fournisseurs
 * (DexScreener, Helius) depuis la même IP : c'est le seul chemin par lequel
 * l'ombre pourrait atteindre V1, non par le code mais par un quota partagé. Si
 * un run se met à collecter des 429, on éteint ici, pas dans un commit.
 */
export function shadowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TOKEN_RESOLUTION_V3_SHADOW !== "0";
}

export type ShadowAgreement =
  /** Même contrat élu de part et d'autre. */
  | "same_mint"
  /** Les deux élisent un contrat, mais PAS le même. C'est le cas qui compte. */
  | "different_mint"
  /** V1 tranche, V3 refuse (conflit, ambiguïté, exclusion temporelle). */
  | "v1_only"
  /** V3 tranche, V1 non. */
  | "v3_only"
  /** Aucun des deux ne tranche. */
  | "both_none"
  /** V3 a échoué : la comparaison n'a pas eu lieu, et on le dit. */
  | "v3_error";

export interface ShadowInput {
  ticker: string | null;
  addresses: string[];
  /** Le texte lui-même n'est JAMAIS journalisé — seulement sa présence. */
  hasRawText: boolean;
  observedAt: Date | null;
}

export interface ShadowComparison {
  policyVersion: string;
  input: {
    ticker: string | null;
    addresses: string[];
    addressCount: number;
    hasRawText: boolean;
    observedAt: string | null;
    allowedChains: string[];
  };
  v1: {
    status: string;
    confidence: string;
    method: string;
    mint: string | null;
    chain: string | null;
  };
  v3: {
    status: string;
    confidence: string;
    method: string;
    callerSupport: string;
    mint: string | null;
    chain: string | null;
    candidateCount: number;
    excludedCount: number;
  };
  agreement: ShadowAgreement;
  /** Pourquoi V3 n'a pas tranché, ou ce qui l'a fait diverger. Jamais vide. */
  reason: string;
  /** Motifs d'exclusion, dédupliqués — « pourquoi ce candidat a sauté ». */
  exclusionReasons: string[];
  /** Types de conflit détectés par V3 (identité de contrat, inter-chaînes…). */
  conflictKinds: string[];
  limitations: string[];
  providerUsage: {
    calls: Record<string, number>;
    cacheHits: Record<string, number>;
    failures: Record<string, number>;
    dbQueries: number;
    budgetRefusals: number;
  };
  latencyMs: number;
  error: string | null;
}

function norm(a: string | null | undefined): string | null {
  return a ? a.toLowerCase() : null;
}

export function computeAgreement(
  v1Mint: string | null,
  v3Mint: string | null,
  errored: boolean,
): ShadowAgreement {
  if (errored) return "v3_error";
  const a = norm(v1Mint);
  const b = norm(v3Mint);
  if (a && b) return a === b ? "same_mint" : "different_mint";
  if (a) return "v1_only";
  if (b) return "v3_only";
  return "both_none";
}

/**
 * Pourquoi les deux divergent, en une phrase exploitable en revue. Une ligne de
 * comparaison qui dit « different_mint » sans dire POURQUOI oblige à rejouer le
 * cas à la main — autant ne pas journaliser.
 */
export function explainReason(
  agreement: ShadowAgreement,
  v3: TokenResolution | null,
  error: string | null,
): string {
  if (agreement === "v3_error") return `V3 a échoué : ${error ?? "erreur inconnue"}`;
  if (!v3) return "aucun verdict V3";
  const conflicts = v3.conflicts.map((c) => c.kind);
  switch (agreement) {
    case "same_mint":
      return "accord sur le contrat élu";
    case "different_mint":
      return conflicts.length
        ? `contrats différents ; V3 signale ${conflicts.join(", ")}`
        : "contrats différents sans conflit détecté par V3";
    case "v1_only":
      return conflicts.length
        ? `V3 refuse de trancher — ${conflicts.join(", ")}`
        : `V3 refuse de trancher — statut ${v3.status}`;
    case "v3_only":
      return `V1 n'a pas tranché, V3 élit un contrat (${v3.method})`;
    case "both_none":
      return `aucun verdict des deux côtés — V3 en ${v3.status}`;
  }
}

/** Construit la ligne de comparaison. PUR : aucune E/S, testable directement. */
export function buildShadowComparison(args: {
  input: ShadowInput;
  v1: CanonicalTokenResolution;
  v3: TokenResolution | null;
  error: string | null;
  latencyMs: number;
}): ShadowComparison {
  const { input, v1, v3, error, latencyMs } = args;
  const v1Mint = v1.canonicalMint ?? null;
  const v3Mint = v3?.selected?.address ?? null;
  const agreement = computeAgreement(v1Mint, v3Mint, error != null || v3 == null);
  const tel = v3?.telemetry ?? emptyTelemetry();

  return {
    policyVersion: POLICY_VERSION,
    input: {
      ticker: input.ticker,
      addresses: input.addresses,
      addressCount: input.addresses.length,
      hasRawText: input.hasRawText,
      observedAt: input.observedAt ? input.observedAt.toISOString() : null,
      allowedChains: [...SHADOW_ALLOWED_CHAINS],
    },
    v1: {
      status: v1.status,
      confidence: v1.confidence,
      method: v1.method,
      mint: v1Mint,
      chain: v1.chain ?? null,
    },
    v3: {
      status: v3?.status ?? "ERROR",
      confidence: v3?.confidence ?? "LOW",
      method: v3?.method ?? "none",
      callerSupport: v3?.callerSupport ?? "unknown",
      mint: v3Mint,
      chain: v3?.selected?.chain ?? null,
      candidateCount: v3?.candidates.length ?? 0,
      excludedCount: v3?.excluded.length ?? 0,
    },
    agreement,
    reason: explainReason(agreement, v3, error),
    exclusionReasons: [
      ...new Set((v3?.excluded ?? []).map((c) => c.excluded?.reason ?? "unknown")),
    ].sort(),
    conflictKinds: [...new Set((v3?.conflicts ?? []).map((c) => c.kind))].sort(),
    limitations: v3?.limitations ?? [],
    providerUsage: {
      calls: { ...tel.providerCalls },
      cacheHits: { ...tel.providerCacheHits },
      failures: { ...tel.providerFailures },
      dbQueries: tel.dbQueries,
      budgetRefusals: tel.budgetRefusals,
    },
    latencyMs,
    error,
  };
}

export interface ShadowDeps {
  prisma: { $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T> };
  /** Injectable pour les tests : par défaut, le vrai V3. */
  resolve?: typeof resolveToken;
  now?: () => number;
}

/**
 * Lance V3 sur la même entrée que V1. NE LÈVE JAMAIS : toute erreur est capturée
 * et devient un champ de la comparaison.
 *
 * Retourne un objet opaque, à repasser tel quel à `finishShadow`. L'appelant ne
 * peut RIEN en tirer d'utilisable comme résolution — c'est délibéré.
 */
export function startShadow(
  input: ShadowInput,
  deps: ShadowDeps,
): Promise<{ v3: TokenResolution | null; error: string | null; latencyMs: number }> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const run = deps.resolve ?? resolveToken;

  return run(
    {
      ticker: input.ticker ?? undefined,
      addresses: input.addresses.length ? input.addresses : undefined,
      rawText: undefined, // le texte brut ne quitte pas V1 : rien à journaliser
      allowedChains: SHADOW_ALLOWED_CHAINS,
      chainHint: "solana",
      observedAt: input.observedAt ?? undefined,
      audience: "internal",
    },
    {
      db: prismaDbClient(deps.prisma),
      providers: createProviderContext({ cache: new ResolutionCache() }),
    },
  ).then(
    (v3) => ({ v3, error: null, latencyMs: now() - started }),
    (e: unknown) => ({
      v3: null,
      error: String(e instanceof Error ? e.message : e).slice(0, 200),
      latencyMs: now() - started,
    }),
  );
}

/** Émet la ligne. Le journal applicatif est le seul canal : pas de table. */
export function emitShadowComparison(
  cmp: ShadowComparison,
  log: (tag: string, payload: string) => void = (t, p) => console.info(t, p),
): void {
  try {
    log(SHADOW_LOG_TAG, JSON.stringify(cmp));
  } catch {
    // Un journal qui casse le chemin qu'il observe n'a aucune raison d'exister.
  }
}
