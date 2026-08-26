// ─── Cache de résolution — OBLIGATOIRE ─────────────────────────────────────
// Aucun appel sortant de la V2 ne contourne ce cache. Ce n'est pas une
// optimisation, c'est une contrainte de conception : le résolveur V1 du bridge
// n'avait AUCUN cache et repayait DexScreener + Helius pour chaque candidat de
// chaque passage de cron. Le budget infra du produit (~$279/mois) ne tolère pas
// qu'on multiplie ce comportement en élargissant les sources.
//
// L'horloge est injectée. Sans ça un test du TTL doit dormir, et un test qui
// dort est un test qu'on finit par désactiver.
//
// Portée : mémoire du process. Sur Vercel, un cron et une requête web ne
// partagent pas d'instance — le cache borne le coût d'UNE exécution (où le même
// mint revient plusieurs fois), pas celui de la journée. Un cache persistant
// exigerait une table, donc une migration : hors périmètre V2 (décidé R0).

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  evictions: number;
}

export interface ResolutionCacheOptions {
  /** Durée de vie par défaut, en millisecondes. */
  ttlMs?: number;
  /** Nombre maximum d'entrées. Au-delà, la plus ancienne insertion sort. */
  maxEntries?: number;
  /** Horloge injectable — millisecondes. */
  now?: () => number;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min — aligné sur marketProviders
const DEFAULT_MAX_ENTRIES = 500;

export class ResolutionCache {
  private readonly store = new Map<string, Entry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  /** Requêtes identiques en vol — dédupliquées pour ne pas payer deux fois. */
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(opts: ResolutionCacheOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = opts.now ?? (() => Date.now());
  }

  get<T>(key: string): { hit: true; value: T } | { hit: false } {
    const e = this.store.get(key) as Entry<T> | undefined;
    if (!e) {
      this.misses++;
      return { hit: false };
    }
    if (this.now() >= e.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return { hit: false };
    }
    this.hits++;
    return { hit: true, value: e.value };
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next();
      if (!oldest.done) {
        this.store.delete(oldest.value);
        this.evictions++;
      }
    }
    this.store.set(key, { value, expiresAt: this.now() + (ttlMs ?? this.ttlMs) });
  }

  /**
   * Seul chemin d'accès autorisé. Un échec du producteur n'est PAS mis en
   * cache : un timeout réseau ne doit pas geler un token en « introuvable »
   * pendant dix minutes. En revanche un résultat vide légitime (aucune paire)
   * est mis en cache — c'est une réponse, pas une panne.
   */
  async wrap<T>(key: string, ttlMs: number | undefined, produce: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached.hit) return cached.value;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const p = produce()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, p as Promise<unknown>);
    return p;
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.store.size,
      evictions: this.evictions,
    };
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}
