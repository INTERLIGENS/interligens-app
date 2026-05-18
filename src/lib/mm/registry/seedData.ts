import type { MmClaimType, MmCredTier, MmSourceType, MmStatus } from "../types";

// ─── SEED Phase 1 ──────────────────────────────────────────────────────────
// 4 entities stay in workflow DRAFT until legal review.
// All claims are FACT type sourced on DOJ press releases (Operation Token Mirrors
// October 2024) and 2025 sentencing/plea filings.
// Source: https://www.justice.gov/opa/pr/four-crypto-firms-and-their-employees-charged-operation-token-mirrors

export interface SeedSource {
  key: string;
  publisher: string;
  sourceType: MmSourceType;
  url: string;
  title: string;
  credibilityTier: MmCredTier;
  author?: string;
  publishedAt: string;
  language: string;
}

export interface SeedClaim {
  sourceKey: string;
  claimType: MmClaimType;
  text: string;
  textFr?: string;
  jurisdiction?: string;
  orderIndex: number;
}

export interface SeedEntity {
  slug: string;
  name: string;
  legalName?: string;
  jurisdiction?: string;
  foundedYear?: number;
  founders?: string[];
  status: MmStatus;
  publicSummary: string;
  publicSummaryFr: string;
  knownAliases?: string[];
  officialDomains?: string[];
  claims: SeedClaim[];
}

// ─── Shared DOJ / SEC sources ──────────────────────────────────────────────

export const SEED_SOURCES: SeedSource[] = [
  {
    key: "doj-token-mirrors-2024-10-09",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/18-individuals-and-entities-charged-international-operation-targeting-widespread-fraud",
    title:
      "18 Individuals and Entities Charged in International Operation Targeting Widespread Fraud and Manipulation in the Cryptocurrency Markets",
    credibilityTier: "TIER_1",
    publishedAt: "2024-10-09",
    language: "en",
  },
  {
    key: "doj-gotbit-andriunin-plea-2025-03",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/russian-national-pleads-guilty-operating-crypto-market-manipulation-firm",
    title:
      "Russian National Pleads Guilty to Operating Crypto Market Manipulation Firm",
    credibilityTier: "TIER_1",
    publishedAt: "2025-03-13",
    language: "en",
  },
  {
    key: "doj-gotbit-andriunin-sentencing-2025-06",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/gotbit-founder-sentenced-crypto-market-manipulation",
    title: "Gotbit Founder Sentenced for Crypto Market Manipulation Conspiracy",
    credibilityTier: "TIER_1",
    publishedAt: "2025-06-13",
    language: "en",
  },
  {
    key: "sec-gotbit-complaint-2024",
    publisher: "U.S. Securities and Exchange Commission",
    sourceType: "SEC",
    url: "https://www.sec.gov/litigation/litreleases/lr-26124",
    title:
      "SEC Charges Crypto Market Maker Gotbit, Its Founder, and Two Directors with Market Manipulation",
    credibilityTier: "TIER_1",
    publishedAt: "2024-10-09",
    language: "en",
  },
  {
    key: "doj-cls-global-plea-2025-04",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/crypto-market-maker-cls-global-pleads-guilty-fraud-and-manipulation",
    title:
      "Crypto Market Maker CLS Global Pleads Guilty to Fraud and Market Manipulation Charges",
    credibilityTier: "TIER_1",
    publishedAt: "2025-04-10",
    language: "en",
  },
  {
    key: "doj-mytrade-plea-2024-10",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/crypto-market-maker-mytrade-its-employee-plead-guilty-wash-trading-conspiracy",
    title:
      "Crypto Market Maker MyTrade and Its Employee Plead Guilty in Wash Trading Conspiracy",
    credibilityTier: "TIER_1",
    publishedAt: "2024-10-09",
    language: "en",
  },
  {
    key: "doj-zm-quant-indictment-2024-10",
    publisher: "U.S. Department of Justice",
    sourceType: "DOJ",
    url: "https://www.justice.gov/usao-ma/pr/zm-quant-investment-and-two-employees-indicted-market-manipulation",
    title:
      "ZM Quant Investment and Two Employees Indicted for Cryptocurrency Market Manipulation",
    credibilityTier: "TIER_1",
    publishedAt: "2024-10-09",
    language: "en",
  },
];

// ─── 4 entities in DRAFT workflow ──────────────────────────────────────────

