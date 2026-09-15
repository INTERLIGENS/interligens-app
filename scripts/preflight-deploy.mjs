#!/usr/bin/env node
// PREFLIGHT DE DÉPLOIEMENT — fail-closed, hors ligne, sur l'ENSEMBLE EXPÉDIÉ.
//
//   A deployment preflight governs the actual upload set, not the Git index;
//   ignored and untracked files are part of the security boundary whenever the
//   deployment client can transmit them.
//
// Usage :
//   node scripts/preflight-deploy.mjs --target production [--emit-marker] [--json]
//
// Sortie 0 = les cinq portes sont vertes. Toute autre sortie = REFUS.
// Il n'y a pas de troisième état, et il n'y a pas de `--force` : un preflight
// qu'on peut contourner par un drapeau est une recommandation, pas un contrôle.
//
// ─── CE FICHIER EST DÉSORMAIS SUR LE CHEMIN, PAS À CÔTÉ ─────────────────────
// Il ne s'invoque plus seulement à la main : `scripts/deploy-production.mjs` le
// lance en sous-processus et REFUSE de spawner le CLI tant qu'il n'a pas rendu
// 0. `pnpm deploy:prod` est la commande exposée ; il n'y a plus de `npx vercel
// --prod` dans le chemin gouverné.
//
// ⚠️ Ce fichier n'est PAS pour autant devenu un `predeploy` de package.json, et
// c'est délibéré : pnpm n'exécute pas les scripts `pre`/`post` par défaut depuis
// la v7 (`enable-pre-post-scripts=false`). Un garde branché sur un crochet que
// le gestionnaire de paquets n'appelle pas serait un garde décoratif. Il est
// donc appelé par le wrapper, dans le même processus séquentiel.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";

import {
  buildIgnore, buildManifest, filteredHead, merkleRoot, canonicalManifestText,
  ignoreEngineVersion, FILTRE_REJOUE_DEPUIS, PreflightError, nfc,
} from "./preflight/upload-set.mjs";
import { screenManifest, GENERATED_PATHS } from "./preflight/vocabulary.mjs";

// ─── LA LIAISON DE PROJET ────────────────────────────────────────────────────
// SEUL `interligens-app` est autorisé sur le chemin production. L'identifiant
// est l'autorité — un nom de projet se renomme, un `prj_` non. Les deux sont
// comparés : si l'un des deux diverge, c'est rouge, parce qu'une divergence
// entre nom et identifiant est déjà une anomalie en soi.
export const PROJET_PRODUCTION = {
  projectName: "interligens-app",
  projectId: "prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ",
};

export const MARQUEUR = "public/.well-known/source-set.json";

