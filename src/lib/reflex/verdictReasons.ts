/**
 * REFLEX V1 — signal-code → user-facing reason map (EN + FR).
 *
 * Lookup priority used by verdict.ts:
 *  1. Pre-built reasonEn/reasonFr on the signal (knownBad, casefileMatch,
 *     intelligenceOverlay — already the spec's allowed-phrase wording).
 *  2. REASON_MAP entry by signal.code.
 *  3. Source-specific generic fallback ("On-chain risk signal detected."
 *     for tigerscore drivers we haven't mapped yet).
 *  4. null — verdict layer skips the signal.
 *
 * Every entry in REASON_MAP is asserted lint-clean by the matrix test
 * suite, so adding a new entry that leaks a banned token fails CI.
 */
import type { ReflexLocale, ReflexSignal } from "./types";

export const REASON_MAP: Readonly<Record<string, { en: string; fr: string }>> = {
  // ── TigerScore drivers ────────────────────────────────────────────────
  "tigerscore.unlimited_approvals": {
    en: "Unlimited token approvals detected.",
    fr: "Approbations de tokens illimitées détectées.",
  },
  "tigerscore.high_approvals": {
    en: "Unusually high token approval count.",
    fr: "Nombre élevé d'approbations de tokens.",
  },
  "tigerscore.unknown_programs": {
    en: "Interactions with unverified programs.",
    fr: "Interactions avec des programmes non vérifiés.",
  },
  "tigerscore.freeze_authority": {
    en: "Freeze authority is still active on this token.",
    fr: "L'autorité de gel est encore active sur ce token.",
  },
  "tigerscore.mint_authority": {
    en: "Mint authority is still active on this token.",
    fr: "L'autorité de mint est encore active sur ce token.",
  },
  "tigerscore.mutable_metadata": {
    en: "Token metadata is still mutable.",
    fr: "Les métadonnées du token sont encore modifiables.",
  },
  "tigerscore.scam_lineage_confirmed": {
    en: "Linked to a documented risk lineage.",
    fr: "Lié à une lignée de risque documentée.",
  },
  "tigerscore.scam_lineage_referenced": {
    en: "Referenced near a documented risk lineage.",
    fr: "Référencé près d'une lignée de risque documentée.",
  },
  "tigerscore.address_poisoning": {
    en: "Address-poisoning lookalike pattern detected.",
    fr: "Schéma de lookalike d'adresse détecté.",
  },
  "tigerscore.evm_known_bad": {
    en: "Address registered on our internal risk list.",
    fr: "Adresse enregistrée dans notre liste de risque interne.",
  },
  "tigerscore.evm_in_watchlist": {
    en: "Address present on an active watchlist.",
    fr: "Adresse présente sur une watchlist active.",
  },

  // ── Coordination signals ──────────────────────────────────────────────
  "coordination.coordinated_promotion": {
    en: "Coordinated promotion pattern documented.",
    fr: "Schéma de promotion coordonnée documenté.",
  },
  "coordination.repeated_cashout": {
    en: "Repeated cashout pattern.",
    fr: "Schéma de cashout répété.",
  },
  "coordination.multi_launch_linked": {
    en: "Linked to multiple recent launches.",
    fr: "Lié à plusieurs lancements récents.",
  },
  "coordination.cross_case_recurrence": {
    en: "Recurrence across multiple documented cases.",
    fr: "Récurrence sur plusieurs dossiers documentés.",
  },
  "coordination.known_linked_wallets": {
    en: "Linked to documented wallets.",
    fr: "Lié à des wallets documentés.",
  },
  "coordination.shared_actor_group": {
    en: "Shared actor group with other documented profiles.",
    fr: "Groupe d'acteurs partagé avec d'autres profils documentés.",
  },
  "coordination.shared_launch_window": {
    en: "Shared launch window with documented coordinated actions.",
    fr: "Fenêtre de lancement partagée avec des actions coordonnées.",
  },

  // ── Recidivism ─────────────────────────────────────────────────────────
  "recidivism.recidivist": {
    en: "Linked to multiple prior documented cases.",
    fr: "Lié à plusieurs dossiers documentés antérieurs.",
  },
  "recidivism.prior_case": {
    en: "Linked to a prior documented case.",
    fr: "Lié à un dossier documenté antérieur.",
  },

  // ── Off-chain credibility ─────────────────────────────────────────────
  "offchain.band.very_low": {
    en: "Off-chain credibility is very weak.",
    fr: "Crédibilité off-chain très faible.",
  },
  "offchain.band.low": {
    en: "Off-chain credibility is weak.",
    fr: "Crédibilité off-chain faible.",
  },
  "offchain.band.mixed": {
    en: "Off-chain credibility is mixed.",
    fr: "Crédibilité off-chain mitigée.",
  },

  // ── Narrative scripts ─────────────────────────────────────────────────
  "narrative.LISTING_IMMINENT": {
    en: "Imminent listing claim documented in the copy.",
    fr: "Annonce de listing imminent documentée dans la copie.",
  },
  "narrative.LAST_CHANCE": {
    en: "Last-chance pressure detected.",
    fr: "Pression de dernière chance détectée.",
  },
  "narrative.PRESALE_EXCLUSIVE": {
    en: "Exclusive presale offer pattern.",
    fr: "Schéma d'offre de presale exclusive.",
  },
  "narrative.KOL_INSIDER_CALL": {
    en: "Insider-call narrative detected.",
    fr: "Narratif d'appel d'insider détecté.",
  },
  "narrative.FAKE_AUDIT": {
    en: "Audit claim that we could not verify with our sources.",
    fr: "Annonce d'audit non vérifiable avec nos sources.",
  },
  "narrative.FAKE_PARTNERSHIP": {
    en: "Partnership claim that we could not verify.",
    fr: "Annonce de partenariat non vérifiable.",
  },
  "narrative.MIGRATION_EMERGENCY": {
    en: "Urgent migration request — classic exit pattern.",
    fr: "Demande de migration urgente — schéma de sortie classique.",
  },
  "narrative.COMMUNITY_TAKEOVER": {
    en: "Community-takeover narrative detected.",
    fr: "Narratif de reprise communautaire détecté.",
  },
  "narrative.AIRDROP_CLAIM_TRAP": {
    en: "Airdrop-claim trap pattern.",
    fr: "Schéma de piège d'airdrop.",
  },
  "narrative.WALLET_VERIFICATION": {
    en: "Wallet-verification trap pattern.",
    fr: "Schéma de piège de vérification de wallet.",
  },
  "narrative.SEND_TO_RECEIVE": {
    en: "Send-to-receive pattern — classic wallet trap.",
    fr: "Schéma envoyer-pour-recevoir — piège de wallet classique.",
  },
  "narrative.SYNCHRONIZED_PUSH": {
    en: "Synchronised-push pattern detected.",
    fr: "Schéma de push synchronisé détecté.",
  },
  "narrative.AI_RWA_NARRATIVE_HIJACK": {
    en: "AI/RWA narrative hijack pattern.",
    fr: "Schéma de hijack de narratif IA/RWA.",
  },
  "narrative.CHARITY_CLAIM": {
    en: "Charity-allocation claim — frequent trust-hijack pattern.",
    fr: "Annonce d'allocation caritative — schéma fréquent de hijack de confiance.",
  },
  "narrative.BURN_SUPPLY_SHOCK": {
    en: "Supply-burn claim — common FOMO pressure.",
    fr: "Annonce de burn de supply — pression FOMO fréquente.",
  },
};

const TIGERSCORE_GENERIC = {
  en: "On-chain risk signal detected.",
  fr: "Signal de risque on-chain détecté.",
} as const;

export function reasonForSignal(
  s: ReflexSignal,
  locale: ReflexLocale,
): string | null {
  // 1. Pre-built reason on the signal (set by knownBad/casefileMatch/intel)
  const inline = locale === "en" ? s.reasonEn : s.reasonFr;
  if (inline) return inline;

  // 2. Localization map by code
  const mapped = REASON_MAP[s.code];
  if (mapped) return mapped[locale];

  // 3. Source-specific generic fallback for unmapped TigerScore drivers
  if (s.source === "tigerscore") return TIGERSCORE_GENERIC[locale];

  // 4. Skip — verdict layer drops the signal from reasons
  return null;
}
