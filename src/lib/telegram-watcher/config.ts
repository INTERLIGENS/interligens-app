// src/lib/telegram-watcher/config.ts

import type { TelegramChannel } from "./types";

export const DEFAULT_CHANNELS: TelegramChannel[] = [
  { id: "ch_001", title: "Crypto Calls Alpha",  username: "crypto_calls_alpha",  addedAt: new Date("2025-01-01"), active: true },
  { id: "ch_002", title: "Sol Gem Alerts",       username: "sol_gem_alerts",       addedAt: new Date("2025-01-01"), active: true },
  { id: "ch_003", title: "ETH 100x Signals",     username: "eth100x",              addedAt: new Date("2025-01-01"), active: true },
  { id: "ch_004", title: "DeFi Ape Station",     username: "defi_ape_station",     addedAt: new Date("2025-01-01"), active: true },
  { id: "ch_005", title: "Pump Fun Notifications",username: "pumpfun_notif",        addedAt: new Date("2025-01-01"), active: false },
];

export const SOL_ADDRESS_RE  = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
export const ETH_ADDRESS_RE  = /0x[a-fA-F0-9]{40}/g;
export const TRON_ADDRESS_RE = /T[1-9A-HJ-NP-Za-km-z]{33}/g;
export const TICKER_RE       = /\$([A-Z]{2,10})\b/g;

export const SHILL_KEYWORDS = [
  "gem alert", "100x", "next 100x", "buy now", "ape in", "ape now",
  "🚀", "🔥", "💎", "just launched", "low cap", "hidden gem",
  "dont miss", "don't miss", "early entry", "x100", "moon",
];
