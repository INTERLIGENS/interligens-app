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
/** Empreinte du corps de content/methodologies/funding-relationship/v1.md. */
export const FUNDING_RELATIONSHIP_V1_SHA256 =
  "ac21ecef037e865c18b9e9de66984b8eff101e51bf2bdf86445873e915421947";

/**
 * BUILD 5 — la methodologie que cite le natureBasis d'une relation de
 * financement qualifiee.
 *
 * Le corps est le texte GELE, miroir de content/methodologies/
 * funding-relationship/v1.md. Le test de gel recalcule l'empreinte du .md et la
 * compare : modifier l'un sans l'autre casse la suite.
 */
export const FUNDING_RELATIONSHIP_V1: MethodologyArtifact = {
  id: "funding-relationship",
  version: "v1",
  title: "How INTERLIGENS Qualifies a Funding Relationship",
  intro:
    "That two wallets received SOL from the same address is an observation; what it is " +
    "worth depends on who that address is. This methodology states how INTERLIGENS " +
    "sorts shared funders by evidential weight, and the reservations that travel with " +
    "that judgement.",
  effectiveFrom: "2026-09-04",
  contentSha256: FUNDING_RELATIONSHIP_V1_SHA256,
  components: [
    {
      id: "qualify",
      title: "Funding Relationship Qualification (V1)",
      body: `That two wallets received SOL from the same address is an observation. What that
observation is worth depends entirely on who the address is, and this
methodology exists because "same funder" is not a homogeneous fact. An exchange
hot wallet funds thousands of unrelated people every day; a private address
funding two wallets minutes before a launch is a different kind of fact. Both
are shared funders. Collapsing them would make the strong case indistinguishable
from the banal one.

The input is a set of funding edges, each a PRIMARY_OBSERVATION carrying source,
destination, amount, timestamp and transaction signature. The output is a
category. The category is an INFERENCE — a rule applied to observations — and it
travels with the basis that produced it.

CATEGORIES. Exactly one is assigned, and they are evaluated in the order below.
The order matters: a funder that is both an exchange and above the dust floor is
an exchange, because the weaker reading is the safer one.

1. DUST. The total transferred to the reached subjects is below the operating
   floor defined next. A transfer that cannot pay for a wallet to exist and act
   once does not establish a funding relationship, whatever its direction.
2. SELF_OR_KNOWN_ACTOR. The funder is itself one of the subjects, or an actor
   already identified in the case. A subject funding other subjects is a fact
   about the population, not an external source, and merging it with third-party
   funders would count the same actor twice.
3. KNOWN_EXCHANGE. The funder carries an address label identifying it as an
   exchange, AND that label has demonstrable, auditable provenance. Observation
   remains valid; probative value is low, because an exchange funding several
   wallets is the most ordinary event on the chain.
4. PRIVATE_SHARED_FUNDER. The funder reached at least two subjects, is not dust,
   is not a subject or known actor, and carries no exchange label. This is a
   factual signal that warrants examination. It is NOT a finding of
   coordination, and this methodology produces no such finding.
5. UNKNOWN. Everything else, including any funder whose label exists but cannot
   be audited. Unknown is a statement about our evidence, not about the address.

THE DUST FLOOR IS MECHANICAL, NOT CHOSEN. It is the minimum lamport cost for a
wallet to exist and perform one operation on Solana:

    rent-exempt minimum, zero-data System account
      = (128 bytes account overhead + 0 bytes data)
        x 3,480 lamports per byte-year
        x 2.0 years exemption threshold
      = 890,880 lamports
    one transaction signature
      = 5,000 lamports
    ---------------------------------------------
    operating floor = 895,880 lamports (0.00089588 SOL)

Below this sum, the recipient cannot open an account and sign once. The floor is
therefore derived from protocol parameters, not selected to make results come
out a particular way. It is deliberately the weakest possible floor: it excludes
only transfers that are mechanically incapable of funding activity, and makes no
claim about what amount would be economically meaningful.

COVERAGE IS PART OF THE RESULT. Where the underlying collection was censored —
a page cap reached, a budget exhausted, a request refused — the qualification is
reported as a FLOOR. Censored coverage never yields "no relationship": absence
of observation under a bounded collection establishes nothing about the world,
and reporting it as a negative would convert a budget limit into a fact.

RESERVATIONS. These qualify every judgement produced under this methodology and
are not severable from it.

- QUALIFICATION IS NOT INTERPRETATION. This methodology sorts observations by
  evidential weight. It does not conclude coordination, insider dealing, or
  fraud, and produces no score, ranking, or label carrying such a reading. Those
  are separate questions requiring separate evidence and separate judgement.
- PRIVATE_SHARED_FUNDER IS A QUESTION, NOT AN ANSWER. A private address funding
  several wallets has many ordinary explanations: one person operating several
  wallets, a market-making desk, an OTC counterparty, a friend. The category
  marks what deserves examination, not what has been established.
- LABELS ARE ONLY AS GOOD AS THEIR PROVENANCE. An unaudited exchange label is
  treated as absent. Trusting an unsourced label would let a third party's
  annotation decide how INTERLIGENS reads its own evidence.
- ONE HOP ONLY. V1 qualifies direct funding edges. A funder of a funder is a
  reconstruction, not an observation, and is out of scope.
- V1 IS CONSERVATIVE AND REVISABLE. The categories are coarse by intent. Where a
  funder resists classification, UNKNOWN is preferred to a category that would
  overstate what the evidence carries.`,
    },
  ],
};

