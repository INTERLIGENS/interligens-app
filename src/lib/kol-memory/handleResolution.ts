// ─── BUILD 8 / E1 — RÉSOUDRE UN HANDLE SANS JAMAIS DEVINER ─────────────────
//
// ██  21 des 32 profils publiés étaient structurellement injoignables.       ██
//
// ─── Le défaut ─────────────────────────────────────────────────────────────
//
// `src/app/api/kol/[handle]/route.ts` abaisse la casse de ce qu'il reçoit :
//
//     const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
//
// puis `buildKolCanonicalSnapshot` interroge la base en `findUnique({ handle })`
// — égalité STRICTE, sensible à la casse. Tout profil dont le handle porte une
// majuscule ne peut donc jamais être trouvé : la route cherche `gordongekko`,
// la base porte `GordonGekko`.
//
// Mesuré sur ep-square-band le 2026-09-07, en lecture seule :
//
//     profils publiés                                32
//     dont handle avec majuscule → INJOIGNABLES      21
//     wallets publiables portés par ces 21          126
//     wallets publiables réellement servis           38
//
// Les 21 : 0xBossman, Barbie, Blackbeard, Brommy, CoachTY, CryptoZin,
// DonWedge, EduRio, ElonTrades, Exy, Geppetto, GordonGekko, HalieyWelch,
// HaydenDavis, JMilei, James, Myrrha, Nekoz, OrbitApe, Ronnie, SolanaRockets.
//
// ─── Pourquoi PAS un simple `mode: "insensitive"` ──────────────────────────
//
// Parce qu'une collision de casse EXISTE déjà en base : `0xsweep` et `0xSweep`
// sont deux lignes `KolProfile` DISTINCTES. Une recherche insensible rendrait
// l'une des deux, arbitrairement — c'est-à-dire attribuerait à une personne le
// dossier d'une autre. Sur une plateforme qui nomme des gens, c'est la faute
// qu'on ne peut pas se permettre.
//
// Les deux sont en `draft`, donc aucun profil publié n'est aujourd'hui
// concerné. Mais « aujourd'hui » n'est pas une garantie : la règle doit tenir
// le jour où l'un des deux sera publié.
//
// ─── La règle, en trois temps, et sans quatrième ───────────────────────────
//
//   1. ÉGALITÉ EXACTE — l'identité canonique l'emporte toujours. Si la base
//      porte littéralement ce handle, c'est celui-là, point.
//   2. Sinon, ÉGALITÉ INSENSIBLE À LA CASSE, et seulement si elle désigne
//      UNE SEULE ligne.
//   3. Plusieurs correspondances → REFUS. Jamais un choix arbitraire, jamais
//      « la plus récente », jamais « celle qui a le plus de données ».
//
// Aucune recherche floue, aucune distance d'édition, aucun repli silencieux.
// Un handle qui n'existe pas rend `null` — et 404, comme avant.

import { prisma } from "@/lib/prisma";

/** Ce qui s'est passé, nommé. Sert aux tests et aux journaux, jamais à trier. */
export type HandleMatchKind =
  /** La base porte littéralement ce handle. */
  | "EXACT"
  /** Une seule ligne correspond à la casse près. */
  | "CASE_INSENSITIVE"
  /** Aucune ligne ne correspond. */
  | "NONE"
  /** Plusieurs lignes correspondent à la casse près — on refuse de choisir. */
  | "AMBIGUOUS";

export interface HandleResolution {
  /** Le handle CANONIQUE tel que la base le porte. `null` = non résolu. */
  readonly handle: string | null;
  readonly kind: HandleMatchKind;
  /** Les variantes en présence, quand il y en a plusieurs. Pour le journal. */
  readonly candidates: readonly string[];
}

const NOT_FOUND: HandleResolution = { handle: null, kind: "NONE", candidates: [] };

/**
 * Normalise l'entrée SANS décider de l'identité : on retire l'habillage
 * (espaces, `@` initial), jamais la casse. La casse EST une information —
 * c'est tout le sujet de ce module.
 */
export function normalizeHandleInput(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^@+/, "");
}

/**
 * Handle demandé → handle canonique de la base.
 *
 * Ne lève jamais et ne devine jamais. Deux requêtes au plus, et la seconde
 * n'est faite que si la première échoue.
 */
export async function resolveCanonicalHandle(raw: string | null | undefined): Promise<HandleResolution> {
  const input = normalizeHandleInput(raw);
  if (!input) return NOT_FOUND;

  // 1. Égalité exacte — l'identité canonique d'abord, toujours.
  //    C'est aussi ce qui désambiguïse `0xsweep` face à `0xSweep` : demander
  //    exactement l'un des deux rend exactement celui-là.
  const exact = await prisma.kolProfile.findUnique({
    where: { handle: input },
    select: { handle: true },
  });
  if (exact) return { handle: exact.handle, kind: "EXACT", candidates: [exact.handle] };

  // 2. Égalité insensible à la casse — et on regarde COMBIEN avant de conclure.
  const matches = await prisma.kolProfile.findMany({
    where: { handle: { equals: input, mode: "insensitive" } },
    select: { handle: true },
    orderBy: { handle: "asc" },
    // 2 suffit pour distinguer « une seule » de « plusieurs ». Ramener
    // davantage ne changerait pas la décision et coûterait la requête.
    take: 2,
  });

  if (matches.length === 0) return NOT_FOUND;

  const candidates = matches.map((m) => m.handle);

  // 3. Plusieurs identités possibles : on refuse. Servir l'une des deux
  //    attribuerait à une personne le dossier d'une autre.
  if (matches.length > 1) {
    console.warn(
      `[kol-memory] handle ambigu « ${input} » — ${candidates.join(", ")} : ` +
        "résolution refusée, aucune identité choisie.",
    );
    return { handle: null, kind: "AMBIGUOUS", candidates };
  }

  return { handle: candidates[0], kind: "CASE_INSENSITIVE", candidates };
}
