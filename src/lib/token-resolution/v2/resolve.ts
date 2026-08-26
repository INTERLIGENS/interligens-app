// ─── Orchestrateur — résolution universelle V2 ─────────────────────────────
// Enchaîne les étages dans un ordre qui n'est PAS négociable :
//
//   1. extraction     adresses de la requête + du texte brut
//   2. interne        base d'abord, TOUJOURS (dossiers, curation, mentions, CA_MAP)
//   3. marché         seulement si l'interne ne suffit pas, ou pour confirmer
//                     une adresse explicite
//   4. chaîne         seulement si le marché n'indexe rien (token neuf)
//   5. enrichissement signaux attachés aux identités déjà trouvées
//   6. décision       confidence.ts, seul autorisé à dire RESOLVED
//
// L'ordre 2 → 3 reprend l'invariant explicite du scan public : DexScreener ne
// tourne JAMAIS avant les sources internes, et CoinGecko ne tourne que si les
// deux précédents sont vides. Un lien curé par un humain prime sur un marché.
//
// Aucune écriture. Aucune migration. Ce module ne possède aucune table.

import { extractAddressShapes, identityKey, normalizeAddress } from "./address";
import { normalizeChain, type CanonicalChain } from "./chain";
import { buildCandidateSet } from "./candidates";
import { decide, detectConflicts } from "./confidence";
import { DEFAULT_POLICY, type ResolutionPolicy } from "./policy";
import { cleanTicker } from "./symbol";
import {
  emptyTelemetry,
  type RawCandidate,
  type ResolutionRequest,
  type TokenCandidate,
  type TokenResolution,
} from "./types";
import {
  enrichFromInvolvement,
  enrichFromLaunchMetric,
  enrichFromPriceTracker,
  enrichFromScanAggregate,
  findCaMapByTicker,
  findCasefilePresetsByAddress,
  findCasefilesByAddress,
  findCasefilesByTicker,
  findCuratedByAddress,
  findCuratedByTicker,
  findMentionsByAddress,
  findMentionsByTicker,
  type DbClient,
} from "./sources/db";
import {
  coinGeckoByTicker,
  dexScreenerByAddress,
  dexScreenerSearchTicker,
  heliusMintExists,
  hyperliquidResolveTokenId,
  type ProviderContext,
  type ProviderMarket,
} from "./providers";

export interface ResolveDeps {
  /** Lecture seule. null → résolution sans base (diagnostic, tests). */
  db: DbClient | null;
  providers: ProviderContext;
  policy?: ResolutionPolicy;
}

/**
 * Ordre de sondage d'une adresse EVM dont la chaîne n'est pas donnée.
 * Un hexadécimal 0x…40 ne dit PAS sur quelle chaîne EVM il vit ; deviner « ETH »
 * fabriquerait une identité fausse pour un token Base ou BSC. On sonde donc, en
 * s'arrêtant à la première chaîne qui indexe le token. Chaque sondage est mis en
 * cache : au pire quatre appels par adresse inconnue, une seule fois.
 */
const EVM_PROBE_ORDER: CanonicalChain[] = ["ETH", "BASE", "BSC", "ARBITRUM"];

const SOL_IN_TEXT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_IN_TEXT_RE = /\b0x[a-fA-F0-9]{40}\b/g;

/** Adresses citées dans un texte libre (corps d'un post, légende d'une capture). */
export function extractAddressesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.match(EVM_IN_TEXT_RE) ?? []) out.add(m);
  for (const m of text.match(SOL_IN_TEXT_RE) ?? []) out.add(m);
  return Array.from(out);
}

function marketToRaw(m: ProviderMarket, source: "dexscreener" | "coingecko"): RawCandidate | null {
  const chain = normalizeChain(m.chainRaw);
  if (!chain) return null;
  const norm = normalizeAddress(m.address, chain);
  if (!norm.valid || !norm.address) return null;
  return {
    chain,
    address: norm.address,
    symbol: m.symbol,
    name: m.name,
    source,
    signals: {
      liquidityUsd: m.liquidityUsd,
      volume24hUsd: m.volume24hUsd,
      isPumpFun: norm.isPumpFun,
    },
  };
}

