// src/lib/telegram-watcher/types.ts

export interface TelegramChannel {
  id: string;
  title: string;
  username?: string;
  addedAt: Date;
  active: boolean;
}

export interface TokenMention {
  type: "contract_sol" | "contract_eth" | "contract_tron" | "ticker";
  value: string;
  context: string;
}

export interface TelegramMessage {
  id: number;
  channelId: string;
  channelTitle: string;
  text: string;
  date: Date;
  tokenMentions: TokenMention[];
  urgencyLevel: "critical" | "high" | "medium" | "low";
  callerConfidence: number;
}

export interface Signal {
  type: "GEM_ALERT" | "PUMP_CALL" | "BUY_NOW" | "SHILL" | "GENERIC";
  score: number;
  triggers: string[];
  message: TelegramMessage;
}

export interface WatcherConfig {
  maxChannels: number;
  pollIntervalMs: number;
  minShillScore: number;
  crossChannelWindowMs: number;
}

export const DEFAULT_WATCHER_CONFIG: WatcherConfig = {
  maxChannels: 50,
  pollIntervalMs: 60_000,
  minShillScore: 40,
  crossChannelWindowMs: 3_600_000,
};
