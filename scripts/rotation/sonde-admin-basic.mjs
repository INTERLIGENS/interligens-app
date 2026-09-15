#!/usr/bin/env node
/**
 * SONDE D'INVALIDATION SERVIE — ADMIN_BASIC_PASS
 * CC-OFFLINE-224 · exécutée par le FONDATEUR, jamais par l'agent.
 *
 * ─── CE QU'ELLE MESURE ──────────────────────────────────────────────────────
 *
 * L'autorité SERVIE : ce que le runtime canonique accepte réellement. Pas
 * l'autorité de CONFIGURATION, qui est ce que le panneau Vercel contient.
 * Mesuré le 2026-09-15 sur CRON_SECRET : les deux ont divergé, et l'ancienne
 * valeur ouvrait toujours la porte alors que la configuration portait la
 * nouvelle. « Valeur changée » n'a jamais valu révocation.
 *
 * Mesuré le même soir sur ADMIN_BASIC_PASS : `vercel env ls` affiche toujours
 * `created = 192d` APRÈS un override réussi — un remplacement en place préserve
 * l'horodatage de création. **La colonne `created` n'est pas un témoin de
 * rotation.** La CLI fait autorité sur l'écriture, cette sonde sur le service.
 *
 * ─── POURQUOI UN FICHIER NEUF PLUTÔT QUE `sonde-basic-auth.mjs` ─────────────
 *
 * CC-OFFLINE-218 a livré une sonde Basic dont le raisonnement de cible est
 * repris ici intégralement. Elle n'est pas modifiée : elle est couverte par
 * `__tests__/security/sonde-basic-auth.test.ts`, qui vérifie ses trois
 * prémisses de cible. La faire muter pour changer son interface d'entrée
 * casserait un témoin anti-régression au milieu d'une fenêtre de mesure. Le
 * raisonnement est réutilisé, le fichier éprouvé est laissé intact.
 *
 * ─── AUCUNE VALEUR NE TRANSITE PAR L'AGENT ─────────────────────────────────
 *
 * Les entrées sont des CHEMINS DE FICHIERS, jamais des valeurs :
 *
 *   SONDE_USER_FILE       fichier portant ADMIN_BASIC_USER
 *   SONDE_PASS_OLD_FILE   fichier portant l'ANCIENNE valeur
 *   SONDE_PASS_NEW_FILE   fichier portant la NOUVELLE valeur
 *   SONDE_TARGET_URL      cible sous /api/admin — JAMAIS auth/login
 *
 * Chaque fichier est accepté sous deux formes, pour n'obliger à recopier aucun
 * secret nulle part : soit un fichier d'environnement portant la clé attendue
 * (`.env`, `.env.local`), soit un fichier ne contenant que la valeur. La
 * première forme est préférable — elle n'écrit aucune copie sur disque.
 *
 * L'en-tête Authorization est construit EN MÉMOIRE et passé à `fetch`. Jamais
 * d'argv (`curl -u` inscrirait le mot de passe dans la table des processus, où
 * tout utilisateur de la machine le lit avec `ps`), jamais d'interpolation dans
 * une URL, jamais de journalisation. Le corps des réponses n'est jamais lu : il
 * pourrait porter des données. Un crible anti-fuite relit la sortie complète
 * avant affichage et refuse d'imprimer si une valeur y figure.
 *
 * ─── RÈGLES D'INTERPRÉTATION, RATIFIÉES ────────────────────────────────────
 *
 *   401 est le SEUL refus d'authentification admissible, et le refus attendu
 *   porte `WWW-Authenticate: Basic realm="INTERLIGENS Admin"` — seul refus du
 *   dépôt portant cet en-tête (`basicAuthFail()`, src/proxy.ts).
 *
 *   3xx, 403 et 5xx sont INCONCLUSIFS, jamais « passage ». Noter pour le
 *   dossier, sans que cela change le verdict : un 403 sous /api/admin signifie
 *   que l'authentification a RÉUSSI et qu'un garde applicatif a refusé ensuite.
 *   Un 3xx n'est pas un accès accordé.
 *
 *   auth/login est exempté du garde par conception (`isAdminLoginSurface`) : il
 *   ne mesure PAS ce garde et ne peut pas être la cible. La sonde refuse de
 *   partir si l'URL le vise.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";

const UA = "interligens-sonde-admin-basic/1 (CC-OFFLINE-224)";
const DELAI_MS = 30_000;

const tampon = [];
const P = (s = "") => tampon.push(s);
const VALEURS = new Set();

function imprimerOuRefuser(code) {
  const texte = tampon.join("\n");
  for (const v of VALEURS) {
    if (v && v.length >= 6 && texte.includes(v)) {
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
 * Lit une valeur SANS jamais la rendre visible. Deux formes acceptées :
 * fichier d'environnement portant `cle=`, ou fichier ne contenant que la
 * valeur. Fail-closed : absent, vide, ou illisible ⇒ null.
 */
