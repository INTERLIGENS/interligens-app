export type VerdictTier = "GREEN" | "ORANGE" | "RED";
export type VerdictLang = "en" | "fr";

export interface VerdictCopy {
  label: string;
  subtitle: string;
  actions: [string, string, string];
  disclaimer: string;
}

const COPY: Record<VerdictTier, Record<VerdictLang, VerdictCopy>> = {
  GREEN: {
    fr: {
      label: "OK",
      subtitle: "Pas d'alerte critique détectée. Vérifie quand même les liens.",
      actions: [
        "Vérifie l'URL / le contrat avant de signer.",
        "Commence petit, puis augmente progressivement.",
        "Ajoute en watchlist : surveille liquidité et changements.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "SAFE",
      subtitle: "No critical alerts detected. Still verify URLs.",
      actions: [
        "Verify the URL/contract before signing.",
        "Start small, then scale up.",
        "Watchlist it: monitor liquidity and control changes.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
  ORANGE: {
    fr: {
      label: "ATTENTION",
      subtitle: "Signaux suspects. Avance avec prudence.",
      actions: [
        "Évite toute signature/approval tant que les preuves ne sont pas claires.",
        "Si tu testes : micro-montant + une seule action.",
        "Ouvre les preuves : holders, liquidité, récidive.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "CAUTION",
      subtitle: "Suspicious signals. Proceed with caution.",
      actions: [
        "Avoid signing/approvals until evidence is clear.",
        "If you test: micro amount + one action only.",
        "Open evidence: holders, liquidity, lineage.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
  RED: {
    fr: {
      label: "ÉVITER",
      subtitle: "Schémas à haut risque détectés. Évite toute interaction.",
      actions: [
        "STOP : n'interagis pas (swap / signature / approve).",
        "Si tu as déjà interagi : révoque approvals + migre vers un wallet propre.",
        "Signale et partage le rapport (protéger les autres).",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "AVOID",
      subtitle: "High-risk patterns detected. Avoid interaction.",
      actions: [
        "STOP: do not interact (swap / sign / approve).",
        "If you already interacted: revoke approvals + move to a clean wallet.",
        "Report and share the case file (protect others).",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
};

export function getVerdictCopy(tier: VerdictTier, lang: VerdictLang): VerdictCopy {
  return COPY[tier][lang];
}
