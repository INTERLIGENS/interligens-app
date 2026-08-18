// src/lib/publication/monetaryGate.ts
//
// LE POINT DE FILTRAGE UNIQUE DES AFFIRMATIONS MONÉTAIRES NOMINATIVES.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QU'IL CORRIGE
// ═══════════════════════════════════════════════════════════════════════════
//
// `src/app/api/v1/kol/[handle]/route.ts:48`, avant ce chantier — un seul
// énoncé, deux traitements :
//
//     totalDocumented: redactProceeds(kol, kol.totalDocumented), totalScammed: kol.totalScammed,
//
// Sur `bkokoski` : 210 900 $ retirés le 16 août, **4 500 000 $ servis** par la
// même ligne. Sur `sxyz500` : 141 594 $ retirés, 1 200 000 $ servis. Et
// `totalScammed` est la CLÉ DE TRI de la liste KOL — le chiffre le plus élevé
// est le premier servi. Recensement : docs/prep/RAPPORT_A13_RECENSEMENT_CHIFFRES.md.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PRINCIPE : UN CHIFFRE, PLUSIEURS PORTEURS, UNE SEULE DÉCISION
// ═══════════════════════════════════════════════════════════════════════════
//
// Les 210 000 $ de `bkokoski` existent **trois fois** :
//
//   1. `KolProceedsEvent`  eventType = 'SUMMARY_ARKHAM',    amountUsd = 210 000
//   2. `KolEvidence`       type      = 'coordinated_exit',  amountUsd = 210 000
//   3. `LaundryTrail`      narrativeText — « moved $210K USDC across 4 wallets »
//
// Le retrait du 16 août n'a couvert que le premier. **Un interrupteur par
// table reconstruirait exactement ce défaut** : il faudrait trois décisions
// pour retirer un chiffre, et l'on en oublierait une.
//
// D'où la règle de composition, et c'est tout le fichier :
//
//   > **Une affirmation monétaire est publiable si — et seulement si — AUCUN
//   > des interrupteurs qui la concernent n'est retiré.**
//
// Les interrupteurs se composent en ET. Un seul `withdrawn` suffit à taire le
// chiffre, sur tous ses porteurs à la fois.
//
// ═══════════════════════════════════════════════════════════════════════════
// DEUX FAMILLES, ET POURQUOI ON NE LES CONFOND PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// « Ce que la personne a encaissé » et « ce que ses victimes ont perdu » ne
// sont pas la même affirmation. Les fondre sous un seul interrupteur ferait
// disparaître l'une avec l'autre, sans qu'aucune décision ne l'ait dit.
//
//   PROCEEDS  — ce que la personne a encaissé.
//               Interrupteur : `KolProfile.proceedsPublication` (EXISTANT,
//               posé par MIGRATION_proceeds_containment_v1, six décisions
//               enregistrées le 2026-08-16).
//               Porteurs : totalDocumented · KolCase.paidUsd ·
//               KolTokenInvolvement.proceedsUsd · KolEvidence de type
//               d'encaissement · LaundryTrail (narratif d'encaissement).
//
//   SCAM SCALE — l'ampleur du préjudice attribué.
//               Interrupteur : `KolProfile.monetaryClaimsPublication`
//               (NOUVEAU, posé par MIGRATION_monetary_claims_v1, DEFAULT
//               'published' — aucune décision n'existe).
//               Porteurs : totalScammed · KolEvidence de type de préjudice.
//
// ⚠️ CONSÉQUENCE DE MISE EN PRODUCTION, À CONNAÎTRE AVANT DE FUSIONNER.
//    Les six décisions du 16 août portent `proceedsPublication = 'withdrawn'`.
//    Dès que ce fichier est servi, elles couvrent aussi les porteurs
//    d'encaissement latéraux — `paidUsd`, `proceedsUsd`, les preuves
//    d'encaissement. C'est le défaut que A13 a mesuré, donc l'effet voulu ;
//    c'est aussi un ÉLARGISSEMENT EFFECTIF de décisions déjà prises.
//    **Aucun état n'est basculé par ce chantier** — la branche n'est ni
//    fusionnée ni déployée. La décision de fusionner est celle-là.
//
// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED
// ═══════════════════════════════════════════════════════════════════════════
//
// Même doctrine qu'en A12 (`src/lib/laundry/publicationGate.ts`) : seule la
// chaîne exacte `"published"` publie. État retiré, valeur inattendue, colonne
// absente du `select`, objet nul — tout rend « non publiable ». Un appelant qui
// oublie de demander la colonne n'obtient pas une publication par défaut.
//
// Aucune sortie par variable d'environnement, ici ni ailleurs.

/** Les deux seuls états. Aligné sur les CHECK des deux migrations. */
export const MONETARY_PUBLICATION_STATES = ["published", "withdrawn"] as const;
export type MonetaryPublicationState = (typeof MONETARY_PUBLICATION_STATES)[number];

/**
 * Les deux familles d'affirmation. Le nom de la famille détermine quels
 * interrupteurs sont consultés — jamais l'inverse.
 */
export const MONETARY_CLAIM_FAMILIES = ["proceeds", "scam_scale"] as const;
export type MonetaryClaimFamily = (typeof MONETARY_CLAIM_FAMILIES)[number];

/**
 * Classement des types de `KolEvidence` par famille.
 *
 * Un type INCONNU est traité comme relevant des DEUX familles : il faut alors
 * que les deux interrupteurs soient ouverts pour le publier. C'est le choix
 * fail-closed — un type d'évidence ajouté demain sans être classé ici sera
 * plus protégé, pas moins.
 */
