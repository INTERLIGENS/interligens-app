// src/lib/shill-correlation/ingest.ts
// PHASE 2 — Ingestion layer for the Shill Correlation Engine (shadow mode).
//
// Materializes ShillEvent rows from two READ-ONLY sources:
//   - KolPromotionMention  : clean (kolHandle, tokenMint, chain, sourcePostId)
//   - SocialPostCandidate  : needs influencer->handle + detectedTokens parsing
//
// Idempotent: writes via createMany({ skipDuplicates: true }) on the
// (kolHandle, tweetId, tokenMint) unique index. Existing rows are NEVER
// mutated, so a ShillEvent already advanced past "pending" is left untouched.
// Read-only on all source tables. Never `prisma db push`.

import { prisma } from "@/lib/prisma";
import type { ShillEventDraft, IngestSummary, IngestOptions } from "./types";
import { classifyTokenIdentity } from "./tokenIdentity";

// Re-export : `classifyTokenIdentity` vit desormais dans tokenIdentity.ts, avec
// le reste de la resolution. Le re-exporter garde les appelants existants
// stables sans dupliquer une ligne de logique.
export { classifyTokenIdentity };

// -- Pure helpers (unit-tested) ----------------------------------------------

/** Lowercase, strip a leading @, trim. Empty/invalid -> "". */
export function normalizeHandle(handle: string | null | undefined): string {
  if (!handle) return "";
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Canonicalize chain aliases to a single identifier so the (kolHandle,
 * tweetId, tokenMint, chain) key and downstream per-chain aggregation never
 * fragment the same chain (e.g. source rows mixing "sol" and "solana").
 * Unknown values pass through lowercased.
 */
const CHAIN_ALIASES: Record<string, string> = {
  sol: "solana",
  solana: "solana",
  eth: "ethereum",
  ethereum: "ethereum",
  evm: "ethereum",
  erc20: "ethereum",
  bnb: "bsc",
  bsc: "bsc",
  matic: "polygon",
  poly: "polygon",
  polygon: "polygon",
  base: "base",
};

export function canonicalizeChain(chain: string | null | undefined): string {
  const key = (chain ?? "").trim().toLowerCase();
  return CHAIN_ALIASES[key] ?? key;
}

/** Best-effort chain inference from a token mint/address shape. */
export function inferChain(mint: string): string {
  return mint.startsWith("0x") ? "ethereum" : "solana";
}

/**
 * Parse the detectedTokens column. Stored as JSON text but jsonb-coerced to a
 * String by the pooled prod client (see api/cron/watcher-v2/route.ts), so we
 * accept either a JSON string or an already-parsed array, and tolerate either
 * bare-string mints or { mint } / { address } objects.
 */
export function parseDetectedTokens(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t === "string" ? t : t?.mint ?? t?.address ?? ""))
      .map((t) => String(t).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** KolPromotionMention row (minimal shape) -> ShillEventDraft, or null if unusable. */
export function promotionMentionToDraft(row: {
  kolHandle: string;
  sourcePostId: string;
  postedAt: Date;
  tokenMint: string;
  chain: string;
}): ShillEventDraft | null {
  const kolHandle = normalizeHandle(row.kolHandle);
  const tweetId = (row.sourcePostId ?? "").trim();
  const rawToken = (row.tokenMint ?? "").trim();
  if (!kolHandle || !tweetId || !rawToken || !row.postedAt) return null;

  // B0 : le statut est TRANCHE ici, jamais laisse au defaut base. La grammaire
  // vient de resolve.ts - aucun etat n'est invente.
  const res = classifyTokenIdentity(rawToken);
  const chain = canonicalizeChain(row.chain) || inferChain(res.mint ?? rawToken);
  return {
    kolHandle,
    tweetId,
    tweetTimestamp: row.postedAt,
    tokenMint: res.mint,
    rawToken,
    resolutionStatus: res.status,
    chain,
    sourcePostCandidateId: null,
    campaignId: null,
  };
}

/**
 * SocialPostCandidate row + resolved influencer handle -> 0..N drafts (one per
 * distinct detected token mint). Returns [] when the row lacks a handle,
 * postId, timestamp, or any detected token.
 */
export function postCandidateToDrafts(
  row: {
    id: string;
    postId: string;
    postedAtUtc: Date | null;
    chain: string | null;
    campaignId: string | null;
    detectedTokens: unknown;
  },
  resolvedHandle: string | null | undefined,
): ShillEventDraft[] {
  const kolHandle = normalizeHandle(resolvedHandle);
  const tweetId = (row.postId ?? "").trim();
  const ts = row.postedAtUtc;
  if (!kolHandle || !tweetId || !ts) return [];

  // B0 - CE QUE `detectedTokens` CONTIENT REELLEMENT : des TICKERS. Mesure du
  // 2026-09-03 : 841 entrees sur 841 (30 jours) sont des symboles, zero
  // adresse. L'ancien code les ecrivait dans `tokenMint` SANS poser
  // `resolutionStatus` - donc `resolved_direct` par defaut base, sur un ticker.
  // Une affirmation fausse posee par OMISSION : rien dans le code ne la porte,
  // donc rien ne la signale a la relecture.
  //
  // Un draft non resolu porte desormais `tokenMint: null`. Il est CONSTRUIT,
  // donc comptable et auditable, mais ne sera PAS persiste. Rattacher
  // `detectedAddresses` est le travail de B1.
  const rawTokens = Array.from(new Set(parseDetectedTokens(row.detectedTokens)));
  return rawTokens.map((rawToken) => {
    const res = classifyTokenIdentity(rawToken);
    return {
      kolHandle,
      tweetId,
      tweetTimestamp: ts,
      tokenMint: res.mint,
      rawToken,
      resolutionStatus: res.status,
      chain: canonicalizeChain(row.chain) || inferChain(res.mint ?? rawToken),
      sourcePostCandidateId: row.id,
      campaignId: row.campaignId ?? null,
    };
  });
}

/** Collapse drafts colliding on the (kolHandle, tweetId, tokenMint) key. */
export function dedupeDrafts(drafts: ShillEventDraft[]): ShillEventDraft[] {
  const seen = new Set<string>();
  const out: ShillEventDraft[] = [];
  for (const d of drafts) {
    // La cle unique en base porte sur tokenMint. Pour un draft NON resolu
    // (mint null), on deduplique sur le token BRUT - sinon deux tickers
    // distincts du meme tweet fusionneraient sous une cle « null ».
    const key = [d.kolHandle, d.tweetId, d.tokenMint ?? "raw:" + d.rawToken].join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

// -- DB orchestration --------------------------------------------------------

const DEFAULT_LIMIT = 5000;

/**
 * Scan both sources, build deduplicated drafts, and insert the new ones. Safe
 * to run repeatedly: only previously-unseen (kolHandle, tweetId, tokenMint)
 * triples are inserted; source tables are read-only.
 */
export async function ingestShillEvents(
  opts: IngestOptions = {},
): Promise<IngestSummary> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const summary: IngestSummary = {
    scannedPromotionMentions: 0,
    scannedPostCandidates: 0,
    draftsBuilt: 0,
    created: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
    skippedUnresolved: 0,
    errors: [],
  };

  const drafts: ShillEventDraft[] = [];

  // -- Source 1: KolPromotionMention (clean, 1:1) --
  try {
    const mentions = await prisma.kolPromotionMention.findMany({
      where: opts.since ? { postedAt: { gte: opts.since } } : undefined,
      orderBy: { postedAt: "desc" },
      take: limit,
      select: {
        kolHandle: true,
        sourcePostId: true,
        postedAt: true,
        tokenMint: true,
        chain: true,
      },
    });
    summary.scannedPromotionMentions = mentions.length;
    for (const m of mentions) {
      const draft = promotionMentionToDraft(m);
      if (draft) drafts.push(draft);
      else summary.skippedInvalid++;
    }
  } catch (e) {
    summary.errors.push(`promotionMentions: ${(e as Error).message}`);
  }

  // -- Source 2: SocialPostCandidate (handle resolution + token parse) --
  try {
    const candidates = await prisma.socialPostCandidate.findMany({
      where: opts.since ? { postedAtUtc: { gte: opts.since } } : undefined,
      orderBy: { discoveredAtUtc: "desc" },
      take: limit,
      select: {
        id: true,
        postId: true,
        postedAtUtc: true,
        chain: true,
        campaignId: true,
        detectedTokens: true,
        influencer: { select: { handle: true } },
      },
    });
    summary.scannedPostCandidates = candidates.length;
    for (const c of candidates) {
      const built = postCandidateToDrafts(c, c.influencer?.handle);
      if (built.length === 0) summary.skippedInvalid++;
      else drafts.push(...built);
    }
  } catch (e) {
    summary.errors.push(`postCandidates: ${(e as Error).message}`);
  }

  const deduped = dedupeDrafts(drafts);
  summary.draftsBuilt = deduped.length;

  // ██ BUILD 3-B - LES NON RESOLUS SONT DESORMAIS PERSISTES ██
  //
  // B0 les jetait, et il avait raison de le faire : `tokenMint` etait NOT NULL,
  // donc les ecrire imposait d'y mettre le ticker - le mensonge exact que B0
  // fermait. Le prix etait lourd : 3 502 drafts sur 3 571 perdus.
  //
  // La colonne est nullable depuis le 2026-09-03. Un draft non resolu s'ecrit
  // donc TEL QU'IL EST : `tokenMint = null`, `resolutionStatus =
  // unresolved_ticker`. Rien n'est invente, et plus rien n'est perdu.
  //
  // CE QUI REND L'OPERATION SURE : l'index unique a ete recree en
  // NULLS NOT DISTINCT. Sans lui, deux lignes (kol, tweet, NULL) seraient
  // considerees DISTINCTES par Postgres, et `skipDuplicates` deviendrait un
  // no-op sur exactement les lignes que ce changement ajoute - chaque relance
  // de l'ingestion en aurait empile une copie. Voir le test d'idempotence.
  //
  // `skippedUnresolved` reste compte : il ne dit plus « jete » mais « ecrit
  // sans identite de contrat ». Un chiffre qui monte dit que la resolution
  // (B1) manque, pas que la source est vide.
  const persistable = deduped;
  summary.skippedUnresolved = deduped.filter((d) => d.tokenMint == null).length;

  if (opts.dryRun || persistable.length === 0) return summary;

  // Idempotent insert: skipDuplicates leaves already-ingested events untouched.
  try {
    const result = await prisma.shillEvent.createMany({
      // `resolutionStatus` est passe EXPLICITEMENT : le defaut base
      // `resolved_direct` ne decide plus a la place de l'auteur. `rawToken`
      // n'est pas une colonne - il reste cote draft, pour l'audit.
      data: persistable.map((d) => ({
        kolHandle: d.kolHandle,
        tweetId: d.tweetId,
        tweetTimestamp: d.tweetTimestamp,
        // `null` quand l'identite n'est pas resolue. Le ticker reste hors de
        // cette colonne : il vit dans le draft (`rawToken`), pas en base.
        tokenMint: d.tokenMint,
        chain: d.chain,
        sourcePostCandidateId: d.sourcePostCandidateId,
        campaignId: d.campaignId,
        resolutionStatus: d.resolutionStatus,
        processingStatus: "pending",
      })),
      skipDuplicates: true,
    });
    summary.created = result.count;
    summary.skippedDuplicates = persistable.length - result.count;
  } catch (e) {
    summary.errors.push(`createMany: ${(e as Error).message}`);
  }

  return summary;
}
