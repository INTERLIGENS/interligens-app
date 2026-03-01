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

export const DEMO_PRESETS = { SOL: SOL_PRESETS, ETH: ETH_PRESETS };
