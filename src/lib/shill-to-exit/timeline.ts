// src/lib/shill-to-exit/timeline.ts
// Builds a merged chronological timeline from shill tweets + on-chain exits.

import type { ShillEvent, ExitEvent, ShillToExitTimelineEntry } from "./types";

export function buildTimeline(
  tweets: ShillEvent[],
  transactions: ExitEvent[]
): ShillToExitTimelineEntry[] {
  const entries: ShillToExitTimelineEntry[] = [];

  for (const t of tweets) {
    entries.push({
      type: "SHILL",
      date: t.tweetDate,
      label: `@${t.handle} shilled ${t.tokenMentioned} (tweet ${t.tweetId})`,
    });
  }

  for (const tx of transactions) {
    entries.push({
      type: "EXIT",
      date: tx.date,
      label: `Sold ${tx.tokenSold} for ~$${Math.round(tx.amountUsd).toLocaleString()} (${tx.txHash.slice(0, 10)}…)`,
      amountUsd: tx.amountUsd,
    });
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getShillToExitDeltaDays(
  shillDate: Date,
  exitDate: Date
): number {
  return (exitDate.getTime() - shillDate.getTime()) / (1000 * 60 * 60 * 24);
}
