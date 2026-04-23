// src/lib/signature-intent/analyzer.ts

export type IntentChain = "solana" | "ethereum" | "base" | "arbitrum";
export type RiskLevel   = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
export type IntentType  =
  | "UNLIMITED_APPROVAL"
  | "APPROVE"
  | "PERMIT"
  | "SET_AUTHORITY"
  | "SET_APPROVAL_FOR_ALL"
  | "TRANSFER"
  | "TRANSFER_FROM"
  | "MULTICALL_WITH_APPROVAL"
  | "UNKNOWN";
export type RecommendedAction = "REJECT" | "CAUTION" | "SAFE_TO_SIGN";

export interface SignatureIntentInput {
  raw_tx?: string;
  decoded_data?: {
    method: string;
    params: Record<string, string>;
  };
  chain: IntentChain;
  from_address?: string;
  to_address?: string;
}

export interface SignatureIntentResult {
  risk_level: RiskLevel;
  intent_type: IntentType;
  explanation_en: string;
  explanation_fr: string;
  red_flags: string[];
  recommended_action: RecommendedAction;
  decoded_summary: {
    method_name?: string;
    spender?: string;
    amount?: string;
    is_unlimited?: boolean;
  };
}

// ── EVM function selectors ────────────────────────────────────────────────────

const SEL_APPROVE          = "095ea7b3"; // approve(address,uint256)
const SEL_PERMIT           = "d505accf"; // permit(owner,spender,value,deadline,v,r,s)
const SEL_SET_APPROVAL_ALL = "a22cb465"; // setApprovalForAll(address,bool)
const SEL_TRANSFER_FROM    = "23b872dd"; // transferFrom(address,address,uint256)
const SEL_MULTICALL        = "ac9650d8"; // multicall(bytes[])
const SEL_MULTICALL_DL     = "5ae401dc"; // multicall(uint256,bytes[]) — Uniswap V3

const MAX_UINT256          = "f".repeat(64);
const MAX_UINT256_DECIMAL  = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// ── Low-level calldata helpers ────────────────────────────────────────────────

function stripHex(raw: string): string {
  return raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
}

function getSelector(raw: string): string {
  return stripHex(raw).slice(0, 8).toLowerCase();
}

function getCalldata(raw: string): string {
  return stripHex(raw).slice(8).toLowerCase();
}

function readAddress(data: string, slot: number): string {
  const slotHex = data.slice(slot * 64, (slot + 1) * 64);
  return "0x" + slotHex.slice(24);
}

function readUint256Hex(data: string, slot: number): string {
  return data.slice(slot * 64, (slot + 1) * 64).toLowerCase();
}

function isUnlimited(amountHex: string): boolean {
  const normalized = amountHex.replace(/^0+/, "") || "0";
  return normalized === MAX_UINT256.replace(/^0+/, "") || normalized === "f".repeat(64);
}

// ── EVM raw calldata analysis ─────────────────────────────────────────────────

