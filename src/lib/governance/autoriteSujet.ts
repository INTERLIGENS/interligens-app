// ─── L'AUTORITÉ DE PUBLICATION DU SUJET — UNE SEULE, CONSOMMÉE PAR IMPORT ─
//
// ██  PAS une copie de PUBLIC_KOL_FILTER. LA MÊME AUTORITÉ.                ██
//
// ─── POURQUOI L'IMPORT, ET PAS LA RÉÉCRITURE ────────────────────────────
//
// Une copie recréerait exactement l'Invariant Propagation Failure qu'on ferme
// partout ailleurs, et le dépôt en porte déjà un exemplaire commenté :
// `src/app/api/kol/[handle]/route.ts:22` écrit
//
//     // Enforce publish gate (equivalent to PUBLIC_KOL_FILTER)
//     snapshot.publishStatus !== "restricted" && (…)
//
// « equivalent to » est le mot qui coûte : la règle y vit en DEUX exemplaires,
// et rien ne les tient synchrones. `src/lib/kol/publishGate.ts` est un chemin
// GELÉ — on ne le modifie pas, et on n'en a pas besoin : **importer n'est pas
// modifier**. Le fragment `where` exporté est consommé tel quel.
//
// ─── ET C'EST POURQUOI CE MODULE N'EXPOSE AUCUN PRÉDICAT EN MÉMOIRE ─────
//
// Un `estPublie(profil)` écrit ici serait une RÉ-EXPRESSION de la règle, donc
// une copie, donc la faute. La seule façon d'interroger l'autorité est de lui
// faire porter la REQUÊTE. C'est une contrainte, et c'est le point : elle rend
// la copie non pas interdite mais IMPOSSIBLE À ÉCRIRE sans sortir du module.

import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";
import {
  cleDeSujet,
  resoudreIdentite,
  type LigneDeSujet,
} from "@/lib/governance/invariants/canonicalSubjectHandle";
import {
  constaterDecision,
  gouverner,
  refuser,
  type DecisionDePublication,
  type Refus,
  type UniteGouvernee,
} from "@/lib/governance/uniteGouvernee";

/**
 * Le fragment d'autorité, ré-exporté SANS ré-écriture. Une surface qui en a
 * besoin l'importe d'ici ou de `publishGate` — dans les deux cas c'est le
 * même objet, et il n'en existe qu'un.
 */
export const FILTRE_SUJET_ADMISSIBLE = PUBLIC_KOL_FILTER;

/** Le minimum que toute ligne de sujet porte, quelle que soit la surface. */
export interface LigneAdmissible {
  handle: string;
  publishStatus: string;
}

/** Ce que l'autorité a besoin de savoir lire. Rien de plus. */
export interface MagasinDeSujets<R extends LigneAdmissible> {
  /**
   * Toutes les lignes qui se réclament de la clé, avec leurs relations.
   * Sert UNIQUEMENT à CANONICAL_SUBJECT_HANDLE : détecter le conflit, jamais
   * élire.
   */
  lignesPourCle(cle: string): Promise<LigneDeSujet[]>;
  /**
   * La ligne EXACTE, filtrée par l'autorité de publication. L'implémentation
   * DOIT composer `FILTRE_SUJET_ADMISSIBLE` dans son `where` — c'est le seul
   * endroit du chemin où la règle s'applique.
   *
   * Les champs SUPPLÉMENTAIRES voyagent dans `R`, et ils passent par LA MÊME
   * requête filtrée. C'est délibéré : une seconde lecture non filtrée « une
   * fois le sujet admis » serait un chemin que rien n'empêcherait de remonter
   * au-dessus de l'admission au prochain refactor.
   */
  sujetAdmissible(handleExact: string): Promise<R | null>;
}

export interface SujetAdmis<R extends LigneAdmissible> {
  /** La ligne servie, déjà filtrée par l'autorité. */
  readonly ligne: R;
  readonly handle: UniteGouvernee<"OBSERVATION", string>;
  readonly decision: DecisionDePublication;
  /** La clé qui a servi la recherche. Déterministe, jamais affichée. */
  readonly cle: string;
}

