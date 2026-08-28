// ─── Méthodologies gelées — miroir d'exécution de l'artefact canonique ─────
//
// La SOURCE est content/methodologies/financial-estimates/v1.md. Ce module en
// est le miroir typé, utilisé au rendu : la page /en/methodology n'écrit plus
// la méthode, elle la lit ici.
//
// POURQUOI UN MIROIR ET PAS UNE LECTURE DE FICHIER. Lire le .md au runtime
// ferait dépendre une page de production du tracing de fichiers de Next : si
// le contenu n'est pas embarqué au déploiement, la page tombe en 500. Le
// miroir supprime ce risque, et la divergence est rendue impossible par un
// test : __tests__/methodology/artifact-freeze.test.ts recalcule l'empreinte
// du .md et la compare à CONTENT_SHA256 ci-dessous. Modifier l'un sans
// l'autre casse la suite.
//
// L'artefact reste canonique : c'est lui que cite un methodRef, c'est lui
// qu'un lecteur externe ouvre. Ce fichier ne fait qu'en exécuter le texte.

export interface MethodologyComponent {
  /** Identifiant stable, jamais renuméroté — il entre dans le methodRef. */
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface MethodologyArtifact {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly intro: string;
  readonly effectiveFrom: string;
  readonly contentSha256: string;
  readonly components: readonly MethodologyComponent[];
}

/** Empreinte du corps de content/methodologies/financial-estimates/v1.md. */
export const FINANCIAL_ESTIMATES_V1_SHA256 =
  "078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2";

export const FINANCIAL_ESTIMATES_V1: MethodologyArtifact = {
  id: "financial-estimates",
  version: "v1",
  title: "How INTERLIGENS Calculates Financial Estimates",
  intro:
    "INTERLIGENS publishes estimated financial figures derived from publicly available blockchain data. " +
    "These figures are analytical estimates — not established facts, not legal conclusions.",
  effectiveFrom: "2026-03-19",
  contentSha256: FINANCIAL_ESTIMATES_V1_SHA256,
  components: [
    {
      id: "est-investor-losses",
      title: "Est. Investor Losses",
      body:
        "Represents the estimated aggregate value lost by retail market participants in documented rug-linked cases associated with this profile. Calculated as the approximate USD value of tokens purchased by non-insider wallets minus any recovered value, based on contemporaneous market pricing at the time of collapse. This is an estimate. Individual loss figures may vary significantly.",
    },
    {
      id: "est-proceeds",
      title: "Est. Proceeds",
      body:
        "Represents the estimated USD value received by insider-linked or promoter-linked wallets through pre-launch token allocation, sell activity, or attributed promotion compensation. Derived from observable on-chain transfer and swap transactions valued at contemporaneous market or LP price data.",
    },
    {
      id: "pricing-reference",
      title: "Pricing Reference",
      body:
        "Token prices are sourced from DexScreener, GeckoTerminal, or on-chain LP pricing at the time of the relevant transaction. Where multiple sources conflict, INTERLIGENS uses the closest available data point to the transaction timestamp. Pricing sources are documented in the underlying evidence record.",
    },
    {
      id: "time-basis",
      title: "Time Basis",
      body:
        "Financial calculations cover all available on-chain history for the wallet addresses and token contracts referenced. The time range is noted in the profile evidence record. Figures are not forward-looking and do not include unrealized positions unless explicitly stated.",
    },
    {
      id: "inclusions-exclusions",
      title: "Inclusions and Exclusions",
      body:
        "Only wallets with documented on-chain linkage (verified or source-attributed) are included in financial calculations. Wallets classified as provisional or heuristically linked are excluded from primary figures and noted separately. DEX router addresses and liquidity pool contracts are excluded.",
    },
    {
      id: "realized-unrealized",
      title: "Realized vs. Unrealized",
      body:
        "Unless stated otherwise, all estimated proceeds figures reflect realized transactions — observable sell events or token transfers with corresponding value flows. Unrealized positions are excluded from the primary figure and noted where material.",
    },
    {
      id: "confidence-revision",
      title: "Confidence and Revision",
      body:
        "All methodology-based estimates carry inherent uncertainty. INTERLIGENS reviews published figures when new on-chain evidence emerges or when a correction request provides supporting data. Revised figures are logged with version notes. The methodology is reviewed quarterly.",
    },
  ],
};

/**
 * Reconstruit, octet pour octet, le corps du .md canonique à partir du miroir.
 * C'est cette chaîne que le test de gel compare au fichier — elle ne sert à
 * rien d'autre, et surtout pas au rendu.
 */
export function serializeArtifactBody(a: MethodologyArtifact): string {
  return a.components
    .map((c) => `## ${c.id} — ${c.title}\n\n${c.body}`)
    .join("\n\n");
}
