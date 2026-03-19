/**
 * src/lib/surveillance/signals/tokenExtractor.ts
 * Extrait les adresses de contrat depuis le texte d'un post
 */

const EVM_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

export interface ExtractedToken {
  tokenAddress: string;
  source: "contract_address";
}

export function extractTokensFromText(text: string): ExtractedToken[] {
  const matches = text.match(EVM_ADDRESS_REGEX) ?? [];
  const unique = [...new Set(matches.map((a) => a.toLowerCase()))];
  return unique.map((tokenAddress) => ({ tokenAddress, source: "contract_address" }));
}

export function hasTokenAddress(text: string): boolean {
  return EVM_ADDRESS_REGEX.test(text);
}