function lireValeur(chemin, cle) {
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

// ── Entrées ────────────────────────────────────────────────────────────────

const cible = process.env.SONDE_TARGET_URL ?? "";
const fUser = process.env.SONDE_USER_FILE ?? "";
const fOld = process.env.SONDE_PASS_OLD_FILE ?? "";
const fNew = process.env.SONDE_PASS_NEW_FILE ?? "";

P("");
P("  SONDE D'INVALIDATION SERVIE — ADMIN_BASIC_PASS · CC-OFFLINE-224");
P("");

const manquantes = [
  ["SONDE_TARGET_URL", cible],
  ["SONDE_USER_FILE", fUser],
  ["SONDE_PASS_OLD_FILE", fOld],
  ["SONDE_PASS_NEW_FILE", fNew],
].filter(([, v]) => !v).map(([n]) => n);
if (manquantes.length) refus(`⛔ Variables absentes : ${manquantes.join(", ")}.`);

let url;
try {
  url = new URL(cible);
} catch {
  refus("⛔ SONDE_TARGET_URL n'est pas une URL absolue.");
}
if (url.protocol !== "https:") refus("⛔ SONDE_TARGET_URL doit être en https.");
if (!url.pathname.startsWith("/api/admin/")) {
  refus(
    "⛔ La cible n'est pas sous /api/admin/ — le garde Basic n'y est pas invoqué.",
    `   reçu : ${url.pathname}`,
  );
}
if (/\/api\/admin\/auth\/login\/?$/.test(url.pathname)) {
  refus(
    "⛔ La cible est auth/login, EXEMPTÉ du garde Basic par conception.",
    "   Elle ne mesure pas ce garde et ne peut pas servir de cible.",
  );
}

const user = lireValeur(fUser, "ADMIN_BASIC_USER");
const passOld = lireValeur(fOld, "ADMIN_BASIC_PASS");
const passNew = lireValeur(fNew, "ADMIN_BASIC_PASS");

const absents = [
  ["SONDE_USER_FILE", user],
  ["SONDE_PASS_OLD_FILE", passOld],
  ["SONDE_PASS_NEW_FILE", passNew],
].filter(([, v]) => !v).map(([n]) => n);
if (absents.length) {
  refus(
    `⛔ Valeur absente, vide ou illisible dans : ${absents.join(", ")}.`,
    "   Sans les trois, il n'y a ni refus à distinguer ni contrôle positif.",
  );
}

for (const v of [user, passOld, passNew]) VALEURS.add(v.valeur);

if (passOld.valeur === passNew.valeur) {
  refus(
    "⛔ ANCIENNE et NOUVELLE valeurs sont IDENTIQUES.",
    "   Il n'y a rien à mesurer : ce credential se rote, il ne se sonde pas.",
  );
}

P(`  Cible    ${url.origin}${url.pathname}`);
P(`  Entrées  utilisateur : ${user.forme} · ancienne : ${passOld.forme} · nouvelle : ${passNew.forme}`);
P("           (aucune valeur n'est lue à l'écran, ni ici ni ailleurs)");
P("");

// ── Les trois requêtes ─────────────────────────────────────────────────────

/**
 * Chaque requête porte un nonce distinct en paramètre : aucun cache
 * intermédiaire ne peut servir à l'une la réponse d'une autre, et un 401 mis en
 * cache ne peut pas se faire passer pour un refus.
 */
async function requete(etiquette, entetes) {
  const u = new URL(url.toString());
  u.searchParams.set("sonde", randomBytes(6).toString("hex"));

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DELAI_MS);
  let code = null;
  let defi = false;
  let incident = null;
  try {
    const rep = await fetch(u, {
      method: "GET",
      headers: { "user-agent": UA, ...entetes },
      redirect: "manual",
      signal: ctl.signal,
    });
    code = rep.status;
    defi = /^Basic\b/i.test(rep.headers.get("www-authenticate") ?? "");
    // Le corps n'est JAMAIS lu.
  } catch (e) {
    incident = e?.name === "AbortError" ? "délai dépassé" : "requête non aboutie";
  } finally {
    clearTimeout(t);
  }

  let verdict;
  if (incident) verdict = "INCONCLUSIVE";
  else if (code === 401) verdict = defi ? "REFUSED" : "INCONCLUSIVE";
  else if (code === 404 || (code >= 200 && code < 300)) verdict = "ACCEPTED";
  else verdict = "INCONCLUSIVE"; // 3xx, 403, 5xx et tout le reste

  P(
    `  ${etiquette.padEnd(14)} → ${verdict.padEnd(12)} (${incident ?? code})` +
      (code === 401 ? `   défi Basic : ${defi ? "oui" : "NON"}` : ""),
  );
  return verdict;
}

