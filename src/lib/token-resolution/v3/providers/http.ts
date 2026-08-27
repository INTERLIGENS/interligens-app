// ─── Client HTTP réel ──────────────────────────────────────────────────────
// Le SEUL endroit de la V2 qui appelle fetch. Isolé pour que tout le reste
// soit testable sur fixtures, et pour qu'un délai d'attente ne puisse pas
// manquer quelque part : il est posé ici, pas à l'appel.
//
// Un échec réseau ne lève pas : il retourne ok:false. La résolution doit
// dégrader (moins de sources, limitation notée), jamais planter la surface
// appelante — le résolveur V1 tenait déjà cette ligne, on ne la relâche pas.

import type { HttpClient, HttpRequestOptions, HttpResponse } from "./types";

const DEFAULT_TIMEOUT_MS = 8000;

const FAILED = (status: number): HttpResponse => ({ ok: false, status, json: null });

async function run(
  url: string,
  init: RequestInit,
  opts?: HttpRequestOptions,
): Promise<HttpResponse> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(opts?.headers ?? {}), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return FAILED(res.status);
    return { ok: true, status: res.status, json: await res.json() };
  } catch {
    // 0 = pas de réponse HTTP du tout (timeout, DNS, parse). Distinct d'un 5xx.
    return FAILED(0);
  }
}

export const realHttpClient: HttpClient = {
  getJson: (url, opts) => run(url, { method: "GET" }, opts),
  postJson: (url, body, opts) =>
    run(
      url,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
      opts,
    ),
};