/**
 * RÉSOUDRE UN SUJET — trois refus, une seule sortie admise.
 *
 * Les trois motifs de refus (`SUJET_ABSENT`, `CONFLIT_IDENTITE`,
 * `SUJET_NON_PUBLIE`) sont distincts DANS LE JOURNAL et doivent être
 * indistinguables DANS LA CHARGE ÉMISE. Ce module rend le motif ; c'est au
 * terminal de n'en rien laisser paraître. La séparation est délibérée : un
 * motif qui voyagerait dans la valeur serait un oracle livré avec la garde.
 *
 * ⚠ LA RECHERCHE RESTE EXACTE, DÉLIBÉRÉMENT. `sujetAdmissible` reçoit la clé
 * et l'implémentation Prisma compare `handle` SANS `mode:'insensitive'`. Les
 * 21 profils publiés dont le `handle` porte une majuscule restent donc
 * inatteignables — c'est le défaut P1 d'identity-resolution, mesuré et
 * classé. Le corriger ici AUGMENTERAIT l'émission nominative au milieu d'un
 * lot de containment, sans arbitrage. On ne le fait pas, et on le dit.
 */
export async function resoudreSujetAdmissible<R extends LigneAdmissible>(
  magasin: MagasinDeSujets<R>,
  saisie: string,
): Promise<SujetAdmis<R> | Refus> {
  const cle = cleDeSujet(saisie);
  if (cle.length === 0) return refuser("SUJET_ABSENT");

  // 1. CANONICAL_SUBJECT_HANDLE — le conflit ferme AVANT toute lecture de
  //    publication. Un sujet dont l'identité n'est pas décidable ne peut pas
  //    avoir de décision de publication qui porte sur lui : on ne saurait pas
  //    sur LAQUELLE des deux lignes elle porte.
  const identite = resoudreIdentite(await magasin.lignesPourCle(cle));
  if (!identite.ok) {
    return refuser(identite.motif === "ABSENT" ? "SUJET_ABSENT" : "CONFLIT_IDENTITE");
  }

  // 2. L'AUTORITÉ DE PUBLICATION — la MÊME que toutes les autres surfaces.
  const ligne = await magasin.sujetAdmissible(cle);
  if (ligne === null) return refuser("SUJET_NON_PUBLIE");

  const decision = constaterDecision(
    "KolProfile.publishStatus",
    ligne.handle,
    ligne.publishStatus,
    true,
  );
  // Ceinture : `constaterDecision` peut rendre `null` sur une valeur vide.
  // Une décision manquante ne devient jamais une décision par défaut.
  if (decision === null) return refuser("AUCUNE_FONDATION_POSSIBLE");

  return {
    ligne,
    handle: gouverner("OBSERVATION", ligne.handle, decision),
    decision,
    cle,
  };
}

// ─── L'IMPLÉMENTATION PRISMA — le SEUL endroit où le filtre est composé ──

/** La part du client Prisma dont ce module dépend. Volontairement minuscule. */
export interface ClientKolProfile {
  kolProfile: {
    // Signatures de MÉTHODE (donc bivariantes) et retours `unknown` : c'est
    // ce qui rend un `PrismaClient` réel assignable ici sans que ce module
    // n'importe les types générés. Le coût est une conversion locale, et elle
    // est confinée aux deux lignes ci-dessous.
    findMany(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<unknown>;
  };
}

interface LigneComptee {
  handle: string;
  _count: { kolWallets: number; tokenLinks: number; kolCases: number };
}

/**
 * `champs` est le `select` Prisma des colonnes supplémentaires. `handle` et
 * `publishStatus` y sont ajoutés d'office : sans eux la décision ne peut pas
 * être constatée, et une décision qu'on ne peut pas constater n'existe pas.
 */
export function magasinPrisma<R extends LigneAdmissible>(
  client: ClientKolProfile,
  champs: Record<string, true> = {},
): MagasinDeSujets<R> {
  return {
    async lignesPourCle(cle) {
      const lignes = (await client.kolProfile.findMany({
        where: { handle: { equals: cle, mode: "insensitive" } },
        select: {
          handle: true,
          _count: { select: { kolWallets: true, tokenLinks: true, kolCases: true } },
        },
      })) as LigneComptee[];
      return lignes.map((l) => ({
        handle: l.handle,
        relations: {
          wallets: l._count.kolWallets,
          tokenLinks: l._count.tokenLinks,
          cases: l._count.kolCases,
        },
      }));
    },
    async sujetAdmissible(handleExact) {
      // ██ LA LIGNE QUI PORTE L'AUTORITÉ ██
      // `FILTRE_SUJET_ADMISSIBLE` est étalé ici, pas recopié. Prisma combine
      // les clés de premier niveau en ET : le handle exact ET la décision de
      // publication. Retirer l'étalement fait passer 261 sujets non publiés.
      return (await client.kolProfile.findFirst({
        where: { handle: handleExact, ...FILTRE_SUJET_ADMISSIBLE },
        select: { ...champs, handle: true, publishStatus: true },
      })) as R | null;
    },
  };
}
