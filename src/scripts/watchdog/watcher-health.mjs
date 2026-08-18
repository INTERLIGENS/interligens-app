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
 *   1. Santé du Watcher : SONDE C4 sur `JobRunLog` (src/lib/watchdog/).
 *      La fraîcheur se lit sur un RUN — trigger=CRON, ingestionMode=LIVE,
 *      source=WATCHER_V2 — jamais sur une écriture.
 *
 *      ── POURQUOI CE CHECK A CHANGÉ ────────────────────────────────────────
 *      L'ancienne mesure était `MAX(discoveredAtUtc)` sur les candidats : une
 *      MESURE D'ÉCRITURE. Du 17 au 24 août 2026 le collecteur était mort et un
 *      backfill manuel de 261 lignes a repoussé cette date de trois jours —
 *      le watchdog est resté VERT pendant huit jours de panne. Une date de
 *      dernière écriture ne distingue pas un cron vivant d'un humain qui colle
 *      des lignes à la main.
 *      `MAX(discoveredAtUtc)` SUBSISTE en ligne informative (1bis) mais ne
 *      décide plus RIEN : il sert à trancher, en cas d'alerte C4, entre « le
 *      watcher est mort » et « le watcher va bien mais son journal est cassé ».
 *   2. Spend cap : totalCostUsd du mois courant vs cap configurable.
 *   3. TSA pending : EvidenceItem sans horodatage (warn au-delà d'un seuil).
 *   4. Evidence sans octets : DEUX compteurs séparés sur r2Key IS NULL —
 *      hash-only délibéré (informatif) vs [R2:UNAVAILABLE] accidentel (crit
 *      dès 1, aucun job ne rattrape).
 *   (Le check "canal email" a été retiré le 2026-06-25 : digest email
 *    abandonné, Telegram est l'unique canal d'alerte.)
 *
 * NB schéma : la table réelle XApiUsage est driftée vs schema.prod.prisma
 * (colonnes monthStart/totalCostUsd, PAS month/estimatedUsd) — d'où le SQL brut.
 *
 * Variables d'env (depuis .env.local du repo, ou l'environnement) :
 *   DATABASE_URL            (requis)  — DB prod read-only
 *   TELEGRAM_BOT_TOKEN      (requis)  — bot Telegram
 *   TELEGRAM_OPS_CHAT_ID    (requis)  — chat de destination des alertes
 *   WATCHDOG_C4_WINDOW_DAYS (déf 14)  — profondeur de la fenêtre de runs lue
 *                                       par la sonde C4 (seuils: DEFAULT_C4_CONFIG)
 *   WATCHDOG_SPEND_CAP_USD  (déf 100) — cap mensuel X API (réel ~$100, 2026-06-25)
 *   WATCHDOG_WARN_PCT       (déf 80)  — % du cap déclenchant un warn
 *   WATCHDOG_STATE_FILE     (déf ~/.interligens-watchdog-state.json)
 *   WATCHDOG_DRY_RUN        (déf off) — "1" => imprime au lieu d'envoyer Telegram
 */

import fs from "fs";
import path from "path";
import { createRequire } from "node:module";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/scripts/watchdog/ -> repo root = trois niveaux au-dessus
const REPO_ROOT = path.resolve(__dirname, "../../..");

