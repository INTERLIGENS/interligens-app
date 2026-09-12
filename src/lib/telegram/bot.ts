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
import { admettreAnonyme, emettre, projeterTexte } from "@/lib/governance/audienceProjection";
import { magasinPrisma, resoudreSujetAdmissible } from "@/lib/governance/autoriteSujet";
import { cleDeSujet } from "@/lib/governance/invariants/canonicalSubjectHandle";
import { estRefus } from "@/lib/governance/uniteGouvernee";

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

declare const EMIS_PAR_LA_FRONTIERE: unique symbol;

/**
 * ─── LA CHARGE DU CANAL, ET ELLE NE SE CONSTRUIT PLUS À LA MAIN ─────────
 *
 * Le symbole unique rend cette forme inconstructible hors de ce module :
 * `{ text: "…" }` n'est plus assignable à `TelegramReply`. `composer()` est
 * le SEUL producteur, et il passe par `projeterTexte` puis `emettre`.
 *
 * C'est ce qui rend la marque PORTANTE sur un canal : sans ça, la déclaration
 * serait posée à côté d'un `sendMessage` qui émet ce qu'il veut — exactement
 * le défaut que le module de projection existe pour fermer.
 */
export interface TelegramReply {
  text: string;
  parse_mode?: "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
  readonly [EMIS_PAR_LA_FRONTIERE]: true;
}

/**
 * ⚠ L'AUDIENCE DE CE CANAL N'EST PAS RATIFIÉE — et on ne l'invente pas.
 *
 * Mesuré : le destinataire est un `chat_id` venu de la requête entrante, que
 * l'application n'émet ni ne valide ; `TELEGRAM_WEBHOOK_SECRET` authentifie
 * Telegram, pas l'abonné ; `msg.from` (l. 29) et `msg.chat.type` (l. 27) sont
 * déclarés et jamais lus, donc le destinataire peut être un groupe de N
 * membres, N inconnu et non borné. L'audience est AUTO-DÉSIGNÉE.
 *
 * On applique le PLANCHER en attendant le ruling : la moins privilégiée des
 * trois, donc le containment le plus strict. Le motif porte la question
 * ouverte plutôt que de la refermer.
 */
const AUDIENCE_DU_CANAL = admettreAnonyme(
  "canal Telegram — audience ABONNE auto-designee (chat_id entrant, from/chat.type jamais lus). " +
    "Nature d'audience NON RATIFIEE : plancher ANONYMOUS applique par prudence, pas par decision.",
);

/** L'UNIQUE producteur de charge du canal. Tout passe par la frontière. */
function composer(
  texte: string,
  parse_mode?: "Markdown" | "HTML",
): TelegramReply {
  const { texte: emis } = emettre(
    projeterTexte(AUDIENCE_DU_CANAL, texte, (t) => t, "text/markdown"),
  );
  return {
    text: emis,
    parse_mode,
    disable_web_page_preview: true,
  } as TelegramReply;
}

const HELP_TEXT = [
  "*INTERLIGENS Bot*",
  "",
  "Commands:",
  "  `/scan <address>` — TigerScore on any crypto address",
  "  `/kol <handle>` — KOL risk profile",
  "  `/help` — show this menu",
  "",
  "Example:",
  "  `/scan 0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41`",
  "  `/kol zachxbt`",
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

  return composer(lines.join("\n"), "Markdown");
}

export async function handleScanCommand(arg: string): Promise<TelegramReply> {
  const address = arg.trim();
  if (!address) {
    return composer(
      "Usage: `/scan <address>`\nExample: `/scan 0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41`",
      "Markdown",
    );
  }
  if (!isValidAddress(address)) {
    return composer(
      "That doesn't look like a valid crypto address. Send an EVM (0x…) or Solana base58 address.",
    );
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
    return composer("Scoring service unreachable. Please try again in a minute.");
  }
}

