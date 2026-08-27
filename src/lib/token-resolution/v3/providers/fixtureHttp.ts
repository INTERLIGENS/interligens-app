// ─── Client HTTP sur fixtures ──────────────────────────────────────────────
// Sert les tests et tout diagnostic hors ligne. Aucune sortie réseau possible :
// une URL non enregistrée ne « retombe » pas sur le réseau, elle renvoie un
// échec explicite. Un test qui appellerait le vrai DexScreener sans le vouloir
// est un test qui devient rouge le jour où la liquidité bouge.
//
// Les fixtures de __fixtures__/ ont été capturées sur appels réels le
// 2026-08-26 (3 requêtes DexScreener), pour que les formes testées soient les
// formes servies — y compris les surprises : chainId "robinhood" dans la
// recherche $TOES, liquidity.usd absent sur certaines paires.

import type { HttpClient, HttpRequestOptions, HttpResponse } from "./types";

export interface FixtureRoute {
  /** Sous-chaîne d'URL. La première correspondance gagne, dans l'ordre déclaré. */
  match: string;
  status?: number;
  json: unknown;
}

export interface FixtureHttpClient extends HttpClient {
  /** URLs demandées, dans l'ordre. Permet d'assertion sur le nombre d'appels. */
  readonly calls: string[];
  readonly unmatched: string[];
}

export function createFixtureHttpClient(routes: FixtureRoute[]): FixtureHttpClient {
  const calls: string[] = [];
  const unmatched: string[] = [];

  const serve = (url: string): HttpResponse => {
    calls.push(url);
    const route = routes.find((r) => url.includes(r.match));
    if (!route) {
      unmatched.push(url);
      return { ok: false, status: 599, json: null };
    }
    const status = route.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: route.json };
  };

  return {
    calls,
    unmatched,
    async getJson(url: string, _opts?: HttpRequestOptions) {
      return serve(url);
    },
    async postJson(url: string, _body: unknown, _opts?: HttpRequestOptions) {
      return serve(url);
    },
  };
}
