// src/lib/intelligence/crossCaseLinker.ts
// Detects KOL-to-KOL overlap signals: shared wallets, deployers, or tokens.
// Persists results in KolCrossLink (model in schema.prod.prisma, migration 20260502_kol_crosslink).
// Run after casefile.ingested event or on-demand from admin route.

import { prisma } from "@/lib/prisma";

export type CrossLinkType =
  | "shared_wallet"
  | "shared_deployer"
  | "shared_token"
  | "shared_cex_deposit";

export type CrossLinkConfidence = "exact" | "probable";

export interface CrossLink {
  sourceHandle: string;
  targetHandle: string;
  linkType: CrossLinkType;
  confidence: CrossLinkConfidence;
  evidence: string[];
  detectedAt: Date;
}

type WalletRow = { address: string; chain: string; label: string | null };
type TokenRow = { tokenMint: string; kolHandle: string };
type CrossLinkRow = {
  id: string;
  sourceHandle: string;
  targetHandle: string;
  linkType: string;
  confidence: string;
  evidence: unknown;
  detectedAt: Date;
  createdAt: Date;
};

/**
 * Finds all cross-case links for a given KOL handle.
 * Checks shared wallets and shared token involvements.
 * Does NOT modify data — pure read.
 */
export async function findCrossLinks(kolHandle: string): Promise<CrossLink[]> {
  if (!kolHandle) return [];

  const links: CrossLink[] = [];

  // 1. Load source KOL wallets
  const wallets = await prisma.$queryRaw<WalletRow[]>`
    SELECT address, chain, label
    FROM "KolWallet"
    WHERE "kolHandle" = ${kolHandle}
      AND status = 'active'
  `;

  if (wallets.length > 0) {
    const addresses = wallets.map((w) => w.address);

    // 2. Find other KOLs that share any of these wallets
    const sharedWalletKols = await prisma.$queryRaw<
      { kolHandle: string; address: string; chain: string }[]
    >`
      SELECT "kolHandle", address, chain
      FROM "KolWallet"
      WHERE address = ANY(${addresses}::text[])
        AND "kolHandle" != ${kolHandle}
        AND status = 'active'
    `;

    for (const hit of sharedWalletKols) {
      const walletLabel =
        wallets.find((w) => w.address === hit.address)?.label ?? hit.address.slice(0, 8) + "...";
      links.push({
        sourceHandle: kolHandle,
        targetHandle: hit.kolHandle,
        linkType: "shared_wallet",
        confidence: "exact",
        evidence: [
          `Wallet ${walletLabel} (${hit.chain}) attributed to both @${kolHandle} and @${hit.kolHandle}`,
          `Address: ${hit.address}`,
        ],
        detectedAt: new Date(),
      });
    }
  }

  // 3. Find shared token involvements
  const sourceTokens = await prisma.$queryRaw<TokenRow[]>`
    SELECT "tokenMint", "kolHandle"
    FROM "KolTokenInvolvement"
    WHERE "kolHandle" = ${kolHandle}
      AND "isPromoted" = true
  `;

  if (sourceTokens.length > 0) {
    const mints = sourceTokens.map((t) => t.tokenMint);

    const sharedTokenKols = await prisma.$queryRaw<TokenRow[]>`
      SELECT DISTINCT "tokenMint", "kolHandle"
      FROM "KolTokenInvolvement"
      WHERE "tokenMint" = ANY(${mints}::text[])
        AND "kolHandle" != ${kolHandle}
        AND "isPromoted" = true
    `;

    for (const hit of sharedTokenKols) {
      const isDup = links.some(
        (l) => l.targetHandle === hit.kolHandle && l.linkType === "shared_token",
      );
      if (isDup) continue;

      links.push({
        sourceHandle: kolHandle,
        targetHandle: hit.kolHandle,
        linkType: "shared_token",
        confidence: "probable",
        evidence: [
          `Both @${kolHandle} and @${hit.kolHandle} promoted token ${hit.tokenMint}`,
        ],
        detectedAt: new Date(),
      });
    }
  }

  return links;
}

/**
 * Persist cross links into KolCrossLink table (idempotent via ON CONFLICT DO NOTHING).
 */
export async function persistCrossLinks(links: CrossLink[]): Promise<void> {
  if (links.length === 0) return;

  for (const link of links) {
    const evidenceJson = JSON.stringify(link.evidence);
    await prisma.$executeRaw`
      INSERT INTO "KolCrossLink"
        ("id", "sourceHandle", "targetHandle", "linkType", "confidence", "evidence", "detectedAt", "createdAt")
      VALUES
        (gen_random_uuid()::text, ${link.sourceHandle}, ${link.targetHandle},
         ${link.linkType}, ${link.confidence}, ${evidenceJson}::jsonb, ${link.detectedAt}, now())
      ON CONFLICT ("sourceHandle", "targetHandle", "linkType") DO NOTHING
    `;
  }
}

/**
 * Returns all persisted KolCrossLink rows, optionally filtered by handle.
 */
export async function getCrossLinks(handle?: string): Promise<CrossLinkRow[]> {
  if (handle) {
    return prisma.$queryRaw<CrossLinkRow[]>`
      SELECT id, "sourceHandle", "targetHandle", "linkType", "confidence", "evidence", "detectedAt", "createdAt"
      FROM "KolCrossLink"
      WHERE "sourceHandle" = ${handle} OR "targetHandle" = ${handle}
      ORDER BY "detectedAt" DESC
      LIMIT 200
    `;
  }

  return prisma.$queryRaw<CrossLinkRow[]>`
    SELECT id, "sourceHandle", "targetHandle", "linkType", "confidence", "evidence", "detectedAt", "createdAt"
    FROM "KolCrossLink"
    ORDER BY "detectedAt" DESC
    LIMIT 500
  `;
}
