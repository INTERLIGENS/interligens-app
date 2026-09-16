#!/usr/bin/env node
/**
 * SONDE D'AUTHENTIFICATION — AUTORITÉ NEON
 * CC-OFFLINE-228 · fenêtre de rotation du mot de passe de production
 *
 * ─── OBJET, ET RIEN D'AUTRE ─────────────────────────────────────────────────
 *
 * Établir si une paire (identité, mot de passe) est ACCEPTÉE ou REFUSÉE par
 * l'autorité Neon. Pas l'état du schéma, pas le contenu d'une table, pas la
 * santé applicative. Une requête, bornée : SELECT 1.
 *
 * Fichier NEUF. Les trois sondes du dépôt sont HTTP (`sonde-basic-auth.mjs`,
 * `sonde-admin-basic.mjs`, `sonde-cron-bearer.mjs`) et aucune ne parle à une
 * base. Aucune n'est mutée — la règle qui les a préservées trois fois depuis
 * le 15/09.
 *
 * ─── LE PIÈGE QUE CETTE SONDE EXISTE POUR ÉVITER ────────────────────────────
 *
 * REFUSED n'est admissible que sur un refus d'AUTHENTIFICATION caractérisé,
 * c'est-à-dire un SQLSTATE de la classe 28 rendu par le serveur lui-même. Un
 * délai dépassé, un DNS en échec, un réseau injoignable, un refus de TLS sont
 * INCONCLUSIVE — jamais REFUSED. C'est la même règle qu'en HTTP : un refus
 * d'intermédiaire n'est pas une mesure. Sans cette distinction, débrancher le
 * Wi-Fi « prouverait » qu'un credential est révoqué.
 *
 * ─── AUCUNE VALEUR, AUCUNE URL, AUCUN MESSAGE DE PILOTE ─────────────────────
 *
 * Entrées par CHEMIN DE FICHIER ou par service du TROUSSEAU, jamais par valeur,
 * jamais par argv. Ne sortent que : ACCEPTED / REFUSED / INCONCLUSIVE et une
 * classe d'erreur normalisée. Le message du pilote n'est JAMAIS imprimé — il
 * contient couramment l'hôte, l'utilisateur, parfois la chaîne entière. Seuls
 * le SQLSTATE (cinq caractères) ou le code système (`ENOTFOUND`, `ETIMEDOUT`…)
 * en sortent. Un crible anti-fuite relit la sortie avant affichage.
 *
 * ─── ENTRÉES ────────────────────────────────────────────────────────────────
 *
 *   SONDE_DB_URL_FILE       fichier portant DATABASE_URL (forme dotenv), ou
 *                           fichier ne contenant que l'URL
 *   SONDE_DB_URL_KEYCHAIN   — alternative, préférée : nom de service du
 *                           Trousseau. Lue en mémoire, rien sur le disque.
 *   SONDE_ATTENDU           accepte | refuse   — ce qu'on attend de cette URL
 *
 * ─── LES DEUX JAMBES ────────────────────────────────────────────────────────
 *
 *   [1] CANARI  — la MÊME URL dont le seul mot de passe est remplacé par un
 *                 aléa de 32 octets généré en mémoire. Il DOIT être REFUSED.
 *                 Sans lui, un « REFUSED » ne se distingue pas d'une autorité
 *                 en panne, et un « ACCEPTED » ne prouve pas que l'instrument
 *                 sait échouer.
 *   [2] SOUS TEST — l'URL telle quelle.
 *
 * Le canari passe EN PREMIER : si l'autorité accepte n'importe quoi, rien de
 * ce qui suit n'est interprétable.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const DEPOT = "/Users/dood/dev/interligens-web";
const require_ = createRequire(`${DEPOT}/noop.js`);

const DELAI_MS = 10_000;

const tampon = [];
const P = (s = "") => tampon.push(s);
const VALEURS = new Set();

function imprimerOuRefuser(code) {
  const texte = tampon.join("\n");
  for (const v of VALEURS) {
    if (v && v.length >= 8 && texte.includes(v)) {
      process.stdout.write(
        "\n  ⛔ CRIBLE ANTI-FUITE : une valeur figure dans la sortie. Rien n'est imprimé.\n\n",
      );
      process.exit(9);
    }
  }
  process.stdout.write(texte + "\n");
  process.exit(code);
}

function refus(...lignes) {
  P("");
  for (const l of lignes) P(`  ${l}`);
  P("");
  P("  SONDE NON EXÉCUTÉE — fail-closed. Aucun résultat n'est rendu.");
  P("");
  imprimerOuRefuser(2);
}

/**
 * Le marqueur d'hôte de la base de production n'est PAS recopié ici : il est
 * extrait de sa source unique, `src/lib/ops/prodWriteGuard.ts`. Une constante
 * dupliquée diverge le jour où l'une des deux change ; extraction en échec ⇒
 * la sonde refuse de partir plutôt que de deviner.
 */