export const SEED_ENTITIES: SeedEntity[] = [
  {
    slug: "gotbit",
    name: "Gotbit Consulting",
    legalName: "Gotbit Consulting LLC",
    jurisdiction: "US",
    foundedYear: 2017,
    founders: ["Aleksei Andriunin"],
    status: "CONVICTED",
    publicSummary:
      "Crypto market-making firm whose founder Aleksei Andriunin pleaded guilty in March 2025 to wire fraud and conspiracy to commit market manipulation. Sentenced on 13 June 2025 as part of the DOJ's Operation Token Mirrors. Forfeiture of 22.8 million USD in USDT/USDC.",
    publicSummaryFr:
      "Société de market making crypto dont le fondateur Aleksei Andriunin a plaidé coupable en mars 2025 pour wire fraud et conspiration en vue de manipulation de marché. Condamné le 13 juin 2025 dans le cadre de l'opération DOJ Token Mirrors. Saisie de 22,8 millions USD en USDT/USDC.",
    knownAliases: ["Gotbit"],
    officialDomains: ["gotbit.io"],
    claims: [
      {
        sourceKey: "doj-token-mirrors-2024-10-09",
        claimType: "FACT",
        text: "On 9 October 2024, the U.S. Department of Justice announced charges against Gotbit Consulting and its founder Aleksei Andriunin as part of Operation Token Mirrors, alleging a scheme to artificially inflate trading volume for cryptocurrency clients.",
        textFr:
          "Le 9 octobre 2024, le Department of Justice américain a annoncé des charges contre Gotbit Consulting et son fondateur Aleksei Andriunin dans le cadre de l'opération Token Mirrors, alléguant un stratagème visant à gonfler artificiellement le volume de trading pour des clients crypto.",
        jurisdiction: "US",
        orderIndex: 1,
      },
      {
        sourceKey: "doj-gotbit-andriunin-plea-2025-03",
        claimType: "FACT",
        text: "Aleksei Andriunin pleaded guilty in March 2025 to one count of conspiracy to commit market manipulation and wire fraud, and one count of wire fraud, in the U.S. District Court for the District of Massachusetts.",
        textFr:
          "Aleksei Andriunin a plaidé coupable en mars 2025 d'un chef de conspiration en vue de manipulation de marché et de wire fraud, et d'un chef de wire fraud, devant le tribunal fédéral du district du Massachusetts.",
        jurisdiction: "US",
        orderIndex: 2,
      },
      {
        sourceKey: "doj-gotbit-andriunin-sentencing-2025-06",
        claimType: "FACT",
        text: "On 13 June 2025, Aleksei Andriunin was sentenced in connection with the Gotbit market manipulation case. The agreement included forfeiture of approximately 22.8 million USD in USDT and USDC.",
        textFr:
          "Le 13 juin 2025, Aleksei Andriunin a été condamné dans l'affaire de manipulation de marché Gotbit. L'accord prévoyait la restitution d'environ 22,8 millions USD en USDT et USDC.",
        jurisdiction: "US",
        orderIndex: 3,
      },
      {
        sourceKey: "sec-gotbit-complaint-2024",
        claimType: "FACT",
        text: "The U.S. Securities and Exchange Commission filed a parallel civil complaint against Gotbit, its founder and two directors in October 2024 alleging market manipulation in violation of federal securities laws.",
        textFr:
          "La SEC a déposé une plainte civile parallèle contre Gotbit, son fondateur et deux directeurs en octobre 2024, alléguant une manipulation de marché en violation des lois fédérales américaines sur les valeurs mobilières.",
        jurisdiction: "US",
        orderIndex: 4,
      },
    ],
  },
  {
    slug: "cls-global",
    name: "CLS Global FZC LLC",
    legalName: "CLS Global FZC LLC",
    jurisdiction: "AE",
    status: "CONVICTED",
    publicSummary:
      "UAE-registered crypto market maker that pleaded guilty in April 2025 to wire fraud and market manipulation charges brought by the DOJ as part of Operation Token Mirrors. Employee Andrey Zhorzhes was named in the filings.",
    publicSummaryFr:
      "Market maker crypto enregistré aux Émirats arabes unis, qui a plaidé coupable en avril 2025 pour wire fraud et manipulation de marché devant le DOJ dans le cadre de l'opération Token Mirrors. L'employé Andrey Zhorzhes a été nommément identifié dans les pièces.",
    knownAliases: ["CLS Global", "CLS"],
    officialDomains: ["cls.global"],
    claims: [
      {
        sourceKey: "doj-token-mirrors-2024-10-09",
        claimType: "FACT",
        text: "CLS Global FZC LLC was charged on 9 October 2024 by the U.S. Department of Justice as part of Operation Token Mirrors, alongside employee Andrey Zhorzhes, for participating in a scheme to generate artificial trading volume for cryptocurrency clients.",
        textFr:
          "CLS Global FZC LLC a été mise en cause le 9 octobre 2024 par le Department of Justice américain dans le cadre de l'opération Token Mirrors, aux côtés de l'employé Andrey Zhorzhes, pour avoir participé à un stratagème de génération de volume de trading artificiel pour des clients crypto.",
        jurisdiction: "US",
        orderIndex: 1,
      },
      {
        sourceKey: "doj-cls-global-plea-2025-04",
        claimType: "FACT",
        text: "On 10 April 2025, CLS Global FZC LLC entered a guilty plea in the U.S. District Court for the District of Massachusetts to conspiracy to commit market manipulation and wire fraud.",
        textFr:
          "Le 10 avril 2025, CLS Global FZC LLC a plaidé coupable devant le tribunal fédéral du district du Massachusetts pour conspiration en vue de manipulation de marché et wire fraud.",
        jurisdiction: "US",
        orderIndex: 2,
      },
    ],
  },
  {
    slug: "mytrade",
    name: "MyTrade MM",
    jurisdiction: "Unknown",
    status: "CONVICTED",
    publicSummary:
      "Crypto market maker whose founder pleaded guilty in October 2024 to conspiracy to commit wash trading as part of the DOJ's Operation Token Mirrors. Public coverage is limited compared to Gotbit and CLS Global.",
    publicSummaryFr:
      "Market maker crypto dont le fondateur a plaidé coupable en octobre 2024 pour conspiration en vue de wash trading dans le cadre de l'opération Token Mirrors du DOJ. La couverture presse publique est plus limitée que pour Gotbit et CLS Global.",
    knownAliases: ["MyTrade"],
    claims: [
      {
        sourceKey: "doj-token-mirrors-2024-10-09",
        claimType: "FACT",
        text: "MyTrade was one of four crypto market-making firms charged by the U.S. Department of Justice on 9 October 2024 as part of Operation Token Mirrors targeting wash trading and market manipulation schemes.",
        textFr:
          "MyTrade fait partie des quatre sociétés de market making crypto mises en cause par le Department of Justice américain le 9 octobre 2024 dans le cadre de l'opération Token Mirrors ciblant des stratagèmes de wash trading et de manipulation de marché.",
        jurisdiction: "US",
        orderIndex: 1,
      },
      {
        sourceKey: "doj-mytrade-plea-2024-10",
        claimType: "FACT",
        text: "MyTrade and a named employee pleaded guilty in October 2024 to conspiracy to commit wash trading in connection with cryptocurrency tokens traded on decentralized and centralized platforms.",
        textFr:
          "MyTrade et un employé nommément identifié ont plaidé coupable en octobre 2024 pour conspiration en vue de wash trading en lien avec des tokens crypto négociés sur des plateformes décentralisées et centralisées.",
        jurisdiction: "US",
        orderIndex: 2,
      },
    ],
  },
  {
    slug: "zm-quant",
    name: "ZM Quant Investment",
    legalName: "ZM Quant Investment Ltd.",
    jurisdiction: "HK",
    status: "CHARGED",
    publicSummary:
      "Hong-Kong-based crypto market maker indicted in October 2024 by the U.S. Department of Justice. Employees Baijun Ou and Ruiqi Lau were named in the indictment for running automated bots generating 10 to 20 trades per minute across multiple wallets to evade self-trade detection.",
    publicSummaryFr:
      "Market maker crypto basé à Hong Kong, inculpé en octobre 2024 par le Department of Justice américain. Les employés Baijun Ou et Ruiqi Lau ont été nommément identifiés dans l'acte d'inculpation pour avoir opéré des bots automatisés générant 10 à 20 transactions par minute sur plusieurs wallets afin de contourner la détection self-trade.",
    knownAliases: ["ZM Quant"],
    claims: [
      {
        sourceKey: "doj-token-mirrors-2024-10-09",
        claimType: "FACT",
        text: "ZM Quant Investment was named as one of the four market-making firms targeted by the U.S. Department of Justice's Operation Token Mirrors announced on 9 October 2024.",
        textFr:
          "ZM Quant Investment a été désignée comme l'une des quatre sociétés de market making ciblées par l'opération Token Mirrors du Department of Justice américain annoncée le 9 octobre 2024.",
        jurisdiction: "US",
        orderIndex: 1,
      },
      {
        sourceKey: "doj-zm-quant-indictment-2024-10",
        claimType: "FACT",
        text: "Employees Baijun Ou and Ruiqi Lau, both based in Hong Kong, were indicted in October 2024 on charges of wire fraud and conspiracy to commit market manipulation. The prosecution remains pending.",
        textFr:
          "Les employés Baijun Ou et Ruiqi Lau, tous deux basés à Hong Kong, ont été inculpés en octobre 2024 pour wire fraud et conspiration en vue de manipulation de marché. La procédure est en cours.",
        jurisdiction: "US",
        orderIndex: 2,
      },
    ],
  },
];
