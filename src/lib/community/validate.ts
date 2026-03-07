
export const DANGER_TYPES = ["scam","phishing","drainer","exploiter","rugpull"];
export const ALLOWED_LABEL_TYPES = [
  "scam","phishing","drainer","exploiter","rugpull",
  "mixer","bridge","exchange","whale","team","other"
];

export function detectChain(address: string): string | null {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return "EVM";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return "TRON";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "SOL";
  return null;
}

export function validateSubmission(body: any): string | null {
  if (!body.address) return "address required";
  if (!body.labelType) return "labelType required";
  if (!ALLOWED_LABEL_TYPES.includes(body.labelType)) return "invalid labelType";
  const chain = body.chain || detectChain(body.address);
  if (!chain) return "invalid address or unknown chain";
  if (DANGER_TYPES.includes(body.labelType)) {
    if (!body.txHash && !body.evidenceUrl && !body.message) {
      return "evidence required for danger category (txHash, evidenceUrl, or message)";
    }
  }
  if (body.message && body.message.length > 500) return "message too long (500 chars max)";
  return null;
}

export function deriveSeverity(labelType: string): string {
  if (DANGER_TYPES.includes(labelType)) return "danger";
  if (["mixer","bridge"].includes(labelType)) return "warn";
  return "info";
}
