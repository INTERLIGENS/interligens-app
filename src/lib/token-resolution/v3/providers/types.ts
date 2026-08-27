// ─── Contrat des adapters providers ────────────────────────────────────────
// Aucun `fetch` nu dans la V2. Tout appel sortant passe par un HttpClient
// injecté, lui-même enveloppé par le cache obligatoire. Trois conséquences
// voulues :
//   • les tests tournent sur fixtures, sans réseau ni horloge réelle ;
//   • chaque appel est compté (télémétrie), donc le coût est mesurable ;
//   • remplacer un provider ne touche pas le moteur de résolution.

import type { ResolutionTelemetry } from "../types";
import type { ResolutionCache } from "./cache";

export interface HttpResponse {
  ok: boolean;
  status: number;
  json: unknown;
}

export interface HttpRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface HttpClient {
  getJson(url: string, opts?: HttpRequestOptions): Promise<HttpResponse>;
  postJson(url: string, body: unknown, opts?: HttpRequestOptions): Promise<HttpResponse>;
}

export interface ProviderEnv {
  heliusApiKey?: string | null;
}

/**
 * Contexte passé à chaque adapter. `cache` n'est PAS optionnel : il n'existe
 * aucune signature permettant d'appeler un provider sans cache.
 */
export interface ProviderBudget {
  /** Plafond dur d'appels sortants par provider et par exécution. */
  maxCallsPerProvider: number;
}

export interface ProviderContext {
  http: HttpClient;
  cache: ResolutionCache;
  telemetry: ResolutionTelemetry;
  env: ProviderEnv;
  budget: ProviderBudget;
}

/** Marché d'un token vu par un provider. Forme neutre, sans dette de provider. */
export interface ProviderMarket {
  chainRaw: string;
  address: string;
  symbol: string | null;
  name: string | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairCreatedAt: number | null;
}
