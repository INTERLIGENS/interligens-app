#!/usr/bin/env node
// LE CHEMIN DE DÉPLOIEMENT EXÉCUTABLE — production, et rien d'autre.
//
//   Deployment safety is a property of the executable deployment path;
//   a correct optional preflight is not a deployment guard.
//
// Ce fichier existe pour une raison précise et mesurée : le preflight livré le
// 2026-09-15 était correct et démontré, mais RIEN N'OBLIGEAIT À L'INVOQUER. La
// commande de déploiement du dépôt restait `npx vercel --prod`, qui ne le
// traverse pas. Un contrôle correct qu'on peut ne pas exécuter n'est pas un
// garde — c'est une recommandation avec des tests.
//
// ─── LA SÉQUENCE, ET ELLE N'EST PAS RÉORDONNABLE ─────────────────────────────
//
//   preflight upload-set exact → refus des secrets → liaison de projet
//   → source-set/Merkle → vercel@51.7.0 → deploy
//
// LE GARDE PRÉCÈDE TOUTE POSSIBILITÉ D'UPLOAD. Ce n'est pas une intention, c'est
// une propriété de structure : le CLI n'est pas SPAWNÉ tant que le preflight n'a
// pas rendu 0. Un seul processus, séquentiel, `execFileSync` — aucun `&&` de
// shell qu'un opérateur pourrait couper en deux, aucun pipe, aucune tâche de
// fond, aucun `--force`. Le test `le preflight ROUGE ⇒ le CLI n'est JAMAIS
// spawné` compte les appels et exige ZÉRO.
//
// ─── L'ÉPINGLAGE, ET POURQUOI IL EST PLUS FORT QUE `npx vercel@51.7.0` ───────
//
// La consigne demandait une invocation nommant explicitement 51.7.0. Nous allons
// un cran plus loin : on exécute LE BINAIRE QUE LE PREFLIGHT VIENT DE CERTIFIER,
// résolu par la MÊME fonction (`detectCliVersion`, porte 1). `npx vercel@51.7.0`
// laisse subsister un aller-retour au registre entre la certification et
// l'exécution ; ici il n'y en a aucun — les octets certifiés et les octets
// exécutés sont les mêmes octets.
//
// La version n'est pas recopiée : elle est IMPORTÉE de `FILTRE_REJOUE_DEPUIS`.
// Il n'y a donc pas deux constantes à tenir synchronisées, il y en a UNE. Si
// elle change un jour, le filtre rejoué et le binaire exécuté changent du même
// geste — et `scripts/preflight/` étant gelé, ce geste passe par la voie de
// maintenance. C'est exactement ce que la consigne exigeait : la version
// appartient au mécanisme exécutable et à ses tests, pas à la prose.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FILTRE_REJOUE_DEPUIS, PreflightError } from "./preflight/upload-set.mjs";
import { detectCliVersion, porteProjet, MARQUEUR } from "./preflight-deploy.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));

/** LA constante de version. Importée, jamais recopiée — une seule source. */
export const VERCEL_CLI_VERSION = FILTRE_REJOUE_DEPUIS;

/** La cible. Ce chemin ne dessert QUE la production ; il n'a pas de paramètre. */
export const CIBLE = "production";

/**
 * La séquence du ruling, sous forme de donnée inspectable. Le test la compare
 * mot pour mot à l'ordre exigé — une prose d'en-tête ne prouve pas un ordre,
 * une liste exécutée le prouve.
 */
export const ETAPES = [
  "preflight-upload-set-exact",
  "refus-des-secrets",
  "liaison-de-projet",
  "source-set-merkle",
  "cli-epingle",
  "deploy",
];

// ─── LES TROIS PRIMITIVES INJECTABLES ────────────────────────────────────────
// Injectables pour que les tests puissent COMPTER les spawns sans déployer.
// Aucune n'a de valeur par défaut permissive : chacune fait le vrai travail.

