// ─── BUILD 12 · S2 — IDENTITÉ GOUVERNÉE ────────────────────────────────────
//
// ██  « Valide » ne veut pas dire « résolu ».                              ██
//
// `isValidMint` est une regex base58. `"1".repeat(44)` la franchit — le corpus
// S1 de T2 l'épingle explicitement. Une chaîne bien formée qui ne correspond à
// aucun jeton passait donc jusqu'au point de décision pré-achat, y recevait un
// score de 0 faute de données, et ressortait au niveau le plus permissif.
//
// Ce module n'invente AUCUNE méthodologie. Il ne va rien chercher : il reçoit
// des ATTESTATIONS déjà collectées par l'appelant sur son propre chemin, et il
// dit si l'une d'elles fait autorité. C'est une règle de gouvernance, pas une
// mesure de plus.
//
// ─── Ce qui fait autorité, et ce qui n'en fait pas ────────────────────────
//
// Le ticker et le symbole ne sont PAS des autorités d'identité, et mint→symbole
// n'en est pas une non plus : un symbole est un LIBELLÉ DE SORTIE. Deux jetons
// peuvent porter « $BOTIFY » ; un seul porte un mint donné. Toute attestation
// dont la clé est un symbole est refusée ici, nommément.
//
// À défaut d'autorité : FAIL CLOSED. Jamais ALLOW.

/**
 * Les sources qui peuvent ATTESTER qu'un mint désigne un actif réel.
 * Chacune est clé sur l'adresse elle-même, jamais sur un libellé.
 */
export const IDENTITY_AUTHORITIES = [
  /** Le compte de mint existe on-chain. */
  "onchain_mint_account",
  /** Le dossier interne connaît cette adresse. */
  "casefile",
  /** La liste known-bad connaît cette adresse. */
  "knownBad",
  /** Un provider de marché rend une paire POUR CETTE ADRESSE. */
  "market_pair",
  /** La couche intelligence a apparié CETTE ADRESSE à une entité connue. */
  "intelligence_match",
  /**
   * AL — la résolution canonique atteste (chainId, contractAddress).
   *
   * Elle est clé sur l'adresse et sur elle seule : le résolveur ne reçoit ni
   * ticker ni texte, et son prédicat d'attestation exige que la chaîne
   * SÉLECTIONNÉE soit dans le périmètre demandé. Sans quoi le mint SOLANA
   * d'USDC, interrogé avec un indice ETH, attesterait une identité EVM.
   */
  "canonical_token_resolution",
] as const;

export type IdentityAuthority = (typeof IDENTITY_AUTHORITIES)[number];

/**
 * Les clés qui ressemblent à une identité sans en être une. Elles sont
 * ÉNUMÉRÉES plutôt que sous-entendues : un lecteur doit pouvoir vérifier que
 * le refus est une règle, pas un oubli.
 */
export const NON_AUTHORITIES = ["symbol", "ticker", "name", "cashtag"] as const;

export interface IdentityAttestation {
  source: IdentityAuthority | (typeof NON_AUTHORITIES)[number] | string;
  /** La source affirme-t-elle connaître CETTE adresse. */
  attests: boolean;
}

export type IdentityResolution =
  | { resolved: true; authorities: IdentityAuthority[] }
  | { resolved: false; reason: "SYNTAX" | "NO_AUTHORITY" };

export interface ResolveIdentityInput {
  /** La cible a-t-elle franchi la validation de forme (base58 / EVM). */
  syntacticallyValid: boolean;
  attestations: readonly IdentityAttestation[];
}

function estAutorite(source: string): source is IdentityAuthority {
  return (IDENTITY_AUTHORITIES as readonly string[]).includes(source);
}

/**
 * Résolution canonique. Pure, sans réseau, sans base.
 *
 * Une forme correcte NE SUFFIT PAS : il faut qu'au moins une autorité atteste
 * l'adresse. Sans cela la fonction rend `resolved: false`, et la projection en
 * tire un WARN — jamais un ALLOW.
 */
export function resolveTokenIdentity(input: ResolveIdentityInput): IdentityResolution {
  if (!input.syntacticallyValid) return { resolved: false, reason: "SYNTAX" };

  const authorities = input.attestations
    .filter((a) => a.attests && estAutorite(a.source))
    .map((a) => a.source as IdentityAuthority);

  if (authorities.length === 0) return { resolved: false, reason: "NO_AUTHORITY" };
  return { resolved: true, authorities };
}