/** Résout la chaîne d'une adresse explicite, en sondant le marché si nécessaire. */
async function locateExplicitAddress(
  deps: ResolveDeps,
  raw: string,
  chainHint: CanonicalChain | null,
): Promise<{
  chain: CanonicalChain;
  address: string;
  market: ProviderMarket | null;
  isPumpFun: boolean;
} | null> {
  const shape = extractAddressShapes([raw])[0]?.shape;
  if (!shape || !shape.normalized) return null;

  // Identifiant Hyperliquid : un aller-retour spotMeta donne le contrat EVM.
  if (shape.kind === "hyper_token_id") {
    const hyper = await hyperliquidResolveTokenId(deps.providers, shape.normalized);
    if (!hyper) return null;
    return { chain: "HYPER", address: hyper.evmAddress, market: null, isPumpFun: false };
  }

  if (!shape.evmAmbiguous && shape.inferredChain) {
    const chain = shape.inferredChain;
    const market = await dexScreenerByAddress(deps.providers, chain, shape.normalized);
    return { chain, address: shape.normalized, market, isPumpFun: shape.isPumpFun };
  }

  // Hexadécimal EVM : la chaîne indiquée par l'appelant fait foi si elle est EVM.
  const order =
    chainHint && EVM_PROBE_ORDER.includes(chainHint)
      ? [chainHint, ...EVM_PROBE_ORDER.filter((c) => c !== chainHint)]
      : EVM_PROBE_ORDER;
  for (const chain of order) {
    const market = await dexScreenerByAddress(deps.providers, chain, shape.normalized);
    if (market) return { chain, address: shape.normalized, market, isPumpFun: false };
  }
  // Aucune chaîne ne l'indexe : on retient l'indication de l'appelant, sinon rien.
  if (chainHint && EVM_PROBE_ORDER.includes(chainHint)) {
    return { chain: chainHint, address: shape.normalized, market: null, isPumpFun: false };
  }
  return null;
}

