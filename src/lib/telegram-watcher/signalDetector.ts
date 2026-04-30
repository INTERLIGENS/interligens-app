// src/lib/telegram-watcher/signalDetector.ts

import type { Signal, TelegramMessage } from "./types";
import { parseMessage } from "./messageParser";

const PATTERN_RULES: Array<{ type: Signal["type"]; triggers: string[]; bonus: number }> = [
  { type: "GEM_ALERT",  triggers: ["gem alert", "hidden gem", "💎"],                    bonus: 30 },
  { type: "PUMP_CALL",  triggers: ["100x", "next 100x", "x100", "moon", "🚀"],          bonus: 25 },
  { type: "BUY_NOW",    triggers: ["buy now", "ape in", "ape now", "don't miss", "dont miss"], bonus: 20 },
  { type: "SHILL",      triggers: ["just launched", "early entry", "low cap"],           bonus: 15 },
];

export function detectShillSignals(message: TelegramMessage): Signal[] {
  const { callerConfidence } = parseMessage(message.text);
  const lower = message.text.toLowerCase();
  const signals: Signal[] = [];

  for (const rule of PATTERN_RULES) {
    const matched = rule.triggers.filter(t => lower.includes(t.toLowerCase()));
    if (matched.length > 0) {
      const score = Math.min(callerConfidence + rule.bonus, 100);
      signals.push({ type: rule.type, score, triggers: matched, message });
    }
  }

  if (signals.length === 0 && callerConfidence >= 30) {
    signals.push({ type: "GENERIC", score: callerConfidence, triggers: [], message });
  }

  return signals;
}

interface CrossChannelEntry {
  token: string;
  channelIds: string[];
  firstSeen: Date;
}

const recentTokens = new Map<string, CrossChannelEntry>();

export function detectCrossChannelBurst(
  messages: TelegramMessage[],
  windowMs = 3_600_000
): string[] {
  const now = Date.now();

  for (const msg of messages) {
    for (const t of msg.tokenMentions) {
      const key = t.value;
      const existing = recentTokens.get(key);
      if (!existing) {
        recentTokens.set(key, { token: key, channelIds: [msg.channelId], firstSeen: new Date() });
      } else if (now - existing.firstSeen.getTime() <= windowMs) {
        if (!existing.channelIds.includes(msg.channelId)) {
          existing.channelIds.push(msg.channelId);
        }
      } else {
        recentTokens.set(key, { token: key, channelIds: [msg.channelId], firstSeen: new Date() });
      }
    }
  }

  const burst: string[] = [];
  for (const [token, entry] of recentTokens.entries()) {
    if (entry.channelIds.length >= 2 && now - entry.firstSeen.getTime() <= windowMs) {
      burst.push(token);
    }
  }
  return burst;
}

export function clearCrossChannelCache(): void {
  recentTokens.clear();
}
