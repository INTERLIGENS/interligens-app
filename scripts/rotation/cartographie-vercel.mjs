#!/usr/bin/env node
/**
 * CARTOGRAPHIE VERCEL PRODUCTION — instrument de LECTURE SEULE.
 * ============================================================
 *
 * Ce que cet instrument fait
 * --------------------------
 * Il établit, pour chaque credential, les cinq colonnes que la fenêtre INCIDENT
 * ROTATION exige :
 *
 *   ①  présent dans Vercel Production ?
 *   ②  identique à la valeur exposée ?
 *   ③  alias ou doublon d'une autre variable ?
 *   ④  consommateur(s) dans le code ?
 *   ⑤  mécanisme de révocation côté fournisseur ?
 *
 * Ce qu'il ne fait pas, par construction
 * --------------------------------------
 *   - Il ne rote, ne crée, ne révoque, n'invalide AUCUN credential.
 *   - Il n'appelle aucun fournisseur avec un credential. Les deux seules
 *     commandes sortantes sont `vercel env ls` et `vercel env pull`, exécutées
 *     par le fondateur avec SA propre session Vercel, jamais avec une valeur
 *     lue dans un fichier.
 *   - Il n'écrit dans aucun fichier d'environnement. Le `vercel env pull` est
 *     exécuté dans un répertoire temporaire hors du dépôt qui ne contient
 *     qu'une COPIE du lien de projet : le CLI ne peut pas atteindre le
 *     `.env.local` du poste, même s'il ignorait le nom de fichier demandé.
 *   - Il n'imprime, ne journalise, n'écrit AUCUNE valeur. Cette propriété n'est
 *     pas une intention : le rapport est passé au crible `chercherFuite()`
 *     avant d'être rendu, et l'instrument AVORTE sans rien écrire si une seule
 *     valeur connue y apparaît.
 *
 * Les quatre règles de forme, et où elles sont implémentées
 * --------------------------------------------------------
 * 1. COMPARAISON PAR EMPREINTE, jamais par valeur → `empreinte()`.
 *    HMAC-SHA256 tronqué à 12 hexets. Le rapport ne contient ni valeur, ni
 *    préfixe, ni suffixe, ni longueur de secret individuelle.
 *
 * 2. EMPREINTE SALÉE PAR UN NONCE DE SESSION → `nouveauNonce()`.
 *    32 octets aléatoires, gardés en mémoire, jamais écrits, perdus à la sortie
 *    du processus. Conséquences voulues : pas d'attaque par dictionnaire (le
 *    HMAC est clé), et deux exécutions ne sont pas comparables entre elles.
 *    Deux rapports produits à deux moments différents ne peuvent donc PAS être
 *    diffés ; c'est le prix payé pour qu'une empreinte publiée ne vaille rien.
 *
 * 3. EXTRACTION DEPUIS LES OCTETS, pas depuis un parseur dotenv →
 *    `extraireOctets()`. Le fichier est découpé sur 0x0A et manipulé en
 *    Buffer, jamais décodé en UTF-8 avant empreinte. La ligne 18 du `.env`
 *    exposé — du texte sans `=`, qu'aucun parseur ne charge et qui est pourtant
 *    parti verbatim en production — est la raison d'être de cette règle. Une
 *    ligne non conforme est COMPTÉE, EMPREINTÉE et SIGNALÉE, jamais imprimée.
 *
 * 4. AUCUN FICHIER DE SECRETS ABANDONNÉ → `creerBac()` / `effacerBac()`.
 *    Tout intermédiaire porteur de valeurs vit dans un bac temporaire hors du
 *    dépôt, écrasé puis supprimé par l'instrument lui-même — en sortie normale,
 *    en cas d'erreur, et sur interruption (SIGINT/SIGTERM/SIGHUP). Le rapport
 *    final refuse d'être écrit à l'intérieur du dépôt.
 *
 * La variante qui se déguise
 * --------------------------
 * `decomposerValeur()` existe parce qu'une comparaison de chaînes a rendu un
 * FAUX NÉGATIF sur le credential le plus grave : la `DATABASE_URL` exposée et
 * la courante « diffèrent », alors que seul l'hôte change (pooler contre
 * direct) — même utilisateur, même endpoint, MÊME MOT DE PASSE. L'instrument
 * décompose donc les URL de connexion et compare chaque composant séparément.
 *
 * Usage :  node scripts/rotation/cartographie-vercel.mjs [options]
 *          node scripts/rotation/cartographie-vercel.mjs --aide
 */

import { createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = "1.0.0";

/** En deçà de cette longueur, une valeur n'est pas discriminante : la chercher
 *  dans le rapport produirait des collisions ("true", "5432") sans rien
 *  prouver. Au-dessus, toute occurrence est une fuite. */
export const LONGUEUR_MIN_FUITE = 8;

// ──────────────────────────────────────────────────────────────────────────
// 1. EMPREINTE
// ──────────────────────────────────────────────────────────────────────────

export function nouveauNonce() {
  return randomBytes(32);
}

/**
 * Empreinte salée d'une valeur. `valeur` peut être un Buffer (chemin normal :
 * on empreinte les OCTETS) ou une chaîne (composants d'URL déjà décodés).
 * Retourne null pour une valeur absente — « absent » et « vide » sont deux
 * verdicts différents et ne doivent jamais se confondre.
 */
export function empreinte(nonce, valeur) {
  if (valeur === null || valeur === undefined) return null;
  const buf = Buffer.isBuffer(valeur) ? valeur : Buffer.from(String(valeur), "utf8");
  if (buf.length === 0) return "#vide";
  return "#" + createHmac("sha256", nonce).update(buf).digest("hex").slice(0, 12);
}

// ──────────────────────────────────────────────────────────────────────────
// 2. EXTRACTION DEPUIS LES OCTETS
// ──────────────────────────────────────────────────────────────────────────

const LF = 0x0a;
const CR = 0x0d;
const EGAL = 0x3d;
const DIESE = 0x23;

function estBlanc(o) {
  return o === 0x20 || o === 0x09 || o === 0x0b || o === 0x0c || o === CR;
}

function rogner(buf) {
  let d = 0;
  let f = buf.length;
  while (d < f && estBlanc(buf[d])) d++;
  while (f > d && estBlanc(buf[f - 1])) f--;
  return buf.subarray(d, f);
}

function deguillemeter(buf) {
  if (buf.length < 2) return { valeur: buf, guillemets: false };
  const a = buf[0];
  const z = buf[buf.length - 1];
  if ((a === 0x22 && z === 0x22) || (a === 0x27 && z === 0x27)) {
    return { valeur: buf.subarray(1, buf.length - 1), guillemets: true };
  }
  return { valeur: buf, guillemets: false };
}

const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Découpe un Buffer de fichier d'environnement en lignes, et classe chaque
 * ligne. Ne décode jamais une valeur en UTF-8 : les valeurs restent des
 * Buffers jusqu'à l'empreinte.
 *
 * Retour :
 *   { affectations: [{nom, ligne, brut, normale, guillemets, redefinie}],
 *     nonConformes: [{ligne, octets, motif}],
 *     compteurs: {lignes, vides, commentaires, affectations, nonConformes} }
 *
 * `motif` d'une ligne non conforme vaut "sans-egal" ou "nom-invalide". Le
 * CONTENU n'est jamais retenu dans cette structure autrement que sous forme de
 * Buffer destiné à l'empreinte (`octetsBruts`), que le rendu n'imprime jamais.
 */
export function extraireOctets(buf) {
  const lignes = [];
  let debut = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length) {
      if (i > debut) lignes.push(buf.subarray(debut, i));
      break;
    }
    if (buf[i] === LF) {
      lignes.push(buf.subarray(debut, i));
      debut = i + 1;
    }
  }

  const affectations = [];
  const nonConformes = [];
  const compteurs = { lignes: lignes.length, vides: 0, commentaires: 0, affectations: 0, nonConformes: 0 };
  const vues = new Map();

  lignes.forEach((ligneBrute, idx) => {
    const numero = idx + 1;
    const ligne = rogner(ligneBrute);
    if (ligne.length === 0) {
      compteurs.vides++;
      return;
    }
    if (ligne[0] === DIESE) {
      compteurs.commentaires++;
      return;
    }

    const iEgal = ligne.indexOf(EGAL);
    if (iEgal === -1) {
      compteurs.nonConformes++;
      nonConformes.push({ ligne: numero, octets: ligne.length, motif: "sans-egal", octetsBruts: Buffer.from(ligne) });
      return;
    }

    let gauche = rogner(ligne.subarray(0, iEgal)).toString("latin1");
    if (gauche.startsWith("export ")) gauche = gauche.slice(7).trim();

    if (!NOM_VALIDE.test(gauche)) {
      compteurs.nonConformes++;
      nonConformes.push({ ligne: numero, octets: ligne.length, motif: "nom-invalide", octetsBruts: Buffer.from(ligne) });
      return;
    }

    const brut = Buffer.from(ligne.subarray(iEgal + 1));
    const { valeur, guillemets } = deguillemeter(rogner(brut));

    compteurs.affectations++;
    const redefinie = vues.has(gauche);
    vues.set(gauche, numero);
    affectations.push({
      nom: gauche,
      ligne: numero,
      brut, // octets exacts après le `=`
      normale: Buffer.from(valeur), // rognés + déguillemetés
      guillemets,
      redefinie,
    });
  });

  return { affectations, nonConformes, compteurs };
}

