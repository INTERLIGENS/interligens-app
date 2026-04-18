/**
 * Seed Dione Protocol as a PROJECT-type KolProfile.
 *
 * Idempotent: upsert on handle, replace aliases + tokenLinks + evidences (by dedupKey).
 * Run with:
 *   pnpm tsx scripts/seed/seedDioneProtocol.ts
 *
 * Companion: INVESTIGATION_DIONE_REPORT.md (2026-04-17) — read before editing.
 *
 * DB prod safety rule: do NOT auto-run this seed; migrations and data updates
 * go via Neon SQL Editor. This file is a source-of-truth artefact.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HANDLE = "dione-protocol";

const ALIASES: Array<{ alias: string; type: string }> = [
  { alias: "DioneProtocol", type: "twitter" },
  { alias: "dioneprotocol.eth", type: "ens" },
  { alias: "Dione Protocol LLC", type: "corporate" },
  { alias: "Dione Labs", type: "corporate_rebrand" },
];

const TOKEN_LINKS: Array<{
  contractAddress: string;
  chain: string;
  tokenSymbol: string;
  role: string;
  note: string;
  documentationStatus: string;
}> = [
  {
    contractAddress: "0x89b69f2d1adffa9a253d40840b6baa7fc903d697",
    chain: "ETH",
    tokenSymbol: "DIONE",
    role: "issuer",
    note: "DIONE V1 contract, deployed 14 Aug 2022 from 0xbb2a…7a2e. Deprecated after 30 Oct 2024 migration.",
    documentationStatus: "documented",
  },
  {
    contractAddress: "0x65278f702019078e9ab196c0da0a6ee55e7248b7",
    chain: "ETH",
    tokenSymbol: "DIONE",
    role: "issuer",
    note: "Wrapped DIONE V2 contract. Migration vehicle — 1:1 swap, LP withdrawn from Ethereum 30 Oct 2024 11:00 UTC, re-seeded on Odyssey chain per project. Holder-visible Ethereum trading halted 30 Oct 07:00 UTC, resumed 5 Nov.",
    documentationStatus: "documented",
  },
  {
    contractAddress: "0xb4c6fedd984bc983b1a758d0875f1ea34f81a6af",
    chain: "ETH",
    tokenSymbol: "OVPP",
    role: "related_conflict",
    note: "OpenVPP on Ethereum. CEO = Parth Kapadia, concurrently Dione's Head of Energy. SPARK grant cohort recipient — conflict-of-interest flag.",
    documentationStatus: "documented",
  },
  {
    contractAddress: "0x8c0d3adcf8ce094e1ae437557ec90a6374dc9bdd",
    chain: "BASE",
    tokenSymbol: "OVPP",
    role: "related_conflict",
    note: "OpenVPP on Base. Same project as ETH OVPP. Frequently confused with 'Dione OVPP' promised in Q4 2024 roadmap.",
    documentationStatus: "documented",
  },
];

const EVIDENCES: Array<{
  type: string;
  label: string;
  description: string;
  wallets: string;
  amountUsd?: number;
  token?: string;
  sourceUrl?: string;
  dedupKey: string;
}> = [
  {
    type: "wallet_attribution",
    label: "Deployer wallet — 0xbb2a…7a2e (ENS: dioneprotocol.eth)",
    description:
      "Deployer of DIONE V1 (14 Aug 2022) and V2. Etherscan name tag 'Dione: Deployer'. Initial funding path: KuCoin deposit ~Jul 2022 (MLAT target for beneficial-owner KYC). Current portfolio $45,224; 68% held in MAGA (Trump Project 2025) on Base. 151 transactions; last activity 11 Aug 2025. No direct on-chain interaction with 0x32B6… (BK EVM wallet per repo attribution) observed.",
    wallets: JSON.stringify(["0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e"]),
    sourceUrl:
      "https://etherscan.io/address/0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e",
    dedupKey: "dione-protocol:wallet:deployer-0xbb2a",
  },
  {
    type: "wallet_attribution",
    label: "BK personal EVM wallet — 0x32B6…3ecF",
    description:
      "Repo-attributed to Brandon Kokoski. No ENS, no public name tag. Funded by Gate.io deposit ~Jun 2023 (MLAT target). Current portfolio ~$387k, dominated by 3.48M DOGE on BSC. First tx ~2y292d ago; last tx 207d ago. NO direct on-chain interaction with Dione deployer 0xbb2a… observed — weakens any claim that BK personally controls the deployer.",
    wallets: JSON.stringify(["0x32B6006e5b942F47Ab4DB68eE70f683370853ecF"]),
    sourceUrl:
      "https://etherscan.io/address/0x32B6006e5b942F47Ab4DB68eE70f683370853ecF",
    dedupKey: "dione-protocol:wallet:bk-0x32b6",
  },
  {
    type: "migration_mechanics",
    label: "V1→V2 migration — soft-exit pattern (30 Oct 2024)",
    description:
      "07:00 UTC: CEX trading halted (MEXC, Gate.io, CoinEx). 11:00 UTC: snapshot + Ethereum LP withdrawal. 5 Nov: trading resumed on Odyssey chain only. Team published explicit warning: 'DO NOT buy the old token on Uniswap you will LOSE your money!' 1:1 swap ratio claimed; project claims 100% LP re-seeded on Odyssey — unverifiable from Ethereum state alone. Previously quantified $1.26M / 539.28 ETH extraction figure in seed is NOT corroborated by external sources and is downgraded pending Dune/Arkham trace.",
    wallets: JSON.stringify(["0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e"]),
    token: "DIONE",
    sourceUrl:
      "https://x.com/DioneProtocol/status/1854636683083530699",
    dedupKey: "dione-protocol:migration:v1-v2-mechanics",
  },
  {
    type: "aml_posture",
    label: "KYC-less primary sale via TrustSwap OTC",
    description:
      "Pre-mainnet OTC offering run with TrustSwap explicitly stated 'KYC is not required'. Vested via Team Finance, claimable on Odyssey. Relevant AML-posture fact for any judicial filing targeting primary-issuance conduct.",
    wallets: JSON.stringify([]),
    token: "DIONE",
    sourceUrl: "https://trustswap.com/blog/dione-protocol-otc-sale/",
    dedupKey: "dione-protocol:aml:trustswap-otc-no-kyc",
  },
  {
    type: "conflict_of_interest",
    label: "Parth Kapadia / OpenVPP — SPARK grant self-dealing",
    description:
      "Parth Kapadia is simultaneously Dione's Head of Energy and the co-founder & CEO of OpenVPP. OpenVPP is a publicly-named recipient of the first DIONE SPARK grant cohort (launched 22 Nov 2024). Dione SPARK offers up to $100k per category plus co-marketing and team collaboration. Arm's-length review of the grant decision is not publicly documented.",
    wallets: JSON.stringify([]),
    sourceUrl:
      "https://www.globenewswire.com/news-release/2024/11/22/2986196/0/en/Dione-Protocol-Announces-DIONE-SPARK-A-Grants-Accelerator-Program-to-Propel-Green-Web3-Innovation.html",
    dedupKey: "dione-protocol:conflict:kapadia-openvpp-spark",
  },
  {
    type: "promotion_posture",
    label: "Paid press-release distribution via Newsfile Corp",
    description:
      "The 'secures massive funding' (Jan 2023) and 'adds Maxim Prishchepo and Ryan Arriaga' (Feb 2023) headlines were distributed by Newsfile Corp, a Toronto paid-distribution wire, and republished on Yahoo Finance, Benzinga, EIN Presswire. No independent newsroom coverage verified the underlying funding or team claims. Treat as promotional content for evidentiary weighting.",
    wallets: JSON.stringify([]),
    sourceUrl: "https://www.newsfilecorp.com/release/151359",
    dedupKey: "dione-protocol:promotion:newsfile-paid",
  },
  {
    type: "reframed_attribution",
    label: "Ryan Arriaga = TheFudHound = SafeMoon whistleblower (reframe)",
    description:
      "Reframing required in existing seed. Ryan Arriaga (aka @TheFudHound) was SafeMoon's Head of Products; he resigned/was terminated in March 2022 and publicly accused CEO John Karony and CTO Thomas Smith of fraud. Karony was convicted and sentenced to 100 months in Feb 2026; Smith pleaded guilty Feb 2025. Arriaga's company Onchain Solutions Inc / Blockchain Dev Shop was subsequently contracted by Dione (Jan 2023) and forked Avalanche for Odyssey. Arriaga has NO documented role at BOTIFY. The prior 'Arriaga as serial operator across SafeMoon→Dione→BOTIFY' framing is INCORRECT and should be retracted. Common-thread operator between Dione and BOTIFY is Brandon Kokoski, not Arriaga.",
    wallets: JSON.stringify([]),
    sourceUrl:
      "https://www.irs.gov/compliance/criminal-investigation/ceo-of-digital-asset-company-safemoon-sentenced-to-100-months-in-prison-for-multimillion-dollar-crypto-fraud-scheme",
    dedupKey: "dione-protocol:reframe:arriaga-whistleblower",
  },
  {
    type: "partnership_asymmetry",
    label: "Partnerships named by Dione, unconfirmed by counterparties",
    description:
      "Energiekreislauf GmbH (Austria), IBC SOLAR AG (Germany), TRAKEN (Serbia), ITU Seed (Istanbul) are all real entities with open-source presence. Dione claims varying degrees of partnership; only Dione's side of the announcement was located in open sources. IBC SOLAR's phrasing 'initial steps in strategic business development' is the softest possible partnership language. Counterparty-side confirmation is the key verification task.",
    wallets: JSON.stringify([]),
    dedupKey: "dione-protocol:partnerships:asymmetric",
  },
  {
    type: "social_engineering",
    label: "@KokoskiB insider-access language pattern",
    description:
      "Verified quotes: 'I've been in vaults, penthouses, and backrooms with people who run this space' (Jan 13 2023); 'rooms most DeFi projects never touch' (Sep 20 2025 OVPP endorsement). Consistent privileged-access self-presentation. Marketing-to-manipulation narrative consistent with his disclosed pre-crypto career (5 years marketing / e-commerce).",
    wallets: JSON.stringify([]),
    sourceUrl: "https://x.com/KokoskiB/status/1969063171420766515",
    dedupKey: "dione-protocol:social:insider-language",
  },
];

async function main() {
  const now = new Date();

  const profileData = {
    handle: HANDLE,
    platform: "PROJECT",
    displayName: "Dione Protocol",
    tier: "ORANGE",
    label: "scam",
    riskFlag: "under_investigation",
    confidence: "medium",
    status: "active",
    verified: false,
    evmAddress: "0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e",
    totalDocumented: null, // previous $1.26M figure retracted pending Dune/Arkham trace
    evidenceStatus: "strong",
    walletAttributionStatus: "partial",
    proceedsStatus: "pending_verification",
    editorialStatus: "reviewed",
    summary:
      "Dione Protocol — PROJECT-type entity. Newark, Delaware LLC. Operated a V1→V2 migration on 30 Oct 2024 with soft-exit characteristics (LP withdrawal, 'don't buy old token' warning, Ethereum-side visibility cut off). KYC-less primary sale via TrustSwap OTC. Documented conflict of interest: Parth Kapadia (Head of Energy) simultaneously CEO of OpenVPP, a first-cohort DIONE SPARK grant recipient. Common-thread operator with BOTIFY is Brandon Kokoski (VP/COO). Ryan Arriaga, previously framed as serial operator, is instead a SafeMoon whistleblower / contracted dev — framing reconciled 2026-04-17.",
    observedBehaviorSummary:
      "Soft-exit via forced V1→V2 migration with exchange coordination. KYC-less primary sale. Paid press-release distribution presented as editorial. Insider self-dealing (Kapadia/OpenVPP SPARK grant). Partnerships named by project but unconfirmed by counterparties.",
    documentedFacts: JSON.stringify([
      "Deployer wallet 0xbb2a… deployed DIONE V1 on 14 Aug 2022; funded by KuCoin (MLAT target)",
      "V1→V2 migration 30 Oct 2024: CEX halt + LP withdrawal + 'don't buy old token' warning",
      "TrustSwap OTC primary sale conducted without KYC",
      "Parth Kapadia / OpenVPP SPARK grant conflict of interest",
      "Funding-announcement press was paid distribution via Newsfile Corp, not independent reporting",
      "BK personal EVM 0x32B6… funded via Gate.io; no direct interaction with Dione deployer",
    ]),
    partialFacts: JSON.stringify([
      "$1.26M / 539.28 ETH extraction claim pending Dune/Arkham on-chain trace",
      "'12 BK rugs' internal list (GOLD1, XMEN, TOBE, PUPPET, EBE, BOTIFY, GHOST, OPENVPP, PREDIC, AMARA, STUDY + others) — needs external corroboration",
      "Partnership depth for IBC SOLAR, TRAKEN, Energiekreislauf — counterparty confirmation pending",
      "BK Instagram bio quote 'Seen in the rooms you tweet about' — attribution unconfirmed",
    ]),
    behaviorFlags: JSON.stringify([
      "SOFT_EXIT_MIGRATION",
      "KYC_LESS_PRIMARY_SALE",
      "CONFLICT_OF_INTEREST",
      "PAID_PROMOTION_PRESENTED_AS_NEWS",
      "MULTI_LAUNCH_LINKED",
      "KNOWN_LINKED_WALLETS",
      "PARTNERSHIP_ASYMMETRY",
    ]),
    evidenceDepth: "strong",
    completenessLevel: "substantial",
    proceedsCoverage: "pending",
    walletAttributionStrength: "partial",
    profileStrength: "established",
    publishable: true,
    publishStatus: "published",
    internalNote:
      "harmScore=75. PROJECT-type; retail-visible. BK is the common operator between Dione and BOTIFY. Ryan Arriaga reframed as whistleblower (not operator) on 2026-04-17. Quantified extraction figure demoted to partialFacts pending on-chain trace. See INVESTIGATION_DIONE_REPORT.md.",
    lastEnrichedAt: now,
    last_reviewed_at: now,
  };

  const profile = await prisma.kolProfile.upsert({
    where: { handle: HANDLE },
    create: profileData,
    update: profileData,
  });

  // Aliases — wipe & reinsert for idempotency
  await prisma.kolAlias.deleteMany({ where: { kolHandle: HANDLE } });
  for (const a of ALIASES) {
    await prisma.kolAlias.create({
      data: { kolHandle: HANDLE, alias: a.alias, type: a.type },
    });
  }

  // Token links — upsert on composite unique (handle, address, chain)
  for (const t of TOKEN_LINKS) {
    await prisma.kolTokenLink.upsert({
      where: {
        kolHandle_contractAddress_chain: {
          kolHandle: HANDLE,
          contractAddress: t.contractAddress,
          chain: t.chain,
        },
      },
      create: { ...t, kolHandle: HANDLE },
      update: { ...t, kolHandle: HANDLE },
    });
  }

  // Evidences — upsert on dedupKey
  for (const e of EVIDENCES) {
    const existing = await prisma.kolEvidence.findFirst({
      where: { kolHandle: HANDLE, dedupKey: e.dedupKey },
      select: { id: true },
    });
    if (existing) {
      await prisma.kolEvidence.update({
        where: { id: existing.id },
        data: { ...e, kolHandle: HANDLE },
      });
    } else {
      await prisma.kolEvidence.create({ data: { ...e, kolHandle: HANDLE } });
    }
  }

  const [aliasCount, tokenCount, evidenceCount] = await Promise.all([
    prisma.kolAlias.count({ where: { kolHandle: HANDLE } }),
    prisma.kolTokenLink.count({ where: { kolHandle: HANDLE } }),
    prisma.kolEvidence.count({ where: { kolHandle: HANDLE } }),
  ]);

  console.log(
    `seedDioneProtocol: profile ${profile.handle} [${profile.tier}] · ` +
      `aliases=${aliasCount} · tokens=${tokenCount} · evidences=${evidenceCount} · ` +
      `publishStatus=${profile.publishStatus}`,
  );
}

main()
  .catch((err) => {
    console.error("seedDioneProtocol failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