function marqueurHoteProd() {
  try {
    const src = readFileSync(`${DEPOT}/src/lib/ops/prodWriteGuard.ts`, "utf8");
    const m = /PROD_DB_HOST_MARKER\s*=\s*"([^"]+)"/.exec(src);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function lireFichier(chemin, cle) {
  if (!chemin || !existsSync(chemin)) return null;
  let brut;
  try {
    if (!statSync(chemin).isFile()) return null;
    brut = readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
  for (const ligne of brut.split("\n")) {
    const m = new RegExp(`^\\s*(?:export\\s+)?${cle}\\s*=\\s*(.*)$`).exec(ligne);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v.length ? { valeur: v, forme: "clé de fichier d'environnement" } : null;
  }
  const seul = brut.trim();
  if (!seul.length || seul.includes("\n")) return null;
  return { valeur: seul, forme: "fichier à valeur unique" };
}

function lireTrousseau(service) {
  if (!service) return null;
  const r = spawnSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w"], {
    encoding: "utf8",
  });
  if (r.status !== 0) return null;
  const v = (r.stdout ?? "").replace(/\n$/, "");
  return v.length ? { valeur: v, forme: "Trousseau macOS (jamais sur disque)" } : null;
}

// ── Entrées ────────────────────────────────────────────────────────────────

const fUrl = process.env.SONDE_DB_URL_FILE ?? "";
const kUrl = process.env.SONDE_DB_URL_KEYCHAIN ?? "";
const attendu = process.env.SONDE_ATTENDU ?? "";

P("");
P("  SONDE D'AUTHENTIFICATION — AUTORITÉ NEON · CC-OFFLINE-228");
P("");

if (!["accepte", "refuse"].includes(attendu)) {
  refus(`⛔ SONDE_ATTENDU doit valoir « accepte » ou « refuse » (reçu : ${attendu || "rien"}).`);
}
if (!fUrl && !kUrl) refus("⛔ Ni SONDE_DB_URL_FILE ni SONDE_DB_URL_KEYCHAIN : rien à mesurer.");
if (fUrl && kUrl) refus("⛔ SONDE_DB_URL_FILE et SONDE_DB_URL_KEYCHAIN posées toutes deux. L'une ou l'autre.");

const src = fUrl ? lireFichier(fUrl, "DATABASE_URL") : lireTrousseau(kUrl);
if (!src) refus("⛔ URL absente, vide ou illisible. Sans elle, il n'y a rien à mesurer.");
VALEURS.add(src.valeur);

let u;
try {
  u = new URL(src.valeur);
} catch {
  refus("⛔ L'entrée n'est pas une URL de connexion analysable.");
}
if (!/^postgres(ql)?:$/.test(u.protocol)) refus("⛔ L'URL n'est pas une URL PostgreSQL.");
if (!u.password) refus("⛔ L'URL ne porte aucun mot de passe : il n'y a pas de paire à éprouver.");
VALEURS.add(u.password);

const marqueur = marqueurHoteProd();
if (!marqueur) {
  refus("⛔ PROD_DB_HOST_MARKER introuvable dans src/lib/ops/prodWriteGuard.ts — refus de deviner l'hôte attendu.");
}
if (!u.hostname.includes(marqueur)) {
  refus(
    "⛔ L'hôte de l'URL ne porte pas le marqueur de la base de production.",
    "   Cette fenêtre ne vise qu'UNE identité ; une seconde base est hors périmètre.",
  );
}

