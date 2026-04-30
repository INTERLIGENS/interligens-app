// src/lib/telegram-watcher/messageParser.ts

import type { TokenMention } from "./types";
import {
  SOL_ADDRESS_RE,
  ETH_ADDRESS_RE,
  TRON_ADDRESS_RE,
  TICKER_RE,
  SHILL_KEYWORDS,
} from "./config";

export interface ParsedMessage {
  tokens: TokenMention[];
  urgencyLevel: "critical" | "high" | "medium" | "low";
  callerConfidence: number;
}

export function extractTokenMentions(text: string): TokenMention[] {
  const mentions: TokenMention[] = [];
  const seen = new Set<string>();

  const addIfNew = (m: TokenMention) => {
    const key = `${m.type}:${m.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      mentions.push(m);
    }
  };

  for (const m of text.matchAll(new RegExp(TRON_ADDRESS_RE.source, "g"))) {
    addIfNew({ type: "contract_tron", value: m[0], context: text.slice(Math.max(0, m.index! - 20), m.index! + 44) });
  }
  for (const m of text.matchAll(new RegExp(ETH_ADDRESS_RE.source, "g"))) {
    addIfNew({ type: "contract_eth", value: m[0], context: text.slice(Math.max(0, m.index! - 20), m.index! + 42) });
  }
  for (const m of text.matchAll(new RegExp(SOL_ADDRESS_RE.source, "gi"))) {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(m[0]) && !/^0x/.test(m[0])) {
      addIfNew({ type: "contract_sol", value: m[0], context: text.slice(Math.max(0, m.index! - 20), m.index! + 44) });
    }
  }
  for (const m of text.matchAll(new RegExp(TICKER_RE.source, "g"))) {
    addIfNew({ type: "ticker", value: m[1], context: m[0] });
  }

  return mentions;
}

export function parseMessage(text: string): ParsedMessage {
  const tokens = extractTokenMentions(text);
  const lower = text.toLowerCase();

  const matchedKeywords = SHILL_KEYWORDS.filter(k => lower.includes(k.toLowerCase()));
  const keywordScore = Math.min(matchedKeywords.length * 20, 100);

  const hasAddress = tokens.some(t => t.type !== "ticker");
  const hasTicker = tokens.some(t => t.type === "ticker");
  const addressBonus = hasAddress ? 15 : 0;
  const tickerBonus = hasTicker ? 5 : 0;

  const callerConfidence = Math.min(keywordScore + addressBonus + tickerBonus, 100);

  const urgencyLevel: ParsedMessage["urgencyLevel"] =
    callerConfidence >= 80 ? "critical" :
    callerConfidence >= 60 ? "high" :
    callerConfidence >= 30 ? "medium" : "low";

  return { tokens, urgencyLevel, callerConfidence };
}
