// L'ENSEMBLE RÉELLEMENT EXPÉDIÉ — rejoué hors ligne, jamais déduit.
//
//   A deployment preflight governs the actual upload set, not the Git index;
//   ignored and untracked files are part of the security boundary whenever the
//   deployment client can transmit them.
//
// Tout contrôle du dépôt est indexé sur le graphe de commits. Le déploiement,
// lui, est indexé sur le SYSTÈME DE FICHIERS. Les deux ensembles ne se
// recoupent qu'en partie — mesuré le 2026-09-14 sur le déploiement servi :
// 1996 fichiers téléversés, 1959 issus du commit affiché, 24 issus d'AUCUN
// commit, 665 fichiers du commit jamais partis. Un `.env` de 16 clés était
// dans les 24, invisible à Gitleaks parce que Gitleaks scanne le dépôt.
//
// Ce module rejoue le filtre RÉEL du client de déploiement, à partir du
// système de fichiers, sans réseau et sans exécuter le CLI.
//
// ─── PROVENANCE DE LA LISTE CODÉE EN DUR ─────────────────────────────────────
// Recopiée VERBATIM de `getVercelIgnore2`, vercel@51.7.0,
// dist/chunks/chunk-LOUKPRIS.js. Elle n'est pas une reconstitution de mémoire :
// elle est lue dans le binaire qui déploie. `__tests__/preflight/` la confronte
// à la version épinglée, et rougit si le CLI installé n'est pas celle-là —
// sinon nous certifierions un filtre A puis exécuterions un filtre B.
//
// ⚠️ DEUX PIÈGES, MESURÉS, QUI ONT CHACUN DONNÉ UN FAUX RÉSULTAT AVANT :
//
//   1. `.gitignore` N'EST PAS UN FILTRE. Il figure dans la liste ci-dessous,
//      c'est-à-dire qu'il est lui-même EXCLU DU TÉLÉVERSEMENT — jamais lu comme
//      règle. Le suivi git n'a donc AUCUN effet sur ce qui part. Un fichier non
//      suivi part ; un fichier gitignoré part. Seul `.vercelignore` filtre.
//
//   2. NORMALISATION UNICODE. macOS stocke les noms en NFD, git les rend en
//      NFC. Sans normalisation, les 13 captures `evidence/…Capture d'écran…png`
//      apparaissent à la fois « absentes du commit » et « jamais déployées » —
//      13 faux positifs ET 13 faux négatifs sur les mêmes fichiers. Tout chemin
//      qui sort d'ici est en NFC.

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Version du CLI dont le filtre est rejoué ici. Voir `assertCliPinned`. */
export const FILTRE_REJOUE_DEPUIS = "51.7.0";

/**
 * VERBATIM de getVercelIgnore2 (vercel@51.7.0). Ne pas « nettoyer », ne pas
 * trier, ne pas dédupliquer : toute divergence avec l'original est un filtre
 * différent de celui qui déploie.
 */
export const HARDCODED_IGNORES = [
  ".hg", ".git", ".gitmodules", ".svn", ".cache", ".next", ".now", ".vercel",
  ".npmignore", ".dockerignore", ".gitignore", ".*.swp", ".DS_Store",
  ".wafpicke-*", ".lock-wscript", ".env.local", ".env.*.local", ".venv",
  ".yarn/cache", ".pnp*", "npm-debug.log", "config.gypi", "node_modules",
  "__pycache__", "venv", "CVS",
];

/** VERBATIM : `str.replace(/(\n|^)\.\//g, "$1")`. */
export function clearRelative(str) {
  return str.replace(/(\n|^)\.\//g, "$1");
}

export function nfc(p) {
  return p.normalize("NFC");
}

class PreflightError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreflightError";
  }
}
export { PreflightError };