// --- Chargement de la sonde C4 (TypeScript) depuis ce script Node nu --------
//
// launchd lance `node watcher-health.mjs` sans passer par un bundler. La sonde
// C4 vit en TypeScript dans src/lib/watchdog/ — c'est ce qui permet de prouver
// ses 6 invariants par mutation en Vitest, et c'est non négociable : dupliquer
// sa logique ici en JavaScript créerait deux sondes qui divergeraient au
// premier correctif, et celle qui alerte serait justement celle qui n'est pas
// testée.
//
// `tsx/cjs/api` enregistre un hook de résolution qui compile le TS à la volée.
// Le `.plist` n'a donc PAS à changer et reste sur `node` nu.
//
// Si le chargement échoue (node_modules absent, tsx retiré), on ne se tait
// pas : `loadC4()` remonte l'erreur et le check la transforme en problème
// visible. Une sonde qui n'a pas pu se charger est un incident, pas un silence.
const require = createRequire(import.meta.url);
function loadC4() {
  const { register } = require("tsx/cjs/api");
  const unregister = register();
  try {
    return {
      probe: require(path.join(REPO_ROOT, "src/lib/watchdog/watcherHealthProbe.ts")),
      adapter: require(path.join(REPO_ROOT, "src/lib/watchdog/jobRunLogAdapter.ts")),
      arm: require(path.join(REPO_ROOT, "src/lib/watchdog/probeArming.ts")),
    };
  } finally {
    unregister();
  }
}

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
// Profondeur de la fenêtre de runs lue pour la sonde C4. 14 j couvre très large
// les seuils de la sonde (24 h au plus) tout en donnant du recul pour compter
// les runs capés consécutifs et pour que `oldestUnsatisfiedSlot` ait de quoi
// borner sa remontée de créneaux.
//
// WATCHDOG_SILENCE_DAYS a été RETIRÉ ici le 2026-08-25 : il réglait le seuil de
// l'ancienne mesure `MAX(discoveredAtUtc)`, qui ne décide plus rien. Les seuils
// de la sonde C4 vivent dans DEFAULT_C4_CONFIG (src/lib/watchdog/), avec les
// tests qui les prouvent. Laisser traîner une variable d'env qui ne change plus
// rien serait pire que de la supprimer : on la tournerait en croyant agir.
const C4_WINDOW_DAYS = parseInt(process.env.WATCHDOG_C4_WINDOW_DAYS ?? "14", 10);
const SPEND_CAP_USD = parseFloat(process.env.WATCHDOG_SPEND_CAP_USD ?? "100");
const WARN_PCT = parseFloat(process.env.WATCHDOG_WARN_PCT ?? "80");
const DRY_RUN = process.env.WATCHDOG_DRY_RUN === "1";

// Âge maximum toléré par source d'intelligence, en jours. Une liste de
// sanctions se démode plus vite qu'un flux communautaire de domaines : le
// seuil suit la nature de la source, pas une moyenne.
//
// ofac/amf/fca sont palier 1 (réglementaire) : leur péremption est CRITIQUE
// parce que TigerScore applique un floor sur un match ET ne contrôle aucune
// fraîcheur — un « pas de sanction » calculé sur une liste de 4 mois est une
// affirmation que rien ne soutient.
const INTEL_TIER1_SLUGS = new Set(["ofac", "amf", "fca"]);
const INTEL_MAX_AGE_DAYS_DEFAULT = parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_DAYS ?? "30", 10);
const INTEL_MAX_AGE_DAYS = {
  ofac: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_OFAC ?? "7", 10),
  amf: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_AMF ?? "14", 10),
  fca: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_FCA ?? "14", 10),
  scamsniffer: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_SCAMSNIFFER ?? "14", 10),
  forta: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_FORTA ?? "30", 10),
  goplus: parseInt(process.env.WATCHDOG_INTEL_MAX_AGE_GOPLUS ?? "30", 10),
};
const STATE_FILE =
  process.env.WATCHDOG_STATE_FILE ||
  path.join(process.env.HOME || REPO_ROOT, ".interligens-watchdog-state.json");

const REALERT_MS = 24 * 3_600_000; // ré-alerte au plus une fois / 24h pour le même problème