/** Le garde. Sous-processus, sortie héritée, code de sortie = verdict. */
export function runPreflightSubprocess(cwd) {
  try {
    execFileSync(process.execPath, [join(ICI, "preflight-deploy.mjs"), "--cwd", cwd, "--target", CIBLE, "--emit-marker"], {
      cwd,
      stdio: "inherit",
    });
    return 0;
  } catch (e) {
    // Un code de sortie non nul EST le verdict. Une exception sans code (le CLI
    // n'a pas pu démarrer) est également un refus : pas de mesure, pas de vert.
    return typeof e.status === "number" ? e.status : 2;
  }
}

/**
 * Résout la commande de déploiement. REFUSE plutôt que de flotter.
 *
 * ⚠️ `VERCEL_CLI_PACKAGE_JSON` est une commodité de TEST de la porte 1. Sur le
 * chemin de déploiement elle choisirait le BINAIRE EXÉCUTÉ, pas seulement une
 * chaîne de version : elle est donc refusée ici. Le preflight peut s'en servir,
 * le déploiement jamais.
 *
 * `detect` est injectable, et la différence avec la variable d'environnement est
 * la seule qui compte : un PARAMÈTRE DE FONCTION ne se pose pas depuis
 * l'extérieur du processus. L'entrée en ligne de commande n'en passe aucun, donc
 * le chemin réel utilise toujours la porte 1. Les tests, eux, peuvent enfin
 * prouver la propriété POSITIVE sur un runner sans CLI installé — sans quoi ils
 * ne vaudraient que sur un poste, panne déjà mesurée (c451ad5).
 */
export function resolveDeployCommand(cwd, env = process.env, detect = detectCliVersion) {
  if (env.VERCEL_CLI_PACKAGE_JSON) {
    throw new PreflightError(
      "VERCEL_CLI_PACKAGE_JSON est posée — elle désigne le binaire qui serait EXÉCUTÉ. REFUS sur le chemin de déploiement.",
    );
  }
  const { version, source, path } = detect(cwd);
  if (version !== VERCEL_CLI_VERSION) {
    throw new PreflightError(
      `CLI trouvé en ${version} (${source}), épinglé à ${VERCEL_CLI_VERSION}. ` +
        "Certifier un filtre et en exécuter un autre est précisément ce qui est interdit ici.",
    );
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new PreflightError(`package.json du CLI illisible (${e.message}) — le binaire n'est pas identifiable. REFUS.`);
  }
  const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.vercel;
  if (!binRel) {
    throw new PreflightError("le package.json du CLI ne déclare pas de binaire `vercel` — rien à exécuter. REFUS.");
  }
  const entry = join(dirname(path), binRel);
  if (!existsSync(entry)) {
    throw new PreflightError(`binaire du CLI introuvable : ${entry}. REFUS.`);
  }
  // `node <entry> --prod` : le chemin est ABSOLU et résolu depuis le package.json
  // déjà vérifié. Aucun nom de paquet n'est re-résolu au moment de l'exécution,
  // donc aucune résolution flottante n'est possible ici.
  return { bin: process.execPath, args: [entry, "--prod"], version, source, entry };
}

export function spawnCliSubprocess({ bin, args }, cwd) {
  execFileSync(bin, args, { cwd, stdio: "inherit" });
}

// ═══════════════════════════════════════════════════════════════════════════
// LE CHEMIN
// ═══════════════════════════════════════════════════════════════════════════

