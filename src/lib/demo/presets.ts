export type DemoScenario = "green" | "orange" | "red";

export type DemoPreset = {
  scenario: DemoScenario;
  mockParam: DemoScenario;
  addr: string;
  storyline: { en: string; fr: string };
};

export const SOL_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",
    mockParam: "green",
    addr: "SAFE111111111111111111111111111111111111111",
    storyline: {
      en: "Routine swap on an official router — low risk pattern.",
      fr: "Swap classique via routeur officiel — profil à faible risque.",
    },
  },
  orange: {
    scenario: "orange",
    mockParam: "orange",
    addr: "WARN2222222222222222222222222222222222222222",
    storyline: {
      en: "Unusual approvals or weak signals — proceed with caution.",
      fr: "Signaux mitigés — prudence avant signature.",
    },
  },
  red: {
    scenario: "red",
    mockParam: "red",
    addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    storyline: {
      en: "Unlimited approval to an unknown spender — high drain risk.",
      fr: "Approval illimité vers un spender inconnu — risque élevé de drain.",
    },
  },
};

export const ETH_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",
    mockParam: "green",
    addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    storyline: {
      en: "Routine swap on an official router — low risk pattern.",
      fr: "Swap classique via routeur officiel — profil à faible risque.",
    },
  },
  orange: {
    scenario: "orange",
    mockParam: "orange",
    addr: "WARN2222222222222222222222222222222222222222",
    storyline: {
      en: "Unusual approvals or weak signals — proceed with caution.",
      fr: "Signaux mitigés — prudence avant signature.",
    },
  },
  red: {
    scenario: "red",
    mockParam: "red",
    addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    storyline: {
      en: "Unlimited approval to an unknown spender — high drain risk.",
      fr: "Approval illimité vers un spender inconnu — risque élevé de drain.",
    },
  },
};

export const TRON_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",
    mockParam: "green",
    addr: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6",
    storyline: {
      en: "Clean TRON wallet with normal activity — low risk pattern.",
      fr: "Wallet TRON propre avec activite normale — profil a faible risque.",
    },
  },
  orange: {
    scenario: "orange",
    mockParam: "orange",
    addr: "WARN_TRON_0000000000000000000000000000000",
    storyline: {
      en: "Recent TRON account with limited history — proceed with caution.",
      fr: "Compte TRON recent avec historique limite — prudence.",
    },
  },
  red: {
    scenario: "red",
    mockParam: "red",
    addr: "TRON_DEMO_ADDRESS_RED_000000000000",
    storyline: {
      en: "USDT-TRC20 blacklisted address — frozen by Tether. Critical risk.",
      fr: "Adresse blacklistee USDT-TRC20 — gelee par Tether. Risque critique.",
    },
  },
};

export const BASE_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",
    mockParam: "green",
    addr: "0xBASE_DEMO_GRN_000000000000000000000000000",
    storyline: {
      en: "Clean Base wallet with normal activity — low risk pattern.",
      fr: "Wallet Base propre avec activite normale — profil a faible risque.",
    },
  },
  orange: {
    scenario: "orange",
    mockParam: "orange",
    addr: "0xBASE_DEMO_ORG_000000000000000000000000000",
    storyline: {
      en: "Unverified contract on Base — proceed with caution.",
      fr: "Contrat non verifie sur Base — prudence.",
    },
  },
  red: {
    scenario: "red",
    mockParam: "red",
    addr: "BASE_DEMO_ADDRESS_RED_000000000000000000",
    storyline: {
      en: "Honeypot token detected on Base — sell impossible. Critical risk.",
      fr: "Token honeypot detecte sur Base — vente impossible. Risque critique.",
    },
  },
};

export const ARBITRUM_PRESETS: Record<DemoScenario, DemoPreset> = {
  green: {
    scenario: "green",
    mockParam: "green",
    addr: "0xARB_DEMO_GRN_0000000000000000000000000000",
    storyline: {
      en: "Clean Arbitrum wallet with normal DeFi activity — low risk.",
      fr: "Wallet Arbitrum propre avec activite DeFi normale — faible risque.",
    },
  },
  orange: {
    scenario: "orange",
    mockParam: "orange",
    addr: "0xARB_DEMO_ORG_0000000000000000000000000000",
    storyline: {
      en: "Fresh contract on Arbitrum with limited history — caution advised.",
      fr: "Contrat recent sur Arbitrum avec historique limite — prudence.",
    },
  },
  red: {
    scenario: "red",
    mockParam: "red",
    addr: "ARB_DEMO_ADDRESS_RED_0000000000000000000",
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