// --- Retry connexion DB (anti-faux-positif réseau) ---------------------------
// Host-001 est un laptop en Indonésie (Lombok) ; le lien vers Neon (Francfort)
// est intercontinental et lâche par intermittence (read ETIMEDOUT/ECONNRESET
// en pleine session — le socket se connecte puis meurt). Un seul essai =>
// une alerte 🔴 "échec DB" au 1er paquet perdu, alors que la DB va très bien.
// On ne considère donc la DB en panne que si TOUTES les tentatives échouent :
//   - hoquet réseau transitoire  -> une tentative suivante réussit -> pas d'alerte
//   - vraie panne DB             -> les 3 tentatives échouent      -> alerte 🔴
const DB_MAX_ATTEMPTS = parseInt(process.env.WATCHDOG_DB_MAX_ATTEMPTS ?? "3", 10);
// Timeout explicite par tentative : borne les stalls silencieux (sinon un
// ETIMEDOUT read peut pendre ~75s au niveau OS).
const DB_CONNECT_TIMEOUT_MS = parseInt(process.env.WATCHDOG_DB_CONNECT_TIMEOUT_MS ?? "15000", 10);
// Backoff AVANT chaque nouvelle tentative (la 1re est immédiate). Avec 3
// tentatives, 2 attentes sont consommées (2s puis 5s) ; le 10s reste défini
// pour une éventuelle 4e tentative via WATCHDOG_DB_MAX_ATTEMPTS.
const DB_RETRY_BACKOFF_MS = [2000, 5000, 10000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // 1. Santé du Watcher — SONDE C4 sur JobRunLog (la fraîcheur se lit sur un RUN)
  try {
    const { probe, adapter, arm } = loadC4();
    const runs = await adapter.loadWatcherRuns(adapter.fromPgClient(client), {
      windowDays: C4_WINDOW_DAYS,
    });
    const report = probe.evaluateWatcherHealth(runs, new Date(now));

    // ── ARMEMENT ──────────────────────────────────────────────────────────
    // La sonde ne juge que lorsque l'écrivain qu'elle observe a eu une CHANCE
    // d'écrire. Deux états la suspendent : aucune ligne du tout, et un
    // écrivain plus jeune qu'un cycle cron complet. Voir probeArming.ts — la
    // garde ne peut jamais masquer un ordonnanceur mort plus d'une cadence.
    const arming = arm.evaluateArming({
      runs,
      liveCronRunCount: report.liveCronRunCount,
      now: new Date(now),
      cadenceMs: probe.DEFAULT_C4_CONFIG.cadenceMs,
    });

    if (!arming.armed) {
      problems.push({
        key: "c4_non_arme",
        severity: "warn",
        line: `🟠 SONDE C4 NON ARMÉE — ${arming.reason}.`,
      });
      lines.push(`• Watcher C4 : non armée — ${arming.reason}`);
    } else {
      if (report.overall !== "HEALTHY") {
        problems.push({
          // La clé porte le verdict : passer de DEGRADED à CRITICAL change la
          // signature et re-déclenche une alerte, au lieu d'être avalé par
          // l'anti-spam 24h comme « problème déjà signalé ».
          key: `watcher_c4_${report.overall.toLowerCase()}`,
          severity: report.overall === "CRITICAL" ? "crit" : "warn",
          line: probe.formatWatcherHealthReport(report),
        });
      }
      lines.push(
        `• Watcher C4 : ${report.overall} — dernier run sain ` +
          `${report.successfulFreshness ? fmtAge(now - new Date(report.successfulFreshness).getTime()) : "jamais"}` +
          ` (runs LIVE+CRON retenus : ${report.liveCronRunCount}, écartés : ${report.ignoredRunCount})`,
      );
    }
  } catch (e) {
    // Colonnes absentes (42703) = migration JobRunLog pas encore appliquée.
    // C'est un état ATTENDU de la mise en service, pas une panne du watcher :
    // on le nomme précisément au lieu de le noyer dans « ERREUR check ».
    const notMigrated = e.code === "42703";
    problems.push({
      key: notMigrated ? "c4_non_migre" : "c4_err",
      severity: notMigrated ? "warn" : "crit",
      line: notMigrated
        ? `🟠 SONDE C4 NON ARMÉE — la migration JobRunLog n'est pas appliquée (${e.message})`
        : `🔴 Sonde C4 impossible : ${e.message}`,
    });
    lines.push(`• Watcher C4 : ${notMigrated ? "migration absente" : `ERREUR (${e.message})`}`);
  }

  // 1bis. Ancienne mesure — INFORMATIVE, ne décide plus rien.
  //
  // `MAX(discoveredAtUtc)` ne distingue pas une écriture cron d'un backfill
  // manuel : c'est ce qui a masqué le blackout du 17→24 août. On la garde
  // affichée parce qu'elle reste le meilleur moyen, en cas d'alerte C4, de
  // trancher entre « le watcher est mort » (les deux sont vieux) et « le
  // journal est cassé » (C4 crie, mais les signaux sont frais).
  //
  // ⚠️ Le nombre affiché est APPROXIMATIF : `discoveredAtUtc` est
  // `timestamp without time zone` et `pg` le parse dans le fuseau local du
  // process — l'âge est surestimé de l'offset local (8 h depuis Lombok).
  // C'est le défaut SI-01. La sonde C4, elle, lit ses dates via
  // `AT TIME ZONE 'UTC'` et n'en souffre pas.
  try {
    const r = await client.query(
      `SELECT MAX("discoveredAtUtc") AS last FROM social_post_candidates WHERE "sourceProvider"='x_api_v2'`
    );
    const last = r.rows[0]?.last ? new Date(r.rows[0].last).getTime() : null;
    const age = last == null ? null : now - last;
    lines.push(`• Signaux x_api_v2 (indicatif, ±offset local) : dernier il y a ${fmtAge(age)}`);
  } catch (e) {
    lines.push(`• Signaux x_api_v2 : ERREUR check (${e.message})`);
  }

  // 2. Spend cap (lecture de NOTRE table d'estimation, pas d'appel X API)
  //
  // ⚠️ DIVERGENCE DE REPORTING CONNUE (follow-up) — depuis le hotfix
  // xapi-usage-authoritative, la DÉCISION de blocage du watcher se base sur
  // l'usage AUTORITATIF X en POSTS et sur le cycle réel 21→21
  // (GET /2/usage/tweets). Ce check-ci lit encore XApiUsage.totalCostUsd, une
  // ESTIMATION en $ sur une fenêtre CALENDAIRE (date_trunc('month'), reset le
  // 1er) — donc désaligné du cycle X et de la vraie logique de garde-fou. En
  // pratique il SUR-estime en fin de cycle (empile jusqu'à ~20j du cycle
  // précédent) puis SOUS-estime en début de mois. Cette ligne "Spend X API"
  // reste donc un indicateur $ approximatif, NON FIABLE, jusqu'au follow-up qui
  // recalera le watchdog sur l'usage autoritatif (sans casser sa garantie "zéro
  // appel X" — p.ex. via des colonnes que le watcher persiste). Ne pas s'y fier
  // pour un seuil budgétaire tant que ce follow-up n'est pas fait.
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

  // 3. Chaîne de preuve — pièces sans horodatage TSA (CC-OFFLINE-56).
  // Lecture seule. Les pièces créées en serverless naissent tsaToken NULL et
  // sont rattrapées par le job launchd stamp-pending (08:30, avant ce watchdog
  // à 09:00) : N doit donc être ~0 ici. La ligne est TOUJOURS dans le rapport
  // (demande David : voir si N ne redescend pas) ; warn seulement au-delà du
  // seuil WATCHDOG_TSA_PENDING_WARN (déf 50) — filet anti-dérive, pas du bruit.
  try {
    const r = await client.query(
      `SELECT count(*)::int AS n FROM "EvidenceItem" WHERE "tsaToken" IS NULL`
    );
    const n = r.rows[0]?.n ?? 0;
    const warnAt = parseInt(process.env.WATCHDOG_TSA_PENDING_WARN ?? "50", 10);
    if (n >= warnAt) {
      problems.push({
        key: "tsa_pending",
        severity: "warn",
        line: `🟠 TSA pending: ${n} pièce(s) sans horodatage (seuil ${warnAt}) — vérifier le job stamp-pending (launchd Host-001)`,
      });
    }
    lines.push(`• TSA pending: ${n}`);
  } catch (e) {
    lines.push(`• TSA pending: ERREUR check (${e.message})`);
  }

  // 4. Chaîne de preuve — pièces SANS OCTETS. Deux populations à ne JAMAIS
  // confondre, alors qu'elles ont toutes deux r2Key IS NULL :
  //
  //   a) hash-only DÉLIBÉRÉ — commit opérateur où les octets n'ont volontairement
  //      pas été transmis. Notes marquées « HASH-ONLY (bytes non transmis) » par
  //      src/lib/osint/evidenceCommitBridge.ts. Normal, informatif, jamais alertant.
  //
  //   b) ACCIDENTEL — les octets existaient mais evidenceR2ConfigFromEnv() a
  //      renvoyé null (variable R2 mal provisionnée). Marqué [R2:UNAVAILABLE] à
  //      l'insertion par src/lib/evidence-chain/ingest.ts. C'est une preuve sans
  //      pièce jointe : toute valeur > 0 est un problème, pas un seuil à régler.
  //
  // Lecture seule. Le compte (b) alerte dès 1 — contrairement à TSA pending, il
  // n'existe aucun job de rattrapage : les octets sont perdus si la source l'est.
  try {
    //   c) NI L'UN NI L'AUTRE — la classe que les deux filtres laissaient passer.
    //      Une pièce à r2Key IS NULL dont les notes ne portent AUCUN des deux
    //      marqueurs n'était comptée nulle part. Mesuré le 2026-08-18 :
    //      count(*) = 1, accidental = 0, deliberate = 0. Le watchdog annonçait
    //      « 0 accidentel, 0 délibéré » depuis quatre jours, sur une base qui
    //      contenait une pièce orpheline — cmssyx6se… , ingérée le 14 août,
    //      sans octets, sans marqueur, et sans la moindre ligne dans
    //      EvidenceAccessLog, pas même son INGEST.
    //
    //      Deux catégories nommées ne font pas un inventaire. Le total, si.
    //      C'est lui qui rend l'écart visible, et l'écart est la seule chose
    //      qui signale ce que personne n'a pensé à nommer.
    //
    //      ⚠️ CE COMPTEUR CONDITIONNE LA SÛRETÉ D'ACTIVER LA TSA. Un horodatage
    //      posé sur une pièce orpheline la rend indiscernable d'une pièce
    //      complète : elle porterait un jeton TSA valide sur un contenu absent.
    //      Tant que l'écart n'est pas à zéro — ou expliqué — ne pas configurer
    //      TSA_PRIMARY_URL / TSA_URL_FALLBACK.
    const r = await client.query(
      `SELECT
         count(*)::int                                                  AS total,
         count(*) FILTER (WHERE "notes" LIKE '[R2:UNAVAILABLE]%')::int AS accidental,
         count(*) FILTER (WHERE "notes" LIKE '%HASH-ONLY%')::int        AS deliberate
       FROM "EvidenceItem"
       WHERE "r2Key" IS NULL`
    );
    const total = r.rows[0]?.total ?? 0;
    const accidental = r.rows[0]?.accidental ?? 0;
    const deliberate = r.rows[0]?.deliberate ?? 0;
    // Une pièce peut porter les DEUX marqueurs ; l'écart se calcule donc sur
    // le total moins les pièces qui en portent au moins un, pas sur la somme
    // des deux compteurs — sinon un double marquage rendrait l'écart négatif
    // et masquerait un orphelin réel.
    const nomme = await client.query(
      `SELECT count(*)::int AS n FROM "EvidenceItem"
        WHERE "r2Key" IS NULL
          AND ("notes" LIKE '[R2:UNAVAILABLE]%' OR "notes" LIKE '%HASH-ONLY%')`
    );
    const orphelins = total - (nomme.rows[0]?.n ?? 0);
    if (orphelins > 0) {
      problems.push({
        key: "evidence_orphan_no_marker",
        severity: "crit",
        line:
          `🔴 EVIDENCE ORPHELINE — ${orphelins} pièce(s) sans octets ET SANS MARQUEUR ` +
          `(total sans r2Key ${total}, dont ${accidental} [R2:UNAVAILABLE] et ` +
          `${deliberate} hash-only). Ni accidentelles ni délibérées : personne ne ` +
          `sait pourquoi elles n'ont pas d'octets. NE PAS activer la TSA tant que ` +
          `cet écart n'est pas à zéro — un horodatage les rendrait indiscernables ` +
          `d'une pièce complète.`,
      });
    }
    if (accidental > 0) {
      problems.push({
        key: "evidence_no_bytes",
        severity: "crit",
        line:
          `🔴 EVIDENCE SANS OCTETS — ${accidental} pièce(s) [R2:UNAVAILABLE] : les octets ` +
          `existaient mais n'ont pas été archivés (config R2 injoignable). Vérifier ` +
          `R2_ACCOUNT_ID / R2_EVIDENCE_* / R2_* en Production. Aucun job ne rattrape.`,
      });
    }
    lines.push(
      `• Evidence sans octets : ${total} au total — ${accidental} accidentel(s) [R2:UNAVAILABLE], ` +
      `${deliberate} hash-only délibéré(s), ${orphelins} SANS MARQUEUR`
    );
  } catch (e) {
    lines.push(`• Evidence sans octets : ERREUR check (${e.message})`);
  }

  // 5. Péremption des sources d'intelligence réglementaire.
  //
  // POURQUOI CE CHECK EXISTE — TigerScore applique un floor 15 sur match OFAC
  // (scorer.ts) et matchEntity ne filtre QUE sur listIsActive : il n'existe
  // aucune notion d'âge dans le calcul, ni TTL, ni décote, ni avertissement.
  // Une observation OFAC de 133 jours a été mesurée le 2026-08-14 en train de
  // modifier un score en direct (80 → 72), sans que rien ne signale sa
  // vétusté. La donnée périmée ne se voit donc NULLE PART dans le produit :
  // c'est le seul endroit où on peut la voir.
  //
  // Le seuil est par palier de source : une liste de sanctions se démode plus
  // vite qu'un flux communautaire de domaines de phishing.
  try {
    const r = await client.query(
      `SELECT "sourceSlug",
              max("ingestedAt")                                    AS last,
              (now()::date - max("ingestedAt")::date)::int          AS age_days
         FROM intel_source_observations
        GROUP BY "sourceSlug"`
    );

    if (r.rows.length === 0) {
      problems.push({
        key: "intel_empty",
        severity: "crit",
        line: `🔴 INTEL VAULT VIDE — aucune observation. Le floor OFAC de TigerScore ne peut plus se déclencher.`,
      });
      lines.push(`• Intel sources : AUCUNE observation`);
    } else {
      const stale = [];
      for (const row of r.rows) {
        const slug = row.sourceSlug;
        const age = Number(row.age_days);
        const limit = INTEL_MAX_AGE_DAYS[slug] ?? INTEL_MAX_AGE_DAYS_DEFAULT;
        if (age > limit) stale.push({ slug, age, limit });
      }

      // Une source réglementaire périmée est CRITIQUE : le produit rend des
      // verdicts « pas de sanction » qui ne veulent rien dire.
      const staleTier1 = stale.filter((x) => INTEL_TIER1_SLUGS.has(x.slug));
      if (staleTier1.length > 0) {
        problems.push({
          key: "intel_stale_tier1",
          severity: "crit",
          line:
            `🔴 SOURCE RÉGLEMENTAIRE PÉRIMÉE — ` +
            staleTier1.map((x) => `${x.slug} ${x.age}j (seuil ${x.limit}j)`).join(", ") +
            `. TigerScore applique un floor sur ces listes ET ne contrôle aucune fraîcheur : ` +
            `les verdicts « pas de sanction » ne sont plus fiables.`,
        });
      }
      const staleOther = stale.filter((x) => !INTEL_TIER1_SLUGS.has(x.slug));
      if (staleOther.length > 0) {
        problems.push({
          key: "intel_stale",
          severity: "warn",
          line:
            `⚠️ Source intel périmée — ` +
            staleOther.map((x) => `${x.slug} ${x.age}j (seuil ${x.limit}j)`).join(", "),
        });
      }

      const summary = r.rows
        .map((row) => `${row.sourceSlug} ${Number(row.age_days)}j`)
        .sort()
        .join(", ");
      lines.push(`• Intel sources : ${summary}`);
    }
  } catch (e) {
    lines.push(`• Intel sources : ERREUR check (${e.message})`);
  }

  // 6. Batches d'ingestion restés « running ».
  //
  // Trois batches d'avril 2026 (2 ofac, 1 scamsniffer) n'ont jamais été
  // clôturés : le run a dépassé la fenêtre serverless et personne ne l'a su —
  // aucun timeout, aucune reprise. Un batch zombie ressemble à un import en
  // cours, indéfiniment.
  try {
    const r = await client.query(
      `SELECT count(*)::int AS n
         FROM intel_ingestion_batches
        WHERE status = 'running'
          AND "startedAt" < now() - interval '1 hour'`
    );
    const zombies = Number(r.rows[0]?.n ?? 0);
    if (zombies > 0) {
      problems.push({
        key: "intel_zombie_batch",
        severity: "warn",
        line:
          `⚠️ ${zombies} batch(es) d'ingestion intel bloqué(s) en 'running' depuis >1h — ` +
          `run dépassé hors fenêtre serverless, jamais clôturé.`,
      });
    }
    lines.push(`• Batches intel zombies : ${zombies}`);
  } catch (e) {
    lines.push(`• Batches intel zombies : ERREUR check (${e.message})`);
  }

  // Canal email digest (Resend) : ABANDONNÉ le 2026-06-25 au profit de
  // Telegram comme unique canal d'alerte. L'ancien check #3 lisait la
  // dernière ligne WatcherDigest, mais il n'y en a qu'UNE (2026-05-09,
  // error_fetch ponctuel) et WATCHER_EMAIL_MODE n'est plus "digest" →
  // il affichait éternellement un ⚠️ périmé sans valeur. Retiré.

  return { problems, lines };
}

