#!/usr/bin/env node
/**
 * SONDE D'INVALIDATION — Basic Auth admin servi.
 * ==============================================
 *
 * Ce qu'elle établit
 * ------------------
 * `ADMIN_BASIC_PASS` est un secret AUTO-ÉMIS : aucun fournisseur ne le détient,
 * il n'existe aucun écran où le révoquer. Le critère de fermeture n'a donc
 * qu'une branche possible pour lui — la DÉMONSTRATION DE NON-OPÉRATIONNALITÉ.
 *
 * La cartographie a établi que la valeur exposée DIFFÈRE de la valeur courante,
 * au poste comme dans Vercel Production. Cela n'établit que CONFIGURED_CURRENT.
 * Cette sonde établit SERVED_CURRENT : que l'autorité RÉELLEMENT SERVIE refuse
 * l'ancienne paire.
 *
 * Ce qu'elle interroge
 * --------------------
 * Un chemin INEXISTANT sous `/api/admin/`, tiré au sort à chaque exécution.
 *
 * Ce choix n'est pas un contournement, c'est le seul qui satisfasse les trois
 * critères à la fois. Le garde Basic vit dans `src/proxy.ts`, qui s'exécute
 * AVANT le routage sur tout `/api/admin/:path*`. Un chemin sans gestionnaire
 * traverse donc le garde — et rien d'autre :
 *
 *     mauvaise paire  →  401 (le garde refuse)            ← le gestionnaire n'existe pas et ne tourne pas
 *     bonne paire     →  404 (le garde laisse passer)     ← aucun code métier, aucune requête en base
 *
 * Deux codes DISTINCTS, aucune donnée lue, aucune écriture, aucun envoi, aucun
 * document, aucun appel facturé. Une sonde sur un endpoint qui écrit n'est pas
 * une sonde ; une sonde qui lit la base peut rendre 500 pour une raison
 * étrangère à l'authentification, et un 500 n'est pas une mesure.
 *
 * Le piège que la troisième requête ferme
 * ---------------------------------------
 * Si le garde ne s'exécutait PAS (proxy absent du déploiement servi, matcher
 * modifié), les deux requêtes rendraient 404 — et le 404 de l'ancienne paire se
 * lirait comme « ancienne paire acceptée », c'est-à-dire l'alarme maximale,
 * pour la mauvaise raison. La sonde émet donc d'abord une requête SANS aucune
 * authentification, qui DOIT rendre 401. Si elle ne le fait pas, la sonde est
 * déclarée NULLE et rien d'autre n'est interprété.
 *
 * Forme, non négociable
 * ---------------------
 *   - Aucune valeur ne s'affiche. Ni dans la commande, ni dans la sortie.
 *   - Les valeurs sont LUES DANS LES FICHIERS par la sonde elle-même. Le
 *     fondateur n'en tape ni n'en colle aucune.
 *   - Aucun corps de réponse n'est lu ni imprimé : il pourrait porter des
 *     données. Seuls le code HTTP et une étiquette sortent.
 *   - L'en-tête `Authorization` est construit EN MÉMOIRE et passé à `fetch`.
 *     Rien ne transite par une ligne de commande : un `curl -u user:pass`
 *     aurait exposé le secret dans la table des processus, lisible par tout
 *     utilisateur de la machine.
 *   - Aucun cookie n'est envoyé. Le garde accepte `admin_session` OU Basic :
 *     un cookie rendrait la mesure sans objet.
 *   - Aucune redirection n'est suivie : un 3xx doit se voir comme un 3xx.
 *
 * Usage :  node scripts/rotation/sonde-basic-auth.mjs --sans-reseau   (répétition)
 *          node scripts/rotation/sonde-basic-auth.mjs                 (sonde réelle)
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { extraireOctets, indexer, chercherFuite } from "./cartographie-vercel.mjs";

export const VERSION = "1.0.0";

/** Chemin de production par défaut. Aucune valeur de secret ici. */
export const BASE_DEFAUT = "https://app.interligens.com";

/** Le garde Basic couvre `/api/admin/:path*` (matcher de `src/proxy.ts`). */
export const PREFIXE_SONDE = "/api/admin";

// ──────────────────────────────────────────────────────────────────────────
// 1. LE CONTRAT DE REFUS, TEL QU'IL EST ÉCRIT DANS LE CODE SERVI
// ──────────────────────────────────────────────────────────────────────────

/**
 * `basicAuthFail()` — src/proxy.ts, commit servi 9ee790c :
 *
 *     new NextResponse("Unauthorized", {
 *       status: 401,
 *       headers: { "WWW-Authenticate": 'Basic realm="INTERLIGENS Admin"' },
 *     })
 *
 * C'est le SEUL refus du dépôt qui porte l'en-tête `WWW-Authenticate`. Les
 * refus de gestionnaire (`requireAdminApi`) rendent du JSON 401/403 SANS cet
 * en-tête ; le garde nominatif rend un JSON 401 `NOMINATIVE_ACCESS_REQUIRED`.
 * La présence du défi Basic distingue donc un refus D'AUTHENTIFICATION BASIC
 * de tout autre refus — et la sonde l'observe sans imprimer aucun en-tête.
 */