function analyzeEvmRaw(raw: string): SignatureIntentResult {
  const sel  = getSelector(raw);
  const data = getCalldata(raw);

  if (sel === SEL_APPROVE) {
    const spender    = readAddress(data, 0);
    const amountHex  = readUint256Hex(data, 1);
    const unlimited  = isUnlimited(amountHex);
    if (unlimited) {
      return {
        risk_level: "CRITICAL",
        intent_type: "UNLIMITED_APPROVAL",
        explanation_en: `STOP. This transaction grants unlimited access to ALL your tokens to ${spender}. This is a classic drainer pattern.`,
        explanation_fr: `STOP. Cette transaction autorise ${spender} à prendre TOUS tes tokens sans limite. C'est un drainer classique.`,
        red_flags: ["Unlimited approval (MAX_UINT256)", `Spender: ${spender}`],
        recommended_action: "REJECT",
        decoded_summary: { method_name: "approve", spender, amount: "MAX_UINT256", is_unlimited: true },
      };
    }
    let amountDecimal: string;
    try {
      amountDecimal = BigInt("0x" + amountHex).toString();
    } catch {
      amountDecimal = amountHex;
    }
    return {
      risk_level: "MEDIUM",
      intent_type: "APPROVE",
      explanation_en: `This transaction approves ${spender} to spend a limited amount of your tokens.`,
      explanation_fr: `Cette transaction autorise ${spender} à dépenser un montant limité de vos tokens.`,
      red_flags: [`Spender: ${spender}`, `Amount: ${amountDecimal}`],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "approve", spender, amount: amountDecimal, is_unlimited: false },
    };
  }

  if (sel === SEL_PERMIT) {
    return {
      risk_level: "HIGH",
      intent_type: "PERMIT",
      explanation_en: "This is an off-chain permit signature (EIP-2612) that authorizes an immediate token transfer. No further on-chain confirmation needed after signing.",
      explanation_fr: "C'est une signature hors chaîne (permit EIP-2612) qui autorise un transfert immédiat. Aucune confirmation on-chain requise après signature.",
      red_flags: ["Off-chain permit — no second confirmation", "Authorization is immediate upon signing"],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "permit" },
    };
  }

  if (sel === SEL_SET_APPROVAL_ALL) {
    return {
      risk_level: "CRITICAL",
      intent_type: "SET_APPROVAL_FOR_ALL",
      explanation_en: "STOP. This transaction grants access to ALL your NFTs or tokens in this collection. Classic NFT drainer signature.",
      explanation_fr: "STOP. Cette transaction donne accès à TOUS tes NFTs ou tokens de cette collection. Signature drainer NFT classique.",
      red_flags: ["setApprovalForAll — full collection access", "Commonly used in NFT drainer attacks"],
      recommended_action: "REJECT",
      decoded_summary: { method_name: "setApprovalForAll", is_unlimited: true },
    };
  }

  if (sel === SEL_TRANSFER_FROM) {
    return {
      risk_level: "LOW",
      intent_type: "TRANSFER_FROM",
      explanation_en: "Standard token transfer. Verify the recipient address before signing.",
      explanation_fr: "Transfert de token standard. Vérifiez l'adresse destinataire avant de signer.",
      red_flags: [],
      recommended_action: "SAFE_TO_SIGN",
      decoded_summary: { method_name: "transferFrom" },
    };
  }

  if (sel === SEL_MULTICALL || sel === SEL_MULTICALL_DL) {
    const inner = data.toLowerCase();
    if (inner.includes(SEL_APPROVE) || inner.includes(SEL_SET_APPROVAL_ALL)) {
      return {
        risk_level: "HIGH",
        intent_type: "MULTICALL_WITH_APPROVAL",
        explanation_en: "This complex transaction contains a hidden approval. Review each sub-call carefully before signing.",
        explanation_fr: "Cette transaction complexe contient une approbation cachée. Vérifiez chaque sous-appel avant de signer.",
        red_flags: ["Multicall with embedded approval", "Approval hidden inside complex transaction"],
        recommended_action: "CAUTION",
        decoded_summary: { method_name: "multicall" },
      };
    }
    return {
      risk_level: "MEDIUM",
      intent_type: "UNKNOWN",
      explanation_en: "Complex multi-step transaction. Verify the source and purpose before signing.",
      explanation_fr: "Transaction multi-étapes complexe. Vérifiez la source et l'objet avant de signer.",
      red_flags: ["Multicall — multiple operations bundled"],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "multicall" },
    };
  }

  return {
    risk_level: "MEDIUM",
    intent_type: "UNKNOWN",
    explanation_en: "This transaction could not be decoded. Verify it with the dApp before signing.",
    explanation_fr: "Cette transaction n'a pas pu être décodée. Vérifiez-la avec la dApp avant de signer.",
    red_flags: ["Unknown transaction type"],
    recommended_action: "CAUTION",
    decoded_summary: {},
  };
}

