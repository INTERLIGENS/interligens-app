export type DemoScenario = "green" | "orange" | "red";

export type DemoPreset = {
  scenario: DemoScenario;
  addr: string;
  storyline: { en: string; fr: string };
};

export const SOL_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",

    addr: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    storyline: {
      en: "WIF — established Solana meme token, high liquidity, clean signals.",
      fr: "WIF — token Solana établi, haute liquidité, signaux propres.",
    },
  },
  orange: {
    scenario: "orange",

    addr: "7WRX5QGuRLhGCJszpQjYmw6ihb6z8KRdAEHQUhGJpump",
    storyline: {
      en: "Pump.fun launch, 8 days old — concentration and age signals present.",
      fr: "Lancement pump.fun, 8 jours — signaux de concentration et d'âge détectés.",
    },
  },
  red: {
    scenario: "red",

    addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    storyline: {
      en: "BOTIFY — 8 referenced claims: shill campaign, rug pull, sybil cluster.",
      fr: "BOTIFY — 8 signalements : shill coordonné, rug pull, cluster sybil.",
    },
  },
};

export const ETH_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",

    addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    storyline: {
      en: "Routine swap on an official router — low risk pattern.",
      fr: "Swap classique via routeur officiel — profil à faible risque.",
    },
  },
  orange: {
    scenario: "orange",

    addr: "",
    storyline: {
      en: "Unusual approvals or weak signals — proceed with caution.",
      fr: "Signaux mitigés — prudence avant signature.",
    },
  },
  red: {
    scenario: "red",

    addr: "",
    storyline: {
      en: "Unlimited approval to an unknown spender — high drain risk.",
      fr: "Approval illimité vers un spender inconnu — risque élevé de drain.",
    },
  },
};

export const TRON_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",

    addr: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6",
    storyline: {
      en: "Clean TRON wallet with normal activity — low risk pattern.",
      fr: "Wallet TRON propre avec activite normale — profil a faible risque.",
    },
  },
  orange: {
    scenario: "orange",

    addr: "",
    storyline: {
      en: "Recent TRON account with limited history — proceed with caution.",
      fr: "Compte TRON recent avec historique limite — prudence.",
    },
  },
  red: {
    scenario: "red",

    addr: "",
    storyline: {
      en: "USDT-TRC20 blacklisted address — frozen by Tether. Critical risk.",
      fr: "Adresse blacklistee USDT-TRC20 — gelee par Tether. Risque critique.",
    },
  },
};

export const BASE_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",

    addr: "base:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    storyline: {
      en: "Clean Base wallet with normal activity — low risk pattern.",
      fr: "Wallet Base propre avec activite normale — profil a faible risque.",
    },
  },
  orange: {
    scenario: "orange",

    addr: "",
    storyline: {
      en: "Unverified contract on Base — proceed with caution.",
      fr: "Contrat non verifie sur Base — prudence.",
    },
  },
  red: {
    scenario: "red",

    addr: "",
    storyline: {
      en: "Honeypot token detected on Base — sell impossible. Critical risk.",
      fr: "Token honeypot detecte sur Base — vente impossible. Risque critique.",
    },
  },
};

export const ARBITRUM_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",

    addr: "arb:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    storyline: {
      en: "Clean Arbitrum wallet with normal DeFi activity — low risk.",
      fr: "Wallet Arbitrum propre avec activite DeFi normale — faible risque.",
    },
  },
  orange: {
    scenario: "orange",

    addr: "",
    storyline: {
      en: "Fresh contract on Arbitrum with limited history — caution advised.",
      fr: "Contrat recent sur Arbitrum avec historique limite — prudence.",
    },
  },
  red: {
    scenario: "red",

    addr: "",
    storyline: {
      en: "Bridge exploit pattern detected on Arbitrum — known bad deployer. Critical risk.",
      fr: "Pattern d'exploit de bridge detecte sur Arbitrum — deployer malveillant. Risque critique.",
    },
  },
};

export const DEMO_PRESETS = { SOL: SOL_PRESETS, ETH: ETH_PRESETS, TRON: TRON_PRESETS, BASE: BASE_PRESETS, ARBITRUM: ARBITRUM_PRESETS };

type DemoChainKey = keyof typeof DEMO_PRESETS;

const MOCK_CHAIN_PREFIXES: Record<string, DemoChainKey> = {
  tron: "TRON",
  eth: "ETH",
  base: "BASE",
  arb: "ARBITRUM",
  arbitrum: "ARBITRUM",
  sol: "SOL",
};

/**
 * Parse a mock param like "tron-red" → { chain: "TRON", scenario: "red" }
 * Plain "red" defaults to SOL for backwards compat.
 */
export function parseMockParam(mock: string): { chain: DemoChainKey; scenario: DemoScenario } | null {
  const parts = mock.split("-");
  if (parts.length === 2) {
    const chainKey = MOCK_CHAIN_PREFIXES[parts[0].toLowerCase()];
    const scenario = parts[1] as DemoScenario;
    if (chainKey && ["green", "orange", "red"].includes(scenario)) {
      return { chain: chainKey, scenario };
    }
  }
  // Plain scenario (backwards compat)
  if (["green", "orange", "red"].includes(mock)) {
    return { chain: "SOL", scenario: mock as DemoScenario };
  }
  return null;
}
