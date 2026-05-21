/**
 * src/lib/pdf/nova/data/novaCasefileFixture.ts
 *
 * 100% synthetic data for the $NOVA demo casefile. The fixture is split out
 * from the template so tests can assert on individual fields and reviewers
 * can verify every string is fake before render.
 *
 * Synthetic wording rules (Bloc 3 of MATRICE V2):
 *   - Addresses: 0xSYNTHETIC-NOVA-...-DEMO-NNNN (never matches /0x[a-f0-9]{40}/).
 *   - TXIDs:     SYNTHETIC-TX-NOVA-DEMO-...
 *   - Origin wallet attribution = L0 (NOT L4), with the audit-corrected wording.
 *   - Triage    = "B - Exchange escalation candidate" (post-GPT audit downgrade).
 *   - CEX touchpoint phrased as "platform touchpoint candidate".
 */

export type AttributionLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type SourceReliability = "SR1" | "SR2" | "SR3" | "SR4" | "SR5";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export interface NovaWalletStep {
  step: string;
  address: string;
  attribution: AttributionLevel;
  observation: string;
}

export interface NovaTxid {
  txid: string;
  dateUtc: string;
  amount: string;
  fromTo: string;
}

export interface NovaTimelineRow {
  date: string;
  event: string;
}

export interface NovaClaim {
  id: string;
  claim: string;
  attribution: AttributionLevel;
  sourceReliability: SourceReliability;
  confidence: Confidence;
  basisLimitation: string;
}

export interface NovaOsintRow {
  element: string;
  observation: string;
  attribution: AttributionLevel;
}

export interface NovaExhibit {
  id: string;
  type: string;
  description: string;
  source: string;
  hashSha256: string;
  attribution: AttributionLevel;
  sourceReliability: SourceReliability;
  redaction: "public" | "redacted" | "contains-pii" | "synthetic-pii-placeholder";
  risk: "LOW" | "MED" | "HIGH";
}

export interface NovaCasefileFixture {
  casefileId: string;
  dateGenerated: string;
  dataClassification: string;
  intendedUse: string;
  intendedAudience: string;
  operationalTriage: string;
  jurisdictions: string;

  reportingParty: {
    profile: string;
    internalId: string;
    declaredWallet: string;
    walletControlProof: string[];
    sourceOfFunds: string;
    amountEngaged: string;
  };

  incident: {
    pattern: string;
    timeline: NovaTimelineRow[];
    reportedAmount: string;
  };

  onChain: {
    walletFlow: NovaWalletStep[];
    txids: NovaTxid[];
    synthesis: string;
  };

  osint: NovaOsintRow[];

  claims: NovaClaim[];

  assumptions: string[];
  limitations: string[];
  negativeEvidence: string[];
  contradictoryEvidence: string[];

  exhibits: NovaExhibit[];

  triageCode: string;
  triageLabel: string;
  triageNote: string;
  jurisdictionalFlags: { label: string; body: string }[];
  completeness: { label: string; status: "COMPLETE" | "PARTIAL" | "EXCLUDED (demo)" }[];
}

