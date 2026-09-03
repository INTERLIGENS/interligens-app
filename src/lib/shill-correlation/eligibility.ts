// --- B3 — L'INVARIANT D'ÉLIGIBILITÉ DU MOTEUR SOLANA, UNIQUE -------------
//
// ██ eligibleForSolanaEngine = (chain === "solana" && tokenMint != null) ██
//
// ─── CE QUE CE MODULE REMPLACE ────────────────────────────────────────────
//
// La frontière du moteur tenait par TROIS `if` successifs dans process.ts.
// Ils étaient corrects — mais leur correction dépendait de leur ORDRE. Rien
// dans le code ne disait que le test de chaîne devait précéder celui du mint,
// et un jour quelqu'un aurait réordonné, factorisé, ou ajouté un quatrième cas
// entre les deux. Un invariant qui n'existe que dans l'ordre de trois
// conditions n'est pas un invariant, c'est une coïncidence entretenue.
//
// Ici il porte un nom, il est en un seul endroit, et il est testable seul.
//
// ─── FAIL-CLOSED, ET C'EST LE POINT ──────────────────────────────────────
//
// La forme est `if (eligible) … else refuser`, jamais `if (mauvais) refuser`.
// La différence compte : une chaîne INCONNUE — `null`, `""`, `"base"`, une
// valeur qu'un étage amont aurait mal écrite — tombe du côté du refus SANS
// qu'on ait eu à l'énumérer. Le moteur Solana n'accepte que ce qu'il a
// reconnu, jamais ce qu'il n'a pas su rejeter.
//
// C'est ce qui protège du cas réel : `chain` est NULL sur 7 603/7 603 lignes
// de `social_post_candidates`, et B1 rend `chain = null` pour toute adresse
// EVM. Sous une garde fail-open, ces lignes passeraient.
//
// ─── LES DIAGNOSTICS RESTENT DISTINCTS ───────────────────────────────────
//
// Un seul invariant ne veut pas dire un seul message. Trois refus, trois
// causes, trois corrections différentes :
//   identity_unresolved  -> l'identité n'a jamais été résolue      -> B1
//   chain_not_solana     -> chaîne absente, inconnue, ou non-Solana -> source
//   not_base58_address   -> une valeur est là, ce n'est pas une adresse Solana
// Les confondre ferait chercher au mauvais endroit.

import { looksLikeSolanaMint } from "./buyers";

export const SOLANA_CHAIN = "solana";

export type IneligibilityDiagnostic =
  | "identity_unresolved"
  | "chain_not_solana"
  | "not_base58_address";

export type SolanaEngineEligibility =
  | {
      eligible: true;
      /** Le mint, NARROWÉ en `string` : l'appelant n'a plus à le revérifier. */
      mint: string;
    }
  | {
      eligible: false;
      diagnostic: IneligibilityDiagnostic;
      reason: string;
    };

export interface SolanaEngineSubject {
  chain?: string | null;
  tokenMint?: string | null;
}

/**
 * LA SEULE PORTE DU MOTEUR SOLANA.
 *
 * Rend un résultat discriminé plutôt qu'un booléen : le `true` porte le mint
 * narrowé, de sorte que l'appelant ne PUISSE pas continuer sans avoir lu le
 * verdict. Un booléen aurait laissé écrire `if (ok) fetch(event.tokenMint!)`,
 * et le `!` aurait ré-ouvert exactement ce que la garde ferme.
 */
export function checkSolanaEngineEligibility(
  subject: SolanaEngineSubject,
): SolanaEngineEligibility {
  const chain = subject.chain ?? null;
  const mint = subject.tokenMint ?? null;

  // L'identité d'abord : « jamais résolue » est la cause la plus amont, et
  // celle qui appelle B1 plutôt qu'un correctif de source.
  if (mint == null) {
    return {
      eligible: false,
      diagnostic: "identity_unresolved",
      reason: "tokenMint est null — l'identité de contrat n'a jamais été résolue",
    };
  }

  // FAIL-CLOSED : on exige `=== "solana"`. Toute autre valeur, y compris
  // `null` et l'inconnu, est refusée sans avoir à être énumérée.
  if (chain !== SOLANA_CHAIN) {
    return {
      eligible: false,
      diagnostic: "chain_not_solana",
      reason: `chaîne « ${chain ?? "inconnue"} » — le moteur n'accepte que ${SOLANA_CHAIN}`,
    };
  }

  // Une valeur est là et la chaîne dit Solana : reste à ce que ce soit une
  // adresse. Un ticker qui aurait survécu en amont s'arrête ici.
  if (!looksLikeSolanaMint(mint)) {
    return {
      eligible: false,
      diagnostic: "not_base58_address",
      reason: `« ${mint} » n'est pas une adresse base58 (symbole ?)`,
    };
  }

  return { eligible: true, mint };
}

/** Forme booléenne, pour compter. Le chemin d'exécution utilise l'autre. */
export function eligibleForSolanaEngine(subject: SolanaEngineSubject): boolean {
  return checkSolanaEngineEligibility(subject).eligible;
}
