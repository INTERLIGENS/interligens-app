const BANNED_PHRASES_EN = [
  "laundered funds",
  "laundered proceeds",
  "money laundering confirmed",
  "successfully laundered",
  "definitively hidden",
  "funds are now untraceable",
  "this person laundered",
  "this wallet laundered",
];

const BANNED_PHRASES_FR = [
  "a blanchi les fonds",
  "a blanchi le produit",
  "blanchiment confirmé",
  "blanchiment avéré",
  "fonds définitivement cachés",
  "fonds désormais intraçables",
  "cette personne a blanchi",
  "ce portefeuille a blanchi",
];

const ALL_BANNED = [...BANNED_PHRASES_EN, ...BANNED_PHRASES_FR];

export function validateLaundryOutput(text: string): void {
  for (const phrase of ALL_BANNED) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      throw new Error(`[LaundryTrail] Banned phrase in output: "${phrase}"`);
    }
  }
}