// ─── LE MOTEUR gitignore, ET POURQUOI IL EST CHERCHÉ PLUTÔT QU'IMPORTÉ ───────
//
// Le CLI applique le paquet `ignore`. Nous devons appliquer LE MÊME moteur, pas
// une réimplémentation « équivalente » : une sémantique gitignore écrite à la
// main est exactement le genre de prose adjacente qui finit par diverger du
// contrôle qu'elle prétend rejouer.
//
// `ignore` n'est pas hissé dans node_modules (pnpm, dépendance transitive
// d'eslint) et `package.json` est GELÉ par le guard — on ne peut donc pas le
// déclarer proprement ici. On le résout par le graphe réel, et si on ne le
// trouve pas, ON REFUSE. Jamais de repli sur un filtre maison : un filtre de
// secours qui laisserait tout passer est pire que l'absence de contrôle.

const ICI = createRequire(import.meta.url);

export function resolveIgnoreFactory(cwd = process.cwd()) {
  const candidats = [
    () => ICI("ignore"),
    () => createRequire(join(cwd, "noop.js"))("ignore"),
    () => createRequire(createRequire(join(cwd, "noop.js")).resolve("eslint"))("ignore"),
  ];
  const echecs = [];
  for (const tenter of candidats) {
    try {
      const mod = tenter();
      const factory = typeof mod === "function" ? mod : mod?.default;
      if (typeof factory === "function") return factory;
      echecs.push("module résolu mais sans fabrique appelable");
    } catch (e) {
      echecs.push(e.code || e.message);
    }
  }
  throw new PreflightError(
    "paquet `ignore` introuvable — le moteur de filtrage du CLI ne peut pas être rejoué.\n" +
      `  tentatives : ${echecs.join(" · ")}\n` +
      "  REFUS : un preflight qui ne peut pas calculer l'ensemble expédié ne rend pas un verdict vert.",
  );
}

/** Version du moteur effectivement chargée — journalisée, jamais supposée. */
export function ignoreEngineVersion(cwd = process.cwd()) {
  for (const r of [ICI, createRequire(join(cwd, "noop.js"))]) {
    try {
      return r("ignore/package.json").version;
    } catch { /* suivant */ }
  }
  try {
    const req = createRequire(join(cwd, "noop.js"));
    return createRequire(req.resolve("eslint"))("ignore/package.json").version;
  } catch {
    return "inconnue";
  }
}

/**
 * Reconstruit le filtre exact du client de déploiement.
 * FAIL-CLOSED : toute condition que le CLI traite en erreur est une erreur ici
 * aussi — jamais un filtre vide, qui laisserait TOUT partir en silence.
 */
export function buildIgnore(cwd, { factory = resolveIgnoreFactory(cwd) } = {}) {
  const lire = (nom) => {
    const p = join(cwd, nom);
    if (!existsSync(p)) return "";
    try {
      return readFileSync(p, "utf8");
    } catch (e) {
      throw new PreflightError(`${nom} illisible (${e.code}) — un filtre qu'on ne peut pas lire n'est pas un filtre vide.`);
    }
  };
  const vercelignore = lire(".vercelignore");
  const nowignore = lire(".nowignore");

  // Le CLI lève CONFLICTING_IGNORE_FILES. On lève aussi : sinon le preflight
  // certifierait un filtre que le déploiement refuserait d'appliquer.
  if (vercelignore && nowignore) {
    throw new PreflightError(
      "`.vercelignore` ET `.nowignore` présents — le CLI refuse (CONFLICTING_IGNORE_FILES). Supprimer `.nowignore`.",
    );
  }

  const ignoreFile = [vercelignore, nowignore].join("\n");
  const ig = factory().add(`${HARDCODED_IGNORES.join("\n")}\n${clearRelative(ignoreFile)}`);
  return ig;
}

/**
 * Énumère l'ensemble expédié depuis le SYSTÈME DE FICHIERS — pas depuis git.
 * Les répertoires exclus sont élagués (sémantique gitignore : `docs/` exclut
 * tout le sous-arbre), ce qui évite de descendre dans node_modules.
 */
