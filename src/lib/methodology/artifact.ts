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

/** Empreinte du corps de content/methodologies/social-promotion/v1.md. */
export const SOCIAL_PROMOTION_V1_SHA256 =
  "44c8d1ac7ab56bfc48573452de76922db40860a3efc2435974b39c5e96a1202e";

/**
 * B4.1 — la methodologie que cite le natureBasis d'une promotion qualifiee.
 *
 * Un methodRef qui ne resout pas est un mensonge (registry.ts). Poser
 * `social-promotion/qualify@v1` dans un basis SANS cet artefact aurait ecrit
 * une reference introuvable — la faute exacte que la grammaire canonique
 * existe pour empecher.
 *
 * Le corps est le texte GELE, miroir de content/methodologies/social-promotion/
 * v1.md. Le test de gel recalcule l'empreinte du .md et la compare : modifier
 * l'un sans l'autre casse la suite.
 */
export const SOCIAL_PROMOTION_V1: MethodologyArtifact = {
  id: "social-promotion",
  version: "v1",
  title: "How INTERLIGENS Qualifies an Exploitable Social Promotion",
  intro:
    "A social post that mentions a token is not, by that fact, a promotion of it. " +
    "This methodology states the conditions under which INTERLIGENS treats a captured " +
    "post as an exploitable promotion, and the reservations that travel with that judgement.",
  effectiveFrom: "2026-09-03",
  contentSha256: SOCIAL_PROMOTION_V1_SHA256,
  components: [
    {
      id: "qualify",
      title: "Exploitable Promotion Predicate (V1)",
      body: `A captured social post is treated as an exploitable promotion only when all five
of the following hold. The criteria are conjunctive: failing any one is
sufficient to reject, and the rejection names which one.

1. INGESTION MODE. The post was captured by the live watcher (\`ingestionMode = LIVE\`). Backfilled rows are excluded: they describe how the corpus was assembled, not what the market saw.
2. CONTRACT DROP SIGNAL. The post carries a \`ca_drop\` signal. A token mentioned without a contract being surfaced is a comment, not a call to buy.
3. CONTRACT PRESENT. At least one contract address was detected in the post. Without a contract there is nothing to correlate on-chain, so the promotion is not exploitable even if it is real.
4. SIGNAL SCORE FLOOR. The detector's aggregate signal score is at least 50, inclusive. The floor is a launch setting, not a measurement of promotional intent.
5. SINGLE TICKER. Exactly one ticker symbol was detected. A post naming several tokens is a comparison, a listing, or a thread — and pairing a contract to one of several tickers without textual proof would be a fabrication.

RESERVATIONS. These qualify every judgement produced under this methodology and are not severable from it.

- MENTION IS NOT PROMOTION. The predicate exists because the two are routinely confused. A post reading "$CETS didn't get the Alpha listing and it went to $FLORK" names two tokens and promotes neither.
- PRECISION OVER RECALL. V1 is deliberately conservative and will produce false negatives — a genuine promotion whose contract address was not extracted, or which names a second token in passing, is rejected. A narrow clean corpus is preferred to a wide doubtful one at launch.
- THE SINGLE-TICKER RULE IS A LAUNCH GUARD, NOT A UNIVERSAL TRUTH. Multi-token promotions exist. V1 declines to handle them because it cannot yet distinguish them from comparisons; this is a limitation of the predicate, not a claim about the world.
- NO INVENTED TICKER-TO-CONTRACT ASSOCIATION. Where a post names a ticker and a contract without demonstrable textual linkage, no association is recorded. Ambiguity is reported as ambiguity.
- QUALIFICATION IS NOT PROOF OF MANIPULATION. That a post satisfies this predicate establishes that it is a promotion worth measuring. It establishes nothing about coordination, undisclosed compensation, or intent to defraud. Those are separate questions requiring separate evidence.`,
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
