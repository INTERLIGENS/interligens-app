// ─── AL · ADAPTATEUR D'IDENTITÉ CANONIQUE ──────────────────────────────────
//
// ██  Identité SEULEMENT. Aucun score, aucun verdict, aucune réputation.    ██
//
// ─── Le défaut qu'il ferme ────────────────────────────────────────────────
//
// Le chemin EVM n'offrait que deux attestations : `knownBad` et
// `intelligence_match`. Autrement dit, la seule façon d'obtenir une identité
// attestée sur EVM était d'être connu comme MAUVAIS — un actif propre ne
// pouvait STRUCTURELLEMENT pas résoudre. D'où USDC et USDT en WARN permanent,
// mesuré en production le 2026-09-09.
//
// Cet adaptateur branche `src/lib/token-resolution/v3`, qui existait et n'était
// consommé nulle part. Il n'ajoute qu'UNE valeur au contrat d'identité —
// `canonical_token_resolution` — et aucune logique de résolution parallèle.
//
// ─── LES DEUX PIÈGES, ET ILS SONT LE CŒUR DU TRAVAIL ──────────────────────
//
// 1. `resolveToken` NE FAIL PAS CLOSED : IL LÈVE.
//
//    Une panne HTTP remonte l'exception hors du résolveur. Sans l'enveloppe
//    ci-dessous, une panne DexScreener ferait tomber LA REQUÊTE DE SCORE
//    ENTIÈRE en 500 au lieu de produire un WARN. Le fail-closed est DANS
//    l'adaptateur, et nulle part ailleurs.
//
// 2. `status === "RESOLVED"` N'EST PAS LE PRÉDICAT D'ATTESTATION.
//
//    Mesuré : le mint SOLANA d'USDC interrogé avec `chainHint: "ETH"` rend
//    `status: RESOLVED`, `confidence: MODERATE`,
//    `callerSupport: unsupported_by_caller`, `selected.chain: "SOL"`.
//
//    Un adaptateur qui lirait `status` seul ATTESTERAIT UNE IDENTITÉ EVM POUR
//    UNE ADRESSE SOLANA. C'est la substitution d'identité, servie par une
//    lecture naïve. Les trois conditions sont donc exigées ENSEMBLE.
//
// ─── Sur `confidence` ─────────────────────────────────────────────────────
//
// HIGH/MODERATE sépare aussi ces cas, et on ne s'en sert PAS : la contrainte
// de périmètre suffit et ne demande aucun nombre. Aucun seuil n'est introduit.

import {
  resolveToken,
  type CanonicalChain,
  type TokenResolution,
} from "@/lib/token-resolution/v3";
import { normalizeAddress } from "@/lib/token-resolution/v3/address";
import { createProviderContext } from "@/lib/token-resolution/v3/providersPublic";

/** Pourquoi l'identité n'est pas attestée. Nommé, jamais fabriqué. */
export type IdentityProbeRefusal =
  | "NOT_RESOLVED"
  | "UNSUPPORTED_BY_CALLER"
  | "CHAIN_OUT_OF_SCOPE"
  | "NO_SELECTION"
  /** L'adresse retenue n'est pas une adresse CANONIQUE pour sa propre chaîne. */
  | "ADDRESS_NOT_CANONICAL_FOR_CHAIN"
  | "RESOLVER_FAILURE";

export interface CanonicalIdentityProbe {
  /** L'identité canonique est-elle ATTESTÉE pour le périmètre demandé. */
  attested: boolean;
  /** La chaîne canonique retenue, quand il y en a une. */
  chain: CanonicalChain | null;
  /** L'adresse canonique retenue, quand il y en a une. */
  address: string | null;
  refusal: IdentityProbeRefusal | null;
  /** La cause exacte d'une panne. Jamais inventée. */
  detail?: string;
}

const REFUSE = (refusal: IdentityProbeRefusal, detail?: string): CanonicalIdentityProbe => ({
  attested: false,
  chain: null,
  address: null,
  refusal,
  ...(detail ? { detail } : {}),
});

/**
 * L'ÉVALUATION D'ATTESTATION — les SIX conditions, en un seul endroit.
 *
 *   1. l'appel resolver s'est terminé sans exception échappée .. (dans la sonde)
 *   2. status === "RESOLVED"
 *   3. callerSupport === "supported"
 *   4. une identité `selected` EXISTE, adresse comprise
 *   5. selected.chain ∈ allowedChains déclarées par l'appelant
 *   6. selected.address est CANONIQUE pour selected.chain
 *
 * La sixième est la plus fine et c'est celle qui compte : sans elle on peut
 * attester une adresse MAL FORMÉE sur une chaîne pourtant autorisée. Le
 * périmètre serait bon, l'identité non — la même famille que la substitution
 * de chaîne, un cran plus bas.
 *
 * La canonicité n'est PAS revalidée ici : `normalizeAddress` du module de
 * résolution la porte déjà, chaîne par chaîne, avec sa liste fermée de sept
 * chaînes canoniques et la casse EVM. On l'appelle, on ne la réécrit pas.
 *
 * UNE SEULE implémentation, deux vues : `isCanonicallyAttested` en est le
 * booléen. Écrire le prédicat deux fois était le défaut mesuré au tour
 * précédent — un mutant qui retirait une condition dans la seconde copie
 * survivait. Il ne peut plus y avoir de seconde copie.
 */