const enteteBasic = (u, p) => ({
  authorization: "Basic " + Buffer.from(`${u}:${p}`, "utf8").toString("base64"),
});

const vNone = await requete("NO CREDENTIAL", {});
const vOld = await requete("OLD", enteteBasic(user.valeur, passOld.valeur));
const vNew = await requete("NEW", enteteBasic(user.valeur, passNew.valeur));

P("");

// ── Lecture ────────────────────────────────────────────────────────────────

if (vNone !== "REFUSED") {
  P("  ⛔ SONDE NULLE — la porte vive ne rend pas un refus Basic.");
  P("     Le garde ne s'exécute pas sur ce chemin : un 401 et un 404 n'y sont");
  P("     plus distinguables. NE RIEN CONCLURE, et vérifier le déploiement servi.");
  imprimerOuRefuser(4);
}
if (vOld === "ACCEPTED") {
  P("  ⛔ ANCIENNE VALEUR ENCORE ACCEPTÉE par le runtime servi.");
  P("     La bascule n'a pas pris. STOP.");
  imprimerOuRefuser(1);
}
if (vOld === "REFUSED" && vNew === "ACCEPTED") {
  P("  ✅ INVALIDATION SERVIE ÉTABLIE — ancienne refusée, nouvelle acceptée.");
  P("     Portée : CE runtime, CE chemin, CET instant. Les runtimes historiques");
  P("     ne sont pas concernés et continuent d'accepter l'ancienne valeur.");
  imprimerOuRefuser(0);
}
if (vNew === "REFUSED") {
  P("  ⛔ NOUVELLE VALEUR REFUSÉE — le runtime servi n'a pas la nouvelle valeur.");
  P("     Les DEUX sont refusées : on ignore laquelle est servie. STOP.");
  imprimerOuRefuser(1);
}
P(`  ⚠️ NON CONCLUANT — OLD=${vOld}, NEW=${vNew}. Aucun verdict ne se rend là-dessus.`);
imprimerOuRefuser(4);