export const EVIDENCE_TYPE_FAMILY: Readonly<Record<string, MonetaryClaimFamily>> = {
  // Ce que la personne a encaissé.
  coordinated_exit: "proceeds",
  fund_movement: "proceeds",
  paid_promotion: "proceeds",
  cashout: "proceeds",
  evm_wallet: "proceeds",
  deployer_extraction: "proceeds",
  // L'ampleur du préjudice.
  victim_impact: "scam_scale",
  cex_manipulation: "scam_scale",
  coordinated_dump: "scam_scale",
};

/** Tout objet susceptible de porter les états — y compris mal formé. */
export type MonetaryPublicationCarrier = {
  proceedsPublication?: unknown;
  monetaryClaimsPublication?: unknown;
} | null | undefined;

/** À étaler dans tout `select` Prisma qui précède un montant nominatif. */
// Types du CLIENT GÉNÉRÉ, à dessein — voir publicationGate.ts.
import type { Prisma } from "@prisma/client";

export const MONETARY_PUBLICATION_SELECT = {
  proceedsPublication: true,
  monetaryClaimsPublication: true,
} satisfies Prisma.KolProfileSelect;

/** À étaler dans un `where` d'agrégat (leaderboard, classement, somme). */
export const PUBLISHED_MONETARY_FILTER = {
  proceedsPublication: "published",
  monetaryClaimsPublication: "published",
} satisfies Prisma.KolProfileWhereInput;

function isOpen(value: unknown): boolean {
  return value === "published";
}

/**
 * L'unique prédicat.
 *
 * `family` détermine les interrupteurs consultés :
 *   - `"proceeds"`    → `proceedsPublication` ET `monetaryClaimsPublication`
 *   - `"scam_scale"`  → `monetaryClaimsPublication` seul
 *   - non précisée    → LES DEUX (fail-closed pour un appelant qui n'a pas
 *                       qualifié son chiffre)
 *
 * `monetaryClaimsPublication` est consulté dans les deux cas : c'est
 * l'interrupteur général « plus aucun chiffre sur cette personne », celui qui
 * permet de tout taire d'un geste sans avoir à énumérer les familles.
 */
export function isMonetaryClaimPublished(
  profile: MonetaryPublicationCarrier,
  family?: MonetaryClaimFamily,
): boolean {
  if (!profile) return false;
  if (!isOpen(profile.monetaryClaimsPublication)) return false;
  if (family === "scam_scale") return true;
  // "proceeds" et le cas non qualifié exigent aussi l'interrupteur d'encaissement.
  return isOpen(profile.proceedsPublication);
}

/**
 * Rend le montant, ou `null` s'il n'est pas publiable.
 *
 * `null` et jamais `0` — même raison qu'en `redactProceeds` : un appelant qui
 * teste `(x ?? 0) > 0` fait disparaître le bloc au lieu d'afficher « 0 $ »,
 * ce qui serait une affirmation, et une affirmation fausse.
 */
export function redactMonetary<T extends number | string | null | undefined>(
  profile: MonetaryPublicationCarrier,
  value: T,
  family?: MonetaryClaimFamily,
): number | string | null {
  if (!isMonetaryClaimPublished(profile, family)) return null;
  return value ?? null;
}

/** Famille d'une ligne `KolEvidence`. Type inconnu → non qualifié → les deux. */
export function evidenceFamily(type: string | null | undefined): MonetaryClaimFamily | undefined {
  if (typeof type !== "string") return undefined;
  return EVIDENCE_TYPE_FAMILY[type];
}

/** Rend le montant d'une preuve, ou `null`. Classe le type puis délègue. */
export function redactEvidenceAmount<T extends number | null | undefined>(
  profile: MonetaryPublicationCarrier,
  evidence: { type?: string | null; amountUsd?: T } | null | undefined,
): number | null {
  if (!evidence) return null;
  const redacted = redactMonetary(profile, evidence.amountUsd, evidenceFamily(evidence.type));
  return typeof redacted === "number" ? redacted : null;
}

/**
 * Somme une collection en n'additionnant QUE ce qui est publiable.
 *
 * Indispensable pour `totalPaidUsd` (`/api/v1/kol/{h}:39`) et `totalLoss`
 * (`class-action:52`) : une somme calculée à la volée est invisible à toute
 * requête, et un filtre Prisma ne l'atteint pas.
 */
export function sumPublishedMonetary(
  profile: MonetaryPublicationCarrier,
  values: ReadonlyArray<number | null | undefined>,
  family?: MonetaryClaimFamily,
): number | null {
  if (!isMonetaryClaimPublished(profile, family)) return null;
  return values.reduce<number>((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
}

/**
 * LA COMPOSITION COMPLÈTE — celle qui fait qu'un retrait couvre tous les
 * porteurs d'un même chiffre.
 *
 * Certains porteurs ont, EN PLUS des interrupteurs de profil, un état qui leur
 * est propre : `LaundryTrail.publication` (A12). La règle ne change pas, elle
 * s'étend — **tous les interrupteurs qui concernent l'affirmation, en ET.**
 *
 * `objectPublication` est laissé générique et non typé sur `LaundryTrail` :
 * cette fonction ne doit rien savoir de la table d'où vient l'état. Le jour où
 * un troisième objet porte le sien, il passe par le même paramètre.
 *
 * `undefined` signifie « cet objet n'a pas d'état propre » et n'ajoute aucune
 * contrainte — à ne pas confondre avec un état DEMANDÉ mais absent, cas que
 * l'appelant doit traiter en passant `null` (qui, lui, refuse).
 */
export function isCompositeMonetaryClaimPublished(
  profile: MonetaryPublicationCarrier,
  objectPublication?: unknown,
  family?: MonetaryClaimFamily,
): boolean {
  if (!isMonetaryClaimPublished(profile, family)) return false;
  if (objectPublication === undefined) return true;
  return isOpen(objectPublication);
}