/** Empreinte du corps de content/methodologies/coordinated-exit/v1.md. */
export const COORDINATED_EXIT_V1_SHA256 =
  "ab993adca19a31473143f444358a4cdf69aa7eafea80e55adc2e40eaa92ca06c";

/**
 * BUILD 6 / PACK B — la methodologie que cite le natureBasis d'une co-sortie
 * caracterisee.
 *
 * Le corps est le texte GELE, miroir de content/methodologies/coordinated-exit/
 * v1.md. Le test de gel recalcule l'empreinte du .md et la compare : modifier
 * l'un sans l'autre casse la suite.
 */
export const COORDINATED_EXIT_V1: MethodologyArtifact = {
  id: "coordinated-exit",
  version: "v1",
  title: "How INTERLIGENS Characterises a Co-Exit",
  intro:
    "Several wallets selling within seconds of one another is a fact; what it means is " +
    "a separate question. This methodology states the dimensions along which INTERLIGENS " +
    "describes a co-exit group, and the reservations that travel with that description.",
  effectiveFrom: "2026-09-05",
  contentSha256: COORDINATED_EXIT_V1_SHA256,
  components: [
    {
      id: "qualify",
      title: "Co-Exit Characterisation (V1)",
      body: `Several wallets selling within seconds of one another is a fact. What that fact
means is a separate question, and this methodology does not answer it. It
characterises a co-exit group along fixed dimensions so that a reader can weigh
it, and it stops there.

The input is a group of ExitEvents, each a PRIMARY_OBSERVATION carrying subject,
mint, type, amount, block time and transaction signature, together with the
temporal relations derived from those block times. The output is a
characterisation. The characterisation is an INFERENCE — a rule applied to
observations — and it travels with the basis that produced it.

STRUCTURAL PROPERTY, BINDING ON EVERY EVENT ENTERING THIS METHODOLOGY.

    SELL requires demonstrated transactional counterparty provenance.
    Atomic co-occurrence alone is insufficient.
    Rent recovery is not sale consideration.

This is not advisory. An event typed SELL whose counterparty provenance is not
demonstrated is refused entry, and the refusal raises rather than downgrades:
characterising an undemonstrated sale would place the whole group on evidence
that does not exist.

DIMENSIONS. Seven, all descriptive, none scored.

1. DISTINCT SUBJECTS. How many different wallets appear in the group. A wallet
   exiting repeatedly is a behaviour, not a group.
2. CANONICAL PROXIMITY. The ratified window is 60 seconds. Reported: how many
   subject pairs fall within it, and the smallest and median gap observed. The
   window is a parameter of the observation, never tuned to the result.
3. SPAN. The interval from the earliest to the latest event in the group.
   Chaining may stretch a group beyond the canonical window while every pair
   inside it stays within — span and proximity are therefore reported apart.
4. DEMONSTRATED VENUE AND DESTINATION. Named only where every event in the group
   names the same one. Where any event does not, the field is null. A venue that
   is not demonstrated is absent, never inferred from the majority.
5. COMPOSITION. How many events are SELL and how many are OUTGOING_TRANSFER. The
   two are not interchangeable: a transfer moves tokens, a sale disposes of them,
   and a group made of transfers says something different from one made of sales.
6. COVERAGE. The three coverages travel separately — subjects, transactions,
   primary evidence. A group observed under censored collection is a floor.
7. MATERIALITY STATUS. Where the pre-exit balance is not demonstrable, the status
   is NOT_MEASURABLE and stays so. It is never estimated, never proxied, and no
   claim of a material exit is made without it.

CATEGORY. V1 defines exactly one: NARROW_WINDOW_CLUSTER — at least two distinct
subjects exiting the same mint within the canonical proximity window. It is
structural: it restates what was observed, in one word.

    NARROW_WINDOW_CLUSTER IS NOT COORDINATED_EXIT.

No temporal proximity, however tight, demonstrates intent, coordination, dumping,
or fault. Wallets cluster because a chart moved, because a post landed, because
a stop-loss triggered, because one operator holds several keys. These are
different worlds producing the same seconds. Distinguishing them requires
evidence this methodology does not consume.

V1 defines a single category deliberately. A second one — "tight" versus "loose",
"large" versus "small" — would require a threshold that no measurement supports,
and a threshold chosen to make groups fall on one side is not a finding about the
world. Where a distinction is wanted, the dimensions are published and the reader
may draw it, in the open.

RESERVATIONS. These qualify every characterisation produced under this
methodology and are not severable from it.

- CHARACTERISATION IS NOT INTERPRETATION. This methodology describes a group
  along fixed dimensions. It produces no score, no ranking, no risk level, and no
  verdict. Coordination, dumping and intent are separate questions requiring
  separate evidence and separate judgement.
- THE WINDOW IS AN OBSERVATION PARAMETER. 60 seconds is ratified, not discovered.
  Sensitivity across other windows is reported alongside; those windows never
  silently replace the canonical one according to which result is preferred.
- observedCounterpartyAmount IS NEVER SUMMED. It records one directly observed
  counterparty asset attributed to the demonstrated exchange, not the total
  received. This methodology does not read it, does not aggregate it, and yields
  no proceeds figure or profit-and-loss.
- ABSENCE OF A CHARACTERISATION ESTABLISHES NOTHING. Where no group is observed,
  the collection was bounded — by a window, a page cap, a budget. That is a limit
  on what was looked at, not a fact about what happened.`,
    },
  ],
};

export function serializeArtifactBody(a: MethodologyArtifact): string {
  return a.components
    .map((c) => `## ${c.id} — ${c.title}\n\n${c.body}`)
    .join("\n\n");
}