export function deployerProduction({
  cwd = process.cwd(),
  runPreflight = runPreflightSubprocess,
  resolveCli = resolveDeployCommand,
  spawnCli = spawnCliSubprocess,
  env = process.env,
  log = console.log,
} = {}) {
  const journal = [];
  const refus = (etape, detail) => {
    journal.push({ etape, ok: false, detail });
    log(`\n🛑 DÉPLOIEMENT REFUSÉ — ${etape}\n   ${detail}\n`);
    return { ok: false, journal, deploye: false };
  };

  // ── 1·2·3·4 — LE GARDE, EN UN SEUL VERDICT ───────────────────────────────
  // Les quatre premières étapes de la séquence sont les quatre portes du
  // preflight, plus l'émission du marqueur. Elles ne sont pas réimplémentées
  // ici : les dupliquer créerait un second contrôle qui pourrait diverger du
  // premier. Le code de sortie du preflight EST le verdict.
  log(`\n🔒 GARDE — ${ETAPES.slice(0, 4).join(" → ")}\n`);
  const code = runPreflight(cwd);
  if (code !== 0) {
    return refus(
      "preflight",
      `le preflight a refusé (code ${code}). Aucun octet n'a été téléversé : le CLI n'a pas été lancé.`,
    );
  }
  journal.push({ etape: "preflight", ok: true, detail: "les quatre portes sont vertes, marqueur émis" });

  // ── 3 bis — LA LIAISON DE PROJET, RELUE APRÈS LE GARDE ────────────────────
  // Le preflight l'a déjà vérifiée. On la relit ici parce que le fichier
  // `.vercel/project.json` est le SEUL état mutable entre le verdict et
  // l'exécution, et parce que c'est lui qui décide QUEL projet reçoit l'upload.
  const projet = porteProjet(cwd, CIBLE);
  if (!projet.ok) return refus("liaison-de-projet", projet.detail);
  journal.push({ etape: "liaison-de-projet", ok: true, detail: projet.detail });

  // ── 4 bis — LE MARQUEUR ───────────────────────────────────────────────────
  const marqueurAbs = join(cwd, MARQUEUR);
  let root;
  try {
    root = JSON.parse(readFileSync(marqueurAbs, "utf8")).sourceSetRoot;
  } catch (e) {
    return refus("source-set-merkle", `marqueur ${MARQUEUR} absent ou illisible (${e.message}).`);
  }
  if (typeof root !== "string" || !/^[0-9a-f]{64}$/.test(root)) {
    return refus("source-set-merkle", `racine du source-set absente ou malformée dans ${MARQUEUR}.`);
  }
  journal.push({ etape: "source-set-merkle", ok: true, detail: root });

  // ── 5 — LE CLI ÉPINGLÉ ────────────────────────────────────────────────────
  let commande;
  try {
    commande = resolveCli(cwd, env);
  } catch (e) {
    return refus("cli-epingle", e.message);
  }
  journal.push({ etape: "cli-epingle", ok: true, detail: `vercel@${commande.version} (${commande.source})` });

  // ── 6 — DEPLOY ────────────────────────────────────────────────────────────
  log(
    `\n🚀 DÉPLOIEMENT — vercel@${commande.version}\n` +
      `   source-set = ${root}\n   projet     = ${projet.detail}\n   binaire    = ${commande.entry}\n`,
  );
  try {
    spawnCli(commande, cwd);
  } catch (e) {
    return refus("deploy", `le CLI a échoué (${e.status ?? e.code ?? e.message}).`);
  }
  journal.push({ etape: "deploy", ok: true, detail: `vercel@${commande.version} --prod` });
  return { ok: true, journal, deploye: true };
}

// ─── Entrée en ligne de commande ─────────────────────────────────────────────
// Aucun argument, aucun drapeau. Il n'y a pas de `--target` : ce chemin ne
// dessert que la production. Il n'y a pas de `--force`, pas de
// `--skip-preflight` : un garde qu'un drapeau contourne n'est pas un garde.
const estPrincipal = process.argv[1] && process.argv[1].endsWith("deploy-production.mjs");
if (estPrincipal) {
  let res;
  try {
    res = deployerProduction({ cwd: process.cwd() });
  } catch (e) {
    console.error(`\n🛑 DÉPLOIEMENT REFUSÉ — exception non rattrapée : ${e.message}\n`);
    process.exit(2);
  }
  process.exit(res.ok ? 0 : 1);
}
