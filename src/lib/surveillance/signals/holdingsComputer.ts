/**
 * src/lib/surveillance/signals/holdingsComputer.ts
 * Calcule le solde d'un token pour un wallet à un instant T
 */

import { prisma } from "@/lib/prisma";

export async function computeHoldingAtTime(
  walletAddress: string,
  tokenAddress: string,
  atTime: Date
): Promise<bigint> {
  const events = await prisma.$queryRaw<
    { direction: string; amountRaw: string }[]
  >`
    SELECT direction, "amountRaw"
    FROM onchain_events
    WHERE "walletAddress" = ${walletAddress.toLowerCase()}
      AND "tokenAddress" = ${tokenAddress.toLowerCase()}
      AND "eventType" = 'erc20_transfer'
      AND "blockTimeUtc" <= ${atTime}
  `;

  let balance = BigInt(0);
  for (const e of events) {
    try {
      const amount = BigInt(e.amountRaw ?? "0");
      if (e.direction === "in") balance += amount;
      else if (e.direction === "out") balance -= amount;
    } catch {
      // ignore malformed amountRaw
    }
  }

  return balance < BigInt(0) ? BigInt(0) : balance;
}
