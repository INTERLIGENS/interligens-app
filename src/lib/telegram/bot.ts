/**
 * Telegram Bot v0 — INTERLIGENS scan bot.
 *
 * Commands:
 *   /scan <address>   → TigerScore summary computed in-process
 *   /help             → list of commands
 *   anything else     → gentle nudge to use /scan
 *
 * Contract: every handler returns a { text, parse_mode } object suitable for
 * sendMessage. Handlers NEVER throw — they return an error message string in
 * the `text` field instead. The webhook route is responsible for making the
 * Telegram sendMessage call.
 *
 * Scoring path: computeTigerScoreWithIntel() is imported and called directly,
 * never via HTTP. Going through fetch('/api/v1/score') would loop back through
 * the public edge (Cloudflare), which blocks the bot's server-to-self POSTs
 * with a managed challenge → 403.
 *
 * Demo-safe: if TELEGRAM_BOT_TOKEN is missing, the webhook still returns 200
 * OK and logs "Telegram not configured". Nothing crashes.
 */

import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { isKnownBadEvm } from "@/lib/entities/knownBad";

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; username?: string };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface TelegramReply {
  text: string;
  parse_mode?: "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
}

const HELP_TEXT = [
  "*INTERLIGENS Bot*",
  "",
  "Commands:",
  "  `/scan <address>` — get a TigerScore on any crypto address",
  "  `/help` — show this menu",
  "",
  "Example:",
  "  `/scan 0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41`",
  "",
  "Web app: https://app.interligens.com",
].join("\n");

const UNKNOWN_TEXT = [
  "I don't understand that yet.",
  "",
  "Use `/scan <address>` to check a token, or `/help` for the full list.",
].join("\n");

function isEvmAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function isSolanaAddress(s: string): boolean {
  // Base58, typical mint length 32-44
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function isValidAddress(s: string): boolean {
  return isEvmAddress(s) || isSolanaAddress(s);
}

function escapeMarkdown(s: string): string {
  // Telegram Markdown V1 — escape only the chars that break parsing.
  return s.replace(/([*_`\[\]])/g, "\\$1");
}

/**
 * Format a score response. Defensive: accepts any shape and never throws.
 */
function formatScoreReply(
  address: string,
  data: unknown,
): TelegramReply {
  const d = (data ?? {}) as {
    tigerScore?: number;
    score?: number;
    tier?: string;
    verdict?: string;
    color?: string;
    topReasons?: Array<{ label?: string } | string>;
    signals?: Array<{ label?: string; severity?: string }>;
  };

  const score = d.tigerScore ?? d.score;
  const tier = d.tier ?? d.verdict ?? d.color ?? "UNKNOWN";
  const emoji =
    tier === "RED" || tier === "CRITICAL"
      ? "🔴"
      : tier === "ORANGE" || tier === "MODERATE"
        ? "🟠"
        : tier === "GREEN" || tier === "LOW"
          ? "🟢"
          : "⚪";

  const reasons: string[] = [];
  if (Array.isArray(d.topReasons)) {
    for (const r of d.topReasons.slice(0, 3)) {
      if (typeof r === "string") reasons.push(r);
      else if (r && typeof r === "object" && r.label) reasons.push(r.label);
    }
  }
  if (reasons.length === 0 && Array.isArray(d.signals)) {
    for (const s of d.signals.slice(0, 3)) {
      if (s?.label) reasons.push(s.label);
    }
  }

  const lines: string[] = [];
  lines.push(`${emoji} *${escapeMarkdown(tier)}*${score !== undefined ? ` · score ${score}` : ""}`);
  lines.push(`\`${escapeMarkdown(address)}\``);
  if (reasons.length > 0) {
    lines.push("");
    lines.push("Top signals:");
    for (const r of reasons) lines.push(`  • ${escapeMarkdown(r)}`);
  }
  lines.push("");
  lines.push("Full report: https://app.interligens.com");

  return {
    text: lines.join("\n"),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
}

export async function handleScanCommand(arg: string): Promise<TelegramReply> {
  const address = arg.trim();
  if (!address) {
    return {
      text: "Usage: `/scan <address>`\nExample: `/scan 0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41`",
      parse_mode: "Markdown",
    };
  }
  if (!isValidAddress(address)) {
    return {
      text: "That doesn't look like a valid crypto address. Send an EVM (0x…) or Solana base58 address.",
    };
  }

  try {
    const isEvm = isEvmAddress(address);

    // In-process TigerScore compute. No HTTP, no edge, no Cloudflare.
    const result = isEvm
      ? await computeTigerScoreWithIntel(
          {
            chain: "ETH",
            evm_known_bad: isKnownBadEvm(address.toLowerCase()) !== null,
            evm_is_contract: false,
          },
          address.toLowerCase(),
        )
      : await computeTigerScoreWithIntel(
          {
            chain: "SOL",
            scan_type: "token",
            no_casefile: true,
            mint_address: address,
          },
          address,
        );

    return formatScoreReply(address, {
      score: result.finalScore,
      verdict: result.finalTier,
      signals: result.drivers.map((d) => ({ label: d.label, severity: d.severity })),
    });
  } catch (err) {
    console.error("[telegram-bot] scan compute failed", err);
    return {
      text: "Scoring service unreachable. Please try again in a minute.",
    };
  }
}

export function handleHelpCommand(): TelegramReply {
  return { text: HELP_TEXT, parse_mode: "Markdown", disable_web_page_preview: true };
}

export function handleUnknown(): TelegramReply {
  return { text: UNKNOWN_TEXT, parse_mode: "Markdown", disable_web_page_preview: true };
}

/**
 * Route a raw Telegram update to the appropriate handler.
 * Always resolves to a TelegramReply — errors are swallowed and turned into
 * a human-friendly message.
 */
export async function route(
  update: TelegramUpdate,
): Promise<{ chatId: number; reply: TelegramReply } | null> {
  const msg = update.message ?? update.edited_message;
  if (!msg || !msg.text) return null;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/scan")) {
    const arg = text.replace(/^\/scan(@\w+)?\s*/i, "");
    const reply = await handleScanCommand(arg);
    return { chatId, reply };
  }

  if (text.startsWith("/help") || text.startsWith("/start")) {
    return { chatId, reply: handleHelpCommand() };
  }

  // Unknown command → gentle nudge
  return { chatId, reply: handleUnknown() };
}

/**
 * Send a reply through the Telegram Bot API.
 * Returns `false` if the token is missing or the API errors out. Never throws.
 */
export async function sendReply(
  chatId: number,
  reply: TelegramReply,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN missing — would have sent", {
      chatId,
      reply,
    });
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply.text,
          parse_mode: reply.parse_mode,
          disable_web_page_preview: reply.disable_web_page_preview ?? true,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegram-bot] sendMessage failed", res.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram-bot] sendMessage threw", err);
    return false;
  }
}