export type AttestationOutcome =
  | { attested: true; chain: CanonicalChain; address: string }
  | { attested: false; refusal: Exclude<IdentityProbeRefusal, "RESOLVER_FAILURE"> };

export function evaluateCanonicalAttestation(
  r: Pick<TokenResolution, "status" | "callerSupport" | "selected">,
  allowedChains: readonly CanonicalChain[],
): AttestationOutcome {
  if (r.status !== "RESOLVED") return { attested: false, refusal: "NOT_RESOLVED" };
  if (r.callerSupport !== "supported") {
    return { attested: false, refusal: "UNSUPPORTED_BY_CALLER" };
  }
  const selected = r.selected;
  if (!selected || !selected.chain || !selected.address) {
    return { attested: false, refusal: "NO_SELECTION" };
  }
  if (!allowedChains.includes(selected.chain)) {
    return { attested: false, refusal: "CHAIN_OUT_OF_SCOPE" };
  }
  const norm = normalizeAddress(selected.address, selected.chain);
  if (!norm.valid || norm.address === null) {
    return { attested: false, refusal: "ADDRESS_NOT_CANONICAL_FOR_CHAIN" };
  }
  // L'adresse rendue est la forme CANONIQUE, pas celle qu'on a demandée : une
  // sonde qui rendrait l'entrée masquerait une normalisation.
  return { attested: true, chain: selected.chain, address: norm.address };
}

/** Le booléen. Vue sur `evaluateCanonicalAttestation`, jamais une seconde copie. */
export function isCanonicallyAttested(
  r: Pick<TokenResolution, "status" | "callerSupport" | "selected">,
  allowedChains: readonly CanonicalChain[],
): boolean {
  return evaluateCanonicalAttestation(r, allowedChains).attested;
}

export interface ProbeIdentityArgs {
  address: string;
  /**
   * La chaîne que l'appelant sait traiter, quand il la connaît. Si elle est
   * fournie, on ne sonde QUE celle-là — aucune extension automatique. Si elle
   * est absente, `resolveToken` retombe sur son EVM_PROBE_ORDER existant et
   * borné, et on ne l'élargit pas non plus.
   */
  chainHint?: CanonicalChain | null;
  /** Le périmètre déclaré. Un asset hors de cette liste n'est PAS attesté. */
  allowedChains: readonly CanonicalChain[];
}

/**
 * Sonde l'identité canonique d'une adresse.
 *
 * Ne consomme aucun score, aucun verdict, aucune réputation, et n'utilise
 * JAMAIS le symbole comme autorité — `ticker` n'est pas passé au résolveur.
 *
 * Fail closed sur TOUT : panne, timeout, non-résolu, hors périmètre → identité
 * non attestée. Jamais de repli permissif.
 */
export async function probeCanonicalTokenIdentity(
  args: ProbeIdentityArgs,
): Promise<CanonicalIdentityProbe> {
  const { address, chainHint = null, allowedChains } = args;
  if (allowedChains.length === 0) return REFUSE("CHAIN_OUT_OF_SCOPE");

  let resolution: TokenResolution;
  try {
    resolution = await resolveToken(
      {
        // Aucune valeur textuelle, aucun ticker : le symbole n'est pas une
        // autorité d'identité, et ne pas le passer est plus fort que de
        // l'ignorer plus bas.
        addresses: [address],
        chainHint,
        allowedChains,
        audience: "public",
      },
      { db: null, providers: createProviderContext() },
    );
  } catch (e) {
    // Le résolveur LÈVE sur panne provider. Sans ce catch, une panne
    // DexScreener ferait tomber la requête de score entière en 500.
    return REFUSE("RESOLVER_FAILURE", e instanceof Error ? e.message : String(e));
  }

  // UNE SEULE autorité. La sonde ne rejoue aucune condition : elle transporte
  // le verdict et sa cause.
  const verdict = evaluateCanonicalAttestation(resolution, allowedChains);
  if (!verdict.attested) return REFUSE(verdict.refusal);

  return {
    attested: true,
    chain: verdict.chain,
    address: verdict.address,
    refusal: null,
  };
}

/**
 * Les chaînes EVM que le chemin pré-achat sait traiter, telles que les routes
 * les déclarent déjà. Aucune extension : c'est le périmètre existant, nommé
 * une fois au lieu d'être recopié.
 */
export const PREBUY_EVM_CHAINS: readonly CanonicalChain[] = ["ETH", "BASE", "BSC", "ARBITRUM"];