export const REFUS = Object.freeze({
  code: 401,
  entete: "www-authenticate",
  defi: 'Basic realm="INTERLIGENS Admin"',
});

/** Le code attendu quand le garde laisse passer : aucun gestionnaire derrière. */
export const PASSAGE = 404;

// ──────────────────────────────────────────────────────────────────────────
// 2. INTERPRÉTATION — pure, testable, sans réseau
// ──────────────────────────────────────────────────────────────────────────

export const VERDICTS = Object.freeze({
  SANS_REPONSE: "NON CONCLUANT — la production n'a pas répondu",
  PORTE_INACTIVE: "SONDE NULLE — le garde Basic ne s'exécute pas sur ce chemin",
  ANCIENNE_ACCEPTEE: "⛔ ANCIENNE PAIRE ENCORE ACCEPTÉE — STOP du bloc Admin",
  INDETERMINE: "NON CONCLUANT — l'ancienne paire n'obtient ni refus Basic, ni passage",
  DIVERGENCE: "NON CONCLUANT — la paire du poste est refusée par le runtime servi",
  CONTROLE_MANQUE: "NON CONCLUANT — le contrôle positif n'a pas abouti",
  REFUS_ETABLI: "✅ REFUS ÉTABLI — l'autorité servie refuse l'ancienne paire et accepte l'actuelle",
});

/**
 * `liveness`, `ancienne`, `actuelle` : code HTTP, ou null si la requête n'a pas
 * abouti. L'ordre des règles est le raisonnement lui-même, et il n'admet aucun
 * raccourci : on ne conclut sur l'ancienne paire qu'après avoir prouvé que le
 * garde tourne, et on ne conclut au refus qu'après le contrôle positif.
 */