export function enumerateUploadSet(cwd, { ig = buildIgnore(cwd) } = {}) {
  const out = [];
  const walk = (abs) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (e) {
      // FAIL-CLOSED. Un répertoire qu'on ne peut pas lire pourrait contenir
      // n'importe quoi : on refuse, on ne l'omet pas.
      throw new PreflightError(`répertoire illisible: ${relative(cwd, abs)} (${e.code})`);
    }
    for (const ent of entries) {
      const absChild = join(abs, ent.name);
      const rel = nfc(relative(cwd, absChild).split(sep).join("/"));
      if (!rel || rel.startsWith("..")) continue;
      if (ent.isSymbolicLink()) {
        // Le client ne suit pas les liens comme un répertoire ordinaire et
        // leur cible peut sortir du dépôt. Indécidable ici ⇒ refusé plus haut.
        if (!ig.ignores(rel)) out.push({ path: rel, symlink: true });
        continue;
      }
      if (ent.isDirectory()) {
        if (ig.ignores(`${rel}/`)) continue;
        walk(absChild);
      } else if (ent.isFile()) {
        if (!ig.ignores(rel)) out.push({ path: rel, symlink: false });
      }
    }
  };
  walk(cwd);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

/** SHA-1 du CONTENU BRUT — c'est le `uid` que Vercel rend sur
 *  GET /v6/deployments/{id}/files. Reproduit et vérifié le 2026-09-14 sur
 *  `.cc-allowed-paths` et `.cc-forbidden-paths` du déploiement servi. */
export function sha1File(abs) {
  return createHash("sha1").update(readFileSync(abs)).digest("hex");
}

/** Le manifeste d'upload : [{path, sha1}] trié par chemin NFC. */
export function buildManifest(cwd, opts = {}) {
  const entries = enumerateUploadSet(cwd, opts);
  const symlinks = entries.filter((e) => e.symlink).map((e) => e.path);
  if (symlinks.length) {
    throw new PreflightError(
      `lien symbolique dans l'ensemble expédié — cible indécidable, donc refusé :\n  ${symlinks.join("\n  ")}`,
    );
  }
  return entries.map(({ path }) => ({ path, sha1: sha1File(join(cwd, path)) }));
}

/** L'arbre de HEAD, APRÈS le même filtre — le terme droit du prédicat. */
export function filteredHead(cwd, { ig = buildIgnore(cwd), exec }) {
  const raw = exec("git ls-tree -r --name-only -z HEAD", cwd);
  const all = raw.split("\0").filter(Boolean).map(nfc);
  if (all.length === 0) {
    throw new PreflightError("`git ls-tree` n'a rendu aucun fichier — un arbre vide n'est pas une mesure.");
  }
  return all.filter((p) => !ig.ignores(p)).sort();
}

// ─── L'IDENTITÉ CRYPTOGRAPHIQUE DU SOURCE-SET ────────────────────────────────
//
// Arbre de Merkle binaire sur les feuilles (chemin, sha1) TRIÉES.
//   feuille  = sha256("leaf\0"  + chemin + "\0" + sha1)
//   nœud     = sha256("node\0"  + gauche + droite)
//   impair   = promu tel quel au niveau supérieur
// Les préfixes de domaine séparent feuilles et nœuds : sans eux, un nœud peut
// se faire passer pour une feuille.
//
// ⚠️ CE QUE CETTE RACINE EST, ET CE QU'ELLE N'EST PAS — voir le classement RC
// dans docs/prep/. Elle identifie l'ENTRÉE acceptée par le preflight. Elle
// n'atteste NI la reproductibilité du build, NI que l'alias servi est bien ce
// déploiement. On ne mentira pas pour fermer (d).

const H = (...parts) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(typeof p === "string" ? Buffer.from(p, "utf8") : p);
  return h.digest();
};

export function merkleRoot(manifest) {
  if (manifest.length === 0) {
    throw new PreflightError("manifeste vide — une racine sur le vide n'est pas une identité.");
  }
  let level = manifest.map((e) => H("leaf\0", `${e.path}\0${e.sha1}`));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? H("node\0", level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0].toString("hex");
}

/** Le manifeste canonique, lisible et recalculable à la main. */
export function canonicalManifestText(manifest) {
  return manifest.map((e) => `${e.sha1}  ${e.path}`).join("\n") + "\n";
}
