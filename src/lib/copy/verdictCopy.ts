export type VerdictTier = "GREEN" | "ORANGE" | "RED";
export type VerdictLang = "en" | "fr";

// ─── CC-OFFLINE-292 — L'ÉTAT PROJETÉ N'EST PAS LE PALIER ───────────────────
//
// ██  UNE COPIE RASSURANTE A DES PRÉCONDITIONS.                            ██
// ██  QUAND ELLES NE SONT PAS SATISFAITES, ELLE N'EST PAS SÉLECTIONNÉE.    ██
//
// Le texte GREEN AFFIRME quelque chose : « No critical alerts detected ».
// Cette affirmation n'est vraie que si une couverture a été ÉTABLIE. Sans
// elle, la phrase ne décrit pas une absence d'alerte : elle décrit une
// absence de mesure, et la présente comme une absence d'alerte.
//
// Aucune de ces chaînes n'est réécrite ni supprimée. Elles restent EXACTES
// pour l'état qu'elles décrivent. Ce qui change est leur SÉLECTION.
export type VerdictPresentation = VerdictTier | "UNVERIFIED";

export interface VerdictCopy {
  label: string;
  subtitle: string;
  actions: [string, string, string];
  disclaimer: string;
}

const COPY: Record<VerdictPresentation, Record<VerdictLang, VerdictCopy>> = {
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
  // ─── CC-OFFLINE-292 · L'ÉTAT SANS COUVERTURE ─────────────────────────────
  //
  // ⛔ CE N'EST PAS UNE ACCUSATION. Une couverture non établie ne dit rien
  //    contre le jeton : elle dit que le produit n'a rien mesuré. Aucun mot
  //    de soupçon n'entre ici — et aucun mot de permission non plus.
  UNVERIFIED: {
    fr: {
      label: "NON VÉRIFIÉ",
      subtitle: "La couverture n'a pas été établie pour cette adresse. Ce n'est pas une évaluation de sécurité.",
      actions: [
        "Rien n'a été vérifié ici. Considère l'état comme inconnu, pas comme validé.",
        "Ne décide pas sur la foi de cet écran. Cherche une source indépendante.",
        "Si tu interagis quand même, suppose que le risque n'est pas mesuré.",
      ],
      disclaimer: "Indicateur basé sur des signaux. Pas un conseil financier. Fais tes propres recherches (DYOR).",
    },
    en: {
      label: "UNVERIFIED",
      subtitle: "Coverage was not established for this address. This is not a safety assessment.",
      actions: [
        "Nothing was verified here. Treat this as unknown, not as cleared.",
        "Do not decide on the strength of this screen. Look for an independent source.",
        "If you interact anyway, assume the risk is unmeasured.",
      ],
      disclaimer: "Signal-based indicator. Not financial advice. Do your own research (DYOR).",
    },
  },
};

export function getVerdictCopy(tier: VerdictTier, lang: VerdictLang): VerdictCopy {
  return COPY[tier][lang];
}

/**
 * CC-OFFLINE-292 — LA SÉLECTION SUIT L'AUTORITÉ, ELLE NE LA FABRIQUE PAS.
 *
 * `coverageSufficient` est PRODUIT en amont (`risk.coverage.sufficient` de la
 * route de scan). Cette fonction ne le calcule pas, ne le devine pas, ne le
 * complète pas : elle le LIT. `undefined` — aucune autorité de couverture
 * n'accompagne ce résultat — laisse le comportement historique intact.
 *
 * ⛔ UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE. Seul `GREEN` bascule : c'est la seule
 *    lecture PERMISSIVE, et une permission a besoin d'un appui positif.
 *    `ORANGE` et `RED` traversent intacts — la couverture restreint une
 *    permission, elle ne réduit pas une gravité établie.
 */
export function selectVerdictCopy(
  tier: VerdictTier,
  lang: VerdictLang,
  coverageSufficient?: boolean,
): { presentation: VerdictPresentation; copy: VerdictCopy } {
  const presentation: VerdictPresentation =
    coverageSufficient === false && tier === "GREEN" ? "UNVERIFIED" : tier;
  return { presentation, copy: COPY[presentation][lang] };
}
