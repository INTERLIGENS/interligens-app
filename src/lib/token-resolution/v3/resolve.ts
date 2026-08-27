// ─── Orchestrateur V3 — résolution universelle ─────────────────────────────
// Étages, dans un ordre non négociable :
//
//   1. extraction     contrats de la requête + du texte brut
//   2. TIER CURATED   base d'abord, TOUJOURS — dossiers publiés, liens curés,
//                     mentions. Hérité du tier interne de la V1, mais
//                     SOUMIS au périmètre de chaînes et à la compatibilité
//                     temporelle : la curation atteste un contrat, elle n'est
//                     pas une autorité qui échappe aux règles.
//   3. marché         seulement si l'interne ne suffit pas, ou pour confirmer
//                     un contrat explicitement fourni
//   4. chaîne         seulement si le marché n'indexe rien (contrat neuf)
//   5. enrichissement signaux attachés aux identités déjà trouvées
//   6. décision       confidence.ts, seul autorisé à dire RESOLVED
//
// Aucune écriture, aucune migration, aucun `fetch` hors instrumentation.

import { extractAddressShapes, identityKey, normalizeAddress } from "./address";
import { normalizeChain, type CanonicalChain } from "./chain";
import { buildCandidateSet } from "./candidates";
import { decide, detectConflicts } from "./confidence";
import { DEFAULT_POLICY, isChainAllowed, type ResolutionPolicy } from "./policy";
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
  findCasefilePresetsByAddress,
  findCasefilesByAddress,
  findCasefilesByTicker,
  findCuratedByAddress,
  findCuratedByTicker,
  findMentionsByAddress,
  findMentionsByTicker,
  type DbClient,
} from "./sources/db";
import { asCaseId, findContractsByCaseIds } from "./sources/caseIndex";
import {
  coinGeckoByTicker,
  dexScreenerByAddress,
  dexScreenerSearchTicker,
  heliusMintExists,
  hyperliquidResolveTokenId,
  syncCacheTelemetry,
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
 * Ordre de sondage d'un contrat EVM dont la chaîne n'est pas donnée.
 * Un hexadécimal 0x…40 ne dit PAS sur quelle chaîne EVM il vit ; deviner « ETH »
 * fabriquerait une identité fausse. On sonde, en s'arrêtant au premier succès.
 * Le sondage est RESTREINT au périmètre déclaré par l'appelant : sonder des
 * chaînes qu'il ne sait pas traiter serait payer pour rien.
 */
const EVM_PROBE_ORDER: CanonicalChain[] = ["ETH", "BASE", "BSC", "ARBITRUM"];

const SOL_IN_TEXT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_IN_TEXT_RE = /\b0x[a-fA-F0-9]{40}\b/g;

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
      // D2 : pairCreatedAt borne la PAIRE, pas le mint. Preuve INDIRECTE —
      // c'est temporal.ts qui applique la tolérance élargie correspondante.
      firstSeenAt: m.pairCreatedAt,
      firstSeenSource: source,
    },
  };
}

interface LocatedAddress {
  chain: CanonicalChain;
  address: string;
  market: ProviderMarket | null;
  isPumpFun: boolean;
}