export async function resolveToken(
  request: ResolutionRequest,
  deps: ResolveDeps,
): Promise<TokenResolution> {
  const policy = deps.policy ?? DEFAULT_POLICY;
  const telemetry = deps.providers.telemetry ?? emptyTelemetry();
  const limitations: string[] = [];
  const raws: RawCandidate[] = [];
  const explicitKeys = new Set<string>();

  const ticker = cleanTicker(request.ticker) || null;
  const chainHint = normalizeChain(request.chainHint);
  const db = deps.db;

  const countedQuery = async <T>(fn: () => Promise<T>): Promise<T> => {
    telemetry.dbQueries++;
    return fn();
  };

  // ─── 1. Adresses explicites ─────────────────────────────────────────────
  const providedAddresses = [
    ...(request.addresses ?? []),
    ...extractAddressesFromText(request.rawText),
  ];
  const shapes = extractAddressShapes(providedAddresses);
  if (providedAddresses.length > 0 && shapes.length === 0) {
    limitations.push(
      "adresse(s) présente(s) dans la requête mais aucune n'est une adresse valide sur une chaîne connue",
    );
  }

  const explicitAddressStrings: string[] = [];
  for (const { raw } of shapes) {
    const located = await locateExplicitAddress(deps, raw, chainHint);
    if (!located) {
      limitations.push(`adresse ${raw.slice(0, 10)}… non rattachable à une chaîne connue`);
      continue;
    }
    explicitAddressStrings.push(located.address);
    explicitKeys.add(identityKey(located.chain, located.address));
    raws.push({
      chain: located.chain,
      address: located.address,
      symbol: located.market?.symbol ?? null,
      name: located.market?.name ?? null,
      matchType: "explicit_ca",
      source: "explicit_ca",
      signals: {
        liquidityUsd: located.market?.liquidityUsd ?? null,
        volume24hUsd: located.market?.volume24hUsd ?? null,
        isPumpFun: located.isPumpFun,
      },
    });
    if (located.market) {
      const m = marketToRaw({ ...located.market, chainRaw: located.chain }, "dexscreener");
      if (m) raws.push(m);
    } else if (located.chain === "SOL") {
      // Aucun marché indexé : la chaîne reste la seule à pouvoir confirmer que
      // ce mint existe. C'est le cas du lancement de quelques minutes.
      const exists = await heliusMintExists(deps.providers, located.address);
      if (exists === "exists") {
        raws.push({
          chain: "SOL",
          address: located.address,
          source: "onchain",
          signals: { onChainConfirmed: true, isPumpFun: located.isPumpFun },
        });
      } else if (exists === "unknown") {
        limitations.push(
          "existence on-chain non vérifiable (clé RPC absente ou appel en échec) — absence de preuve, pas preuve d'absence",
        );
      } else {
        limitations.push(
          `mint ${located.address.slice(0, 8)}… introuvable on-chain et sur les marchés`,
        );
      }
    }
    // Sources locales sans base attachées à cette adresse.
    raws.push(...findCasefilePresetsByAddress([located.address]));
  }

  // ─── 2. Sources internes — TOUJOURS avant le marché ─────────────────────
  if (db) {
    if (explicitAddressStrings.length > 0) {
      const [curated, mentions, casefiles] = await Promise.all([
        countedQuery(() => findCuratedByAddress(db, explicitAddressStrings, request.audience)),
        countedQuery(() => findMentionsByAddress(db, explicitAddressStrings)),
        countedQuery(() => findCasefilesByAddress(db, explicitAddressStrings)),
      ]);
      raws.push(...curated, ...mentions, ...casefiles);
    }
    if (ticker) {
      const [curated, mentions, casefiles] = await Promise.all([
        countedQuery(() => findCuratedByTicker(db, ticker, request.audience)),
        countedQuery(() => findMentionsByTicker(db, ticker)),
        countedQuery(() => findCasefilesByTicker(db, ticker)),
      ]);
      raws.push(...curated, ...mentions, ...casefiles);
    }
  } else if (ticker || explicitAddressStrings.length > 0) {
    limitations.push("résolution sans base : dossiers, liens curés et mentions non consultés");
  }
  if (ticker) raws.push(...findCaMapByTicker(ticker));

  // ─── 3. Marché — uniquement si nécessaire ───────────────────────────────
  // Deux déclencheurs, et seulement ceux-là :
  //   a. aucune source interne n'a produit de candidat pour ce ticker ;
  //   b. une adresse explicite porte un symbole qui CONTREDIT le ticker — il
  //      faut alors savoir si un autre token porte réellement ce ticker, sinon
  //      le conflit ne peut pas être établi. C'est la vérification que le
  //      résolveur du bridge faisait déjà, au même endroit.
  const internalForTicker = raws.filter(
    (r) => r.source !== "explicit_ca" && r.source !== "dexscreener" && r.source !== "onchain",
  );
  const explicitSymbols = raws
    .filter((r) => r.source === "explicit_ca" && r.symbol)
    .map((r) => r.symbol as string);
  const symbolContradiction =
    !!ticker &&
    explicitSymbols.length > 0 &&
    !explicitSymbols.some((s) => cleanTicker(s) === cleanTicker(ticker));

  if (ticker && (internalForTicker.length === 0 || symbolContradiction)) {
    const markets = await dexScreenerSearchTicker(deps.providers, ticker);
    for (const m of markets) {
      const r = marketToRaw(m, "dexscreener");
      if (r) raws.push(r);
    }
    // ─── 4. Dernier recours — CoinGecko, uniquement si tout le reste est vide.
    const anyCandidate = raws.some((r) => r.source !== "explicit_ca");
    if (markets.length === 0 && !anyCandidate) {
      const cg = await coinGeckoByTicker(deps.providers, ticker);
      for (const m of cg.markets) {
        const r = marketToRaw(m, "coingecko");
        if (r) raws.push(r);
      }
      if (cg.truncated > 0) {
        limitations.push(
          `${cg.truncated} coin(s) CoinGecko écarté(s) par le plafond de détail — couverture partielle`,
        );
      }
    }
  }

  // ─── 5. Enrichissement — jamais créateur de candidat ────────────────────
  const discovered = Array.from(new Set(raws.map((r) => r.address)));
  if (db && discovered.length > 0) {
    const [price, involvement, launch, scans, casefilesByAddr] = await Promise.all([
      countedQuery(() => enrichFromPriceTracker(db, discovered)),
      countedQuery(() => enrichFromInvolvement(db, discovered)),
      countedQuery(() => enrichFromLaunchMetric(db, discovered)),
      countedQuery(() => enrichFromScanAggregate(db, discovered)),
      countedQuery(() => findCasefilesByAddress(db, discovered)),
    ]);
    const known = new Set(raws.map((r) => identityKey(r.chain, r.address)));
    for (const p of [...price, ...involvement, ...launch]) {
      if (!known.has(identityKey(p.chain, p.address))) continue;
      raws.push({ chain: p.chain, address: p.address, source: p.source, signals: p.signals });
    }
    for (const s of scans) {
      for (const r of raws.filter((x) => x.address === s.address)) {
        raws.push({
          chain: r.chain,
          address: r.address,
          source: "scan_aggregate",
          signals: { scanCount: s.scanCount },
        });
      }
    }
    // Un dossier publié trouvé par ADRESSE enrichit une identité déjà connue ;
    // il n'en invente pas (findCasefilesByAddress ne porte que des identités
    // déjà découvertes ci-dessus).
    for (const c of casefilesByAddr) {
      if (known.has(identityKey(c.chain, c.address))) raws.push(c);
    }
  }

  // ─── 6. Décision ────────────────────────────────────────────────────────
  const { candidates, droppedInternal } = buildCandidateSet(raws, {
    ticker,
    audience: request.audience,
  });
  if (droppedInternal > 0) {
    limitations.push(
      `${droppedInternal} candidat(s) issus de sources internes retirés de la réponse publique`,
    );
  }

  const conflicts = detectConflicts({ candidates, ticker, explicitIdentityKeys: explicitKeys, policy });
  const decision = decide({ candidates, ticker, explicitIdentityKeys: explicitKeys, conflicts, policy });

  const cacheStats = deps.providers.cache.stats();
  telemetry.cacheHits = cacheStats.hits;
  telemetry.cacheMisses = cacheStats.misses;

  const returned: TokenCandidate[] = candidates.slice(0, policy.maxCandidatesReturned);
  if (candidates.length > returned.length) {
    limitations.push(
      `${candidates.length - returned.length} candidat(s) au-delà du plafond d'affichage (${policy.maxCandidatesReturned})`,
    );
  }

  return {
    status: decision.status,
    confidence: decision.confidence,
    method: decision.method,
    selected: decision.selected,
    candidates: returned,
    conflicts,
    limitations: [...limitations, ...decision.limitations],
    telemetry,
    audience: request.audience,
  };
}