export const NOVA_CASEFILE_FIXTURE: NovaCasefileFixture = {
  casefileId: "INTERLIGENS-CF-FICT-NOVA-001",
  dateGenerated: "2026-05-19",
  dataClassification: "SYNTHETIC DEMO - DO NOT PUBLISH",
  intendedUse: "Format testing only",
  intendedAudience: "Internal analyst / format review",
  operationalTriage: "B - Exchange escalation candidate",
  jurisdictions: "FR (reporting) - UK / SG (touchpoints)",

  reportingParty: {
    profile: "Individual, retail investor",
    internalId: "RP-001",
    declaredWallet: "0xSYNTHETIC-NOVA-VICTIM-DEMO-0001",
    walletControlProof: [
      "Signed message: unavailable",
      "Exchange withdrawal record: available (EX-001)",
      "Screenshot: insufficient alone",
      "-> Control supported by submitted records, not cryptographically verified",
    ],
    sourceOfFunds: "SEPA bank transfer to regulated exchange (EX-002)",
    amountEngaged: "EUR 18,400 (see pricing limitation, sect.06)",
  },

  incident: {
    pattern: "Investment-platform impersonation / non-withdrawal pattern.",
    timeline: [
      { date: "2026-01-22", event: "First contact via social messaging platform" },
      { date: "2026-01-22 -> 02-08", event: "Trust-building phase" },
      { date: "2026-02-10", event: "Purchase of 6 ETH on regulated exchange (own funds)" },
      { date: "2026-02-12", event: 'First transfer to "NovaYield" platform - 2 ETH' },
      { date: "2026-02-20", event: "Investment-style dashboard showing reported balance with +34% displayed gain" },
      { date: "2026-02-24", event: "Test withdrawal successful - 0.3 ETH" },
      { date: "2026-03-02", event: "Additional transfer - 4 ETH" },
      { date: "2026-03-15", event: 'Withdrawal blocked - "unlock fees" requested' },
      { date: "2026-03-18", event: "Last communication from counterparty" },
      { date: "2026-03-19", event: "Reporting party identifies the situation as problematic" },
    ],
    reportedAmount:
      "EUR 18,400 (fiat equivalent of 6 ETH at transfer rates - see pricing limitation sect.06).",
  },

  onChain: {
    walletFlow: [
      {
        step: "Origin",
        address: "0xSYNTHETIC-NOVA-VICTIM-DEMO-0001",
        attribution: "L0",
        observation:
          "Reporting-party asserted wallet; ownership supported by EX-001/EX-002; not cryptographically verified by signed message",
      },
      {
        step: "Hop 1",
        address: "0xSYNTHETIC-NOVA-DEPOSIT-DEMO-0002",
        attribution: "L0",
        observation: '"NovaYield" deposit address',
      },
      {
        step: "Hop 2",
        address: "0xSYNTHETIC-NOVA-SPLIT-DEMO-0003",
        attribution: "L1",
        observation:
          "Cluster - split in 3 sub-transfers (heuristic: timing + amounts)",
      },
      {
        step: "Hop 3",
        address: "0xSYNTHETIC-NOVA-MIXER-DEMO-0004",
        attribution: "L0",
        observation:
          "Obfuscation breakpoint candidate - privacy-enhancing / mixer-labeled service. Label requires verification before legal use.",
      },
      {
        step: "Branch B",
        address: "0xSYNTHETIC-NOVA-CEX-DEMO-0005",
        attribution: "L2",
        observation:
          "Deposit address corroborated by public label as belonging to a centralized exchange",
      },
    ],
    txids: [
      {
        txid: "SYNTHETIC-TX-NOVA-DEMO-a1",
        dateUtc: "2026-02-12T14:03Z",
        amount: "2 ETH",
        fromTo: "victim -> deposit",
      },
      {
        txid: "SYNTHETIC-TX-NOVA-DEMO-b2",
        dateUtc: "2026-03-02T09:41Z",
        amount: "4 ETH",
        fromTo: "victim -> deposit",
      },
      {
        txid: "SYNTHETIC-TX-NOVA-DEMO-c3",
        dateUtc: "2026-03-03T11:20Z",
        amount: "1.8 ETH",
        fromTo: "split -> cex",
      },
    ],
    synthesis:
      "A portion of funds (~1.8 ETH) reaches a platform touchpoint candidate (L2). Tracing beyond the obfuscation breakpoint (L0) is limited.",
  },

  osint: [
    {
      element: "novayield[.]fictivexyz",
      observation: "Registered 2026-01-05, masked registrar, Wayback archived (EX-005)",
      attribution: "L0",
    },
    {
      element: 'App "NovaYield"',
      observation: "Referenced under a name close to a legitimate platform",
      attribution: "L0",
    },
    {
      element: "@novayield_fict",
      observation:
        "Social account created January 2026, deleted since (not archived integrally - see Contradictory Evidence sect.06)",
      attribution: "L0",
    },
  ],

  claims: [
    {
      id: "C1",
      claim: "Reporting party funds reached address ...DEPOSIT-0002",
      attribution: "L0",
      sourceReliability: "SR1",
      confidence: "HIGH",
      basisLimitation: "On-chain tx (EX-003). No limitation.",
    },
    {
      id: "C2",
      claim: "...DEPOSIT-0002 and ...SPLIT-0003 likely under common control",
      attribution: "L1",
      sourceReliability: "SR1",
      confidence: "MEDIUM",
      basisLimitation: "Clustering: timing + amounts. Heuristic, not definitive.",
    },
    {
      id: "C3",
      claim: "~1.8 ETH reached a centralized exchange deposit address",
      attribution: "L2",
      sourceReliability: "SR1",
      confidence: "MEDIUM",
      basisLimitation:
        "Public label + explorer tag. Label not confirmed by exchange; requires disclosure.",
    },
    {
      id: "C4",
      claim: "The domain hosted an interface presenting investment / yield features",
      attribution: "L0",
      sourceReliability: "SR1",
      confidence: "HIGH",
      basisLimitation:
        'Wayback archive (EX-005). "Deceptive character" not established by this exhibit.',
    },
    {
      id: "C5",
      claim: "The handle allegedly promoted the platform",
      attribution: "L0",
      sourceReliability: "SR5",
      confidence: "LOW",
      basisLimitation:
        "Reporting party declaration. Not corroborated, account deleted, not archived.",
    },
  ],

  assumptions: [
    "Wallet ...VICTIM-0001 was under reporting party control prior to 2026-02-10 (basis: EX-001).",
    "ETH transferred originated from reporting party's own funds.",
  ],
  limitations: [
    "Tracing stops at the obfuscation breakpoint (...MIXER-0004) - funds beyond cannot be attributed.",
    "On-chain analysis cannot establish intent.",
    "Clustering (C2) is probabilistic, not definitive.",
    "CEX attribution (C3) requires exchange disclosure to be confirmed.",
    "EUR conversion (18,400) depends on the pricing method retained; range is possible.",
  ],
  negativeEvidence: [
    "No personal identity could be established from public sources.",
    "No confirmed link with a known fraud cluster.",
  ],
  contradictoryEvidence: [
    "The successful 0.3 ETH withdrawal is consistent with known investment-platform non-withdrawal patterns but is not itself proof of fraudulent intent.",
    "Wallet control by reporting party is supported by submitted records but not cryptographically verified by signed message.",
    "The platform/domain name may be spoofed or impersonating an unrelated legitimate entity.",
    "The CEX label (C3) comes from a public base - not confirmed by the exchange; a conflicting label exists on another source.",
    "The handle (C5) is deleted and not archived - promotion not corroborated.",
    "Domain archive may be incomplete.",
    "Pricing method may change the declared loss amount.",
  ],

  exhibits: [
    {
      id: "EX-001",
      type: "Exchange export",
      description: "Purchase of 6 ETH",
      source: "Provided by RP",
      hashSha256: "a3f5...e91c",
      attribution: "L4",
      sourceReliability: "SR3",
      redaction: "synthetic-pii-placeholder",
      risk: "LOW",
    },
    {
      id: "EX-002",
      type: "Bank statement",
      description: "SEPA transfer",
      source: "Provided by RP",
      hashSha256: "b7c2...d40a",
      attribution: "L4",
      sourceReliability: "SR3",
      redaction: "synthetic-pii-placeholder",
      risk: "LOW",
    },
    {
      id: "EX-003",
      type: "On-chain tx",
      description: "Transfer TXIDs",
      source: "Public blockchain",
      hashSha256: "c1d8...77f3",
      attribution: "L0",
      sourceReliability: "SR1",
      redaction: "public",
      risk: "LOW",
    },
    {
      id: "EX-004",
      type: "Screenshot",
      description: "Investment-style dashboard showing reported balance",
      source: "Provided by RP",
      hashSha256: "d9e0...12ab",
      attribution: "L0",
      sourceReliability: "SR4",
      redaction: "redacted",
      risk: "MED",
    },
    {
      id: "EX-005",
      type: "Web archive",
      description: "Wayback of domain",
      source: "Wayback Machine",
      hashSha256: "e4f1...9c5d",
      attribution: "L0",
      sourceReliability: "SR1",
      redaction: "public",
      risk: "LOW",
    },
  ],

  triageCode: "B",
  triageLabel: "B - Exchange escalation candidate",
  triageNote:
    "Potential upgrade to C - Civil recovery review candidate - only if counsel confirms CEX touchpoint, jurisdiction, recoverable value and proportionality. INTERLIGENS does not declare recovery viable.",
  jurisdictionalFlags: [
    {
      label: "France reporting flag",
      body:
        "The casefile contains factual materials that may assist a reporting or complaint process. Any criminal qualification belongs to competent authorities or counsel.",
    },
    {
      label: "England & Wales touchpoint flag",
      body:
        "A platform touchpoint appears in the flow. Whether any disclosure mechanism is available depends on counsel's assessment of jurisdiction, evidence, urgency and proportionality.",
    },
    {
      label: "Singapore touchpoint flag",
      body:
        "A platform touchpoint may have a Singapore nexus. Availability of any procedural mechanism is for counsel to assess.",
    },
  ],
  completeness: [
    { label: "Transaction data", status: "COMPLETE" },
    { label: "Communications", status: "PARTIAL" },
    { label: "Fiat proof", status: "COMPLETE" },
    { label: "Identity / PII", status: "EXCLUDED (demo)" },
    { label: "OSINT", status: "PARTIAL" },
    { label: "Exhibit hashes", status: "COMPLETE" },
  ],
};
