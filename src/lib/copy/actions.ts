export type ScanType = "token" | "wallet";

export interface ActionInput {
  scan_type: ScanType;
  tier: "GREEN" | "ORANGE" | "RED";
  chain: "SOL" | "ETH" | "TRON" | "BSC" | "BASE" | "ARBITRUM";
  hasUnlimitedApprovals?: boolean;
  knownBadHit?: boolean;
}

export interface ActionCopy {
  en: string[];
  fr: string[];
}

export function getActionCopy(input: ActionInput): ActionCopy {
  const { scan_type, tier, hasUnlimitedApprovals, knownBadHit } = input;

  // TOKEN SCAN — jamais "move funds"
  if (scan_type === "token") {
    return {
      en: [
        "DO NOT INTERACT (swap / sign / approve)",
        "AVOID BUYING OR CONNECTING",
        "VERIFY SOURCES (case file + explorer links)",
      ],
      fr: [
        "N'INTERAGIS PAS (swap / signature / approval)",
        "ÉVITE D'ACHETER OU DE TE CONNECTER",
        "VÉRIFIE LES SOURCES (dossier + explorers)",
      ],
    };
  }

  // WALLET SCAN GREEN — conseils légers
  if (tier === "GREEN") {
    return {
      en: [
        "Verify URL / contract before signing",
        "Start with a small test amount",
        "Monitor approvals regularly",
      ],
      fr: [
        "Vérifie l'URL / contrat avant de signer",
        "Teste une petite somme d'abord",
        "Surveille tes approvals régulièrement",
      ],
    };
  }

  // WALLET SCAN ORANGE
  if (tier === "ORANGE") {
    return {
      en: [
        "REVOKE ACTIVE APPROVALS",
        "DISCONNECT FROM UNKNOWN SITES",
        ...(hasUnlimitedApprovals || knownBadHit
          ? ["IF IN DOUBT: MOVE FUNDS TO A CLEAN WALLET"]
          : ["Keep exposure minimal — no large amounts"]),
      ],
      fr: [
        "RÉVOQUE LES APPROVALS ACTIVES",
        "DÉCONNECTE-TOI DES SITES INCONNUS",
        ...(hasUnlimitedApprovals || knownBadHit
          ? ['EN CAS DE DOUTE : TRANSFÈRE VERS UN WALLET "CLEAN"']
          : ["Exposition minimale — aucun gros montant"]),
      ],
    };
  }

  // WALLET SCAN RED
  return {
    en: [
      "REVOKE ACTIVE APPROVALS",
      "DISCONNECT FROM UNKNOWN SITES",
      'IF IN DOUBT: MOVE FUNDS TO A CLEAN WALLET',
    ],
    fr: [
      "RÉVOQUE LES APPROVALS ACTIVES",
      "DÉCONNECTE-TOI DES SITES INCONNUS",
      'EN CAS DE DOUTE : TRANSFÈRE VERS UN WALLET "CLEAN"',
    ],
  };
}

/** Heuristique scan_type depuis les paramètres d'une page */
export function detectScanType(params: {
  chain: string;
  isMint?: boolean;
  isContract?: boolean;
}): ScanType {
  const chain = (params.chain ?? "").toUpperCase();
  if (chain === "SOL") return params.isMint !== false ? "token" : "wallet";
  // EVM: contrat => token, wallet EOA => wallet
  if (params.isContract === true) return "token";
  if (params.isContract === false) return "wallet";
  return "token"; // safe default
}