// ── EVM decoded_data analysis ─────────────────────────────────────────────────

function analyzeEvmDecoded(
  method: string,
  params: Record<string, string>,
): SignatureIntentResult {
  const m = method.toLowerCase().replace(/[^a-z]/g, "");

  if (m === "approve") {
    const spender = params.spender ?? params._spender ?? params.guy ?? "";
    const amount  = params.amount ?? params.value ?? params._value ?? params.wad ?? "";
    const unlimited =
      amount === MAX_UINT256_DECIMAL ||
      amount.toLowerCase().replace(/^0+/, "") === "f".repeat(64);
    if (unlimited) {
      return {
        risk_level: "CRITICAL",
        intent_type: "UNLIMITED_APPROVAL",
        explanation_en: `STOP. Unlimited token approval to ${spender || "unknown address"}. This is a classic drainer pattern.`,
        explanation_fr: `STOP. Approbation illimitée vers ${spender || "adresse inconnue"}. C'est un drainer classique.`,
        red_flags: ["Unlimited approval (MAX_UINT256)", `Spender: ${spender}`],
        recommended_action: "REJECT",
        decoded_summary: { method_name: "approve", spender, amount: "MAX_UINT256", is_unlimited: true },
      };
    }
    return {
      risk_level: "MEDIUM",
      intent_type: "APPROVE",
      explanation_en: `Approves ${spender || "an address"} to spend a limited token amount.`,
      explanation_fr: `Autorise ${spender || "une adresse"} à dépenser un montant limité.`,
      red_flags: [`Spender: ${spender}`, `Amount: ${amount}`],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "approve", spender, amount, is_unlimited: false },
    };
  }

  if (m === "permit") {
    return {
      risk_level: "HIGH",
      intent_type: "PERMIT",
      explanation_en: "Off-chain permit signature (EIP-2612). Authorizes token transfer immediately upon signing.",
      explanation_fr: "Signature hors chaîne (permit EIP-2612). Autorise un transfert immédiatement à la signature.",
      red_flags: ["Off-chain permit — no second confirmation", "Immediate authorization"],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "permit", spender: params.spender },
    };
  }

  if (m === "setapprovalforall") {
    return {
      risk_level: "CRITICAL",
      intent_type: "SET_APPROVAL_FOR_ALL",
      explanation_en: "STOP. Full collection approval to an address — classic NFT drainer pattern.",
      explanation_fr: "STOP. Approbation totale de la collection — signature drainer NFT classique.",
      red_flags: ["setApprovalForAll — full collection access"],
      recommended_action: "REJECT",
      decoded_summary: { method_name: "setApprovalForAll", is_unlimited: true },
    };
  }

  if (m === "transferfrom" || m === "transfer") {
    return {
      risk_level: "LOW",
      intent_type: m === "transferfrom" ? "TRANSFER_FROM" : "TRANSFER",
      explanation_en: "Standard token transfer. Verify the recipient before signing.",
      explanation_fr: "Transfert de token standard. Vérifiez le destinataire avant de signer.",
      red_flags: [],
      recommended_action: "SAFE_TO_SIGN",
      decoded_summary: { method_name: method },
    };
  }

  if (m === "multicall") {
    const joined = Object.values(params).join("").toLowerCase();
    if (joined.includes(SEL_APPROVE) || joined.includes(SEL_SET_APPROVAL_ALL)) {
      return {
        risk_level: "HIGH",
        intent_type: "MULTICALL_WITH_APPROVAL",
        explanation_en: "Complex transaction with a hidden approval sub-call. Verify before signing.",
        explanation_fr: "Transaction complexe avec une sous-approbation cachée. Vérifiez avant de signer.",
        red_flags: ["Multicall with embedded approval"],
        recommended_action: "CAUTION",
        decoded_summary: { method_name: "multicall" },
      };
    }
    return {
      risk_level: "MEDIUM",
      intent_type: "UNKNOWN",
      explanation_en: "Multi-step transaction. Verify source and intent before signing.",
      explanation_fr: "Transaction multi-étapes. Vérifiez la source et l'intention avant de signer.",
      red_flags: ["Multicall — multiple operations bundled"],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "multicall" },
    };
  }

  return {
    risk_level: "MEDIUM",
    intent_type: "UNKNOWN",
    explanation_en: "Unknown transaction. Verify with the dApp before signing.",
    explanation_fr: "Transaction inconnue. Vérifiez avec la dApp avant de signer.",
    red_flags: ["Unknown method"],
    recommended_action: "CAUTION",
    decoded_summary: { method_name: method },
  };
}

