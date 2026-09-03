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
import { parseDetectedTokens } from "./parsing";

// Re-export : le parseur vit desormais dans parsing.ts, module PUR. ingest.ts
// importe prisma ; tout consommateur du parseur l'aurait importe aussi.
export { parseDetectedTokens };

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
export interface PersistDraftsResult {
  draftsBuilt: number;
  skippedUnresolved: number;
  created: number;
  skippedDuplicates: number;
  errors: string[];
}

/**
 * ██ LE CHEMIN D'ECRITURE DES ShillEvent — UN SEUL ██
 *
 * Extrait de `ingestShillEvents` pour que le bridge forward (B3) l'appelle au
 * lieu de le reecrire. Deux chemins d'ecriture divergent toujours : l'un
 * gagnerait un champ, l'autre non, et la difference se verrait six mois plus
 * tard dans une ligne mal formee.
 *
 * IDEMPOTENT PAR LA BASE, pas par le code. `skipDuplicates` s'appuie sur
 * UNIQUE (kolHandle, tweetId, tokenMint) NULLS NOT DISTINCT : sans cette
 * clause, deux lignes (kol, tweet, NULL) seraient DISTINCTES pour Postgres et
 * chaque relance en empilerait une copie.
 *
 * LES NON RESOLUS SONT PERSISTES, `tokenMint = null`. Le ticker n'entre jamais
 * dans cette colonne (B0) : il vit dans le draft, sous `rawToken`.
 */
export async function persistShillEventDrafts(
  drafts: ShillEventDraft[],
  opts: { dryRun?: boolean } = {},
): Promise<PersistDraftsResult> {
  const deduped = dedupeDrafts(drafts);
  const out: PersistDraftsResult = {
    draftsBuilt: deduped.length,
    skippedUnresolved: deduped.filter((d) => d.tokenMint == null).length,
    created: 0,
    skippedDuplicates: 0,
    errors: [],
  };

  if (opts.dryRun || deduped.length === 0) return out;

  try {
    const result = await prisma.shillEvent.createMany({
      // `resolutionStatus` est passe EXPLICITEMENT : le defaut base
      // `resolved_direct` ne decide plus a la place de l'auteur. `rawToken`
      // n'est pas une colonne - il reste cote draft, pour l'audit.
      data: deduped.map((d) => ({
        kolHandle: d.kolHandle,
        tweetId: d.tweetId,
        tweetTimestamp: d.tweetTimestamp,
        tokenMint: d.tokenMint,
        chain: d.chain,
        sourcePostCandidateId: d.sourcePostCandidateId,
        campaignId: d.campaignId,
        resolutionStatus: d.resolutionStatus,
        processingStatus: "pending",
      })),
      skipDuplicates: true,
    });
    out.created = result.count;
    out.skippedDuplicates = deduped.length - result.count;
  } catch (e) {
    out.errors.push(`createMany: ${(e as Error).message}`);
  }
  return out;
}


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

  const persisted = await persistShillEventDrafts(drafts, { dryRun: opts.dryRun });
  summary.draftsBuilt = persisted.draftsBuilt;
  summary.skippedUnresolved = persisted.skippedUnresolved;
  summary.created = persisted.created;
  summary.skippedDuplicates = persisted.skippedDuplicates;
  summary.errors.push(...persisted.errors);

  return summary;
}