/**
 * ─── LE REFUS DU CANAL — UNE SEULE SUITE D'OCTETS, TROIS RAISONS ────────
 *
 * `SUJET_ABSENT`, `SUJET_NON_PUBLIE` et `CONFLIT_IDENTITE` rendent LA MÊME
 * chaîne, et c'est elle qui rend le containment uniforme possible sur ce
 * canal.
 *
 * Pourquoi ça marche ici alors que ça ne marche pas sur la Watchlist : `/kol`
 * est une requête PONCTUELLE. Il n'y a pas de forme de collection à préserver,
 * pas de 11 lignes riches contre 96 pauvres. L'unité de containment peut être
 * la réponse elle-même.
 *
 * L'écho du handle ne porte aucune information de retour : c'est l'ENTRÉE DE
 * L'ABONNÉ, normalisée par une clé déterministe. Sous cette condition, les 261
 * sujets non publiés se confondent avec les 140 lignes inatteignables ET avec
 * l'ensemble non borné des handles qui n'existent pas. Trois populations, une
 * réponse.
 *
 * ⚠ BORNE DÉCLARÉE, NON COMBLÉE : un corps identique n'est pas une réponse
 * identique sur un canal où la LATENCE est observable. Les trois chemins
 * interrogent Postgres, donc l'écart est petit — petit n'est pas nul, et je ne
 * l'ai pas mesuré.
 */
export function messageDeRefusKol(cle: string): string {
  return `No KOL profile found for \`@${escapeMarkdown(cle)}\`.`;
}

const refusIdentique = (cle: string): TelegramReply =>
  composer(messageDeRefusKol(cle), "Markdown");

export async function handleKolCommand(arg: string): Promise<TelegramReply> {
  // CANONICAL_SUBJECT_HANDLE — la clé se calcule AVANT tout lookup.
  const cle = cleDeSujet(arg);
  if (!cle) {
    return composer(
      "Usage: `/kol <twitter_handle>`\nExample: `/kol zachxbt`",
      "Markdown",
    );
  }
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      // ██ L'AUTORITÉ DE PUBLICATION DU SUJET, CONSOMMÉE PAR IMPORT ██
      //
      // `magasinPrisma` compose `FILTRE_SUJET_ADMISSIBLE`, qui EST
      // `PUBLIC_KOL_FILTER` — le même objet que toutes les autres surfaces
      // nominatives, pas une copie. C'est la règle de fermeture ratifiée :
      // « Telegram /kol must consume the same governed subject-publication
      //   authority as every other nominative projection. »
      //
      // Avant ce lot, la ligne d'ici était
      //     findUnique({ where: { handle } })
      // sans aucun filtre de publication : 261 sujets sans décision de
      // publication répondaient, tous avec un `riskFlag`, 202 avec un `tier`.
      const sujet = await resoudreSujetAdmissible<{
        handle: string;
        publishStatus: string;
        displayName: string | null;
        tier: string | null;
        riskFlag: string;
        rugCount: number | null;
      }>(
        magasinPrisma(prisma, {
          displayName: true,
          tier: true,
          riskFlag: true,
          rugCount: true,
        }),
        cle,
      );

      if (estRefus(sujet)) {
        // Le motif part au JOURNAL, jamais dans la charge. Un motif qui
        // voyagerait dans le message serait l'oracle livré avec la garde.
        console.info("[telegram-bot] /kol refus", { cle, raison: sujet.raison });
        return refusIdentique(cle);
      }

      const kol = sujet.ligne;
      const rugLine = (kol.rugCount ?? 0) > 0 ? `\n⚠️ Rug count: *${kol.rugCount}*` : "";
      return composer(
        [
          `🕵️ *KOL PROFILE*`,
          `Handle: \`@${escapeMarkdown(kol.handle)}\``,
          `Name: ${escapeMarkdown(kol.displayName ?? "—")}`,
          `Tier: *${escapeMarkdown(kol.tier ?? "UNKNOWN")}*`,
          `Risk flag: ${escapeMarkdown(kol.riskFlag)}${rugLine}`,
        ].join("\n"),
        "Markdown",
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    // TROISIÈME CLASSE DE RÉPONSE, et elle est DÉCLARÉE : une panne
    // d'infrastructure rend un message distinct. Elle ne corrèle avec aucune
    // propriété du sujet — elle ne dépend que de la joignabilité de la base —
    // donc elle n'est pas un oracle. Si un jour elle se mettait à dépendre du
    // sujet, elle en deviendrait un.
    console.error("[telegram-bot] kol lookup failed", err);
    return composer("KOL lookup failed. Try again later.");
  }
}

export function handleHelpCommand(): TelegramReply {
  return composer(HELP_TEXT, "Markdown");
}

export function handleUnknown(): TelegramReply {
  return composer(UNKNOWN_TEXT, "Markdown");
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

  if (text.startsWith("/kol")) {
    const arg = text.replace(/^\/kol(@\w+)?\s*/i, "");
    const reply = await handleKolCommand(arg);
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
