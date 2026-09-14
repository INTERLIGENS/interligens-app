// ─── BUILD 9 — ON NE RÉÉCRIT PAS UNE VERSION SCELLÉE ───────────────────────
//
// ██  Une assertion ne se corrige pas. Elle est SUPPLANTÉE.                 ██
//
// ─── La propriété que ce module rend exécutable ───────────────────────────
//
// L'étape 6 a posé le sceau et l'audit : une modification en place se DÉTECTE.
// Détecter, c'est constater après coup. Ce module refuse AVANT.
//
//     « Aucune correction légitime ne réécrit SILENCIEUSEMENT une version
//       scellée. »
//
// Le mot qui compte est *silencieusement*. Corriger est parfaitement légitime
// — c'est même ce qu'on veut, quand une assertion est mal formulée. Ce qui ne
// l'est pas, c'est de le faire par-dessus la version scellée : le sceau ne
// prouve plus rien, et l'assertion d'hier devient irrécupérable.
//
// La voie légitime crée une version N+1 qui SUPPLANTE la précédente. L'ancienne
// reste, avec son sceau intact, et l'historique du dossier reste lisible.
//
// ─── Pourquoi un refus, alors que l'audit détecte déjà ────────────────────
//
// Parce que l'audit tourne quand on le lance, et qu'une réécriture silencieuse
// se remarque d'autant moins qu'elle est ancienne. Un refus à l'écriture ne
// dépend de personne.

//
// ─── SPINE-00 · B — ce module VÉRIFIE, il ne compose pas ─────────────────
//
// Les deux vérificateurs ci-dessous reçoivent une révision TELLE QUE LUE et
// la font passer par `canonicalSealMaterial` avant de hacher : la matière
// scellée a une seule normalisation, et elle ne vit pas ici. Le rendu SQL de
// supplantation (`renderSupersedeSql`) qui vivait dans ce fichier a été RETIRÉ :
// il hachait la charge brute sans normaliser — 0/16 sceaux persistés lui
// correspondaient, et aucune ligne de la base n'est en version ≥ 2, la seule
// qu'il pouvait produire. L'écrivain gouverné (`governedWriter.decideFoundation`
// avec `supersedesVersion`) est l'unique chemin de supplantation.

import { canonicalSealMaterial, claimContentHash, type SealableClaim } from "./versioning";

/** L'état d'une révision de claim, tel qu'on peut le comparer. */
export interface SealedRevision extends SealableClaim {
  readonly version: number;
  /** `null` = jamais scellé. Une absence, jamais une accusation. */
  readonly contentHash?: string | null;
}

/** L'empreinte d'une révision, par la primitive — jamais par la ligne brute. */
const sceauDe = (r: SealableClaim): string => claimContentHash(canonicalSealMaterial(r));

export class SilentRewriteError extends Error {
  constructor(claimId: string, version: number) {
    super(
      `[casefile] réécriture refusée : le claim ${claimId} v${version} est scellé, ` +
        "et son contenu change sans que la version soit incrémentée. Une assertion " +
        "ne se corrige pas — elle est supplantée par une version N+1 qui la référence. " +
        "L'ancienne reste, avec son sceau intact.",
    );
    this.name = "SilentRewriteError";
  }
}

export class BrokenSealError extends Error {
  constructor(claimId: string, version: number) {
    super(
      `[casefile] version ${version} du claim ${claimId} : le sceau ne correspond ` +
        "pas au contenu. La ligne a été modifiée en place APRÈS son scellement. " +
        "Aucune écriture n'est possible avant d'avoir établi ce qui a changé.",
    );
    this.name = "BrokenSealError";
  }
}

/**
 * Vérifie qu'une révision scellée porte bien son contenu.
 *
 * `contentHash` absent rend `false` sans lever : « jamais scellé » n'est pas
 * « altéré », et confondre les deux transformerait une absence en accusation.
 */
export function isSealIntact(r: SealedRevision): boolean {
  return !!r.contentHash && sceauDe(r) === r.contentHash;
}

/**
 * LE refus. À appeler avant toute écriture sur un claim existant.
 *
 * Trois issues, et une seule est une erreur de forme :
 *
 *   contenu inchangé            → rien à dire, l'écriture ne touche pas au fond
 *   contenu changé, version +   → supplantation légitime, autorisée
 *   contenu changé, même version→ REFUS, c'est une réécriture silencieuse
 *
 * Une révision non scellée n'est pas protégée par ce garde : il n'y a rien à
 * comparer. C'est la raison pour laquelle le scellement doit être fait, et pas
 * seulement possible.
 */
export function assertNoSilentRewrite(
  avant: SealedRevision,
  apres: SealedRevision,
): void {
  // Le sceau de la ligne EXISTANTE doit d'abord tenir. S'il ne tient pas, la
  // ligne a déjà été modifiée en place, et autoriser une écriture par-dessus
  // effacerait la trace de la première.
  if (avant.contentHash && !isSealIntact(avant)) {
    throw new BrokenSealError(avant.claimId, avant.version);
  }

  const contenuChange = sceauDe(avant) !== sceauDe(apres);
  if (!contenuChange) return;

  if (apres.version <= avant.version) {
    throw new SilentRewriteError(avant.claimId, avant.version);
  }
}
