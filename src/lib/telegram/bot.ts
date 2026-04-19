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
import { getKolDossier } from "@/lib/kol/kolDossier";

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
  "Send any address directly — no command needed:",
  "  `0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41`",
  "  SOL base58 mint · EVM 0x…",
  "",
  "Or a handle:",
  "  `@bkokoski`",
  "",
  "Commands still supported:",
  "  `/scan <address>` · `/help`",
  "",
  "Web app: https://app.interligens.com",
].join("\n");

const UNKNOWN_TEXT = [
  "Send an address (EVM 0x… or SOL base58) or a @handle.",
  "Type `/help` for examples.",
].join("\n");

const INVALID_ADDRESS_TEXT = "Invalid address format.";
const CHAIN_UNSUPPORTED_TEXT = "Chain not supported yet.";
const SCORE_UNAVAILABLE_TEXT = "Score temporarily unavailable.";
const HANDLE_NOT_FOUND_TEXT =
  "Handle not referenced yet. Try an address or visit app.interligens.com";

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

function isHandle(s: string): boolean {
  return /^@[A-Za-z0-9_]{2,32}$/.test(s);
}

// Best-effort: looks like a wallet address from a non-supported chain
// (BTC bc1…, Tron T…, Cosmos cosmos1…, Near a.b.near, etc.)
function looksLikeUnsupportedChain(s: string): boolean {
  if (isValidAddress(s)) return false;
  if (/^bc1[a-z0-9]{25,}$/i.test(s)) return true;              // BTC bech32
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s)) return true; // BTC legacy
  if (/^T[A-Za-z0-9]{33}$/.test(s)) return true;                 // Tron
  if (/^(cosmos|terra|osmo|inj)[a-z0-9]{30,}$/i.test(s)) return true;
  if (/^0x[a-fA-F0-9]{39,64}$/.test(s)) return true;             // malformed EVM-like
  return false;
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
  lines.push(`*${escapeMarkdown(tier)}*${score !== undefined ? ` · score ${score}` : ""}`);
  lines.push(`\`${escapeMarkdown(address)}\``);
  if (reasons.length > 0) {
    lines.push("");
    lines.push("Top signals:");
    for (const r of reasons) lines.push(`  - ${escapeMarkdown(r)}`);
  }
  lines.push("");
  lines.push("View full report → https://app.interligens.com");

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
      text: "Usage: `/scan <address>` — or just paste the address directly.",
      parse_mode: "Markdown",
    };
  }
  if (!isValidAddress(address)) {
    return { text: looksLikeUnsupportedChain(address) ? CHAIN_UNSUPPORTED_TEXT : INVALID_ADDRESS_TEXT };
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
    return { text: SCORE_UNAVAILABLE_TEXT };
  }
}

export async function handleHandleCommand(raw: string): Promise<TelegramReply> {
  const handle = raw.trim().replace(/^@/, "");
  if (!handle) return { text: HANDLE_NOT_FOUND_TEXT };

  try {
    const dossier = await getKolDossier(handle);
    if (!dossier || dossier.publishStatus !== "published") {
      return { text: HANDLE_NOT_FOUND_TEXT };
    }

    const tier = dossier.tier ?? "UNKNOWN";
    const proceeds = dossier.aggregates.observedProceedsTotal;
    const lines: string[] = [];
    lines.push(`*@${escapeMarkdown(dossier.handle)}*${dossier.displayName ? ` · ${escapeMarkdown(dossier.displayName)}` : ""}`);
    lines.push(`Tier ${escapeMarkdown(tier)} · ${dossier.aggregates.evidenceCount} evidence · ${dossier.aggregates.walletsCount} wallets · ${dossier.aggregates.linkedTokensCount} tokens`);
    if (proceeds > 0) lines.push(`Observed proceeds: $${proceeds.toLocaleString("en-US")}`);
    if (dossier.summary) {
      lines.push("");
      lines.push(escapeMarkdown(String(dossier.summary).slice(0, 240)));
    }
    lines.push("");
    lines.push(`View full report → https://app.interligens.com/en/kol/${encodeURIComponent(dossier.handle)}`);
    return { text: lines.join("\n"), parse_mode: "Markdown", disable_web_page_preview: true };
  } catch (err) {
    console.error("[telegram-bot] handle lookup failed", err);
    return { text: HANDLE_NOT_FOUND_TEXT };
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

  // Auto-detect: first token of a bare message can be an address or a handle.
  const firstToken = text.split(/\s+/, 1)[0] ?? "";

  if (isValidAddress(firstToken)) {
    return { chatId, reply: await handleScanCommand(firstToken) };
  }
  if (isHandle(firstToken)) {
    return { chatId, reply: await handleHandleCommand(firstToken) };
  }
  if (looksLikeUnsupportedChain(firstToken)) {
    return { chatId, reply: { text: CHAIN_UNSUPPORTED_TEXT } };
  }

  // Unknown — gentle nudge, never a tech error
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