/** Index nom → dernière affectation (sémantique dotenv : le dernier gagne). */
export function indexer(extrait) {
  const m = new Map();
  for (const a of extrait.affectations) m.set(a.nom, a);
  return m;
}

// ──────────────────────────────────────────────────────────────────────────
// 3. DÉCOMPOSITION DES VARIANTES DÉGUISÉES
// ──────────────────────────────────────────────────────────────────────────

const PARAMS_PORTEURS_DE_CLE = ["api-key", "apikey", "api_key", "key", "token", "access_token", "auth"];

/**
 * Décompose une valeur qui est une URL. Deux familles :
 *
 *   - URL DE CONNEXION (postgres, mysql, redis, amqp, mongodb) : le secret est
 *     le mot de passe, noyé au milieu d'un hôte et d'options qui changent tout
 *     le temps. C'est le cas `DATABASE_URL` pooler/direct.
 *   - URL PORTEUSE DE CLÉ (https avec ?api-key=…) : l'URL EST le credential.
 *
 * Retourne null si la valeur n'est pas une URL exploitable. `endpointBase` est
 * le premier label d'hôte débarrassé du suffixe `-pooler` : c'est LUI qui dit
 * si deux URL visent la même base, là où l'hôte complet dit « différent ».
 */
export function decomposerValeur(valeurTexte) {
  const v = String(valeurTexte || "").trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return null;

  let u;
  try {
    u = new URL(v);
  } catch {
    return null;
  }

  const protocole = u.protocol.replace(/:$/, "");
  const familleConnexion = /^(postgres|postgresql|mysql|mariadb|redis|rediss|amqp|amqps|mongodb|mongodb\+srv)$/i.test(protocole);

  const hote = u.hostname;
  const premierLabel = hote.split(".")[0] || "";
  const pooler = /-pooler$/i.test(premierLabel) || /\bpooler\b/i.test(hote);
  const endpointBase = premierLabel.replace(/-pooler$/i, "");

  const composants = {
    protocole,
    utilisateur: u.username ? decodeURIComponent(u.username) : "",
    motDePasse: u.password ? decodeURIComponent(u.password) : "",
    hote,
    endpointBase,
    variante: pooler ? "POOLER" : "DIRECT",
    port: u.port || "",
    chemin: u.pathname.replace(/^\//, ""),
  };

  const clesIntegrees = {};
  for (const [k, val] of u.searchParams.entries()) {
    if (PARAMS_PORTEURS_DE_CLE.includes(k.toLowerCase()) && val) clesIntegrees[k] = val;
  }

  if (!familleConnexion && Object.keys(clesIntegrees).length === 0) return null;

  return {
    type: familleConnexion ? "connexion" : "url-porteuse-de-cle",
    composants,
    clesIntegrees,
    /** Les composants dont la comparaison est SIGNIFIANTE pour la rotation.
     *  L'hôte n'en fait pas partie : c'est précisément lui qui mentait. */
    composantsSensibles: familleConnexion
      ? ["utilisateur", "motDePasse", "endpointBase", "chemin"]
      : ["hote", "chemin"],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4. CONSOMMATEURS DANS LE CODE
// ──────────────────────────────────────────────────────────────────────────

const MOTIF_ENV = "process\\.env(\\.[A-Za-z_][A-Za-z0-9_]*|\\[[\"'][A-Za-z_][A-Za-z0-9_]*[\"']\\])";

/**
 * Une seule passe `git grep` sur tout le dépôt suivi, puis agrégation.
 * Retourne Map<nom, {total, fichiers: Map<fichier, n>}>, ou null si la mesure
 * n'a pas pu être faite — auquel cas la colonne ④ vaut INCONNU, jamais zéro.
 * « Aucun consommateur mesuré » et « mesure impossible » sont deux choses
 * différentes, et les confondre ferait supprimer une variable vivante.
 */
export function consommateurs(racineDepot) {
  const r = spawnSync("git", ["grep", "-I", "-h", "-o", "-E", MOTIF_ENV, "--", "src", "scripts", "prisma", "app"], {
    cwd: racineDepot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || (r.status !== 0 && r.status !== 1)) return null;

  const parFichier = spawnSync("git", ["grep", "-I", "-n", "-o", "-E", MOTIF_ENV, "--", "src", "scripts", "prisma", "app"], {
    cwd: racineDepot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (parFichier.error || (parFichier.status !== 0 && parFichier.status !== 1)) return null;

  const carte = new Map();
  for (const ligne of parFichier.stdout.split("\n")) {
    if (!ligne) continue;
    const sep = ligne.indexOf(":");
    if (sep === -1) continue;
    const fichier = ligne.slice(0, sep);
    const m = ligne.match(/process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[["']([A-Za-z_][A-Za-z0-9_]*)["']\])/);
    if (!m) continue;
    const nom = m[1] || m[2];
    if (!carte.has(nom)) carte.set(nom, { total: 0, fichiers: new Map() });
    const e = carte.get(nom);
    e.total++;
    e.fichiers.set(fichier, (e.fichiers.get(fichier) || 0) + 1);
  }
  return carte;
}

// ──────────────────────────────────────────────────────────────────────────
// 5. AUTORITÉS DE RÉVOCATION
// ──────────────────────────────────────────────────────────────────────────

/**
 * `branche` désigne laquelle des deux voies du critère de fermeture sera
 * empruntée pour ce credential :
 *   "invalidation"  → invalidé chez son autorité (le fournisseur le refuse).
 *   "demonstration" → démontré non opérationnel (aucune autorité ne peut le
 *                     révoquer ; il faut prouver qu'il n'ouvre plus rien).
 *   "sans-objet"    → ce n'est pas un credential (valeur publique, réglage).
 *
 * `confirmer: true` signale un mécanisme DÉDUIT de la pratique courante et non
 * mesuré. Il doit être vérifié à l'écran au moment de roter, pas supposé.
 */
export const AUTORITES = [
  {
    motif: /^(DATABASE_URL|DATABASE_URL_UNPOOLED|POSTGRES_|PGPASSWORD|PGHOST|PGUSER|PGDATABASE|NEON_)/,
    autorite: "Neon — console du projet, rôle applicatif → « Reset password »",
    geste: "Réinitialiser le mot de passe du rôle. Le reset EST l'invalidation : l'ancien mot de passe cesse d'être accepté immédiatement.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(X_BEARER_TOKEN|TWITTER_BEARER_TOKEN)$/,
    autorite: "Portail développeur X — projet/app → « Regenerate » du Bearer Token",
    geste: "Régénérer le jeton applicatif : la régénération invalide le précédent.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(X_CT0_|X_AUTH_TOKEN_)/,
    autorite: "Compte X — Paramètres → Sécurité → Applications et sessions",
    geste: "TERMINER LES SESSIONS DEPUIS LE COMPTE, puis se reconnecter et relever les nouveaux cookies. Réécrire la variable ne révoque rien : le cookie exposé reste valide tant que la session vit.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^ETHERSCAN_API_KEY$/,
    autorite: "Etherscan → My API Keys",
    geste: "Créer la nouvelle clé, la déployer, PUIS supprimer l'ancienne. Deux gestes distincts.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^RESEND_API_KEY$/,
    autorite: "Resend → API Keys",
    geste: "Créer la nouvelle clé, la déployer, PUIS supprimer l'ancienne.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^ANTHROPIC_API_KEY$/,
    autorite: "Console Anthropic → API Keys",
    geste: "Créer la nouvelle clé, la déployer, PUIS révoquer l'ancienne.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(HELIUS_API_KEY|NEXT_PUBLIC_HELIUS_API_KEY|NEXT_PUBLIC_HELIUS_RPC)$/,
    autorite: "Dashboard Helius → API keys",
    geste: "Créer la nouvelle clé, la déployer, PUIS supprimer l'ancienne. ⚠️ La forme RPC porte la clé DANS l'URL : l'URL est le credential.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
    confirmer: true,
  },
  {
    motif: /^TELEGRAM_BOT_TOKEN$/,
    autorite: "BotFather → /revoke",
    geste: "/revoke invalide l'ancien jeton et en émet un nouveau dans le même geste.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^TELEGRAM_WEBHOOK_SECRET$/,
    autorite: "API Telegram — setWebhook",
    geste: "Redéclarer le webhook avec le nouveau secret. L'ancien cesse d'être envoyé par Telegram dès la redéclaration.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_URL|KV_REST_API|KV_URL|REDIS_URL)/,
    autorite: "Console Upstash → base → rotation du jeton REST",
    geste: "Roter le jeton dans la console. Vérifier à l'écran si l'ancien survit (ROLLING) ou meurt (COUPURE).",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
    confirmer: true,
  },
  {
    motif: /^STRIPE_SECRET_KEY$/,
    autorite: "Dashboard Stripe → Developers → API keys → « Roll key »",
    geste: "Roll avec période de grâce réglable, PUIS expirer l'ancienne à l'échéance choisie.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^STRIPE_WEBHOOK_SECRET$/,
    autorite: "Stripe → Webhooks → endpoint → « Roll secret »",
    geste: "Roll du secret de signature, puis expiration de l'ancien.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(TURNSTILE_SECRET|TURNSTILE_SECRET_KEY)$/,
    autorite: "Cloudflare → Turnstile → widget → rotation de la clé secrète",
    geste: "Roter la clé du widget. Vérifier à l'écran si l'ancienne reste acceptée.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
    confirmer: true,
  },
  {
    motif: /^(R2_|RAWDOCS_S3_|VAULT_R2_|OSINT_RETAIL_R2_)/,
    autorite: "Cloudflare → R2 → « Manage API Tokens »",
    geste: "Créer le nouveau jeton, le déployer, PUIS supprimer l'ancien. Création et suppression sont deux gestes séparés. ⚠️ La portée d'un jeton est REÇUE, jamais mesurée par ce dépôt : un nom en `_RO` ne prouve pas la lecture seule.",
    coupure: "ROLLING",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^GOOGLE_APPS_SCRIPT_URL$/,
    autorite: "Google Apps Script → déploiements",
    geste: "Créer un nouveau déploiement, PUIS archiver l'ancien. ⚠️ URL-capacité : l'URL EST le secret, quiconque l'a peut appeler.",
    coupure: "COUPURE",
    reecrireSuffit: false,
    branche: "invalidation",
  },
  {
    motif: /^(ALCHEMY_API_KEY|ARKHAM_API_KEY|BSCSCAN_API_KEY|FORTA_API_KEY|HYPER_API_KEY|METASLEUTH_API_KEY|ONE_INCH_API_KEY|TRONGRID_API_KEY|BIRDEYE_API_KEY|BETTERSTACK_API_TOKEN|FCA_AUTH_KEY|FCA_AUTH_EMAIL|DISCORD_BOT_TOKEN)$/,
    autorite: "Interface du fournisseur — écran exact NON ÉTABLI par cette fenêtre",
    geste: "Règle générale des clés tierces : créer ≠ invalider. Il faut supprimer explicitement l'ancienne clé dans l'interface. L'écran doit être ouvert et nommé avant de roter.",
    coupure: "à établir",
    reecrireSuffit: false,
    branche: "invalidation",
    confirmer: true,
  },
  {
    motif: /^(ADMIN_TOKEN|ADMIN_BASIC_USER|ADMIN_BASIC_PASS|CRON_SECRET|LEGAL_PDF_TOKEN|MOBILE_API_TOKEN|MM_API_TOKEN|PARTNER_API_KEY|PARTNER_API_KEY_V2|INVESTIGATOR_TOKEN)$/,
    autorite: "AUCUNE — secret émis par nous, vérifié par notre propre code",
    geste: "Aucun fournisseur ne détient ce secret : il n'existe pas d'écran où le révoquer. La fermeture passe donc par DÉMONSTRATION DE NON-OPÉRATIONNALITÉ — la nouvelle valeur est posée partout où le code compare, et un essai délibéré avec l'ANCIENNE valeur doit être refusé.",
    coupure: "COUPURE",
    reecrireSuffit: true,
    branche: "demonstration",
  },
  {
    motif: /^(VAULT_AUDIT_SALT|OSINT_RETAIL_IP_SALT|IP_HASH_SALT)$/,
    autorite: "AUCUNE — ce n'est pas une clé, c'est un SEL",
    geste: "⚠️ NE PAS ROTER sans décision explicite. Roter un sel re-clé tout l'historique haché : les empreintes déjà stockées deviennent incomparables avec les nouvelles. Rien ne casse, rien n'alerte — la corrélation cesse simplement d'être vraie.",
    coupure: "—",
    reecrireSuffit: true,
    branche: "sans-objet",
  },
  {
    motif: /^NEXT_PUBLIC_/,
    autorite: "AUCUNE — servi au navigateur par conception",
    geste: "Une valeur `NEXT_PUBLIC_*` est publique : elle part dans le bundle client. La seule protection réelle est une restriction de domaine côté fournisseur. Sauf si elle porte une clé d'API intégrée — auquel cas c'est la clé du fournisseur qu'il faut roter.",
    coupure: "—",
    reecrireSuffit: true,
    branche: "sans-objet",
  },
  {
    motif: /^VERCEL_OIDC_TOKEN$/,
    autorite: "Vercel — jeton éphémère ré-émis à chaque `vercel env pull`",
    geste: "Jeton de courte durée émis par Vercel. Aucune rotation manuelle : il expire. Vérifier la durée de vie déclarée avant de conclure.",
    coupure: "—",
    reecrireSuffit: true,
    branche: "demonstration",
    confirmer: true,
  },
];

const AUTORITE_INCONNUE = {
  autorite: "INCONNU",
  geste: "Aucune autorité déclarée pour ce nom. À trancher par une personne : soit la variable n'est pas un credential (réglage), soit son fournisseur n'a pas encore été identifié. Ce qu'il faut pour trancher : ouvrir le consommateur mesuré en colonne ④ et lire à QUI la valeur est présentée.",
  coupure: "INCONNU",
  reecrireSuffit: "inconnu",
  branche: "INCONNU",
  confirmer: true,
};

export function autoritePour(nom) {
  for (const a of AUTORITES) if (a.motif.test(nom)) return a;
  return AUTORITE_INCONNUE;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. BAC TEMPORAIRE — hors dépôt, effacé par l'instrument lui-même
// ──────────────────────────────────────────────────────────────────────────

let BAC = null;
let BAC_ETAT = "jamais-créé";

export function creerBac() {
  BAC = fs.mkdtempSync(path.join(os.tmpdir(), "rotation-cartographie-"));
  fs.chmodSync(BAC, 0o700);
  BAC_ETAT = "créé";
  return BAC;
}

/**
 * Écrase chaque fichier par de l'aléa de même taille, puis supprime.
 * Honnêteté requise : sur un système de fichiers à copie sur écriture (APFS) et
 * sur un SSD, l'écrasement logique ne garantit PAS l'effacement physique des
 * blocs. Ce geste réduit l'exposition, il ne la supprime pas. La seule garantie
 * réelle est que le fichier n'existe plus dans l'arborescence — c'est
 * exactement l'incident que cette fenêtre ferme.
 */
export function effacerBac(bac = BAC) {
  if (!bac) return { etat: "jamais-créé" };
  if (!fs.existsSync(bac)) {
    BAC_ETAT = "supprimé";
    return { etat: "supprimé" };
  }
  const pile = [bac];
  const fichiers = [];
  while (pile.length) {
    const p = pile.pop();
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) pile.push(path.join(p, e));
    } else if (st.isFile()) {
      fichiers.push({ p, taille: st.size });
    }
  }
  for (const f of fichiers) {
    try {
      if (f.taille > 0) fs.writeFileSync(f.p, randomBytes(f.taille));
      fs.unlinkSync(f.p);
    } catch {
      /* la suppression récursive ci-dessous reste la garantie */
    }
  }
  fs.rmSync(bac, { recursive: true, force: true });
  BAC_ETAT = fs.existsSync(bac) ? "ÉCHEC DE SUPPRESSION" : "supprimé";
  return { etat: BAC_ETAT, fichiersEcrases: fichiers.length };
}

function armerNettoyage() {
  const nettoyer = () => {
    try {
      effacerBac();
    } catch {
      /* rien à faire de plus au moment de mourir */
    }
  };
  process.on("exit", nettoyer);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      nettoyer();
      process.exit(130);
    });
  }
  process.on("uncaughtException", (e) => {
    nettoyer();
    process.stderr.write(`\n❌ ERREUR NON RATTRAPÉE — bac effacé. ${e && e.message ? e.message : ""}\n`);
    process.exit(4);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 7. ANTI-FUITE — le rapport est prouvé vide de valeurs avant d'exister
// ──────────────────────────────────────────────────────────────────────────

/**
 * LISTE CLOSE des valeurs qui ne peuvent pas être des credentials. Elle existe
 * parce que la première exécution en vif a fait avorter l'instrument sur
 * `NODE_ENV`, `VERCEL_ENV` et `VERCEL_TARGET_ENV` : leur valeur est le mot
 * « production », qui apparaît évidemment dans un rapport intitulé
 * « CARTOGRAPHIE VERCEL PRODUCTION ». Le crible avait raison sur la lettre et
 * tort sur le fond.
 *
 * Le choix retenu est une liste CLOSE de valeurs littérales, pas une heuristique
 * d'entropie : une heuristique se discute au cas par cas et finit par excuser
 * n'importe quoi. Une liste close se lit, et son seul trou est explicite — un
 * credential dont la valeur serait exactement « production » échapperait au
 * crible. Un tel credential ne protège rien de toute façon.
 */
export const VALEURS_NON_DISCRIMINANTES = new Set([
  "production",
  "development",
  "preview",
  "staging",
  "localhost",
  "enabled",
  "disabled",
  "postgres",
  "postgresql",
  "standard",
  "default",
  "unknown",
]);

/** Une valeur est discriminante si la trouver dans le rapport prouve une
 *  recopie, et non une coïncidence de vocabulaire. */
export function estDiscriminante(valeur) {
  const s = (Buffer.isBuffer(valeur) ? valeur.toString("latin1") : String(valeur ?? "")).trim();
  if (s.length < LONGUEUR_MIN_FUITE) return false;
  if (VALEURS_NON_DISCRIMINANTES.has(s.toLowerCase())) return false;
  if (/^[0-9]+([.,][0-9]+)?$/.test(s)) return false;
  return true;
}

/**
 * Cherche toute valeur connue dans le texte rendu. Retourne la liste des
 * ÉTIQUETTES fautives (jamais la valeur). Une liste non vide doit faire avorter
 * l'instrument sans rien écrire : mieux vaut aucun rapport qu'un rapport qui
 * recopie un secret.
 */
export function chercherFuite(texte, valeursEtiquetees) {
  const fautes = [];
  for (const { etiquette, valeur } of valeursEtiquetees) {
    if (!estDiscriminante(valeur)) continue;
    const s = Buffer.isBuffer(valeur) ? valeur.toString("latin1") : String(valeur ?? "");
    if (texte.includes(s)) fautes.push(etiquette);
  }
  return fautes;
}

// ──────────────────────────────────────────────────────────────────────────
// 8. LECTURE DE VERCEL — par le fondateur, avec SA session
// ──────────────────────────────────────────────────────────────────────────

function preparerLienProjet(bac, racineDepot) {
  const src = path.join(racineDepot, ".vercel");
  const lien = path.join(bac, "lien");
  fs.mkdirSync(path.join(lien, ".vercel"), { recursive: true });
  let copies = 0;
  for (const f of ["project.json", "repo.json"]) {
    const s = path.join(src, f);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, path.join(lien, ".vercel", f));
      copies++;
    }
  }
  return { lien, copies };
}

function lancerVercel(args, lien) {
  const bin = process.env.VERCEL_BIN || "vercel";
  return spawnSync(bin, [...args, "--cwd", lien, "--no-color"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * ① les NOMS présents en Production viennent de `vercel env ls` — qui ne
 *    décrypte rien. C'est la source fiable de la colonne « présent ».
 * ② les VALEURS viennent de `vercel env pull` — qui ne peut pas relire une
 *    variable marquée « sensitive ». Un nom présent en ① mais sans valeur en ②
 *    n'est PAS absent : il est NON RELISIBLE, et la colonne « identique ? »
 *    vaut alors INCONNU. Confondre les deux ferait déclarer « pas en prod » une
 *    variable bien présente — précisément le genre de trou qui ferme un
 *    incident sur le papier.
 */
export function lireVercel(bac, racineDepot) {
  const res = { disponible: false, noms: new Map(), valeurs: new Map(), nonConformes: [], erreurs: [] };
  const { lien, copies } = preparerLienProjet(bac, racineDepot);
  if (copies === 0) {
    res.erreurs.push("Aucun lien de projet trouvé (.vercel/project.json). Le dépôt n'est pas lié à un projet Vercel.");
    return res;
  }

  const ls = lancerVercel(["env", "ls", "production", "--format", "json"], lien);
  if (ls.status === 0 && ls.stdout) {
    try {
      const debut = ls.stdout.indexOf("{") === -1 ? ls.stdout.indexOf("[") : ls.stdout.indexOf("{");
      const brut = JSON.parse(ls.stdout.slice(debut >= 0 ? debut : 0));
      const liste = Array.isArray(brut) ? brut : brut.envs || brut.environmentVariables || [];
      for (const e of liste) {
        if (!e || !e.key) continue;
        // On ne lit QUE ces champs. Un éventuel champ de valeur n'est jamais touché.
        res.noms.set(e.key, {
          type: e.type || "inconnu",
          cibles: Array.isArray(e.target) ? e.target.join("+") : String(e.target || "production"),
        });
      }
      res.disponible = true;
    } catch (e) {
      res.erreurs.push(`Sortie JSON de \`vercel env ls\` illisible (${e.message}).`);
    }
  } else {
    res.erreurs.push(`\`vercel env ls production\` a échoué (code ${ls.status}). Session Vercel probablement expirée : \`vercel login\`.`);
  }

  const cible = path.join(bac, "prod.env");
  const pull = lancerVercel(["env", "pull", cible, "--environment", "production", "--yes"], lien);
  if (pull.status === 0 && fs.existsSync(cible)) {
    const extrait = extraireOctets(fs.readFileSync(cible));
    for (const [nom, a] of indexer(extrait)) res.valeurs.set(nom, a);
    res.nonConformes = extrait.nonConformes;
    res.disponible = true;
  } else {
    res.erreurs.push(`\`vercel env pull\` a échoué (code ${pull.status}). Les colonnes de VALEUR resteront INCONNU ; la colonne de PRÉSENCE reste valable si \`env ls\` a répondu.`);
  }

  return res;
}

// ──────────────────────────────────────────────────────────────────────────
// 9. CARTOGRAPHIE
// ──────────────────────────────────────────────────────────────────────────

const INCONNU = "INCONNU";

/**
 * Construit la ligne d'inventaire de chaque nom rencontré, quelle que soit sa
 * source. Le principe qui gouverne tout : une case qu'on n'a pas mesurée vaut
 * INCONNU, jamais « non ». Un inventaire qui comble ses trous par supposition
 * ferme l'incident sur le papier et le laisse ouvert en vrai.
 */
export function cartographier({ nonce, expose, poste, vercel, conso }) {
  const iExpose = expose ? indexer(expose) : null;
  const iPoste = poste ? indexer(poste) : null;

  const noms = new Set();
  if (iExpose) for (const n of iExpose.keys()) noms.add(n);
  if (iPoste) for (const n of iPoste.keys()) noms.add(n);
  if (vercel) {
    for (const n of vercel.noms.keys()) noms.add(n);
    for (const n of vercel.valeurs.keys()) noms.add(n);
  }
  if (conso) for (const n of conso.keys()) noms.add(n);

  // Empreintes par source, et index inverse empreinte → noms (colonne ③).
  const parSource = { expose: new Map(), poste: new Map(), vercel: new Map() };
  const inverse = new Map();
  const ajouter = (source, nom, aff) => {
    if (!aff) return;
    const fp = empreinte(nonce, aff.normale);
    parSource[source].set(nom, fp);
    if (fp === "#vide") return;
    if (!inverse.has(fp)) inverse.set(fp, new Set());
    inverse.get(fp).add(nom);
  };
  for (const n of noms) {
    if (iExpose) ajouter("expose", n, iExpose.get(n));
    if (iPoste) ajouter("poste", n, iPoste.get(n));
    if (vercel) ajouter("vercel", n, vercel.valeurs.get(n));
  }

  // Empreintes des lignes non conformes du fichier exposé : c'est par là que
  // la ligne 18 — un secret que personne ne « lisait » — devient visible.
  const orphelines = (expose ? expose.nonConformes : []).map((nc) => ({
    ...nc,
    empreinte: empreinte(nonce, nc.octetsBruts),
  }));

  const lignes = [];
  for (const nom of [...noms].sort()) {
    const aExpose = iExpose ? iExpose.get(nom) : undefined;
    const aPoste = iPoste ? iPoste.get(nom) : undefined;
    const aVercel = vercel ? vercel.valeurs.get(nom) : undefined;
    const fpExpose = parSource.expose.get(nom) ?? null;
    const fpPoste = parSource.poste.get(nom) ?? null;
    const fpVercel = parSource.vercel.get(nom) ?? null;

    // ── Exposition ────────────────────────────────────────────────────────
    let exposition;
    if (!expose) {
      exposition = INCONNU; // le fichier exposé n'est plus lisible
    } else if (aExpose) {
      exposition = "EXPOSÉ (sous ce nom)";
    } else {
      // La valeur vivante correspond-elle à un octet parti sous un AUTRE nom,
      // ou sans nom du tout ? C'est la seule façon d'attraper la ligne 18.
      const fpVivant = fpVercel ?? fpPoste;
      const sousAutreNom = fpVivant && fpVivant !== "#vide" && [...parSource.expose.values()].includes(fpVivant);
      const dansOrpheline = fpVivant && orphelines.some((o) => o.empreinte === fpVivant);
      if (dansOrpheline) exposition = "EXPOSÉ (ligne sans nom de variable)";
      else if (sousAutreNom) exposition = "EXPOSÉ (sous un autre nom)";
      else exposition = "non exposé";
    }

    // ── ① présent dans Vercel Production ? ────────────────────────────────
    let colVercel;
    if (!vercel || !vercel.disponible) colVercel = INCONNU;
    else if (vercel.noms.size === 0) colVercel = INCONNU;
    else if (vercel.noms.has(nom)) {
      const t = vercel.noms.get(nom);
      colVercel = t.type && t.type !== "inconnu" ? `OUI (${t.type})` : "OUI";
    } else colVercel = vercel.valeurs.has(nom) ? "OUI (via pull)" : "non";

    // ── ② identique à la valeur exposée ? ─────────────────────────────────
    let colIdentique;
    if (!aExpose) colIdentique = exposition.startsWith("EXPOSÉ") ? "voir §variantes" : "sans objet (non exposé)";
    else if (!vercel || !vercel.disponible) colIdentique = `${INCONNU} (Vercel non lu)`;
    else if (!aVercel) {
      colIdentique = vercel.noms.has(nom)
        ? `${INCONNU} — présente mais NON RELISIBLE (variable sensible)`
        : `${INCONNU} — absente de la lecture Vercel`;
    } else colIdentique = fpVercel === fpExpose ? "⚠️ IDENTIQUE" : "différente";

    // ── ②′ identique à la valeur du poste ? ───────────────────────────────
    // Mesurable sans Vercel, et c'est CETTE comparaison qui a établi que cinq
    // credentials exposés étaient encore vivants. Un secret exposé égal à la
    // valeur du poste est vivant, que Vercel soit lisible ou non.
    let colIdentiquePoste;
    if (!aExpose) colIdentiquePoste = exposition.startsWith("EXPOSÉ") ? "voir §variantes" : "sans objet (non exposé)";
    else if (!poste) colIdentiquePoste = `${INCONNU} (poste non lu)`;
    else if (!aPoste) colIdentiquePoste = "absente du poste";
    else colIdentiquePoste = fpPoste === fpExpose ? "⚠️ IDENTIQUE" : "différente";

    // ── ③ alias ou doublon ────────────────────────────────────────────────
    const fpRef = fpVercel ?? fpPoste ?? fpExpose;
    let colAlias = "—";
    if (fpRef && fpRef !== "#vide" && inverse.has(fpRef)) {
      const autres = [...inverse.get(fpRef)].filter((x) => x !== nom).sort();
      if (autres.length) colAlias = `= ${autres.join(", ")}`;
    }
    if (aExpose && aExpose.redefinie) colAlias += " · redéfinie deux fois dans le fichier exposé";

    // ── ④ consommateurs ───────────────────────────────────────────────────
    let colConso;
    if (!conso) colConso = INCONNU;
    else if (!conso.has(nom)) colConso = "aucun dans ce dépôt";
    else {
      const c = conso.get(nom);
      const tops = [...c.fichiers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f);
      colConso = `${c.total} lecture(s), ${c.fichiers.size} fichier(s) — ex. ${tops.join(", ")}`;
    }

    // ── ⑤ révocation ──────────────────────────────────────────────────────
    const aut = autoritePour(nom);

    lignes.push({
      nom,
      exposition,
      colVercel,
      colIdentique,
      colIdentiquePoste,
      colAlias,
      colConso,
      autorite: aut,
      fpExpose,
      fpPoste,
      fpVercel,
      valeurExposee: aExpose ? aExpose.normale : null,
      valeurPoste: aPoste ? aPoste.normale : null,
      valeurVercel: aVercel ? aVercel.normale : null,
    });
  }

  // ── Variantes déguisées : comparaison COMPOSANT PAR COMPOSANT ───────────
  const variantes = [];
  for (const l of lignes) {
    const sources = [
      ["exposé", l.valeurExposee],
      ["poste", l.valeurPoste],
      ["Vercel Prod", l.valeurVercel],
    ].filter(([, v]) => v && v.length > 0);
    if (sources.length < 1) continue;
    const decomposes = sources
      .map(([src, v]) => [src, decomposerValeur(v.toString("utf8"))])
      .filter(([, d]) => d !== null);
    if (decomposes.length === 0) continue;

    const composants = decomposes[0][1].composantsSensibles;
    const avecExpose = decomposes.some(([src]) => src === "exposé");
    const rangs = [];
    for (const c of composants) {
      const cellules = decomposes.map(([src, d]) => [src, empreinte(nonce, d.composants[c] ?? "")]);
      const distincts = new Set(cellules.map(([, fp]) => fp));
      // Une seule source ne se compare à rien. Écrire « identique » sur un rang
      // à source unique serait un verdict inventé : null, et le rendu le dit.
      rangs.push({ composant: c, cellules, identique: cellules.length >= 2 ? distincts.size === 1 : null });
    }
    for (const [src, d] of decomposes) {
      for (const [k, v] of Object.entries(d.clesIntegrees)) {
        rangs.push({
          composant: `clé intégrée « ${k} » (${src})`,
          cellules: [[src, empreinte(nonce, v)]],
          identique: null,
        });
      }
    }
    variantes.push({
      nom: l.nom,
      type: decomposes[0][1].type,
      avecExpose,
      sources: decomposes.map(([src, d]) => [src, d.composants.variante]),
      rangs,
    });
  }

  // ── REMONTÉE DU VERDICT PAR COMPOSANT JUSQU'À LA LIGNE ──────────────────
  //
  // Sans ce passage, `DATABASE_URL` resterait marquée « différente » — donc
  // 🟠, donc pas urgente — alors que la section des variantes montre son mot de
  // passe IDENTIQUE. L'inventaire reproduirait exactement le faux négatif qu'il
  // existe pour corriger. Un composant critique identique suffit : le
  // credential est vivant, quelle que soit la différence des chaînes.
  // Un composant est CRITIQUE quand il EST le secret : le mot de passe d'une URL
  // de connexion, la clé noyée dans une URL d'API. L'hôte, l'utilisateur et le
  // nom de base ne le sont pas — ils identifient la cible, ils ne l'ouvrent pas.
  const estCritique = (c) => c === "motDePasse" || c.startsWith("clé intégrée");

  /** Composants critiques d'une valeur, sous forme [étiquette, empreinte]. */
  const composantsCritiques = (valeur) => {
    if (!valeur || valeur.length === 0) return [];
    const d = decomposerValeur(valeur.toString("utf8"));
    if (!d) return [];
    const out = [];
    for (const c of d.composantsSensibles) {
      if (estCritique(c) && d.composants[c]) out.push([c, empreinte(nonce, d.composants[c])]);
    }
    for (const [k, val] of Object.entries(d.clesIntegrees)) out.push([`clé intégrée « ${k} »`, empreinte(nonce, val)]);
    return out;
  };

  // Index des composants critiques VIVANTS, toutes variables confondues. C'est
  // lui qui attrape le cas transversal : le mot de passe parti sous le nom
  // `DATABASE_URL_UNPOOLED` survit peut-être sous le nom `DATABASE_URL`. Deux
  // noms, un seul secret — et une comparaison nom à nom ne le voit pas.
  const vivants = new Map();
  for (const l of lignes) {
    for (const [src, valeur] of [
      ["poste", l.valeurPoste],
      ["Vercel Prod", l.valeurVercel],
    ]) {
      for (const [c, fp] of composantsCritiques(valeur)) {
        if (!vivants.has(fp)) vivants.set(fp, new Set());
        vivants.get(fp).add(`${l.nom}.${c} (${src})`);
      }
    }
  }

  const transversaux = [];
  for (const l of lignes) {
    const critiques = composantsCritiques(l.valeurExposee);
    if (critiques.length === 0) continue;
    const trouves = [];
    for (const [c, fp] of critiques) {
      const ou = vivants.get(fp);
      if (!ou || ou.size === 0) continue;
      trouves.push({ composant: c, empreinte: fp, vivantSous: [...ou].sort() });
    }
    if (trouves.length === 0) continue;
    transversaux.push({ nom: l.nom, trouves });

    // Remontée jusqu'à la ligne : sans elle, `DATABASE_URL` resterait
    // « différente » — donc 🟠, donc pas urgente — alors que son mot de passe
    // est vivant. L'inventaire reproduirait le faux négatif qu'il corrige.
    const resume = trouves
      .map((t) => `${t.composant} vivant sous ${t.vivantSous.join(", ")}`)
      .join(" ; ");
    const marque = `⚠️ IDENTIQUE par composant — ${resume} · la chaîne diffère, le secret non`;
    const surPoste = trouves.some((t) => t.vivantSous.some((s) => s.endsWith("(poste)")));
    const surVercel = trouves.some((t) => t.vivantSous.some((s) => s.endsWith("(Vercel Prod)")));
    // La remontée écrase TOUTE cellule qui n'annonce pas déjà une identité,
    // « absente du poste » comprise : cette mention rassure, alors que le
    // secret de la variable absente est vivant sous un autre nom.
    if (surPoste && !l.colIdentiquePoste.includes("IDENTIQUE")) l.colIdentiquePoste = marque;
    if (surVercel && !l.colIdentique.includes("IDENTIQUE")) l.colIdentique = marque;
  }

  // ── Orphelines : à quel credential vivant correspond chaque ligne nue ? ──
  const orphelinesResolues = orphelines.map((o) => {
    const correspond = [];
    for (const l of lignes) {
      if (l.fpPoste === o.empreinte) correspond.push(`${l.nom} (poste)`);
      if (l.fpVercel === o.empreinte) correspond.push(`${l.nom} (Vercel Prod)`);
      if (l.fpExpose === o.empreinte) correspond.push(`${l.nom} (fichier exposé)`);
    }
    return { ...o, correspond };
  });

  return { lignes, variantes, transversaux, orphelines: orphelinesResolues };
}

// ──────────────────────────────────────────────────────────────────────────
// 10. RENDU
// ──────────────────────────────────────────────────────────────────────────

function tailleSure(p) {
  try {
    const st = fs.statSync(p);
    return `${st.size} octets`;
  } catch {
    return "illisible";
  }
}

export function rendre({ carte, sources, vercel, conso, horodatage, compteurs }) {
  const L = [];
  const P = (s = "") => L.push(s);

  P(`# CARTOGRAPHIE VERCEL PRODUCTION — ${horodatage}`);
  P();
  P(`Produit par \`scripts/rotation/cartographie-vercel.mjs\` v${VERSION}.`);
  P();
  P("**Ce rapport ne contient aucune valeur de secret.** Il ne contient que des noms, des positions,");
  P("des compteurs et des empreintes. Chaque empreinte est un HMAC-SHA256 salé par un **nonce de session");
  P("de 32 octets aléatoires**, gardé en mémoire et perdu à la fin de l'exécution.");
  P();
  P("Deux conséquences à accepter telles quelles :");
  P();
  P("1. Une empreinte ne permet pas de retrouver la valeur, même par dictionnaire — le HMAC est clé.");
  P("2. **Deux exécutions ne sont pas comparables.** Le même secret produit deux empreintes différentes");
  P("   d'un rapport à l'autre. Comparer deux rapports n'a aucun sens ; seules les comparaisons FAITES");
  P("   À L'INTÉRIEUR d'un rapport sont valables. Ce rapport se relit, il ne se diffe pas.");
  P();
  P("**Aucune rotation n'a eu lieu pendant cette exécution.** L'instrument ne crée, ne révoque, n'invalide");
  P("rien, et n'a présenté aucun credential à aucun fournisseur.");
  P();
  P("---");
  P();
  P("## Sources lues");
  P();
  P("| Source | Chemin | Taille | Affectations | Lignes non conformes |");
  P("|---|---|---|---|---|");
  for (const s of sources) {
    P(`| ${s.role} | \`${s.chemin}\` | ${s.taille} | ${s.affectations} | ${s.nonConformes} |`);
  }
  if (vercel && vercel.disponible) {
    P(`| Vercel Production (noms) | \`vercel env ls production\` | ${vercel.noms.size} nom(s) | — | — |`);
    P(`| Vercel Production (valeurs) | \`vercel env pull\` (bac temporaire) | ${vercel.valeurs.size} valeur(s) | — | ${vercel.nonConformes.length} |`);
  } else {
    P("| Vercel Production | **non lu** | — | — | — |");
  }
  P();
  if (vercel && vercel.erreurs.length) {
    P("> ⚠️ **Lecture Vercel incomplète.** Les colonnes concernées valent INCONNU, pas « non ».");
    for (const e of vercel.erreurs) P(`> - ${e}`);
    P();
  }
  if (!conso) {
    P("> ⚠️ **La mesure des consommateurs a échoué.** La colonne ④ vaut INCONNU partout. « Aucun consommateur");
    P("> mesuré » et « mesure impossible » ne sont pas la même chose : ne supprimez aucune variable sur la foi");
    P("> de cette colonne tant qu'elle est INCONNU.");
    P();
  }

  P("---");
  P();
  P("## Inventaire — les cinq colonnes");
  P();
  P("`⚠️ IDENTIQUE` en colonne ② ou ②′ veut dire : **la valeur partie en production est encore une valeur**");
  P("**vivante.** C'est ce qui décide de l'urgence, et rien d'autre. 🔴 = exposé ET encore vivant quelque part ·");
  P("🟠 = exposé, remplacé depuis, **statut fournisseur inconnu** · ⚪ = actif mais non exposé · ❔ = exposition");
  P("non mesurable (fichier exposé absent).");
  P();
  P("⚠️ **« Remplacé » ne veut pas dire « mort ».** Une valeur 🟠 a été remplacée ici ; rien ne dit que le");
  P("fournisseur la refuse. C'est exactement l'erreur que la colonne ⑤ existe pour empêcher.");
  P();
  P("| Variable | Exposition | ① Vercel Prod | ② = exposé ? (Vercel) | ②′ = exposé ? (poste) | ③ Alias / doublon | ④ Consommateurs | ⑤ Révocation |");
  P("|---|---|---|---|---|---|---|---|");
  for (const l of carte.lignes) {
    const encoreVivant = l.colIdentique.includes("IDENTIQUE") || l.colIdentiquePoste.includes("IDENTIQUE");
    const marque = l.exposition.startsWith("EXPOSÉ")
      ? encoreVivant
        ? "🔴"
        : "🟠"
      : l.exposition === INCONNU
        ? "❔"
        : "⚪";
    P(
      `| ${marque} \`${l.nom}\` | ${l.exposition} | ${l.colVercel} | ${l.colIdentique} | ${l.colIdentiquePoste} | ${l.colAlias} | ${l.colConso} | ${l.autorite.autorite}${l.autorite.confirmer ? " *(à confirmer)*" : ""} |`,
    );
  }
  P();

  P("---");
  P();
  P("## Lignes non conformes du fichier exposé");
  P();
  P("Une ligne sans `=` n'est chargée par aucun parseur dotenv : elle n'apparaît dans aucune liste de");
  P("variables. Mais c'est du texte dans un fichier, et **le fichier est parti verbatim**. Son contenu n'est");
  P("pas imprimé ici — seulement compté, mesuré et empreinté, ce qui suffit à l'identifier par correspondance.");
  P();
  if (carte.orphelines.length === 0) {
    P("_Aucune ligne non conforme dans le fichier exposé._");
  } else {
    P("| Ligne | Octets | Motif | Empreinte | Correspond à |");
    P("|---|---|---|---|---|");
    for (const o of carte.orphelines) {
      P(
        `| ${o.ligne} | ${o.octets} | ${o.motif} | \`${o.empreinte}\` | ${o.correspond.length ? "⚠️ " + o.correspond.join(", ") : "aucune correspondance mesurée"} |`,
      );
    }
    P();
    P("> Une correspondance ici signifie qu'un credential **vivant** est parti en production **sans jamais");
    P("> porter de nom de variable**. Un inventaire par noms l'aurait manqué. Toute vérification future doit");
    P("> porter sur le contenu expédié, pas sur la liste des variables déclarées.");
  }
  P();

  P("---");
  P();
  P("## Variantes déguisées — comparaison composant par composant");
  P();
  P("Une comparaison de chaînes rend un **faux négatif** quand deux URL ne diffèrent que par l'hôte.");
  P("Pooler contre direct : même utilisateur, même endpoint, **même mot de passe** — et une chaîne");
  P("« différente ». C'est pourquoi l'égalité est établie composant par composant, l'hôte exclu.");
  P();
  if (carte.variantes.length === 0) {
    P("_Aucune URL de connexion ni URL porteuse de clé n'a été rencontrée._");
  } else {
    for (const v of carte.variantes) {
      P(`### \`${v.nom}\` — ${v.type}`);
      P();
      P(`Variantes d'hôte observées : ${v.sources.map(([s, t]) => `${s} → **${t}**`).join(" · ")}`);
      P();
      P("| Composant | " + v.rangs[0].cellules.map(([s]) => s).join(" | ") + " | Verdict |");
      P("|---|" + v.rangs[0].cellules.map(() => "---|").join("") + "---|");
      for (const r of v.rangs) {
        const cells = r.cellules.map(([, fp]) => `\`${fp}\``).join(" | ");
        const verdict =
          r.identique === null
            ? r.cellules.length < 2
              ? "source unique — rien à comparer"
              : "—"
            : r.identique
              ? "identique"
              : "différent";
        // L'alerte ne se déclenche que si l'un des termes comparés EST le
        // fichier exposé. « Identique entre deux sources vivantes » ne dit rien
        // de l'exposition.
        const alerte = v.avecExpose && r.identique === true && /motDePasse|clé intégrée/.test(r.composant) ? " ⚠️" : "";
        P(`| ${r.composant} | ${cells} | ${verdict}${alerte} |`);
      }
      if (!v.avecExpose) {
        P();
        P("_Cette variable n'a pas de terme dans le fichier exposé : les empreintes ci-dessus documentent sa");
        P("composition, elles n'établissent aucune exposition._");
      }
      P();
    }
    P("> ⚠️ sur la ligne `motDePasse` signifie que **le mot de passe exposé est encore le mot de passe vivant**,");
    P("> quelle que soit la différence apparente des chaînes.");
  }
  P();

  P("---");
  P();
  P("## Secrets transversaux — un même secret sous plusieurs noms");
  P();
  P("Un secret parti sous un nom peut survivre sous un autre. Le cas mesuré : un mot de passe expédié dans");
  P("`DATABASE_URL_UNPOOLED` reste vivant s'il est encore le mot de passe de `DATABASE_URL`. Une comparaison");
  P("nom à nom ne le voit pas, et une rotation qui ne traite que le premier nom laisse la porte ouverte.");
  P();
  if (!carte.transversaux || carte.transversaux.length === 0) {
    P("_Aucun composant critique exposé ne correspond à un composant critique vivant._");
  } else {
    P("| Variable exposée | Composant critique | Empreinte | Encore vivant sous |");
    P("|---|---|---|---|");
    for (const t of carte.transversaux) {
      for (const f of t.trouves) {
        P(`| \`${t.nom}\` | ${f.composant} | \`${f.empreinte}\` | ⚠️ ${f.vivantSous.join(", ")} |`);
      }
    }
    P();
    P("> Chaque ligne de ce tableau est un credential **encore opérationnel** parti en production. La rotation");
    P("> doit traiter le SECRET, pas le nom de variable : réécrire une seule des variables qui le portent ne");
    P("> ferme rien.");
  }
  P();
  P("---");
  P();
  P("## Ce que cette exécution N'ÉTABLIT PAS");
  P();
  const inconnus = carte.lignes.filter(
    (l) =>
      l.colVercel === INCONNU ||
      l.colIdentique.includes(INCONNU) ||
      l.colIdentiquePoste.includes(INCONNU) ||
      l.colConso === INCONNU ||
      l.autorite.autorite === "INCONNU" ||
      l.autorite.confirmer,
  );
  if (inconnus.length === 0) {
    P("_Aucune case laissée en INCONNU._");
  } else {
    P("| Variable | Case non établie | Ce qu'il faut pour trancher |");
    P("|---|---|---|");
    for (const l of inconnus) {
      const cases = [];
      if (l.colVercel === INCONNU) cases.push("① présence Vercel");
      if (l.colIdentique.includes(INCONNU)) cases.push("② identité à l'exposé");
      if (l.colConso === INCONNU) cases.push("④ consommateurs");
      if (l.autorite.autorite === "INCONNU") cases.push("⑤ autorité");
      else if (l.autorite.confirmer) cases.push("⑤ mécanisme déduit, non mesuré");
      let remede;
      if (l.colIdentique.includes("NON RELISIBLE")) {
        remede =
          "Variable marquée sensible : Vercel ne la relit jamais. Trancher = la RE-POSER avec une valeur neuve (ce qui rend la question sans objet), ou accepter l'inconnu et roter par précaution.";
      } else if (l.colVercel === INCONNU) {
        remede = "Ouvrir Vercel → Settings → Environment Variables → Production et lire la liste des noms à l'écran.";
      } else if (l.autorite.autorite === "INCONNU") {
        remede = l.autorite.geste;
      } else {
        remede = "Ouvrir l'écran nommé en ⑤ et vérifier de visu si l'ancienne valeur survit à la création de la nouvelle.";
      }
      P(`| \`${l.nom}\` | ${cases.join(" · ")} | ${remede} |`);
    }
  }
  P();

  P("---");
  P();
  P("## Compteurs");
  P();
  for (const [k, v] of Object.entries(compteurs)) P(`- ${k} : **${v}**`);
  P();
  P("---");
  P();
  P("## Critère de fermeture");
  P();
  P("> For every credential materially exposed in retained deployment bytes, either the credential has been");
  P("> independently invalidated at its authority, or it has been demonstrated non-operational; replacing a");
  P("> local or deployment value alone does not close exposure.");
  P();
  P("Branche retenue pour chaque credential **exposé** de cet inventaire :");
  P();
  P("| Variable | Branche | Mesure concrète |");
  P("|---|---|---|");
  for (const l of carte.lignes) {
    if (!l.exposition.startsWith("EXPOSÉ")) continue;
    const b =
      l.autorite.branche === "invalidation"
        ? "invalidation chez le fournisseur"
        : l.autorite.branche === "demonstration"
          ? "démonstration de non-opérationnalité"
          : l.autorite.branche;
    P(`| \`${l.nom}\` | ${b} | ${l.autorite.geste} |`);
  }
  P();
  return L.join("\n") + "\n";
}

// ──────────────────────────────────────────────────────────────────────────
// 11. PROGRAMME
// ──────────────────────────────────────────────────────────────────────────

const AIDE = `
CARTOGRAPHIE VERCEL PRODUCTION — instrument de lecture seule (v${VERSION})

  node scripts/rotation/cartographie-vercel.mjs [options]

  --expose <chemin>   Fichier dont les OCTETS sont partis en production.
                      Défaut : <racine du dépôt>/.env
  --poste <chemin>    Fichier des valeurs courantes du poste.
                      Défaut : <racine du dépôt>/.env.local
  --depot <chemin>    Racine du dépôt (lien Vercel + mesure des consommateurs).
                      Défaut : la racine git du répertoire courant.
  --sortie <chemin>   Fichier de rapport. REFUSÉ s'il est dans le dépôt.
                      Défaut : ~/interligens-attestations/rotation/
  --sans-vercel       Répétition à blanc : aucune commande Vercel n'est lancée.
  --stdout            Imprime aussi le rapport complet dans le terminal.
  --aide              Ce texte.

  Cet instrument ne rote rien, ne révoque rien, n'écrit dans aucun fichier
  d'environnement, et n'imprime aucune valeur.
`;

function analyserArgs(argv) {
  const o = { sansVercel: false, stdout: false, aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--aide" || a === "-h" || a === "--help") o.aide = true;
    else if (a === "--sans-vercel") o.sansVercel = true;
    else if (a === "--stdout") o.stdout = true;
    else if (a === "--expose") o.expose = argv[++i];
    else if (a === "--poste") o.poste = argv[++i];
    else if (a === "--depot") o.depot = argv[++i];
    else if (a === "--sortie") o.sortie = argv[++i];
    else throw new Error(`Option inconnue : ${a}`);
  }
  return o;
}

function racineGit(depart) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: depart, encoding: "utf8" });
  if (r.status === 0) return r.stdout.trim();
  return depart;
}

function horodatageUTC() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function principal(argv) {
  const opts = analyserArgs(argv);
  if (opts.aide) {
    process.stdout.write(AIDE);
    return 0;
  }

  const depot = path.resolve(opts.depot || racineGit(process.cwd()));
  const cheminExpose = path.resolve(opts.expose || path.join(depot, ".env"));
  const cheminPoste = path.resolve(opts.poste || path.join(depot, ".env.local"));

  const defautSortie = path.join(os.homedir(), "interligens-attestations", "rotation");
  let cheminSortie = path.resolve(opts.sortie || path.join(defautSortie, `cartographie-${horodatageUTC().replace(/[:]/g, "")}.md`));
  if (fs.existsSync(cheminSortie) && fs.statSync(cheminSortie).isDirectory()) {
    cheminSortie = path.join(cheminSortie, `cartographie-${horodatageUTC().replace(/[:]/g, "")}.md`);
  }

  // Le rapport ne contient pas de valeur, mais RIEN de ce que produit cet
  // instrument n'entre dans le dépôt : c'est exactement l'incident en cours.
  const rel = path.relative(depot, cheminSortie);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    process.stderr.write(
      `❌ REFUS : la sortie « ${cheminSortie} » est à l'intérieur du dépôt « ${depot} ».\n` +
        `   Rien de ce que produit cet instrument n'a le droit d'atterrir dans l'arbre de travail.\n` +
        `   Choisissez un chemin hors du dépôt avec --sortie.\n`,
    );
    return 2;
  }

  process.stdout.write(`\nCARTOGRAPHIE VERCEL PRODUCTION v${VERSION} — LECTURE SEULE\n`);
  process.stdout.write(`  dépôt          : ${depot}\n`);
  process.stdout.write(`  octets exposés : ${cheminExpose}${fs.existsSync(cheminExpose) ? "" : "   (ABSENT)"}\n`);
  process.stdout.write(`  valeurs poste  : ${cheminPoste}${fs.existsSync(cheminPoste) ? "" : "   (ABSENT)"}\n`);

  const nonce = nouveauNonce();
  armerNettoyage();
  const bac = creerBac();
  process.stdout.write(`  bac temporaire : ${bac}\n\n`);

  let code = 0;
  try {
    const expose = fs.existsSync(cheminExpose) ? extraireOctets(fs.readFileSync(cheminExpose)) : null;
    const poste = fs.existsSync(cheminPoste) ? extraireOctets(fs.readFileSync(cheminPoste)) : null;

    if (!expose) {
      process.stdout.write("  ⚠️  Fichier exposé absent : la colonne « exposition » vaudra INCONNU partout.\n\n");
    }

    let vercel = null;
    if (opts.sansVercel) {
      process.stdout.write("  → Vercel NON interrogé (--sans-vercel). Répétition à blanc.\n");
    } else {
      process.stdout.write("  → Lecture de Vercel Production (vercel env ls, puis vercel env pull)…\n");
      vercel = lireVercel(bac, depot);
      process.stdout.write(
        `     noms lus : ${vercel.noms.size} · valeurs relues : ${vercel.valeurs.size} · erreurs : ${vercel.erreurs.length}\n`,
      );
    }

    process.stdout.write("  → Mesure des consommateurs dans le code…\n");
    const conso = consommateurs(depot);

    const carte = cartographier({ nonce, expose, poste, vercel, conso });

    const compteurs = {
      "variables inventoriées": carte.lignes.length,
      "exposées et encore vivantes (🔴)": carte.lignes.filter(
        (l) => l.colIdentique.includes("IDENTIQUE") || l.colIdentiquePoste.includes("IDENTIQUE"),
      ).length,
      "exposées mais remplacées depuis (🟠, statut fournisseur inconnu)": carte.lignes.filter(
        (l) =>
          l.exposition.startsWith("EXPOSÉ") &&
          !l.colIdentique.includes("IDENTIQUE") &&
          !l.colIdentiquePoste.includes("IDENTIQUE"),
      ).length,
      "actives mais non exposées (⚪)": carte.lignes.filter((l) => l.exposition === "non exposé").length,
      "lignes non conformes dans le fichier exposé": expose ? expose.compteurs.nonConformes : "INCONNU",
      "lignes non conformes correspondant à un credential vivant": carte.orphelines.filter((o) => o.correspond.length).length,
      "composants critiques exposés encore vivants": carte.transversaux.reduce((n, t) => n + t.trouves.length, 0),
      "présentes en Production mais lues nulle part dans le code": carte.lignes.filter(
        (l) => l.colVercel.startsWith("OUI") && l.colConso === "aucun dans ce dépôt",
      ).length,
      "lues par le code mais absentes de Production": carte.lignes.filter(
        (l) => l.colVercel === "non" && l.colConso !== "aucun dans ce dépôt" && l.colConso !== INCONNU,
      ).length,
      "cases laissées en INCONNU": carte.lignes.filter(
        (l) => l.colVercel === INCONNU || l.colIdentique.includes(INCONNU) || l.colConso === INCONNU,
      ).length,
    };

    const sources = [
      {
        role: "Octets exposés",
        chemin: cheminExpose,
        taille: expose ? tailleSure(cheminExpose) : "ABSENT",
        affectations: expose ? expose.compteurs.affectations : "—",
        nonConformes: expose ? expose.compteurs.nonConformes : "—",
      },
      {
        role: "Valeurs du poste",
        chemin: cheminPoste,
        taille: poste ? tailleSure(cheminPoste) : "ABSENT",
        affectations: poste ? poste.compteurs.affectations : "—",
        nonConformes: poste ? poste.compteurs.nonConformes : "—",
      },
    ];

    const rapport = rendre({ carte, sources, vercel, conso, horodatage: horodatageUTC(), compteurs });

    // ── LE CRIBLE ─────────────────────────────────────────────────────────
    const etiquetees = [];
    for (const l of carte.lignes) {
      if (l.valeurExposee) etiquetees.push({ etiquette: `${l.nom} (exposé)`, valeur: l.valeurExposee });
      if (l.valeurPoste) etiquetees.push({ etiquette: `${l.nom} (poste)`, valeur: l.valeurPoste });
      if (l.valeurVercel) etiquetees.push({ etiquette: `${l.nom} (Vercel)`, valeur: l.valeurVercel });
    }
    for (const o of carte.orphelines) etiquetees.push({ etiquette: `ligne ${o.ligne} (non conforme)`, valeur: o.octetsBruts });
    const ecartees = etiquetees.filter((e) => !estDiscriminante(e.valeur)).map((e) => e.etiquette);
    const fuites = chercherFuite(rapport, etiquetees);
    if (fuites.length) {
      process.stderr.write(
        `\n❌ AVORTEMENT : le rapport contient ${fuites.length} valeur(s) de secret. RIEN N'A ÉTÉ ÉCRIT.\n` +
          `   Étiquettes fautives : ${fuites.join(", ")}\n` +
          `   C'est un défaut de l'instrument, pas une erreur d'usage. Ne pas contourner.\n`,
      );
      return 3;
    }

    fs.mkdirSync(path.dirname(cheminSortie), { recursive: true });
    fs.writeFileSync(cheminSortie, rapport, { mode: 0o600 });

    process.stdout.write(
      `\n  ✅ Crible anti-fuite : ${etiquetees.length - ecartees.length} valeur(s) discriminante(s) cherchée(s), 0 trouvée(s) dans le rapport.\n`,
    );
    if (ecartees.length) {
      process.stdout.write(
        `     ${ecartees.length} valeur(s) écartée(s) du crible car non discriminantes (trop courtes, numériques,\n` +
          `     ou mot de la liste close) : ${[...new Set(ecartees)].slice(0, 12).join(", ")}${ecartees.length > 12 ? " …" : ""}\n`,
      );
    }
    process.stdout.write(`  ✅ Rapport écrit     : ${cheminSortie}\n\n`);
    process.stdout.write("  RÉSUMÉ\n");
    for (const [k, v] of Object.entries(compteurs)) process.stdout.write(`    ${k} : ${v}\n`);
    if (opts.stdout) process.stdout.write("\n" + rapport);
  } finally {
    const r = effacerBac();
    process.stdout.write("\n  NETTOYAGE\n");
    process.stdout.write(`    bac temporaire : ${bac}\n`);
    process.stdout.write(`    état           : ${r.etat.toUpperCase()}\n`);
    process.stdout.write(`    vérification   : ls "${bac}"  → doit répondre « No such file or directory »\n`);
    if (r.etat !== "supprimé") {
      process.stderr.write(`\n❌ LE BAC N'A PAS ÉTÉ SUPPRIMÉ. Supprimez-le à la main : rm -rf "${bac}"\n`);
      code = 5;
    }
    process.stdout.write(`    nonce de session : détruit avec le processus.\n\n`);
  }
  return code;
}

const estPointDEntree =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (estPointDEntree) {
  principal(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      process.stderr.write(`\n❌ ${e.message}\n`);
      process.exit(1);
    });
}
