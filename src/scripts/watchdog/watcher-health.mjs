#!/usr/bin/env node
/**
 * watcher-health.mjs — Watchdog autonome pour le Watcher V2.
 *
 * BUT : détecter une panne du Watcher AVANT qu'elle ne dure (cf. trou de 10j
 * du 09→19 juin 2026 où le Watcher est resté muet sans alerte).
 *
 * PRINCIPE : ce surveillant vit EN DEHORS du watcher (lancé par launchd, pas
 * par le cron Vercel). Si le cron Vercel ne se déclenche pas, ce script, lui,
 * tourne quand même et le remarque.
 *
 * GARANTIES :
 *   - 100% lecture DB (SQL brut via pg). AUCUNE écriture DB.
 *   - AUCUN appel X API. Le spend est lu depuis notre propre table d'estimation
 *     XApiUsage (pas une facture X récupérée en ligne).
 *   - État (anti-spam + heartbeat) stocké dans un fichier local, pas en DB.
 *
 * CHECKS :
 *   1. Watcher muet : MAX(discoveredAtUtc) WHERE sourceProvider='x_api_v2'.
 *      Filtre x_api_v2 OBLIGATOIRE — les rows playwright_local / seeders manuels
 *      pollueraient sinon le signal et masqueraient un watcher mort (faux vert).
 *   2. Spend cap : totalCostUsd du mois courant vs cap configurable.
 *   3. Canal email : dernier WatcherDigest.emailStatus (informatif — le Watcher
 *      digest email est cassé depuis le 2026-05-10 ; on alerte via Telegram).
 *
 * NB schéma : la table réelle XApiUsage est driftée vs schema.prod.prisma
 * (colonnes monthStart/totalCostUsd, PAS month/estimatedUsd) — d'où le SQL brut.
 *
 * Variables d'env (depuis .env.local du repo, ou l'environnement) :
 *   DATABASE_URL            (requis)  — DB prod read-only
 *   TELEGRAM_BOT_TOKEN      (requis)  — bot Telegram
 *   TELEGRAM_OPS_CHAT_ID    (requis)  — chat de destination des alertes
 *   WATCHDOG_SILENCE_DAYS   (déf 3.5) — seuil silence watcher, en jours
 *   WATCHDOG_SPEND_CAP_USD  (déf 100) — cap mensuel X API (réel ~$100, 2026-06-25)
 *   WATCHDOG_WARN_PCT       (déf 80)  — % du cap déclenchant un warn
 *   WATCHDOG_STATE_FILE     (déf ~/.interligens-watchdog-state.json)
 *   WATCHDOG_DRY_RUN        (déf off) — "1" => imprime au lieu d'envoyer Telegram
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/scripts/watchdog/ -> repo root = trois niveaux au-dessus
const REPO_ROOT = path.resolve(__dirname, "../../..");

// --- Chargement .env.local (le cwd de launchd n'est pas garanti) -------------
function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

// --- Config ------------------------------------------------------------------
const SILENCE_DAYS = parseFloat(process.env.WATCHDOG_SILENCE_DAYS ?? "3.5");
const SPEND_CAP_USD = parseFloat(process.env.WATCHDOG_SPEND_CAP_USD ?? "100");
const WARN_PCT = parseFloat(process.env.WATCHDOG_WARN_PCT ?? "80");
const DRY_RUN = process.env.WATCHDOG_DRY_RUN === "1";
const STATE_FILE =
  process.env.WATCHDOG_STATE_FILE ||
  path.join(process.env.HOME || REPO_ROOT, ".interligens-watchdog-state.json");

const SILENCE_MS = SILENCE_DAYS * 86_400_000;
const REALERT_MS = 24 * 3_600_000; // ré-alerte au plus une fois / 24h pour le même problème

// --- État local (anti-spam + heartbeat) --------------------------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { lastAlertAt: 0, lastSignature: "", lastHeartbeatDate: "" };
  }
}
function saveState(s) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  } catch (e) {
    console.error("[watchdog] impossible d'écrire l'état:", e.message);
  }
}

// --- Telegram ----------------------------------------------------------------
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OPS_CHAT_ID;
  if (DRY_RUN) {
    console.log("\n[watchdog DRY_RUN] message Telegram qui aurait été envoyé :\n" + text + "\n");
    return true;
  }
  if (!token || !chatId) {
    console.error(
      `[watchdog] Telegram non configuré (TELEGRAM_BOT_TOKEN=${token ? "set" : "MANQUANT"}, ` +
        `TELEGRAM_OPS_CHAT_ID=${chatId ? "set" : "MANQUANT"}). Message non envoyé :\n` + text
    );
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error("[watchdog] Telegram sendMessage a échoué", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[watchdog] Telegram sendMessage a throw:", e.message);
    return false;
  }
}

// --- Helpers -----------------------------------------------------------------
function fmtAge(ms) {
  if (ms == null) return "jamais";
  const h = ms / 3_600_000;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}j`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// --- Checks (lecture seule) --------------------------------------------------
async function runChecks(client) {
  const now = Date.now();
  const problems = []; // { key, severity: 'crit'|'warn', line }
  const lines = []; // résumé complet (heartbeat)

  // 1. Watcher muet
  try {
    const r = await client.query(
      `SELECT MAX("discoveredAtUtc") AS last FROM social_post_candidates WHERE "sourceProvider"='x_api_v2'`
    );
    const last = r.rows[0]?.last ? new Date(r.rows[0].last).getTime() : null;
    const age = last == null ? null : now - last;
    if (last == null || age > SILENCE_MS) {
      problems.push({
        key: "silence",
        severity: "crit",
        line: `🔴 WATCHER MUET — dernier signal x_api_v2 il y a ${fmtAge(age)} (seuil ${SILENCE_DAYS}j)`,
      });
    }
    lines.push(`• Watcher : dernier signal il y a ${fmtAge(age)} (seuil ${SILENCE_DAYS}j)`);
  } catch (e) {
    problems.push({ key: "silence_err", severity: "crit", line: `🔴 Check watcher impossible : ${e.message}` });
    lines.push(`• Watcher : ERREUR check (${e.message})`);
  }

  // 2. Spend cap (lecture de NOTRE table d'estimation, pas d'appel X API)
  try {
    const r = await client.query(
      `SELECT "totalCostUsd","tweetsFetched","userLookups"
       FROM "XApiUsage"
       WHERE "monthStart" >= date_trunc('month', (now() at time zone 'utc'))
       ORDER BY "monthStart" DESC LIMIT 1`
    );
    const spend = Number(r.rows[0]?.totalCostUsd ?? 0);
    const pct = SPEND_CAP_USD > 0 ? (spend / SPEND_CAP_USD) * 100 : 0;
    if (pct >= 100) {
      problems.push({
        key: "spend",
        severity: "crit",
        line: `🔴 SPEND CAP DÉPASSÉ — $${spend.toFixed(2)} / $${SPEND_CAP_USD} (${pct.toFixed(0)}%)`,
      });
    } else if (pct >= WARN_PCT) {
      problems.push({
        key: "spend",
        severity: "warn",
        line: `🟠 Spend X API élevé — $${spend.toFixed(2)} / $${SPEND_CAP_USD} (${pct.toFixed(0)}%)`,
      });
    }
    lines.push(`• Spend X API : $${spend.toFixed(2)} / $${SPEND_CAP_USD} (${pct.toFixed(0)}%)`);
  } catch (e) {
    lines.push(`• Spend X API : ERREUR check (${e.message})`);
  }

  // 3. Canal email du Watcher (informatif — on alerte via Telegram, pas email)
  try {
    const r = await client.query(
      `SELECT "emailStatus","createdAt" FROM "WatcherDigest" ORDER BY "createdAt" DESC LIMIT 1`
    );
    if (r.rows.length === 0) {
      lines.push(`• Canal email Watcher : aucun digest enregistré (info)`);
    } else {
      const { emailStatus, createdAt } = r.rows[0];
      const when = new Date(createdAt).toISOString().slice(0, 10);
      const ok = emailStatus === "sent";
      lines.push(`• Canal email Watcher : ${ok ? "✅" : "⚠️"} dernier digest ${when} = ${emailStatus}`);
    }
  } catch (e) {
    lines.push(`• Canal email Watcher : ERREUR check (${e.message})`);
  }

  return { problems, lines };
}

// --- Main --------------------------------------------------------------------
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[watchdog] DATABASE_URL manquant — abandon.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let result;
  try {
    await client.connect();
    result = await runChecks(client);
  } catch (e) {
    // Échec de connexion DB lui-même = anomalie à signaler.
    console.error("[watchdog] échec connexion/checks DB:", e.message);
    await sendTelegram(`🔴 WATCHDOG — échec d'accès à la DB : ${e.message}`);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch {}
  }

  const { problems, lines } = result;
  const state = loadState();
  const now = Date.now();
  const signature = problems.map((p) => p.key).sort().join(",");
  const summary = lines.join("\n");

  if (problems.length > 0) {
    const changed = signature !== state.lastSignature;
    const stale = now - (state.lastAlertAt || 0) > REALERT_MS;
    if (changed || stale) {
      const header = problems.some((p) => p.severity === "crit")
        ? "🔴 ALERTE WATCHDOG INTERLIGENS"
        : "🟠 WATCHDOG INTERLIGENS";
      const body =
        `${header}\n\n` +
        problems.map((p) => p.line).join("\n") +
        `\n\n— État complet —\n${summary}`;
      const sent = await sendTelegram(body);
      if (sent && !DRY_RUN) {
        state.lastAlertAt = now;
        state.lastSignature = signature;
        saveState(state);
      }
    } else {
      console.log("[watchdog] problème déjà alerté (<24h, même signature) — pas de renvoi.");
    }
  } else {
    // Tout vert : recovery éventuel + heartbeat quotidien.
    if (state.lastSignature) {
      await sendTelegram(`✅ WATCHDOG — résolu. Tout est de nouveau vert.\n\n${summary}`);
      state.lastSignature = "";
      state.lastAlertAt = 0;
      saveState(state);
    }
    const today = todayStr();
    if (state.lastHeartbeatDate !== today) {
      const sent = await sendTelegram(`✅ Watchdog INTERLIGENS — tout vert\n\n${summary}`);
      if (sent && !DRY_RUN) {
        state.lastHeartbeatDate = today;
        saveState(state);
      }
    } else {
      console.log("[watchdog] tout vert, heartbeat déjà envoyé aujourd'hui.");
    }
  }

  // Toujours logguer le résumé (visible dans le log launchd).
  console.log(`[watchdog] ${todayStr()} — ${problems.length} problème(s)\n${summary}`);
}

main().catch((e) => {
  console.error("[watchdog] erreur fatale:", e);
  process.exit(1);
});