// --- Connexion + checks avec retries (anti-faux-positif réseau) ---------------
// Retente connect()+runChecks jusqu'à DB_MAX_ATTEMPTS fois. Les checks sont
// 100% lecture (SELECT) et idempotents, donc sûrs à rejouer. Ne throw QUE si
// toutes les tentatives échouent (=> vraie panne DB, alerte légitime).
async function connectAndCheck() {
  let lastErr;
  for (let attempt = 1; attempt <= DB_MAX_ATTEMPTS; attempt++) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    });
    try {
      await client.connect();
      try {
        return await runChecks(client);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    } catch (e) {
      lastErr = e;
      try {
        await client.end();
      } catch {}
      if (attempt < DB_MAX_ATTEMPTS) {
        const wait = DB_RETRY_BACKOFF_MS[attempt - 1] ?? 5000;
        console.error(
          `[watchdog] tentative connexion DB ${attempt}/${DB_MAX_ATTEMPTS} échouée: ` +
            `${e.code || ""} ${e.message} — retry dans ${(wait / 1000).toFixed(0)}s`
        );
        await sleep(wait);
      } else {
        console.error(
          `[watchdog] tentative connexion DB ${attempt}/${DB_MAX_ATTEMPTS} échouée: ` +
            `${e.code || ""} ${e.message} — abandon.`
        );
      }
    }
  }
  throw lastErr;
}

// --- Main --------------------------------------------------------------------
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[watchdog] DATABASE_URL manquant — abandon.");
    process.exit(1);
  }

  let result;
  try {
    result = await connectAndCheck();
  } catch (e) {
    // Échec de connexion DB après toutes les tentatives = vraie anomalie.
    console.error(
      `[watchdog] échec connexion/checks DB après ${DB_MAX_ATTEMPTS} tentatives:`,
      e.message
    );
    await sendTelegram(
      `🔴 WATCHDOG — échec d'accès à la DB (après ${DB_MAX_ATTEMPTS} tentatives) : ${e.message}`
    );
    process.exit(1);
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
