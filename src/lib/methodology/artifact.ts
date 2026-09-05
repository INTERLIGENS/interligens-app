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

// ─── BUILD 7 / S3-G2 — Similarity V2, la comparaison de cas ────────────────
//
// SOURCE : content/methodologies/similarity/v1.md. Ce module en est le miroir
// typé, byte pour byte — un test le vérifie sur les deux sens.
//
// ██ GELÉ AVANT D'AVOIR VU LE MOINDRE RÉSULTAT. ██ L'artefact fige EXACTEMENT
// le contrat et la sémantique livrés en S2 : 16 features, 4 verdicts, 9 motifs,
// 9 invariants, aucun seuil, aucun score, aucun poids. Aucune ligne n'a été
// écrite en connaissance d'un résultat de comparaison — c'est ce qui rend @v1
// opposable : une méthode ajustée après coup ne mesurerait plus que l'ajustement.

/** Empreinte du corps de content/methodologies/similarity/v1.md. */
export const SIMILARITY_V1_SHA256 =
  "4395fddbd6336a240278c3214938a48a1697a610bd3b4d2e306550d4e3155d94";

export const SIMILARITY_V1: MethodologyArtifact = {
  id: "similarity",
  version: "v1",
  title: "How INTERLIGENS Compares a Subject to a Prior Case",
  intro:
    "Asking whether a token looks like a scam demands a score and a threshold, and returns " +
    "a verdict the data does not support. This methodology answers a different question, and " +
    "only that one: which demonstrated characteristics of this subject have already been " +
    "observed in prior cases, and on what evidence does each similarity or difference rest.",
  effectiveFrom: "2026-09-05",
  contentSha256: SIMILARITY_V1_SHA256,
  components: [
    {
      id: "compare",
      title: "Case Similarity Comparison (V1)",
      body: `### 1. What this comparison is, and what it is not

The unit of comparison is a FEATURE: one demonstrated characteristic of one
subject, produced by an engine that already exists, carrying its own evidence,
its own data nature, its own method and its own coverage.

The output is one verdict per feature, drawn from a closed vocabulary of four
values, each accompanied by the basis that produced it: what was compared, the
values on both sides, the evidence pointers, the natures, the coverage, and why
that state and no other.

There is NO similarity score. There is no ranking, no risk level, no percentage
and no weight. Reducing heterogeneous features to a single number would require
weights, and weights are a verdict in disguise. Nothing in this methodology
produces a finding of guilt, scam, coordination, common operator or fault.

### 2. The five observability states

A feature on a given subject is in exactly one of five states. They answer five
different questions and they never merge:

OBSERVED         the characteristic was established, with its evidence.
NOT_OBSERVED     the engine looked at the sample and found nothing in it.
NOT_MEASURABLE   the quantity cannot be measured from what exists.
CENSORED         collection was cut before the question could be answered.
MISSING          the characteristic was never extracted for this subject.

Collapsing these into a single null, false or zero is the fault this contract
exists to make impossible. One null would answer four different questions at
once, and a reader would attribute the answer to the wrong one. Worse: two
nulls side by side read as a resemblance.

MISSING is not a constructible state. An observation cannot carry it; the
comparator observes it when no observation exists. Nothing may therefore
fabricate an absence equipped with a nature and a method.

CENSORED the state and censored coverage are two different facts, and they
coexist. CENSORED means nothing could be established at all. An OBSERVED
feature whose coverage is incomplete has a value, but that value is a FLOOR:
bounded collection may have missed more.

### 3. Value kinds, and what each permits

CATEGORICAL  a label from a closed vocabulary, produced upstream by a frozen
             rule. Equality or difference; nothing in between.
SET          a set of demonstrated identifiers. Overlap is measurable with no
             threshold at all: shared, only-left, only-right.
ORDINAL      a magnitude (a count, seconds). NEVER COMPARED. Saying that one
             magnitude is close to another would require a cut that no ratified
             rule provides, and a cut chosen here would measure only itself.
             The magnitudes are CARRIED on both sides so the reader may judge;
             the comparator abstains and says so.

An observation must have POSITIVE CONTENT. An empty set, a false boolean or an
empty string is not an observation: it is an absence disguised as a value. Two
of them would compare equal, and "neither has anything" would read as "the two
resemble each other". Absence is expressed by a STATE, never by an empty value.

### 4. The feature contract

The registry is CLOSED. A key that is not declared in it has no nature, no
method and no meaning, and a comparison without those three is not
attributable. Seventeen features are declared:

IDENTITY
  identity.token_resolution_status   CATEGORICAL   INFERENCE
  identity.chain_demonstrated        CATEGORICAL   INFERENCE
TEMPORAL
  temporal.anchor_provenance         CATEGORICAL   INFERENCE
  temporal.exit_cluster_span_seconds ORDINAL       INFERENCE
  temporal.exit_cluster_min_gap_seconds ORDINAL    INFERENCE
FUNDING_GRAPH
  funding.shared_funder_addresses    SET           PRIMARY_OBSERVATION
  funding.relationship_categories    SET           INFERENCE
  funding.external_funder_count      ORDINAL       PRIMARY_OBSERVATION
SHILL_CORRELATION
  shill.promotion_qualification      CATEGORICAL   INFERENCE
  shill.kol_handles                  SET           PRIMARY_OBSERVATION, NOMINATIVE
COORDINATED_EXIT
  exit.cluster_category              CATEGORICAL   INFERENCE
  exit.demonstrated_venue            CATEGORICAL   PRIMARY_OBSERVATION
  exit.demonstrated_destination      CATEGORICAL   PRIMARY_OBSERVATION
  exit.distinct_subjects             ORDINAL       PRIMARY_OBSERVATION
  exit.composition_profile           CATEGORICAL   PRIMARY_OBSERVATION
  exit.materiality                   ORDINAL       INFERENCE
PRE_SHILL
  preshill.front_run_wallets         SET           INFERENCE, EXPERIMENTAL

Three things are deliberately NOT features. DATA NATURE is an attribute of
every feature and an input to the comparator; making it a feature would compare
INFERENCE to INFERENCE and call that a resemblance, when it is a property of
the measurement and not of the measured subject. COVERAGE is likewise an
attribute; two equally censored collections do not resemble each other, they
are equally blind. THRESHOLDS never enter this comparator as a parameter: a
threshold may exist only frozen upstream in a ratified rule, and it then enters
as a categorical outcome already computed.

Nature, experimental status and nominative status are owned by the REGISTRY and
are never supplied by the caller. An extractor therefore cannot requalify an
INFERENCE as a PRIMARY_OBSERVATION, nor clear the experimental flag of an
experimental engine output, by passing a different value.

### 5. Comparator semantics

Evaluation order is a rule, not a detail. At each branch the WEAKEST reading
wins; an order leaning the other way would manufacture resemblances and
differences by construction.

1. OBSERVABILITY. If either side is not OBSERVED, the result is NOT_COMPARABLE
   with reason SIDE_NOT_OBSERVABLE, and the reason names BOTH states verbatim.
2. METHOD. If the two sides were produced under different method references,
   rule versions or method parameters, the result is NOT_COMPARABLE with reason
   METHOD_MISMATCH. Nothing in the VALUES would have signalled this: both are
   perfectly well formed.
3. ORDINAL. Two observed magnitudes yield NOT_COMPARABLE with reason
   ORDINAL_REQUIRES_UNDECLARED_THRESHOLD. Accidental equality is a coincidence,
   not a resemblance, and is treated identically.
4. VALUES. CATEGORICAL: equal gives MATCH with reason EQUAL_VALUE, otherwise a
   candidate DIFFERENT with reason VALUE_DIFFERS. SET: identical gives MATCH
   with reason IDENTICAL_SET; a non-empty intersection with a non-empty
   difference gives PARTIAL_MATCH with reason SET_OVERLAP_PARTIAL; disjoint
   sets give a candidate DIFFERENT with reason SET_DISJOINT.
5. CENSORSHIP. A candidate DIFFERENT on a side whose coverage is incomplete
   becomes NOT_COMPARABLE with reason COVERAGE_CENSORED_NEGATIVE_WITHHELD.

Censorship is ASYMMETRIC, and the asymmetry is real. It withdraws negatives and
never positives: an identifier demonstrated on both sides remains demonstrated
whatever the collection bound, while a negative depends entirely on what was
not seen. A surviving positive under censored coverage is marked as a FLOOR.

The verdict vocabulary is closed to MATCH, PARTIAL_MATCH, DIFFERENT and
NOT_COMPARABLE. The reason vocabulary is closed to EQUAL_VALUE, IDENTICAL_SET,
SET_OVERLAP_PARTIAL, VALUE_DIFFERS, SET_DISJOINT, SIDE_NOT_OBSERVABLE,
COVERAGE_CENSORED_NEGATIVE_WITHHELD, METHOD_MISMATCH and
ORDINAL_REQUIRES_UNDECLARED_THRESHOLD. No other pairing exists.

Set overlap is published as three lists and never as a ratio. A ratio would be
a score in disguise and would need a threshold to be read.

A subject-level comparison returns one entry for EVERY declared feature,
including those absent on both sides. Returning only the features present would
make the length of the output vary with ignorance: two poorly covered subjects
would appear to have few differences.

NOT_COMPARABLE is a valid and expected result. It is the correct answer
whenever the evidence does not support a comparison, and a methodology that
avoided it would be manufacturing findings out of absences.

### 6. The nine invariants

Each is enforced by executable code that raises, and each is demonstrated by a
dedicated mutant that must turn red when its guard is removed.

INV-1 The five observability states never merge, and each side state is
      transcribed faithfully from its observation.
INV-2 Absence of evidence never becomes MATCH, PARTIAL_MATCH or DIFFERENT.
INV-3 An observation must have positive content.
INV-4 Censorship may only weaken a negative, never produce one.
INV-5 An experimental engine output does not become a canonical fact by being
      compared; the flag and its reservation propagate.
INV-6 Nature never climbs the authority scale. The result nature is the least
      authoritative of the two sides, and is null when either side is MISSING.
INV-7 Every comparison is attributable: both values or states, evidence
      pointers on observed sides, a rule version, a method reference that
      resolves against a frozen artifact when present, the method parameters
      the registry requires, and a coverage that names what cut it.
INV-8 The verdict and reason vocabularies are closed; no aggregate key may
      appear anywhere in the output; an ordinal magnitude is never judged; and
      the reason text may not contain conclusion language.
INV-9 Two measurements produced under different methods do not compare.

### 7. What never comes out of this comparison

No score, no ranking, no percentage, no risk level. No claim of coordination,
common operator, sybil behaviour, manipulation or fault. No statement about a
person: a shared handle or a shared address is a CO-OCCURRENCE in the data, and
an exchange hot wallet reaches thousands of unrelated people. Reading intent
from any output of this methodology is an INTERPRETATION, produced elsewhere,
on a traceable basis, and never automatically.`,
    },
  ],
};