export function interpreter({ liveness, ancienne, actuelle }) {
  if (liveness === null || ancienne === null || actuelle === null) {
    return { cle: "SANS_REPONSE", verdict: VERDICTS.SANS_REPONSE, stop: false };
  }
  if (liveness !== REFUS.code) {
    return { cle: "PORTE_INACTIVE", verdict: VERDICTS.PORTE_INACTIVE, stop: false };
  }
  // PASSAGE = le garde a laissé filer la requête : 404 (aucun gestionnaire
  // derrière) ou 2xx. C'est l'alarme maximale — l'ANCIENNE paire ouvre encore.
  const passage = ancienne === PASSAGE || (ancienne >= 200 && ancienne < 300);
  if (passage) {
    return { cle: "ANCIENNE_ACCEPTEE", verdict: VERDICTS.ANCIENNE_ACCEPTEE, stop: true };
  }
  // Tout le reste — 3xx, 403, 5xx — n'est NI un refus Basic NI un passage.
  // Une redirection n'est pas un accès accordé, et un 500 n'est pas une mesure.
  // Les classer « accepté » lèverait une fausse alarme ; les classer « refusé »
  // fermerait l'incident sur du vide. Ni l'un ni l'autre : non concluant.
  if (ancienne !== REFUS.code) {
    return { cle: "INDETERMINE", verdict: VERDICTS.INDETERMINE, stop: false };
  }
  if (actuelle === REFUS.code) {
    // CONFIGURED_CURRENT ≠ SERVED_CURRENT : la valeur du poste n'est pas celle
    // que le runtime sert. Le refus de l'ancienne paire ne prouve alors rien —
    // les DEUX paires sont refusées, et on ne sait pas laquelle est servie.
    return { cle: "DIVERGENCE", verdict: VERDICTS.DIVERGENCE, stop: false };
  }
  if (actuelle !== PASSAGE) {
    return { cle: "CONTROLE_MANQUE", verdict: VERDICTS.CONTROLE_MANQUE, stop: false };
  }
  return { cle: "REFUS_ETABLI", verdict: VERDICTS.REFUS_ETABLI, stop: false };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. LECTURE DES PAIRES — depuis les OCTETS, jamais depuis un parseur dotenv
// ──────────────────────────────────────────────────────────────────────────

export function lirePaire(chemin) {
  if (!fs.existsSync(chemin)) return { ok: false, motif: `fichier absent : ${chemin}` };
  const index = indexer(extraireOctets(fs.readFileSync(chemin)));
  const user = index.get("ADMIN_BASIC_USER");
  const pass = index.get("ADMIN_BASIC_PASS");
  if (!user || user.normale.length === 0) return { ok: false, motif: "ADMIN_BASIC_USER absente ou vide" };
  if (!pass || pass.normale.length === 0) return { ok: false, motif: "ADMIN_BASIC_PASS absente ou vide" };
  return { ok: true, user: user.normale, pass: pass.normale };
}

/** En-tête Basic, construit en mémoire. Ne JAMAIS journaliser le retour. */
export function enteteBasic(paire) {
  return "Basic " + Buffer.concat([paire.user, Buffer.from(":"), paire.pass]).toString("base64");
}

// ──────────────────────────────────────────────────────────────────────────
// 4. LES TROIS REQUÊTES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Chaque requête part sur un chemin UNIQUE. Deux raisons : aucun cache
 * intermédiaire ne peut servir à la requête suivante la réponse de la
 * précédente, et un 401 mis en cache ne peut pas se faire passer pour un refus.
 */
export function planifier(nonce) {
  return [
    { rang: 1, cle: "liveness", etiquette: "porte vive (aucune authentification)", chemin: `${PREFIXE_SONDE}/sonde-${nonce}-c`, attendu: REFUS.code, avecAuth: null },
    { rang: 2, cle: "ancienne", etiquette: "ANCIENNE paire (octets exposés)", chemin: `${PREFIXE_SONDE}/sonde-${nonce}-a`, attendu: REFUS.code, avecAuth: "exposé" },
    { rang: 3, cle: "actuelle", etiquette: "paire ACTUELLE (poste) — contrôle positif", chemin: `${PREFIXE_SONDE}/sonde-${nonce}-b`, attendu: PASSAGE, avecAuth: "poste" },
  ];
}

async function emettre(base, etape, entetes, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(etape.chemin, base), {
      method: "GET",
      redirect: "manual", // un 3xx doit se voir comme un 3xx
      cache: "no-store",
      headers: entetes,
      signal: ac.signal,
    });
    // Le corps n'est JAMAIS lu. On le laisse tomber avec la réponse.
    return { code: res.status, defi: (res.headers.get(REFUS.entete) ?? "") !== "" };
  } catch {
    return { code: null, defi: false };
  } finally {
    clearTimeout(t);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 5. PROGRAMME
// ──────────────────────────────────────────────────────────────────────────

const AIDE = `
SONDE D'INVALIDATION — Basic Auth admin servi (v${VERSION})

  node scripts/rotation/sonde-basic-auth.mjs [options]

  --sans-reseau     Répétition à blanc : lit les paires, imprime le plan,
                    n'émet AUCUNE requête. À faire en premier.
  --base <url>      Cible. Défaut : ${BASE_DEFAUT}
  --expose <chemin> Octets exposés. Défaut : <racine git>/.env
  --poste <chemin>  Valeurs courantes. Défaut : <racine git>/.env.local
  --empreinte-version
                    Ajoute un GET public sur /api/health pour inscrire la
                    version SERVIE. ⚠️ Cette route interroge la base (SELECT 1)
                    et ping Redis. Hors du périmètre minimal — à activer en
                    connaissance de cause.
  --aide

  Cette sonde ne rote rien, ne révoque rien, n'écrit dans aucun fichier
  d'environnement, et n'imprime aucune valeur.
`;

function racineGit(depart) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: depart, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : depart;
}

function analyserArgs(argv) {
  const o = { sansReseau: false, aide: false, empreinteVersion: false, base: BASE_DEFAUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--aide" || a === "-h" || a === "--help") o.aide = true;
    else if (a === "--sans-reseau") o.sansReseau = true;
    else if (a === "--empreinte-version") o.empreinteVersion = true;
    else if (a === "--base") o.base = argv[++i];
    else if (a === "--expose") o.expose = argv[++i];
    else if (a === "--poste") o.poste = argv[++i];
    else throw new Error(`Option inconnue : ${a}`);
  }
  return o;
}

