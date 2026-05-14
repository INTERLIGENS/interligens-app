/**
 * REFLEX V1 — narrative library (15 scripts).
 *
 * Data source for the seed (prisma/seeds/narrative-scripts.ts) and for
 * the matcher (src/lib/reflex/narrativeMatcher.ts). Separated from the
 * seed runner so the data can be imported by tests without triggering
 * the Prisma connection at module load.
 *
 * Categories
 *   FOMO          — fear-of-missing-out pressure (listing, last chance…)
 *   AUTHORITY     — borrowed authority (insider, KOL endorsement)
 *   URGENCY       — synthetic time pressure (migration, takeover)
 *   TRUST_HIJACK  — fake institutional/social trust (audit, partnership,
 *                   charity, AI/RWA narrative hijack)
 *   WALLET_TRAP   — direct wallet-interaction trap (airdrop, verify,
 *                   send-to-receive)
 *   COORDINATION  — textual fingerprint of synchronised pushes
 *
 * Severity
 *   WAIT             — matched script with confidence ≥
 *                      NARRATIVE_MATCH_WAIT_THRESHOLD is a standalone
 *                      WAIT trigger (per the spec decision matrix).
 *   STOP_CONTRIBUTOR — never triggers STOP alone; only feeds the
 *                      convergence count. Unused in V1; reserved for V2.
 *
 * derivedFrom references the casefile codes that informed each script
 * (BOTIFY, RAVE, GHOST, VINE, SOLAXY).
 *
 * defaultConfidence values are V1 starting points. Calibration during
 * the shadow phase will tune them — that's why they live in DB rows,
 * not in code constants.
 */

export type NarrativeScriptCategory =
  | "FOMO"
  | "AUTHORITY"
  | "URGENCY"
  | "TRUST_HIJACK"
  | "WALLET_TRAP"
  | "COORDINATION";

export type NarrativeScriptSeverity = "WAIT" | "STOP_CONTRIBUTOR";

export interface NarrativeScriptSeed {
  code: string;
  label: string;
  category: NarrativeScriptCategory;
  keywords: string[];
  regexes: string[];
  derivedFrom: string[];
  defaultConfidence: number;
  severity: NarrativeScriptSeverity;
}

