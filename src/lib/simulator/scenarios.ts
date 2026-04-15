export type Tier = "RED" | "ORANGE" | "GREEN";

export type PricePoint = { t: number; p: number };

export type ScenarioOutcome = {
  capitalDelta: number;
  narrative: string;
  debrief: string;
};

export type Scenario = {
  id: string;
  token: string;
  title: string;
  context: string;
  stats: string[];
  tigerScore: number;
  tier: Tier;
  signals: string[];
  verdict: string;
  chart: PricePoint[];
  entryIndex: number;
  dangerZone: { from: number; to: number };
  onEnter: ScenarioOutcome;
  onSkip: ScenarioOutcome;
};

export const STARTING_CAPITAL = 100;

export const SCENARIOS: Scenario[] = [
  {
    id: "kol-push",
    token: "$BLAZE",
    title: "KOL Push",
    context:
      "Un KOL avec 200k followers vient de tweeter sur $BLAZE. Le token a gagné 180% en 6 heures. Tout le monde entre.",
    stats: [
      "Hausse +180% en 6h",
      "Volatilité extrême",
      "94% des transactions dans les 4 dernières heures",
    ],
    tigerScore: 89,
    tier: "RED",
    signals: [
      "Narratif promotionnel agressif",
      "Concentration des achats anormale",
      "Aucun fondamental on-chain",
    ],
    verdict: "Profil hautement manipulé. Entrée non recommandée.",
    chart: [
      { t: 0, p: 100 },
      { t: 1, p: 108 },
      { t: 2, p: 122 },
      { t: 3, p: 145 },
      { t: 4, p: 178 },
      { t: 5, p: 220 },
      { t: 6, p: 260 },
      { t: 7, p: 280 },
      { t: 8, p: 240 },
      { t: 9, p: 180 },
      { t: 10, p: 130 },
      { t: 11, p: 95 },
      { t: 12, p: 72 },
    ],
    entryIndex: 7,
    dangerZone: { from: 7, to: 12 },
    onEnter: {
      capitalDelta: -60,
      narrative:
        "Tu es entré au pic. Les early wallets ont vendu dans l'heure. Le prix s'est effondré de 74% en cinq bougies.",
      debrief:
        "Tu as perdu. Le TigerScore signalait exactement ce pattern. La narration a remplacé l'analyse.",
    },
    onSkip: {
      capitalDelta: 0,
      narrative:
        "Tu n'es pas entré. Le token a chuté de 74% dans les heures qui ont suivi. Ton capital fictif est intact.",
      debrief:
        "Bon process. Tu as lu le score avant d'agir. C'est ça la discipline.",
    },
  },
  {
    id: "clean-facade",
    token: "NEXAVAULT",
    title: "Projet propre visuellement, mauvais structurellement",
    context:
      "NEXAVAULT affiche un site premium, un whitepaper de 40 pages, une équipe avec des noms. Le score est moins évident.",
    stats: [
      "Hausse modérée +34%",
      "Documentation complète",
      "Aucune liquidité vérifiable",
    ],
    tigerScore: 71,
    tier: "RED",
    signals: [
      "Liquidité non vérifiable",
      "Wallet fondateur concentré à 78%",
      "Aucune activité on-chain réelle",
    ],
    verdict: "Apparence soignée. Signaux structurels préoccupants.",
    chart: [
      { t: 0, p: 100 },
      { t: 1, p: 104 },
      { t: 2, p: 110 },
      { t: 3, p: 118 },
      { t: 4, p: 124 },
      { t: 5, p: 128 },
      { t: 6, p: 134 },
      { t: 7, p: 132 },
      { t: 8, p: 120 },
      { t: 9, p: 88 },
      { t: 10, p: 52 },
      { t: 11, p: 30 },
      { t: 12, p: 22 },
    ],
    entryIndex: 6,
    dangerZone: { from: 7, to: 12 },
    onEnter: {
      capitalDelta: -80,
      narrative:
        "Tu es entré sur la force du design. Trois jours plus tard, le wallet fondateur a drainé la liquidité. Le token a perdu 83%.",
      debrief:
        "Tu as perdu. L'apparence était propre. Le Tiger voyait ce que l'œil ne voyait pas.",
    },
    onSkip: {
      capitalDelta: 0,
      narrative:
        "Tu n'es pas entré. La liquidité a été drainée trois jours plus tard. Ton capital fictif est intact.",
      debrief: "Bon process. Tu as regardé au-delà du design.",
    },
  },
  {
    id: "lucky-gain",
    token: "MORI",
    title: "Gain trompeur",
    context:
      "MORI vient de sortir. Score ambigu. Tu as un feeling. Tu entres.",
    stats: [
      "Hausse +90%",
      "Token très jeune",
      "Narratif fort",
      "Sorties early wallets détectées",
    ],
    tigerScore: 67,
    tier: "ORANGE",
    signals: [
      "Sorties early wallets détectées",
      "Fenêtre courte",
      "Narratif fort, fondamentaux faibles",
    ],
    verdict: "Fenêtre possible mais profil fragile. Risque élevé.",
    chart: [
      { t: 0, p: 100 },
      { t: 1, p: 112 },
      { t: 2, p: 128 },
      { t: 3, p: 144 },
      { t: 4, p: 162 },
      { t: 5, p: 180 },
      { t: 6, p: 190 },
      { t: 7, p: 198 },
      { t: 8, p: 185 },
      { t: 9, p: 170 },
      { t: 10, p: 155 },
      { t: 11, p: 140 },
      { t: 12, p: 128 },
    ],
    entryIndex: 3,
    dangerZone: { from: 7, to: 12 },
    onEnter: {
      capitalDelta: 40,
      narrative:
        "Tu es entré tôt. Le token a gagné encore 40% avant de redescendre. Tu as sorti à temps — cette fois.",
      debrief:
        "Tu as gagné. Mais ton process était mauvais. Le Tiger signalait des sorties early. Tu as eu de la chance, pas de la discipline. Ce réflexe peut te coûter très cher la prochaine fois.",
    },
    onSkip: {
      capitalDelta: 0,
      narrative:
        "Tu n'es pas entré. Le token a grimpé puis s'est effrité. Tu as évité le risque — et la récompense.",
      debrief:
        "Bon process. Le Tiger signalait un profil fragile. Éviter était la bonne décision, même si un gain était possible.",
    },
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
