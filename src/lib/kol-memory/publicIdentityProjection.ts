// ─── BUILD 10 / P0 PUBLIC — LA PROJECTION PUBLIQUE D'UNE IDENTITÉ ─────────
//
// ██  Une surface publique ne sert JAMAIS l'identité synthétique brute.       ██
//
// ─── Ce qui a été mesuré ──────────────────────────────────────────────────
//
// Le 2026-09-08, en GET NON AUTHENTIFIÉ sur la production :
//
//   scan/timeline/<mint 44 canonique>  ->  pivotAddress = mint 43 SYNTHÉTIQUE
//   scan/solana?mint=<mint 44>         ->  4 thread_url portant le 43
//
// `loadCaseByMint` résout l'alias À L'ENTRÉE — `MINT_TO_CASE[casefileLookupKey(mint)]` —
// et rend le JSON brut À LA SORTIE. Interrogée avec la bonne identité, la surface
// répond avec la mauvaise. La résolution existe ; elle est perdue à la
// sérialisation.
//
// ─── Où ce module s'applique, et où il ne s'applique PAS ──────────────────
//
// Il s'applique à la PROJECTION PUBLIQUE : après le chargement, avant la
// réponse. Il ne touche pas `loadCaseByMint`, dont les 13 appelants — six
// alimentant `computeTigerScore` — gardent la sémantique legacy voulue.
//
// ─── La règle de valeur ───────────────────────────────────────────────────
//
//   43 synthétique  ->  resolveToCanonicalMint  ->  44 canonique
//   résolution en échec  ->  OMISSION
//
// C'est une RÉSOLUTION D'IDENTITÉ, pas un remplacement inventé : la valeur
// rendue est celle que la base porte réellement (262/5/3 lignes, mesuré en
// BUILD 9). Aucune constante de substitution n'est introduite ici — la seule
// source de vérité reste `tokenIdentity.ts`, et ce module ne fait que l'appeler.

import { resolveToCanonicalMint } from "./tokenIdentity";

/**
 * Un mint nu, projeté pour une surface publique.
 *
 * Rend le mint canonique, ou `null` quand l'identité ne peut pas être résolue.
 * `null` est une OMISSION assumée : ne rien dire vaut mieux que dire une
 * identité que le produit a fermée.
 *
 * `resolveToCanonicalMint` lève sur une valeur qui n'est pas un mint — c'est son
 * contrat, et on ne le contourne pas : on traite l'exception comme l'omission
 * qu'elle décrit.
 */
export function projectPublicMint(value: unknown, where: string): string | null {
  try {
    return resolveToCanonicalMint(value, where);
  } catch {
    return null;
  }
}

/** Les jetons base58 d'une URL, longueur d'un mint Solana. */
const BASE58_TOKEN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

/**
 * Une URL de preuve, projetée pour une surface publique.
 *
 * Un lien externe ne peut pas pointer une identité que le produit a fermée :
 * la clé synthétique n'existe dans AUCUNE ligne de la base, donc ces liens
 * mènent à un jeton qui n'est pas le sujet du dossier.
 *
 * Chaque jeton base58 de l'URL passe par la gate. Un jeton qui ne résout pas
 * est laissé tel quel — ce n'est pas une identité fermée, c'est une valeur que
 * ce module n'a pas à juger. Seule l'identité synthétique est réécrite.
 *
 * L'URL est corrigée, jamais inventée : le schéma, l'hôte, le chemin et le
 * fragment sont préservés.
 */
export function safeEvidenceUrl(url: string | null | undefined): string {
  if (!url) return "";
  let out = url;
  for (const token of url.match(BASE58_TOKEN) ?? []) {
    const resolved = projectPublicMint(token, "publicIdentityProjection.safeEvidenceUrl");
    if (resolved && resolved !== token) out = out.split(token).join(resolved);
  }
  return out;
}
