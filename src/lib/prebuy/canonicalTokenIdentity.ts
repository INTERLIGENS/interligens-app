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
import { createProviderContext } from "@/lib/token-resolution/v3/providersPublic";

/** Pourquoi l'identité n'est pas attestée. Nommé, jamais fabriqué. */
export type IdentityProbeRefusal =
  | "NOT_RESOLVED"
  | "UNSUPPORTED_BY_CALLER"
  | "CHAIN_OUT_OF_SCOPE"
  | "NO_SELECTION"
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
 * LE prédicat d'attestation. Les trois conditions, ENSEMBLE.
 *
 * Exporté pour être jugé directement : un test qui ne pourrait l'exercer qu'à
 * travers un appel réseau ne prouverait pas grand-chose.
 */
export function isCanonicallyAttested(
  r: Pick<TokenResolution, "status" | "callerSupport" | "selected">,
  allowedChains: readonly CanonicalChain[],
): boolean {
  if (r.status !== "RESOLVED") return false;
  if (r.callerSupport !== "supported") return false;
  const chain = r.selected?.chain ?? null;
  if (chain === null) return false;
  return allowedChains.includes(chain);
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

  // UNE SEULE autorité pour le prédicat. Les vérifications ci-dessous ne le
  // rejouent pas : elles NOMMENT la cause du refus une fois qu'il est prononcé.
  //
  // Écrire le prédicat deux fois était le défaut : un mutant qui retirait la
  // contrainte de périmètre ICI survivait, parce que les tests exerçaient
  // l'autre copie. Un mutant qui ne mord pas est une preuve manquante.
  if (!isCanonicallyAttested(resolution, allowedChains)) {
    if (resolution.status !== "RESOLVED") return REFUSE("NOT_RESOLVED");
    if (resolution.callerSupport !== "supported") return REFUSE("UNSUPPORTED_BY_CALLER");
    if (!resolution.selected) return REFUSE("NO_SELECTION");
    return REFUSE("CHAIN_OUT_OF_SCOPE");
  }
  const selected = resolution.selected!;

  return {
    attested: true,
    chain: selected.chain,
    address: selected.address ?? address,
    refusal: null,
  };
}

/**
 * Les chaînes EVM que le chemin pré-achat sait traiter, telles que les routes
 * les déclarent déjà. Aucune extension : c'est le périmètre existant, nommé
 * une fois au lieu d'être recopié.
 */
export const PREBUY_EVM_CHAINS: readonly CanonicalChain[] = ["ETH", "BASE", "BSC", "ARBITRUM"];