export const NARRATIVE_SCRIPTS: readonly NarrativeScriptSeed[] = [
  {
    code: "LISTING_IMMINENT",
    label: "Listing imminent claim",
    category: "FOMO",
    keywords: [
      "tier 1 listing", "binance listing", "coinbase listing", "okx listing",
      "kraken listing", "bybit listing", "major exchange listing",
      "cex listing imminent", "listing announcement soon",
      "listing imminent", "annonce de listing", "exchange majeur bientôt",
    ],
    regexes: [
      "\\b(binance|coinbase|kraken|okx|bybit|bitget)\\s+listing\\b",
      "\\blisting\\s+(imminent|incoming|confirmed)\\b",
    ],
    derivedFrom: ["BOTIFY"],
    defaultConfidence: 0.7,
    severity: "WAIT",
  },
  {
    code: "LAST_CHANCE",
    label: "Last chance pressure",
    category: "FOMO",
    keywords: [
      "last chance", "don't miss out", "do not miss", "100x potential",
      "1000x potential", "few tokens left", "before it's too late",
      "regret missing", "you'll regret", "moonshot",
      "dernière chance", "ne ratez pas", "100x potentiel",
      "avant qu'il soit trop tard", "vous allez regretter",
    ],
    regexes: [
      "\\b(last\\s+chance|don'?t\\s+miss(?:\\s+out)?|1000?x(?:\\s+potential)?|moonshot)\\b",
    ],
    derivedFrom: ["BOTIFY", "RAVE"],
    defaultConfidence: 0.6,
    severity: "WAIT",
  },
  {
    code: "PRESALE_EXCLUSIVE",
    label: "Exclusive presale offer",
    category: "FOMO",
    keywords: [
      "exclusive presale", "early access", "whitelist only",
      "limited spots", "private round", "presale exclusive",
      "presale exclusive", "accès anticipé", "whitelist uniquement",
      "tour privé", "places limitées",
    ],
    regexes: [
      "\\b(presale|whitelist|private\\s+round|early\\s+access)\\b",
    ],
    derivedFrom: ["VINE"],
    defaultConfidence: 0.65,
    severity: "WAIT",
  },
  {
    code: "KOL_INSIDER_CALL",
    label: "Insider call narrative",
    category: "AUTHORITY",
    keywords: [
      "insider call", "alpha leak", "tip from insider", "private group call",
      "before everyone", "alpha tip", "kol call", "alpha drop",
      "info d'insider", "alpha leak", "appel privé", "tip avant tout le monde",
    ],
    regexes: [
      "\\b(insider\\s+call|alpha\\s+(leak|drop|tip)|kol\\s+call)\\b",
    ],
    derivedFrom: ["VINE", "RAVE"],
    defaultConfidence: 0.7,
    severity: "WAIT",
  },
  {
    code: "FAKE_AUDIT",
    label: "Unverifiable audit claim",
    category: "TRUST_HIJACK",
    keywords: [
      "audited by certik", "audited by hacken", "audit complete",
      "fully audited", "smart contract audit passed", "audit report attached",
      "audité par certik", "audit complet", "smart contract audité",
    ],
    regexes: [
      "\\baudited\\s+by\\s+(certik|hacken|peckshield|trail\\s+of\\s+bits|quantstamp)\\b",
      "\\b(fully\\s+audited|audit\\s+(complete|passed))\\b",
    ],
    derivedFrom: ["GHOST", "BOTIFY"],
    defaultConfidence: 0.75,
    severity: "WAIT",
  },
  {
    code: "FAKE_PARTNERSHIP",
    label: "Unverifiable partnership claim",
    category: "TRUST_HIJACK",
    keywords: [
      "partnership with", "official partner", "strategic partner",
      "collaboration with", "partnered with", "backed by",
      "partenariat avec", "partenaire officiel", "collaboration avec",
    ],
    regexes: [
      "\\b(partnership\\s+with|official\\s+partner(?:ship)?|strategic\\s+partner|partenariat\\s+avec)\\b",
    ],
    derivedFrom: ["RAVE"],
    defaultConfidence: 0.65,
    severity: "WAIT",
  },
  {
    code: "MIGRATION_EMERGENCY",
    label: "Urgent migration request",
    category: "URGENCY",
    keywords: [
      "migrate your tokens", "v2 contract", "swap to v2", "migration urgent",
      "claim your migration", "new contract address", "migrate now",
      "migrer vos tokens", "contrat v2", "migration urgente",
    ],
    regexes: [
      "\\b(migrate\\s+your\\s+tokens?|claim\\s+your\\s+migration|v2\\s+contract|new\\s+contract\\s+address)\\b",
    ],
    derivedFrom: ["BOTIFY"],
    defaultConfidence: 0.85,
    severity: "WAIT",
  },
  {
    code: "COMMUNITY_TAKEOVER",
    label: "Community takeover narrative",
    category: "URGENCY",
    keywords: [
      "community takeover", "team abandoned", "cto confirmed",
      "we're rebuilding", "phoenix from ashes", "fresh start with community",
      "reprise communautaire", "équipe a abandonné",
    ],
    regexes: [
      "\\b(community\\s+takeover|cto\\s+confirmed|team\\s+abandoned)\\b",
    ],
    derivedFrom: ["GHOST"],
    defaultConfidence: 0.7,
    severity: "WAIT",
  },
  {
    code: "AIRDROP_CLAIM_TRAP",
    label: "Airdrop claim trap pattern",
    category: "WALLET_TRAP",
    keywords: [
      "claim your airdrop", "free tokens waiting", "eligible for airdrop",
      "verify wallet for airdrop", "unclaimed airdrop", "airdrop ready to claim",
      "réclamez votre airdrop", "tokens gratuits", "éligible airdrop",
    ],
    regexes: [
      "\\b(claim\\s+your\\s+airdrop|eligible\\s+for\\s+airdrop|unclaimed\\s+airdrop)\\b",
    ],
    derivedFrom: ["VINE"],
    defaultConfidence: 0.8,
    severity: "WAIT",
  },
  {
    code: "WALLET_VERIFICATION",
    label: "Wallet verification trap",
    category: "WALLET_TRAP",
    keywords: [
      "verify your wallet", "wallet verification needed", "wallet verification",
      "connect wallet to claim", "sign to verify", "signature required to verify",
      "vérifiez votre wallet", "vérification wallet", "connectez pour réclamer",
    ],
    regexes: [
      "\\b(verify\\s+your\\s+wallet|wallet\\s+verification|connect\\s+wallet\\s+to\\s+claim|sign\\s+to\\s+verify)\\b",
    ],
    derivedFrom: ["SOLAXY"],
    defaultConfidence: 0.85,
    severity: "WAIT",
  },
  {
    code: "SEND_TO_RECEIVE",
    label: "Send-to-receive pattern",
    category: "WALLET_TRAP",
    keywords: [
      "send to receive", "double your tokens", "send eth get back",
      "deposit to receive", "send 0.1 receive 1",
      "envoyer pour recevoir", "doublez vos tokens",
    ],
    regexes: [
      "\\bsend\\s+\\d+(?:\\.\\d+)?\\s+\\w+\\s+(?:to\\s+)?receive\\s+\\d",
      "\\bdouble\\s+your\\s+tokens?\\b",
      "\\bdeposit\\s+to\\s+receive\\b",
    ],
    derivedFrom: ["SOLAXY"],
    defaultConfidence: 0.9,
    severity: "WAIT",
  },
  {
    code: "SYNCHRONIZED_PUSH",
    label: "Synchronized push pattern",
    category: "COORDINATION",
    keywords: [
      "everyone is talking about", "trending now", "all kols covering",
      "trending #1", "everyone is buying", "going viral",
      "tout le monde en parle", "tendance maintenant",
    ],
    regexes: [
      "\\b(trending\\s+(?:now|#?1)|everyone\\s+is\\s+(?:talking|buying)|all\\s+kols)\\b",
    ],
    derivedFrom: ["BOTIFY"],
    defaultConfidence: 0.55,
    severity: "WAIT",
  },
  {
    code: "AI_RWA_NARRATIVE_HIJACK",
    label: "AI/RWA narrative hijack",
    category: "TRUST_HIJACK",
    keywords: [
      "ai agent token", "ai-powered trading", "real-world asset",
      "rwa tokenization", "real-world asset token", "ai trading bot",
      "token agent ia", "tokenisation rwa", "actifs réels tokenisés",
    ],
    regexes: [
      "\\b(ai\\s+agent\\s+token|rwa\\s+tokenization|real[\\- ]world\\s+asset)\\b",
    ],
    derivedFrom: ["BOTIFY", "GHOST"],
    defaultConfidence: 0.5,
    severity: "WAIT",
  },
  {
    code: "CHARITY_CLAIM",
    label: "Charity allocation claim",
    category: "TRUST_HIJACK",
    keywords: [
      "10% to charity", "donate to", "supporting charity",
      "for the children", "humanitarian cause", "5% donated",
      "10% pour la charité", "don à", "cause humanitaire",
    ],
    regexes: [
      "\\b\\d+%\\s+(to|for)\\s+charity\\b",
      "\\b(for\\s+the\\s+children|humanitarian\\s+cause|donated\\s+to\\s+charity)\\b",
    ],
    derivedFrom: ["RAVE"],
    defaultConfidence: 0.65,
    severity: "WAIT",
  },
  {
    code: "BURN_SUPPLY_SHOCK",
    label: "Supply burn claim",
    category: "FOMO",
    keywords: [
      "burned 80%", "deflationary mechanism", "supply shock",
      "buy back and burn", "auto burn", "tokens burned forever",
      "80% brûlé", "mécanisme déflationniste", "supply shock",
    ],
    regexes: [
      "\\bburned\\s+\\d+\\s*%",
      "\\b(deflationary\\s+mechanism|supply\\s+shock|buy\\s+back\\s+and\\s+burn|auto\\s+burn)\\b",
    ],
    derivedFrom: ["SOLAXY"],
    defaultConfidence: 0.6,
    severity: "WAIT",
  },
];
