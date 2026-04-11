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
        "Vérifie bien le lien avant de cliquer.",
        "Commence petit. Augmente seulement si tu es à l'aise.",
        "Reste vigilant — les choses peuvent changer vite.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "SAFE",
      subtitle: "No critical alerts detected. Still verify URLs.",
      actions: [
        "Double-check the link before you click anything.",
        "Start small. Increase only if you're comfortable.",
        "Keep watching — things can change fast.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
  ORANGE: {
    fr: {
      label: "ATTENTION",
      subtitle: "Signaux suspects. Avance avec prudence.",
      actions: [
        "Ne te précipite pas. Vérifie les preuves avant d'agir.",
        "Si tu testes, utilise un micro-montant seulement.",
        "Consulte le dossier pour plus de détails.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "CAUTION",
      subtitle: "Suspicious signals. Proceed with caution.",
      actions: [
        "Do not rush. Check the evidence before doing anything.",
        "If you test, use a tiny amount only.",
        "Review the case file for more details.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
  RED: {
    fr: {
      label: "ÉVITER",
      subtitle: "N'ACHETEZ PAS. Schémas à haut risque détectés. Évite toute interaction.",
      actions: [
        "STOP. N'achète pas. Ne connecte pas ton wallet.",
        "Si tu as déjà interagi, arrête-toi et consulte le dossier.",
        "Sauvegarde le rapport — tu pourrais en avoir besoin comme preuve.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "AVOID",
      subtitle: "DON'T BUY THIS. High-risk patterns detected. Avoid interaction.",
      actions: [
        "STOP. Do not buy. Do not connect your wallet.",
        "If you already interacted, stop and review the case file.",
        "Save the report — you may need proof later.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
};

export function getVerdictCopy(tier: VerdictTier, lang: VerdictLang): VerdictCopy {
  return COPY[tier][lang];
}
