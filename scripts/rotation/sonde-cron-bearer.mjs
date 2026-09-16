#!/usr/bin/env node
/**
 * SONDE D'INVALIDATION SERVIE — CRON_SECRET (Bearer)
 * CC-OFFLINE-226 · fenêtre de rotation CRON_SECRET
 *
 * ─── POURQUOI UN FICHIER NEUF ───────────────────────────────────────────────
 *
 * La sonde qui a produit la mesure de référence du 2026-09-15 à 17:05 UTC
 * (NO CREDENTIAL 401 · OLD 200 · NEW 401) n'a JAMAIS été commitée : elle vit
 * dans le bac de session, et `scripts/rotation/` ne contient que
 * `cartographie-vercel.mjs`, `sonde-basic-auth.mjs` et `sonde-admin-basic.mjs`.
 * Il n'y avait donc rien à réutiliser au dépôt.
 *
 * Elle n'est pas non plus MUTÉE : ses entrées sont des sources codées en dur
 * (.env, .env.local, deux entrées de Trousseau), et la fenêtre impose des
 * CHEMINS passés en variables d'environnement. La faire muter détruirait la
 * correspondance avec la mesure de référence. Son raisonnement est repris ici
 * intégralement ; son fichier reste intact. C'est la règle qui a préservé
 * `sonde-basic-auth.mjs` le 15/09 au soir.
 *
 * ─── CE QU'ELLE MESURE ──────────────────────────────────────────────────────
 *
 * L'autorité SERVIE, jamais l'autorité de CONFIGURATION. Deux mesures du 15/09
 * l'imposent, prises par les deux bouts :
 *   · CRON_SECRET  — la configuration avait changé, le service NON ;
 *   · ADMIN_BASIC_PASS — `vercel env ls` affichait `created = 192d` APRÈS un
 *     override réussi : la colonne `created` n'est pas un témoin de rotation.
 * La CLI fait autorité sur l'écriture. Cette sonde fait autorité sur le service.
 *
 * ─── DEUX TEMPS, ET LE PREMIER N'EST PAS FACULTATIF ─────────────────────────
 *
 *   SONDE_ATTENDU=ligne-de-base  AVANT toute écriture : OLD doit être ACCEPTED
 *                                et NEW REFUSED. Prouve que l'instrument sait
 *                                réussir ET échouer sur ces entrées.
 *   SONDE_ATTENDU=preuve         APRÈS le déploiement : les deux s'inversent.
 *
 * Sans la ligne de base, `OLD → REFUSED` après coup ne prouve RIEN : une entrée
 * mal résolue rend exactement le même verdict.
 *
 * ─── ENTRÉES — DES CHEMINS, JAMAIS DES VALEURS ──────────────────────────────
 *
 *   SONDE_TARGET_URL          cible sous /api/cron/
 *   SONDE_SECRET_OLD_FILE     fichier portant l'ANCIENNE valeur
 *   SONDE_SECRET_NEW_FILE     fichier portant la NOUVELLE valeur
 *   SONDE_SECRET_OLD_KEYCHAIN   — alternatives aux deux ci-dessus : nom de
 *   SONDE_SECRET_NEW_KEYCHAIN     service du Trousseau. La valeur est lue EN
 *                                 MÉMOIRE par ce processus, ce qui évite de
 *                                 matérialiser un secret en clair sur le
 *                                 disque. Pour chaque côté : l'une ou l'autre,
 *                                 jamais les deux.
 *   SONDE_ATTENDU             ligne-de-base | preuve   (défaut : preuve)
 *
 * Deux formes de fichier acceptées : fichier d'environnement portant
 * `CRON_SECRET=`, ou fichier ne contenant que la valeur.
 *
 * L'en-tête Authorization est construit EN MÉMOIRE : jamais d'argv, jamais
 * d'interpolation dans une URL, jamais de journalisation. Le corps n'est lu que
 * sur 2xx, et seuls `created` et `alreadyPresent` en sortent — ils sont la
 * preuve d'exécution. Crible anti-fuite sur la sortie complète.
 *
 * ─── L'EXÉCUTION MÉTIER, DITE PLUTÔT QUE SOUS-ENTENDUE ──────────────────────
 *
 * Le garde CRON n'est pas un garde de préfixe : chaque route porte sa propre
 * copie locale de `verifyCronSecret`, DANS le handler. Il n'existe donc aucun
 * chemin sans gestionnaire où le mesurer — contrairement à /api/admin. La jambe
 * ACCEPTÉE exécute réellement le handler. C'est assumé, et seulement parce que
 * la cible est idempotente par la base.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const UA = "interligens-sonde-cron-bearer/1 (CC-OFFLINE-226)";
const DELAI_REFUS_MS = 30_000;
const DELAI_EXEC_MS = 75_000; // maxDuration = 60 s côté route

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

const cible = process.env.SONDE_TARGET_URL ?? "";
const fOld = process.env.SONDE_SECRET_OLD_FILE ?? "";
const kOld = process.env.SONDE_SECRET_OLD_KEYCHAIN ?? "";
const fNew = process.env.SONDE_SECRET_NEW_FILE ?? "";
const kNew = process.env.SONDE_SECRET_NEW_KEYCHAIN ?? "";
const attendu = process.env.SONDE_ATTENDU ?? "preuve";

P("");
P("  SONDE D'INVALIDATION SERVIE — CRON_SECRET (Bearer) · CC-OFFLINE-226");
P("");

if (!["ligne-de-base", "preuve"].includes(attendu)) {
  refus(`⛔ SONDE_ATTENDU doit valoir « ligne-de-base » ou « preuve » (reçu : ${attendu}).`);
}
if (!cible) refus("⛔ Variable absente : SONDE_TARGET_URL.");
if (!fOld && !kOld) {
  refus("⛔ Ni SONDE_SECRET_OLD_FILE ni SONDE_SECRET_OLD_KEYCHAIN : rien à distinguer.");
}
if (fOld && kOld) {
  refus("⛔ SONDE_SECRET_OLD_FILE et SONDE_SECRET_OLD_KEYCHAIN sont toutes deux posées. L'une ou l'autre.");
}
if (!fNew && !kNew) {
  refus("⛔ Ni SONDE_SECRET_NEW_FILE ni SONDE_SECRET_NEW_KEYCHAIN : aucun contrôle positif possible.");
}
if (fNew && kNew) {
  refus("⛔ SONDE_SECRET_NEW_FILE et SONDE_SECRET_NEW_KEYCHAIN sont toutes deux posées. L'une ou l'autre.");
}

let url;
try {
  url = new URL(cible);
} catch {
  refus("⛔ SONDE_TARGET_URL n'est pas une URL absolue.");
}
if (url.protocol !== "https:") refus("⛔ SONDE_TARGET_URL doit être en https.");
if (!url.pathname.startsWith("/api/cron/") && !url.pathname.startsWith("/api/intelligence/ingest/")) {
  refus(
    "⛔ La cible n'est pas un chemin planifié — le garde CRON n'y est pas invoqué.",
    `   reçu : ${url.pathname}`,
  );
}

const old = fOld ? lireFichier(fOld, "CRON_SECRET") : lireTrousseau(kOld);
const nouveau = fNew ? lireFichier(fNew, "CRON_SECRET") : lireTrousseau(kNew);

const absents = [
  ["ANCIENNE", old],
  ["NOUVELLE", nouveau],
].filter(([, v]) => !v).map(([n]) => n);
if (absents.length) {
  refus(
    `⛔ Valeur absente, vide ou illisible : ${absents.join(", ")}.`,
    "   Sans les deux, il n'y a ni refus à distinguer ni contrôle positif.",
  );
}
VALEURS.add(old.valeur);
VALEURS.add(nouveau.valeur);

if (old.valeur === nouveau.valeur) {
  refus(
    "⛔ ANCIENNE et NOUVELLE valeurs sont IDENTIQUES.",
    "   Il n'y a rien à mesurer : cette valeur se rote, elle ne se sonde pas.",
  );
}

// ── Garde d'heure ──────────────────────────────────────────────────────────
// Le cron de référence tombe à HH:00:35 UTC. Sonder à cheval mélangerait deux
// exécutions dans les mêmes compteurs et rendrait la non-régression illisible.
const now = new Date();
const mn = now.getUTCMinutes();
if ((mn === 59 || mn === 0 || mn === 1) && !process.env.SONDE_FORCER_HEURE) {
  refus(
    "⛔ REFUS DE PARTIR — heure pleine.",
    `Il est ${now.toISOString().slice(11, 19)} UTC ; le cron de référence passe à HH:00:35.`,
    "Attendre HH:02 UTC.",
  );
}

P(`  Cible    ${url.origin}${url.pathname}`);
P(`  Attendu  ${attendu === "ligne-de-base" ? "LIGNE DE BASE — OLD accepté, NEW refusé" : "PREUVE — OLD refusé, NEW accepté"}`);
P(`  Entrées  ancienne : ${old.forme} · nouvelle : ${nouveau.forme}`);
P("           (aucune valeur n'est lue à l'écran, ni ici ni ailleurs)");
P("");

// ── Les trois requêtes ─────────────────────────────────────────────────────

async function jambe(etiquette, secret, peutExecuter) {
  const u = new URL(url.toString());
  u.searchParams.set("sonde", randomBytes(6).toString("hex"));

  const entetes = { "user-agent": UA, accept: "application/json" };
  if (secret !== null) entetes.authorization = `Bearer ${secret}`;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), peutExecuter ? DELAI_EXEC_MS : DELAI_REFUS_MS);
  let code = null;
  let compteurs = null;
  let incident = null;
  try {
    const rep = await fetch(u, {
      method: "GET",
      headers: entetes,
      redirect: "manual",
      signal: ctl.signal,
    });
    code = rep.status;
    if (code >= 200 && code < 300) {
      try {
        const j = await rep.json();
        compteurs = { created: j?.created ?? null, alreadyPresent: j?.alreadyPresent ?? null };
      } catch {
        compteurs = null;
      }
    }
    // 401 / 403 / 3xx / 5xx : le corps n'est JAMAIS lu.
  } catch (e) {
    incident = e?.name === "AbortError" ? "délai dépassé" : "requête non aboutie";
  } finally {
    clearTimeout(t);
  }

  let verdict;
  let note = "";
  if (incident) verdict = "INCONCLUSIVE";
  else if (code === 401) verdict = "REFUSED";
  else if (code >= 200 && code < 300) verdict = "ACCEPTED";
  else if (code === 403) {
    // Ratifié pour CETTE cible : prodWriteGuardResponse s'exécute APRÈS
    // verifyCronSecret. Un 403 signifie que l'authentification a été FRANCHIE.
    verdict = "ACCEPTED";
    note = " — authentification franchie, garde d'écriture production";
  } else verdict = "INCONCLUSIVE"; // 3xx, 5xx, tout le reste

  P(`  ${etiquette.padEnd(14)} → ${verdict.padEnd(12)} (${incident ?? code})${note}`);
  if (compteurs) {
    P(`      └ exécution réelle : created=${compteurs.created}  alreadyPresent=${compteurs.alreadyPresent}`);
  }
  return verdict;
}

const vNone = await jambe("NO CREDENTIAL", null, false);
const vOld = await jambe("OLD", old.valeur, true);
const vNew = await jambe("NEW", nouveau.valeur, true);

P("");

// ── Lecture ────────────────────────────────────────────────────────────────

if (vNone !== "REFUSED") {
  P("  ⛔ SONDE NULLE — la porte vive ne rend pas 401 sur ce chemin.");
  P("     Le garde ne s'exécute pas : ne RIEN conclure, vérifier le déploiement servi.");
  imprimerOuRefuser(4);
}
if (vOld === "INCONCLUSIVE" || vNew === "INCONCLUSIVE") {
  P(`  ⛔ NON CONCLUANT — OLD=${vOld}, NEW=${vNew}. Aucun verdict ne se rend là-dessus.`);
  imprimerOuRefuser(4);
}

if (attendu === "ligne-de-base") {
  if (vOld === "ACCEPTED" && vNew === "REFUSED") {
    P("  ✅ LIGNE DE BASE CONFORME — l'ancienne valeur est servie, la nouvelle ne l'est pas.");
    P("     L'instrument sait RÉUSSIR et ÉCHOUER sur ces entrées. La fenêtre peut s'ouvrir.");
    imprimerOuRefuser(0);
  }
  if (vOld === "REFUSED") {
    P("  ⛔ OLD REFUSÉ EN LIGNE DE BASE — la sonde ne mesure rien.");
    P("     Entrée mal résolue, ou cible non gardée. STOP : ne rien écrire, ne rien déployer.");
    imprimerOuRefuser(1);
  }
  P("  ⛔ NEW DÉJÀ ACCEPTÉ EN LIGNE DE BASE — contredit l'état déclaré. STOP.");
  imprimerOuRefuser(1);
}

if (vOld === "REFUSED" && vNew === "ACCEPTED") {
  P("  ✅ INVALIDATION SERVIE ÉTABLIE — ancienne refusée, nouvelle acceptée.");
  P("     Portée : CE runtime, CE chemin, CET instant. Les runtimes historiques");
  P("     ne sont pas concernés et continuent d'accepter l'ancienne valeur.");
  imprimerOuRefuser(0);
}
if (vOld === "ACCEPTED") {
  P("  ⛔ ANCIENNE VALEUR ENCORE ACCEPTÉE — la bascule n'a pas pris. STOP.");
  imprimerOuRefuser(1);
}
P("  ⛔ NOUVELLE VALEUR REFUSÉE — le runtime servi ne la porte pas. STOP.");
imprimerOuRefuser(1);