async function locateExplicitAddress(
  deps: ResolveDeps,
  raw: string,
  chainHint: CanonicalChain | null,
  allowedChains: readonly CanonicalChain[],
): Promise<LocatedAddress | null> {
  const shape = extractAddressShapes([raw])[0]?.shape;
  if (!shape || !shape.normalized) return null;

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

  // Hexadécimal EVM : indication de l'appelant d'abord, puis sondage borné au
  // périmètre déclaré.
  const inScope = EVM_PROBE_ORDER.filter((c) => isChainAllowed(allowedChains, c));
  const order =
    chainHint && inScope.includes(chainHint)
      ? [chainHint, ...inScope.filter((c) => c !== chainHint)]
      : inScope;
  for (const chain of order) {
    const market = await dexScreenerByAddress(deps.providers, chain, shape.normalized);
    if (market) return { chain, address: shape.normalized, market, isPumpFun: false };
  }
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

  // C — le plafond d'appels sortants vient de la POLITIQUE PASSÉE ICI, pas
  // d'une valeur figée au moment de construire le contexte. Régler la politique
  // à 5 doit donner 5.
  deps.providers.budget = { maxCallsPerProvider: policy.maxProviderCallsPerRun };
  const limitations: string[] = [];
  const raws: RawCandidate[] = [];
  const explicitKeys = new Set<string>();

  const ticker = cleanTicker(request.ticker) || null;
  const chainHint = normalizeChain(request.chainHint);
  const allowedChains = request.allowedChains ?? [];
  const observedAt = request.observedAt ?? null;
  const db = deps.db;

  const countedQuery = async <T>(fn: () => Promise<T>): Promise<T> => {
    telemetry.dbQueries++;
    return fn();
  };

  // ─── 1. Contrats explicites ─────────────────────────────────────────────
  const providedAddresses = [
    ...(request.addresses ?? []),
    ...extractAddressesFromText(request.rawText),
  ];
  const shapes = extractAddressShapes(providedAddresses);
  if (providedAddresses.length > 0 && shapes.length === 0) {
    limitations.push(
      "adresse(s) présente(s) dans la requête mais aucune n'est un contrat valide sur une chaîne connue",
    );
  }

  const explicitAddressStrings: string[] = [];
  for (const { raw } of shapes) {
    const located = await locateExplicitAddress(deps, raw, chainHint, allowedChains);
    if (!located) {
      limitations.push(`contrat ${raw.slice(0, 10)}… non rattachable à une chaîne connue`);
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
          "existence on-chain non vérifiable (clé RPC absente, appel en échec ou budget épuisé) — " +
            "absence de preuve, pas preuve d'absence",
        );
      } else {
        limitations.push(
          `contrat ${located.address.slice(0, 8)}… introuvable on-chain et sur les marchés`,
        );
      }
    }
    raws.push(...findCasefilePresetsByAddress([located.address]));
  }

  // ─── 2. TIER CURATED — base d'abord, toujours ───────────────────────────
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
  // UR-12 — l'index des dossiers est lu par IDENTIFIANT DE DOSSIER, jamais par
  // ticker. Il ne porte aucun symbole : « SERIAL-12RUGS » y désigne un motif
  // d'enquête, pas un token, et sa valeur est le contrat de BOTIFY.
  if (request.caseIds?.length) {
    raws.push(...findContractsByCaseIds(request.caseIds.map(asCaseId)));
  }

  // ─── 3. Marché — uniquement si nécessaire ───────────────────────────────
  // Deux déclencheurs, et seulement ceux-là :
  //   a. le tier curated n'a produit aucun candidat DANS LE PÉRIMÈTRE de
  //      l'appelant — un lien curé sur une chaîne qu'il ne traite pas ne
  //      dispense pas de chercher ;
  //   b. un contrat explicite porte un symbole qui CONTREDIT le ticker : il
  //      faut savoir si un autre contrat porte réellement ce ticker, sinon le
  //      conflit ne peut pas être établi.
  const internalInScope = raws.filter(
    (r) =>
      r.source !== "explicit_ca" &&
      r.source !== "dexscreener" &&
      r.source !== "onchain" &&
      isChainAllowed(allowedChains, r.chain),
  );
  const explicitSymbols = raws
    .filter((r) => r.source === "explicit_ca" && r.symbol)
    .map((r) => r.symbol as string);
  const symbolContradiction =
    !!ticker &&
    explicitSymbols.length > 0 &&
    !explicitSymbols.some((s) => cleanTicker(s) === cleanTicker(ticker));

  if (ticker && (internalInScope.length === 0 || symbolContradiction)) {
    const markets = await dexScreenerSearchTicker(deps.providers, ticker);
    for (const m of markets) {
      const r = marketToRaw(m, "dexscreener");
      if (r) raws.push(r);
    }
    // ─── 4. Dernier recours — CoinGecko, si tout le reste est vide.
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
    for (const c of casefilesByAddr) {
      if (known.has(identityKey(c.chain, c.address))) raws.push(c);
    }
  }

  // ─── 6. Décision ────────────────────────────────────────────────────────
  const set = buildCandidateSet(raws, {
    ticker,
    audience: request.audience,
    allowedChains,
    observedAt,
    policy,
  });
  if (set.droppedInternal > 0) {
    limitations.push(
      `${set.droppedInternal} candidat(s) issus de sources internes retirés de la réponse publique`,
    );
  }
  for (const c of set.excluded) {
    limitations.push(
      `écarté ${identityKey(c.chain, c.address)} — ${c.excluded?.detail ?? c.excluded?.reason}`,
    );
  }
  if (telemetry.budgetRefusals > 0) {
    limitations.push(
      `${telemetry.budgetRefusals} appel(s) provider refusé(s) par le plafond d'exécution — couverture partielle`,
    );
  }

  const conflicts = detectConflicts({
    candidates: set.candidates,
    excluded: set.excluded,
    ticker,
    explicitIdentityKeys: explicitKeys,
    policy,
  });
  const decision = decide({
    candidates: set.candidates,
    excluded: set.excluded,
    ticker,
    explicitIdentityKeys: explicitKeys,
    conflicts,
    observedAtProvided: !!observedAt,
    policy,
  });

  syncCacheTelemetry(deps.providers);

  const returned: TokenCandidate[] = set.candidates.slice(0, policy.maxCandidatesReturned);
  if (set.candidates.length > returned.length) {
    limitations.push(
      `${set.candidates.length - returned.length} candidat(s) au-delà du plafond d'affichage (${policy.maxCandidatesReturned})`,
    );
  }

  return {
    status: decision.status,
    confidence: decision.confidence,
    method: decision.method,
    callerSupport: decision.callerSupport,
    selected: decision.selected,
    candidates: returned,
    excluded: set.excluded,
    conflicts,
    limitations: [...limitations, ...decision.limitations],
    telemetry,
    audience: request.audience,
  };
}