const exec = (cmd, cwd) => {
  const [bin, ...args] = cmd.split(" ");
  try {
    return execFileSync(bin, args, { cwd, maxBuffer: 1 << 28, encoding: "utf8" });
  } catch (e) {
    throw new PreflightError(`\`${cmd}\` a échoué (${e.status ?? e.code}) — sans cette sortie il n'y a pas de mesure.`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PORTE 1 — L'ÉPINGLAGE DU CLI
// ═══════════════════════════════════════════════════════════════════════════
//
// « preflight et deploy doivent utiliser EXACTEMENT la même version. Sinon nous
//   certifierions un filtre A puis exécuterions un filtre B. »
//
// Obtenu SANS RÉSEAU : on lit le `package.json` du CLI sur le disque, on ne
// l'exécute pas et on n'interroge pas le registre.
//
// ⚠️ LA LIMITE QUI EXISTAIT ICI EST FERMÉE — et il faut dire comment, parce que
// la version précédente de ce commentaire disait franchement qu'elle ne l'était
// pas. `npx vercel --prod` résolvait la DERNIÈRE version publiée au moment de
// l'appel : ce preflight certifiait le CLI du disque pendant que npx en
// téléchargeait un autre. Tant que la commande de déploiement restait celle-là,
// l'épinglage était STRUCTURELLEMENT impossible, et la seconde moitié du
// contrôle n'était qu'une consigne écrite dans un document.
//
// Elle n'est plus une consigne. `scripts/deploy-production.mjs` exécute LE
// BINAIRE que cette porte vient de résoudre — même fonction, même chemin sur le
// disque, aucun aller-retour au registre entre la certification et l'exécution.
// La version est UNE constante (`FILTRE_REJOUE_DEPUIS`), importée des deux
// côtés, et `__tests__/preflight/deploy-path.test.ts` rougit sur tout retour à
// une résolution flottante.
export function detectCliVersion(cwd) {
  const essais = [];
  const lire = (p, source) => {
    try {
      const v = JSON.parse(readFileSync(p, "utf8")).version;
      if (v) return { version: v, source, path: p };
    } catch (e) { essais.push(`${source}: ${e.code || e.message}`); }
    return null;
  };

  if (process.env.VERCEL_CLI_PACKAGE_JSON) {
    const r = lire(process.env.VERCEL_CLI_PACKAGE_JSON, "VERCEL_CLI_PACKAGE_JSON");
    if (r) return r;
  }
  try {
    const p = createRequire(join(cwd, "noop.js")).resolve("vercel/package.json");
    const r = lire(p, "node_modules du dépôt");
    if (r) return r;
  } catch (e) { essais.push(`node_modules: ${e.code || e.message}`); }

  const racines = [
    join(process.env.HOME || "", "Library/pnpm/global/5/node_modules/vercel/package.json"),
    join(process.env.HOME || "", ".local/share/pnpm/global/5/node_modules/vercel/package.json"),
    "/usr/local/lib/node_modules/vercel/package.json",
    "/opt/homebrew/lib/node_modules/vercel/package.json",
  ];
  for (const p of racines) {
    if (existsSync(p)) { const r = lire(p, "installation globale"); if (r) return r; }
  }

  const npx = join(process.env.HOME || "", ".npm/_npx");
  if (existsSync(npx)) {
    try {
      for (const d of readdirSync(npx)) {
        const p = join(npx, d, "node_modules/vercel/package.json");
        if (existsSync(p)) { const r = lire(p, "cache npx"); if (r) return r; }
      }
    } catch (e) { essais.push(`cache npx: ${e.code}`); }
  }

  throw new PreflightError(
    "version du CLI Vercel indéterminable hors ligne — REFUS.\n" +
      `  tentatives : ${essais.join(" · ") || "aucune installation trouvée"}\n` +
      "  Un preflight qui ne sait pas quel filtre sera exécuté ne certifie rien.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LES PORTES
// ═══════════════════════════════════════════════════════════════════════════

export function porteCli(cwd) {
  // Une porte REFUSE ; elle ne lève pas. Lever ferait remonter l'échec au
  // filet extérieur et ferait perdre le verdict des AUTRES portes — on saurait
  // que le déploiement est refusé sans savoir ce qui d'autre cloche. Le refus
  // reste entier, il devient seulement lisible.
  let version, source, path;
  try {
    ({ version, source, path } = detectCliVersion(cwd));
  } catch (e) {
    return { ok: false, nom: "CLI épinglé", detail: e.message };
  }
  if (version !== FILTRE_REJOUE_DEPUIS) {
    return {
      ok: false,
      nom: "CLI épinglé",
      detail:
        `CLI trouvé en ${version} (${source}), filtre rejoué depuis ${FILTRE_REJOUE_DEPUIS}.\n` +
        `      ${path}\n` +
        `      Certifier un filtre et en exécuter un autre est précisément ce que cette porte existe pour interdire.\n` +
        `      Soit installer ${FILTRE_REJOUE_DEPUIS}, soit remesurer getVercelIgnore2 sur ${version} et mettre à jour HARDCODED_IGNORES.`,
    };
  }
  return { ok: true, nom: "CLI épinglé", detail: `vercel@${version} (${source})` };
}

export function porteProjet(cwd, target, attendu = PROJET_PRODUCTION) {
  if (target !== "production") {
    return { ok: true, nom: "Liaison de projet", detail: `cible « ${target} » — porte non applicable` };
  }
  const p = join(cwd, ".vercel/project.json");
  if (!existsSync(p)) {
    return { ok: false, nom: "Liaison de projet", detail: ".vercel/project.json absent — cible de déploiement inconnue. REFUS." };
  }
  let lien;
  try {
    lien = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    return { ok: false, nom: "Liaison de projet", detail: `.vercel/project.json illisible (${e.message}). REFUS.` };
  }
  const ecarts = [];
  if (lien.projectId !== attendu.projectId) ecarts.push(`projectId ${lien.projectId ?? "(absent)"} ≠ ${attendu.projectId}`);
  if (lien.projectName !== attendu.projectName) ecarts.push(`projectName ${lien.projectName ?? "(absent)"} ≠ ${attendu.projectName}`);
  if (ecarts.length) {
    return {
      ok: false,
      nom: "Liaison de projet",
      detail: `ce worktree n'est PAS lié au projet de production.\n      ${ecarts.join("\n      ")}\n      Sur le chemin production, seul ${attendu.projectName} est autorisé. FAIL CLOSED.`,
    };
  }
  return { ok: true, nom: "Liaison de projet", detail: `${lien.projectName} (${lien.projectId})` };
}

export function porteSecrets(manifest) {
  const refus = screenManifest(manifest);
  if (refus.length) {
    return {
      ok: false,
      nom: "Secret-bundle",
      detail:
        `${refus.length} fichier(s) refusé(s) DANS LE MANIFESTE D'UPLOAD :\n` +
        refus.map((r) => `      ${r.verdict.padEnd(12)} ${r.formId.padEnd(24)} ${r.path}\n        └─ ${r.why}`).join("\n"),
    };
  }
  return { ok: true, nom: "Secret-bundle", detail: `${manifest.length} fichiers passés au vocabulaire clos, aucun refus` };
}

/**
 * PORTE — L'UPLOAD-SET EXACT.
 *   manifeste − GENERATED_ALLOWED  ==  HEAD filtré
 *   ET aucun fichier de HEAD attendu après filtre n'est absent
 */
export function porteUploadSet(manifest, headFiltre) {
  const uploaded = new Set(manifest.map((m) => m.path));
  const generated = [...uploaded].filter((p) => GENERATED_PATHS.has(p));
  const gauche = new Set([...uploaded].filter((p) => !GENERATED_PATHS.has(p)));
  const droite = new Set(headFiltre.map(nfc));

  const enTropDansUpload = [...gauche].filter((p) => !droite.has(p)).sort();
  const absentsDeUpload = [...droite].filter((p) => !gauche.has(p)).sort();

  if (enTropDansUpload.length || absentsDeUpload.length) {
    const bloc = [];
    if (enTropDansUpload.length) {
      bloc.push(`      ${enTropDansUpload.length} EXPÉDIÉ(S) HORS DE HEAD — dans aucun commit :`);
      bloc.push(...enTropDansUpload.map((p) => `        + ${p}`));
    }
    if (absentsDeUpload.length) {
      bloc.push(`      ${absentsDeUpload.length} ATTENDU(S) DE HEAD, ABSENT(S) DE L'UPLOAD :`);
      bloc.push(...absentsDeUpload.map((p) => `        − ${p}`));
    }
    return { ok: false, nom: "Upload-set exact", detail: bloc.join("\n") };
  }
  return {
    ok: true,
    nom: "Upload-set exact",
    detail: `${gauche.size} fichiers ≡ HEAD filtré · ${generated.length} GENERATED (${generated.join(", ") || "aucun"})`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LE MARQUEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// La racine EXCLUT SON PROPRE FICHIER, sinon elle ne peut pas exister : le
// marqueur contient la racine, donc son sha1 dépendrait de la racine qui
// dépendrait de son sha1.
export function construireMarqueur(manifest, meta) {
  const sansMarqueur = manifest.filter((m) => m.path !== MARQUEUR);
  const root = merkleRoot(sansMarqueur);
  return {
    root,
    contenu: {
      sourceSetRoot: root,
      algorithm: "merkle-sha256/leaf=sha256('leaf\\0'+path+'\\0'+sha1(content))/node=sha256('node\\0'+L+R)",
      fileCount: sansMarqueur.length,
      excludesSelf: MARQUEUR,
      commit: meta.commit,
      ignoreEngine: meta.ignoreEngine,
      cliVersion: meta.cliVersion,
      generatedAt: meta.generatedAt,
      // ⛔ Écrit ici, dans la donnée elle-même, et pas seulement dans une prose
      // voisine : une prose adjacente à un contrôle n'est jamais l'autorité de
      // ce contrôle.
      attestation: {
        sourceInputIntegrity: "PROVEN",
        buildReproducibilitySLSA: "NOT_ESTABLISHED",
        servedDeploymentBinding: "provider-asserted unless independently attestable",
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export function executerPreflight({ cwd, target, emitMarker }) {
  const portes = [];
  const cli = porteCli(cwd);
  portes.push(cli);
  portes.push(porteProjet(cwd, target));

  // Le calcul de l'ensemble expédié. S'il échoue, on REFUSE — c'est le point
  // le plus important du fichier : pas de manifeste, pas de verdict vert.
  let manifest, headFiltre;
  try {
    const ig = buildIgnore(cwd);
    manifest = buildManifest(cwd, { ig });
    headFiltre = filteredHead(cwd, { ig, exec });
  } catch (e) {
    portes.push({
      ok: false,
      nom: "Calcul de l'ensemble expédié",
      detail: `${e.message}\n      FAIL-CLOSED : l'ensemble expédié n'a pas pu être établi, donc rien n'est certifié.`,
    });
    return { ok: false, portes, manifest: null };
  }

  portes.push(porteSecrets(manifest));
  portes.push(porteUploadSet(manifest, headFiltre));

  const ok = portes.every((p) => p.ok);
  let marqueur = null;
  if (ok && emitMarker) {
    const { contenu, root } = construireMarqueur(manifest, {
      commit: exec("git rev-parse HEAD", cwd).trim(),
      ignoreEngine: ignoreEngineVersion(cwd),
      cliVersion: cli.detail,
      generatedAt: new Date().toISOString(),
    });
    const abs = join(cwd, MARQUEUR);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(contenu, null, 2) + "\n");
    marqueur = { path: MARQUEUR, root };
  }
  return { ok, portes, manifest, marqueur };
}

// ─── Entrée en ligne de commande ─────────────────────────────────────────────
const estPrincipal = process.argv[1] && process.argv[1].endsWith("preflight-deploy.mjs");
if (estPrincipal) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const cwd = arg("--cwd", process.cwd());
  const target = arg("--target", "production");
  const emitMarker = argv.includes("--emit-marker");

  let res;
  try {
    res = executerPreflight({ cwd, target, emitMarker });
  } catch (e) {
    // Dernier filet. Toute exception non prévue est un REFUS, jamais un silence.
    console.error(`\n🛑 PREFLIGHT REFUS — exception non rattrapée : ${e.message}\n`);
    process.exit(2);
  }

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ok: res.ok, portes: res.portes, marqueur: res.marqueur }, null, 2));
  } else {
    console.log(`\n📋 PREFLIGHT · cible=${target} · ${cwd}\n`);
    for (const p of res.portes) {
      console.log(`${p.ok ? "✅" : "❌"} ${p.nom}`);
      console.log(`      ${p.detail.replace(/\n {6}/g, "\n      ")}\n`);
    }
    if (res.marqueur) console.log(`🔏 marqueur écrit : ${res.marqueur.path}\n   racine = ${res.marqueur.root}\n`);
    console.log(res.ok ? "✅ PREFLIGHT VERT — l'ensemble expédié est celui qui a été certifié.\n"
                       : "🛑 PREFLIGHT ROUGE — déploiement refusé.\n");
  }
  process.exit(res.ok ? 0 : 1);
}

export { canonicalManifestText };