// ── Solana analysis ───────────────────────────────────────────────────────────

function analyzeSolana(input: SignatureIntentInput): SignatureIntentResult {
  const method = (input.decoded_data?.method ?? "").toLowerCase().replace(/[_\s]/g, "");

  if (method === "setauthority") {
    return {
      risk_level: "CRITICAL",
      intent_type: "SET_AUTHORITY",
      explanation_en: "STOP. This transaction changes the authority (owner) of a token or program. This is irreversible.",
      explanation_fr: "STOP. Cette transaction change l'autorité (propriétaire) d'un token ou programme. C'est irréversible.",
      red_flags: ["setAuthority — ownership transfer", "Irreversible operation"],
      recommended_action: "REJECT",
      decoded_summary: { method_name: "setAuthority" },
    };
  }

  if (method === "approve") {
    return {
      risk_level: "HIGH",
      intent_type: "APPROVE",
      explanation_en: "This transaction delegates transfer rights over your tokens to another address.",
      explanation_fr: "Cette transaction délègue les droits de transfert de vos tokens à une autre adresse.",
      red_flags: ["Solana token delegation"],
      recommended_action: "CAUTION",
      decoded_summary: { method_name: "approve" },
    };
  }

  if (input.raw_tx) {
    // Base64-encoded Solana transaction: discriminant byte 6 = SetAuthority in SPL Token
    try {
      const bytes = Buffer.from(input.raw_tx, "base64");
      // Heuristic: instruction data with first byte 6 after program ID index indicates SetAuthority
      if (bytes.length > 4 && bytes[bytes.length - 1] === 6) {
        return {
          risk_level: "CRITICAL",
          intent_type: "SET_AUTHORITY",
          explanation_en: "STOP. Potential setAuthority instruction detected in raw transaction.",
          explanation_fr: "STOP. Instruction setAuthority potentielle détectée dans la transaction brute.",
          red_flags: ["Potential setAuthority instruction"],
          recommended_action: "REJECT",
          decoded_summary: { method_name: "setAuthority" },
        };
      }
    } catch {
      /* ignore */
    }
  }

  return {
    risk_level: "MEDIUM",
    intent_type: "UNKNOWN",
    explanation_en: "Unknown Solana transaction. Verify with your wallet before signing.",
    explanation_fr: "Transaction Solana inconnue. Vérifiez avec votre wallet avant de signer.",
    red_flags: ["Unknown Solana transaction type"],
    recommended_action: "CAUTION",
    decoded_summary: {},
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function analyzeSignatureIntent(input: SignatureIntentInput): SignatureIntentResult {
  if (input.chain === "solana") {
    return analyzeSolana(input);
  }

  if (input.decoded_data) {
    return analyzeEvmDecoded(input.decoded_data.method, input.decoded_data.params);
  }

  if (input.raw_tx) {
    return analyzeEvmRaw(input.raw_tx);
  }

  return {
    risk_level: "MEDIUM",
    intent_type: "UNKNOWN",
    explanation_en: "No transaction data provided.",
    explanation_fr: "Aucune donnée de transaction fournie.",
    red_flags: ["Missing transaction data"],
    recommended_action: "CAUTION",
    decoded_summary: {},
  };
}