let Client;
try {
  ({ Client } = require_("pg"));
} catch {
  refus("⛔ Pilote `pg` indisponible — la sonde ne fabrique pas de repli.");
}

// ── La mesure ──────────────────────────────────────────────────────────────

/**
 * Une jambe. Rend un verdict et une CLASSE, jamais un message.
 *
 * Classe 28 = refus d'authentification rendu par le serveur — 28P01 mot de
 * passe invalide, 28000 autorisation invalide. C'est le SEUL refus admissible.
 * Tout le reste — réseau, DNS, TLS, délai, base inexistante — est INCONCLUSIVE.
 */
async function jambe(etiquette, url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: DELAI_MS,
    query_timeout: DELAI_MS,
    statement_timeout: DELAI_MS,
    application_name: "interligens-sonde-db-auth",
  });
  let verdict = "INCONCLUSIVE";
  let classe = "";
  try {
    await client.connect();
    await client.query("SELECT 1");
    verdict = "ACCEPTED";
    classe = "connexion établie, SELECT 1 rendu";
  } catch (e) {
    // ⛔ e.message n'est JAMAIS lu : il porte couramment l'hôte, l'utilisateur,
    //    parfois la chaîne de connexion entière.
    const sqlstate = typeof e?.code === "string" && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : null;
    const sys = typeof e?.code === "string" && !sqlstate ? e.code : null;
    if (sqlstate && sqlstate.startsWith("28")) {
      verdict = "REFUSED";
      classe = `refus d'authentification du serveur · SQLSTATE ${sqlstate}`;
    } else if (sqlstate) {
      classe = `erreur serveur non liée à l'authentification · SQLSTATE ${sqlstate}`;
    } else if (sys) {
      classe = `échec de transport · ${sys}`;
    } else {
      classe = "échec non classé (message délibérément non lu)";
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* fermeture explicite ; un échec de fermeture n'est pas une mesure */
    }
  }
  P(`  ${etiquette.padEnd(22)} → ${verdict.padEnd(12)} ${classe}`);
  return verdict;
}

// [1] CANARI — même URL, mot de passe remplacé par un aléa en mémoire.
const canari = new URL(src.valeur);
canari.password = randomBytes(32).toString("hex");

P(`  Entrée   ${src.forme}`);
P(`  Hôte     marqueur « ${marqueur} » vérifié (hôte complet jamais imprimé)`);
P(`  Attendu  l'URL sous test doit être ${attendu === "accepte" ? "ACCEPTED" : "REFUSED"}`);
P("");

const vCanari = await jambe("[1] CANARI (aléa)", canari.toString());
if (vCanari !== "REFUSED") {
  P("");
  P("  ⛔ SONDE NULLE — un mot de passe aléatoire n'est pas refusé par un refus");
  P("     d'authentification caractérisé. Ne RIEN conclure de la jambe suivante.");
  imprimerOuRefuser(4);
}

const vTest = await jambe("[2] SOUS TEST", src.valeur);
P("");

if (vTest === "INCONCLUSIVE") {
  P("  ⛔ NON CONCLUANT sur l'URL sous test. Aucun verdict ne se rend là-dessus.");
  imprimerOuRefuser(4);
}
if (attendu === "accepte") {
  if (vTest === "ACCEPTED") {
    P("  ✅ LIGNE DE BASE CONFORME — l'autorité accepte cette paire et refuse un aléa.");
    P("     L'instrument sait RÉUSSIR et ÉCHOUER.");
    imprimerOuRefuser(0);
  }
  P("  ⛔ REFUSÉE ALORS QU'ELLE ÉTAIT ATTENDUE ACCEPTÉE — entrée mal résolue, ou");
  P("     paire déjà révoquée. STOP : ne rien reset.");
  imprimerOuRefuser(1);
}
if (vTest === "REFUSED") {
  P("  ✅ RÉVOCATION ÉTABLIE — l'autorité refuse cette paire.");
  P("     Portée : CETTE identité, CETTE autorité, CET instant.");
  imprimerOuRefuser(0);
}
P("  ⛔ ENCORE ACCEPTÉE ALORS QU'ELLE ÉTAIT ATTENDUE REFUSÉE. La rotation n'a rien fermé. STOP.");
imprimerOuRefuser(1);
