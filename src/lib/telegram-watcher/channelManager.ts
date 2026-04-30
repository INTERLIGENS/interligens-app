// src/lib/telegram-watcher/channelManager.ts
// In-memory CRUD for Telegram channels (no DB).

import type { TelegramChannel } from "./types";
import { DEFAULT_CHANNELS } from "./config";

const store: Map<string, TelegramChannel> = new Map(
  DEFAULT_CHANNELS.map(c => [c.id, c])
);

export function addChannel(channel: Omit<TelegramChannel, "addedAt" | "active">): TelegramChannel {
  if (store.has(channel.id)) {
    throw new Error(`Channel ${channel.id} already exists`);
  }
  const entry: TelegramChannel = { ...channel, addedAt: new Date(), active: true };
  store.set(channel.id, entry);
  return entry;
}

export function removeChannel(id: string): boolean {
  return store.delete(id);
}

export function listChannels(onlyActive = false): TelegramChannel[] {
  const all = Array.from(store.values());
  return onlyActive ? all.filter(c => c.active) : all;
}

export function getChannel(id: string): TelegramChannel | undefined {
  return store.get(id);
}

export function setActive(id: string, active: boolean): boolean {
  const ch = store.get(id);
  if (!ch) return false;
  store.set(id, { ...ch, active });
  return true;
}

export function clearAll(): void {
  store.clear();
}