// ─── BUILD 7 / compare@v2 — la version CORRECTIVE ──────────────────────────
//
// SOURCE : content/methodologies/similarity/v2.md. Miroir typé, byte pour byte.
//
// ██ @v1 N'EST PAS RETIRÉ. ██ `supersedes: v1` dit la filiation, pas la mise au
// rebut : @v1 reste GELÉ et RÉSOLVABLE, parce que c'est la seule façon de
// mesurer un delta @v1→@v2 sur un corpus identique. Un correctif qui effacerait
// la version corrigée rendrait sa propre correction invérifiable.
//
// Ce que @v2 ferme, ce sont TROIS contradictions QUE LE RUN S3 A MESURÉES —
// pas trois défauts imaginés : une provenance d'ancre que le vocabulaire fermé
// refusait alors que le corpus la porte, l'absence d'état pour une donnée qui
// existe sans pouvoir soutenir une feature, et l'absence de toute règle
// d'agrégation groupe→sujet. Plus la sémantique de destination.

/** Empreinte du corps de content/methodologies/similarity/v2.md. */
export const SIMILARITY_V2_SHA256 =
  "5a1affa89dab3ca058034041f9731a901c4a144dcd49ee512f2d7864ce81ef51";

export const SIMILARITY_V2: MethodologyArtifact = {
  id: "similarity",
  version: "v2",
  title: "How INTERLIGENS Compares a Subject to a Prior Case",
  intro:
    "Asking whether a token looks like a scam demands a score and a threshold, and returns " +
    "a verdict the data does not support. This methodology answers a different question, and " +
    "only that one: which demonstrated characteristics of this subject have already been " +
    "observed in prior cases, and on what evidence does each similarity or difference rest.",
  effectiveFrom: "2026-09-05",
  contentSha256: SIMILARITY_V2_SHA256,
  components: [
    {
      id: "compare",
      title: "Case Similarity Comparison (V2)",
      body: `### 0. What v2 changes, and what it refuses to change

v2 is a CORRECTIVE version. It declares the same seventeen features as v1, the
same four verdicts, the same prohibition on scores, thresholds, weights and
percentages, and the same nine invariants. It adds four things, each closing a
defect that a real run measured rather than a defect someone imagined:

1. A GROUP-TO-SUBJECT AGGREGATION rule, declared per feature. v1 said nothing,
   so a run had to invent one, and the conservative choice it made destroyed
   facts that three groups out of six had demonstrated.
2. A sixth observability state, INADMISSIBLE, for data that EXISTS and cannot
   support the feature. v1 had only four kinds of absence, and a run had to file
   inadmissible rows under "we looked and found nothing", which was false.
3. An explicit TEMPORAL RESOLUTION, so that a source dated to the day is carried
   as a day and never as an instant.
4. An ATTRIBUTION on every feature that names an address or an entity, so that a
   raw identifier match is never read as an entity match.

v2 loosens nothing. Every refusal v1 made, v2 still makes.

### 1. What this comparison is, and what it is not

The unit of comparison is a FEATURE: one demonstrated characteristic of one
subject, produced by an engine that already exists, carrying its own evidence,
its own data nature, its own method and its own coverage.

The output is one verdict per feature, drawn from a closed vocabulary of four
values, each accompanied by the basis that produced it: what was compared, the
values on both sides, the evidence pointers, the natures, the coverage, the
aggregation scope, the attribution, and why that state and no other.

There is NO similarity score. There is no ranking, no risk level, no percentage
and no weight. Reducing heterogeneous features to a single number would require
weights, and weights are a verdict in disguise. Nothing in this methodology
produces a finding of guilt, scam, coordination, common operator or fault.

### 2. The six observability states

A feature on a given subject is in exactly one of six states. They answer six
different questions and they never merge:

OBSERVED         the characteristic was established, with its evidence.
NOT_OBSERVED     the engine looked at the sample and found nothing in it.
NOT_MEASURABLE   the quantity cannot be measured from what exists.
CENSORED         collection was cut before the question could be answered.
INADMISSIBLE     the data exists and cannot support this feature.
MISSING          the characteristic was never extracted for this subject.

INADMISSIBLE is the state v1 lacked, and its absence was not cosmetic. Under
NOT_OBSERVED a reader concludes that collection should be widened; under
INADMISSIBLE the reader knows it is the QUALIFICATION of the data that blocks,
and that collecting more of the same would change nothing. An inadmissible
feature must name its cause, drawn from a closed list: DATA_NATURE_MISSING (the
source row carries no nature at all), DATA_NATURE_MISMATCH (it carries a nature,
and not the one the feature requires), PROVENANCE_UNSATISFIED (a method,
provenance or proof the contract requires is not met). It must also state what
was found and what was required: a refusal must remain contestable.

An inadmissible side is NEVER downgraded to an absence, and an absent side is
never dressed as a refusal. The comparator gives inadmissibility its own reason
code, evaluated BEFORE observability, so that a rejection cannot disappear under
the generic one.

MISSING remains non-constructible: an observation cannot carry it; the
comparator observes it when no observation exists.

CENSORED the state and censored coverage remain two different facts, and they
coexist. CENSORED means nothing could be established at all. An OBSERVED feature
whose coverage is incomplete has a value, but that value is a FLOOR.

### 3. Group-to-subject aggregation

Several features are defined PER GROUP: the contract says "within the group",
"from the first to the last act of the group". A subject may hold several
groups. v2 declares, for each feature, how the group level reaches the subject
level, and it never decides case by case.

ALL_OR_NOTHING       a subject-level value exists only if EVERY group
                     demonstrates it. Used where the feature describes a
                     property of the whole rather than of a fragment.
DEMONSTRATED_BY_ANY  a fact demonstrated by at least one group IS demonstrated.
                     Used where unanimity is ALREADY required inside the group,
                     so that requiring it a second time between groups would add
                     a rule nothing supports.
PER_GROUP_MAGNITUDE  a magnitude defined per group. Where the subject holds
                     SEVERAL groups there is no subject-level value: the
                     per-group facts are preserved intact, and summarising them
                     into a sum, an average or a maximum would fabricate a
                     quantity nothing measured. Where the subject IS a single
                     group, the magnitude is exactly the one the contract
                     defines, and it is observed and carried. That distinction
                     is not a threshold: it separates the unit of definition
                     from an aggregate that is not one. In both cases the
                     magnitude is CARRIED and never judged.
SUBJECT_LEVEL        the feature is computed directly on the subject; there is
                     nothing to aggregate.

Every aggregation carries a SCOPE, and the scope travels with the value all the
way into the comparison result: ALL_GROUPS, SOME_GROUPS, CONFLICTING_GROUPS,
NO_GROUP, PER_GROUP_ONLY, NOT_AGGREGATED.

THERE IS NO MAJORITY VOTE, anywhere. "Five groups out of six say X, therefore
the subject is X" is a threshold in disguise — why five out of six and not four?
— and it silences the group that says otherwise. When groups demonstrate two
different values the scope says CONFLICTING_GROUPS and NO subject value is
produced. This is enforced in code: an observation whose aggregation records
more than one distinct demonstrated value cannot be OBSERVED.

SOME_GROUPS IS NOT A WHOLE-SUBJECT TRUTH. A value demonstrated by three groups
out of six is demonstrated, and it is demonstrated BY THREE GROUPS OUT OF SIX.
A result resting on such a side is flagged as scope-restricted and carries a
reservation saying so.

### 4. Temporal resolution

A source that dates a fact to the DAY is carried as a day, and a source that
dates it to the INSTANT is carried as an instant. The resolution is explicit,
and so is its provenance.

NO HOUR IS EVER FABRICATED. Midnight is not an observation: it is the default
value of a column type. Carrying that instant would assert a minute nobody
measured, on a product whose engines measure gaps of seconds. A day-resolution
value must therefore be a bare date; a value that claims day resolution while
carrying a time component is refused in code.

A feature may declare that it requires INSTANT resolution. When it does and
either side is only dated to the day, the comparison is NOT_COMPARABLE with the
reason TEMPORAL_RESOLUTION_INSUFFICIENT. The gap is never closed by inventing a
time.

date_only is an admissible anchor provenance in v2, alongside snowflake and
source_timestamp. v1 refused it, and the refusal was wrong: the corpus carries
it, and a real value the contract cannot say is a defect of the contract.
Admitting the provenance authorises no hour whatsoever.

### 5. Attribution of addresses and entities

Several features name an address or an entity. Each such feature carries an
ATTRIBUTION, and its default is ignorance:

UNATTRIBUTED       no auditable label. The value is an identifier, and nothing
                   more.
DECLARED_BY_SOURCE a name REPORTED by the source, typically a program named by
                   an indexer. Reported, never verified, and it carries no
                   provenance precisely because that is what distinguishes it
                   from an attribution.
ATTRIBUTED         an auditable label WITH its provenance. The only opposable
                   identity. A label without provenance is treated as absent,
                   exactly as the funding-relationship methodology already
                   requires.

An identical address compares as an identical IDENTIFIER, and that comparison is
kept: suppressing it would impoverish the result. What is forbidden is reading
anything else into it. When either compared side is UNATTRIBUTED the result is
flagged and carries a reservation stating that no entity, no venue, no exchange,
no cashout and no coordination may be read into the match, and that it carries
no probative weight.

This matters concretely. A destination address unanimously demonstrated by
several groups may be shared market infrastructure; if it is, the co-occurrence
is worth nothing. v2 does not decide which it is — deciding would require a
label the product does not hold, and inventing one is precisely the fault this
methodology exists to prevent. v2 states the ignorance instead.

### 6. The feature contract

The registry is CLOSED and holds exactly the seventeen features of v1. Each now
also declares its aggregation rule, whether it requires an attribution, the
temporal resolution it requires, and the data nature its source rows must carry.

IDENTITY
  identity.token_resolution_status   CATEGORICAL   INFERENCE            SUBJECT_LEVEL
  identity.chain_demonstrated        CATEGORICAL   INFERENCE            SUBJECT_LEVEL
TEMPORAL
  temporal.anchor_provenance         CATEGORICAL   INFERENCE            SUBJECT_LEVEL
  temporal.exit_cluster_span_seconds ORDINAL       INFERENCE            PER_GROUP_MAGNITUDE
  temporal.exit_cluster_min_gap_seconds ORDINAL    INFERENCE            PER_GROUP_MAGNITUDE
FUNDING_GRAPH
  funding.shared_funder_addresses    SET           PRIMARY_OBSERVATION  SUBJECT_LEVEL, attribution
  funding.relationship_categories    SET           INFERENCE            SUBJECT_LEVEL
  funding.external_funder_count      ORDINAL       PRIMARY_OBSERVATION  SUBJECT_LEVEL
SHILL_CORRELATION
  shill.promotion_qualification      CATEGORICAL   INFERENCE            SUBJECT_LEVEL
  shill.kol_handles                  SET           PRIMARY_OBSERVATION  SUBJECT_LEVEL, NOMINATIVE
COORDINATED_EXIT
  exit.cluster_category              CATEGORICAL   INFERENCE            ALL_OR_NOTHING
  exit.demonstrated_venue            CATEGORICAL   PRIMARY_OBSERVATION  DEMONSTRATED_BY_ANY, attribution
  exit.demonstrated_destination      CATEGORICAL   PRIMARY_OBSERVATION  DEMONSTRATED_BY_ANY, attribution
  exit.distinct_subjects             ORDINAL       PRIMARY_OBSERVATION  PER_GROUP_MAGNITUDE
  exit.composition_profile           CATEGORICAL   PRIMARY_OBSERVATION  ALL_OR_NOTHING
  exit.materiality                   ORDINAL       INFERENCE            PER_GROUP_MAGNITUDE
PRE_SHILL
  preshill.front_run_wallets         SET           INFERENCE            SUBJECT_LEVEL, EXPERIMENTAL, attribution

Three things remain deliberately NOT features. DATA NATURE is an attribute and
an input to the comparator. COVERAGE is an attribute. THRESHOLDS never enter
this comparator as a parameter: a threshold may exist only frozen upstream in a
ratified rule, and it then enters as a categorical outcome already computed.

Nature, experimental status, nominative status, aggregation rule and attribution
requirement are owned by the REGISTRY and are never supplied by the caller.

Value kinds are unchanged. CATEGORICAL compares by equality. SET compares by
overlap, published as three lists and never as a ratio. ORDINAL is NEVER
COMPARED: saying that one magnitude is close to another would require a cut that
no ratified rule provides. An observation must have POSITIVE CONTENT; an empty
set, a false boolean or an empty string is an absence disguised as a value.

### 7. Comparator semantics

Evaluation order is a rule, not a detail. At each branch the WEAKEST reading
wins.

1. ADMISSIBILITY. If either side is INADMISSIBLE, the result is NOT_COMPARABLE
   with reason SIDE_INADMISSIBLE, carrying the cause, what was found and what
   was required. This runs FIRST, so a rejection never disappears under the
   generic absence.
2. OBSERVABILITY. If either side is not OBSERVED, the result is NOT_COMPARABLE
   with reason SIDE_NOT_OBSERVABLE, and the reason names BOTH states verbatim.
3. METHOD. Different method references, rule versions or method parameters give
   NOT_COMPARABLE with reason METHOD_MISMATCH. Nothing in the VALUES would have
   signalled it.
4. TEMPORAL RESOLUTION. A feature requiring INSTANT resolution against a side
   dated only to the day gives NOT_COMPARABLE with reason
   TEMPORAL_RESOLUTION_INSUFFICIENT.
5. ORDINAL. Two observed magnitudes give NOT_COMPARABLE with reason
   ORDINAL_REQUIRES_UNDECLARED_THRESHOLD. Accidental equality is a coincidence.
6. VALUES. CATEGORICAL: equal gives MATCH with EQUAL_VALUE, otherwise a
   candidate DIFFERENT with VALUE_DIFFERS. SET: identical gives MATCH with
   IDENTICAL_SET; a non-empty intersection with a non-empty difference gives
   PARTIAL_MATCH with SET_OVERLAP_PARTIAL; disjoint sets give a candidate
   DIFFERENT with SET_DISJOINT.
7. CENSORSHIP. A candidate DIFFERENT on a side whose coverage is incomplete
   becomes NOT_COMPARABLE with COVERAGE_CENSORED_NEGATIVE_WITHHELD.

Censorship remains ASYMMETRIC: it withdraws negatives and never positives.

The verdict vocabulary is closed to MATCH, PARTIAL_MATCH, DIFFERENT and
NOT_COMPARABLE. The reason vocabulary is closed to EQUAL_VALUE, IDENTICAL_SET,
SET_OVERLAP_PARTIAL, VALUE_DIFFERS, SET_DISJOINT, SIDE_NOT_OBSERVABLE,
SIDE_INADMISSIBLE, TEMPORAL_RESOLUTION_INSUFFICIENT,
COVERAGE_CENSORED_NEGATIVE_WITHHELD, METHOD_MISMATCH and
ORDINAL_REQUIRES_UNDECLARED_THRESHOLD. No other pairing exists.

A subject-level comparison returns one entry for EVERY declared feature,
including those absent on both sides.

NOT_COMPARABLE is a valid and expected result. A methodology that avoided it
would be manufacturing findings out of absences.

A result produced under v1 does not compare with a result produced under v2.
Both versions stay frozen and both stay resolvable; the version is part of the
result, exactly as a window or a threshold would be.

### 8. The thirteen invariants

Each is enforced by executable code that raises, and each is demonstrated by a
dedicated mutant that must turn red when its guard is removed.

INV-1  The observability states never merge, and each side state is transcribed
       faithfully from its observation.
INV-2  Absence of evidence never becomes MATCH, PARTIAL_MATCH or DIFFERENT.
INV-3  An observation must have positive content.
INV-4  Censorship may only weaken a negative, never produce one.
INV-5  An experimental engine output does not become a canonical fact by being
       compared.
INV-6  Nature never climbs the authority scale.
INV-7  Every comparison is attributable, and so is every refusal.
INV-8  The verdict and reason vocabularies are closed; no aggregate key may
       appear anywhere in the output; an ordinal magnitude is never judged; the
       reason text may not contain conclusion language.
INV-9  Two measurements produced under different methods do not compare.
INV-10 An INADMISSIBLE side is never downgraded to an absence, never carries its
       cause under another state, and always yields its own reason code.
INV-11 No aggregation by majority vote; a scope is never laundered into a
       whole-subject truth.
INV-12 No hour is fabricated where the source gives none.
INV-13 No semantic identity is attached to an unlabelled address, and a label
       without auditable provenance is treated as absent.

### 9. What never comes out of this comparison

No score, no ranking, no percentage, no risk level. No claim of coordination,
common operator, sybil behaviour, manipulation or fault. No statement about a
person: a shared handle or a shared address is a CO-OCCURRENCE in the data, and
an exchange hot wallet reaches thousands of unrelated people. Reading intent
from any output of this methodology is an INTERPRETATION, produced elsewhere, on
a traceable basis, and never automatically.`,
    },
  ],
};

export function serializeArtifactBody(a: MethodologyArtifact): string {
  return a.components
    .map((c) => `## ${c.id} — ${c.title}\n\n${c.body}`)
    .join("\n\n");
}