async function principal(argv) {
  const opts = analyserArgs(argv);
  if (opts.aide) {
    process.stdout.write(AIDE);
    return 0;
  }

  const depot = racineGit(process.cwd());
  const cheminExpose = path.resolve(opts.expose || path.join(depot, ".env"));
  const cheminPoste = path.resolve(opts.poste || path.join(depot, ".env.local"));

  const sortie = [];
  const P = (s = "") => {
    sortie.push(s);
    process.stdout.write(s + "\n");
  };

  P(`\nSONDE D'INVALIDATION — Basic Auth admin servi v${VERSION}`);
  P(`  cible          : ${opts.base}`);
  P(`  octets exposés : ${cheminExpose}`);
  P(`  valeurs poste  : ${cheminPoste}`);
  P();

  const expose = lirePaire(cheminExpose);
  const poste = lirePaire(cheminPoste);
  if (!expose.ok) {
    process.stderr.write(`❌ ARRÊT — paire exposée illisible : ${expose.motif}\n   Sans ancienne paire, la sonde n'a rien à distinguer.\n`);
    return 2;
  }
  if (!poste.ok) {
    process.stderr.write(`❌ ARRÊT — paire courante illisible : ${poste.motif}\n   Sans contrôle positif, un refus ne se distingue pas d'une auth cassée.\n`);
    return 2;
  }

  // Si les deux paires sont identiques, il n'y a rien à mesurer : le credential
  // est exposé ET vivant, et la sonde rendrait « accepté » pour la valeur
  // exposée sans que cela apprenne quoi que ce soit.
  if (expose.pass.equals(poste.pass) && expose.user.equals(poste.user)) {
    process.stderr.write(
      "❌ ARRÊT — la paire exposée et la paire courante sont IDENTIQUES.\n" +
        "   La sonde est sans objet : ce credential est exposé et vivant, il se rote,\n" +
        "   il ne se sonde pas.\n",
    );
    return 2;
  }

  const nonce = randomBytes(6).toString("hex");
  const plan = planifier(nonce);

  P("  PLAN — trois requêtes GET, trois chemins distincts (aucun cache ne peut les confondre)");
  for (const e of plan) {
    P(`    [${e.rang}/3] ${e.etiquette.padEnd(46)} ${e.chemin}   attendu ${e.attendu}`);
  }
  P();
  P("  Le chemin visé n'existe pas : aucun gestionnaire ne tourne, aucune requête en base,");
  P("  aucun envoi, aucun document, aucun appel facturé. Le 404 attendu en [3/3] EST le");
  P("  contrôle positif : il ne s'obtient qu'en ayant traversé le garde Basic.");
  P();

  if (opts.sansReseau) {
    P("  → --sans-reseau : AUCUNE requête émise. Répétition terminée.");
    P();
    return 0;
  }

  const resultats = {};
  for (const e of plan) {
    const entetes = { "user-agent": "interligens-rotation-probe", "cache-control": "no-store" };
    if (e.avecAuth === "exposé") entetes.authorization = enteteBasic(expose);
    if (e.avecAuth === "poste") entetes.authorization = enteteBasic(poste);
    const r = await emettre(opts.base, e, entetes);
    resultats[e.cle] = r.code;
    const obtenu = r.code === null ? "—" : String(r.code);
    const ok = r.code === e.attendu ? "✅" : "⚠️";
    P(`    [${e.rang}/3] ${e.etiquette.padEnd(46)} attendu ${e.attendu}   obtenu ${obtenu.padEnd(4)} ${ok}   défi Basic : ${r.defi ? "oui" : "non"}`);
  }
  P();

  if (opts.empreinteVersion) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(new URL("/api/health", opts.base), { method: "GET", cache: "no-store", signal: ac.signal });
      const j = await res.json();
      // `version` est un sha public de commit, jamais un secret.
      const v = typeof j?.version === "string" ? j.version : "illisible";
      P(`  VERSION SERVIE (GET /api/health) : ${v}`);
    } catch {
      P("  VERSION SERVIE : non établie (la requête n'a pas abouti).");
    } finally {
      clearTimeout(t);
    }
    P();
  }

  const verdict = interpreter(resultats);
  P(`  VERDICT : ${verdict.verdict}`);
  P();
  if (verdict.cle === "REFUS_ETABLI") {
    P("  Ce que cela établit : à cet instant, sur ce chemin, ce runtime refuse l'ancienne paire");
    P("  et accepte l'actuelle. Rien de plus — voir §5 du document d'accompagnement.");
  } else if (verdict.stop) {
    P("  ⛔ L'ancienne paire ouvre encore le garde du runtime servi. STOP du bloc Admin :");
    P("     ne roter aucun autre credential admin avant d'avoir traité celui-ci.");
  } else {
    P("  Résultat NON INTERPRÉTABLE. Ne rien conclure, ni dans un sens ni dans l'autre.");
  }
  P();

  // Le crible : la sortie est prouvée vide de valeurs avant qu'on s'en aille.
  const fuites = chercherFuite(sortie.join("\n"), [
    { etiquette: "ADMIN_BASIC_USER (exposé)", valeur: expose.user },
    { etiquette: "ADMIN_BASIC_PASS (exposé)", valeur: expose.pass },
    { etiquette: "ADMIN_BASIC_USER (poste)", valeur: poste.user },
    { etiquette: "ADMIN_BASIC_PASS (poste)", valeur: poste.pass },
  ]);
  if (fuites.length) {
    process.stderr.write(`\n❌ DÉFAUT DE LA SONDE : ${fuites.length} valeur(s) imprimée(s) — ${fuites.join(", ")}\n`);
    return 3;
  }

  return verdict.stop ? 1 : 0;
}

const estPointDEntree = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (estPointDEntree) {
  principal(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      process.stderr.write(`\n❌ ${e.message}\n`);
      process.exit(1);
    });
}
