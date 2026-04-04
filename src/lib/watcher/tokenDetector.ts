// ──────────────��────────────────────────────��─────────────────
// Token & Signal Detector — WatcherV2
// Extracts CAs, $TOKEN mentions, and signal types from tweet text
// ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'ca_drop'
  | 'promo_language'
  | 'launch_language'
  | 'bullish_call'
  | 'loading_signal'
  | 'coordinated_pattern';

export interface DetectionResult {
  detectedAddresses: string[];
  detectedTokens: string[];
  signalTypes: SignalType[];
  signalScore: number;
  rawMatches: string[];
}

// ─── Patterns ──────��──────────────────────────────────────────

// SOL base58: 32-44 chars of [1-9A-HJ-NP-Za-km-z]
const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

// EVM 0x address: 42 hex chars
const EVM_ADDR_RE = /\b0x[0-9a-fA-F]{40}\b/g;

// CA: or contract: prefix followed by address
const CA_PREFIX_RE = /(?:CA|contract|ca)\s*[:：]\s*([1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40})/gi;

// $TOKEN pattern — min 2 chars after $
const TOKEN_RE = /\$([A-Za-z][A-Za-z0-9_]{1,19})\b/g;

// Launch language
const LAUNCH_WORDS = /\b(launch|pre-tge|pre tge|f&f|friends and family|whitelist|new launch|dropping|just dropped|stealth launch|fair launch)\b/i;

// Promo language
const PROMO_WORDS = /\b(shill|add more|adding more|huge week|send it|loaded|moon|moonshot|aping|aped|easy 10x|100x|1000x|generational|life changing)\b/i;

// Bullish call: $TOKEN + rocket or buy/hold prefix
const BULLISH_CALL_RE = /(?:buy|hold|bullish on|long)\s+\$[A-Za-z]{2,}|\$[A-Za-z]{2,}\s*🚀/i;

// Loading signal
const LOADING_WORDS = /\b(loading|accumulating|building bag|stacking|dca|dollar cost averaging|filling bags)\b/i;

// ─── Detector ─────────────────────────────────────────────────

export function detectSignals(text: string): DetectionResult {
  const addresses: string[] = [];
  const tokens: string[] = [];
  const signals = new Set<SignalType>();
  const rawMatches: string[] = [];

  // Detect CA prefix patterns first
  for (const match of text.matchAll(CA_PREFIX_RE)) {
    const addr = match[1];
    if (addr && !addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(match[0]);
      signals.add('ca_drop');
    }
  }

  // Detect standalone SOL addresses
  for (const match of text.matchAll(SOL_ADDR_RE)) {
    const addr = match[0];
    // Filter out common false positives (short base58 strings that are words)
    if (addr.length >= 32 && !addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(addr);
      signals.add('ca_drop');
    }
  }

  // Detect EVM addresses
  for (const match of text.matchAll(EVM_ADDR_RE)) {
    const addr = match[0];
    if (!addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(addr);
      signals.add('ca_drop');
    }
  }

  // Detect $TOKEN mentions
  for (const match of text.matchAll(TOKEN_RE)) {
    const symbol = match[1].toUpperCase();
    // Skip common false positives
    if (!SKIP_TOKENS.has(symbol) && !tokens.includes(symbol)) {
      tokens.push(symbol);
      rawMatches.push(match[0]);
    }
  }

  // Signal type detection
  if (LAUNCH_WORDS.test(text)) {
    signals.add('launch_language');
    rawMatches.push('launch_language');
  }
  if (PROMO_WORDS.test(text)) {
    signals.add('promo_language');
    rawMatches.push('promo_language');
  }
  if (BULLISH_CALL_RE.test(text)) {
    signals.add('bullish_call');
    rawMatches.push('bullish_call');
  }
  if (LOADING_WORDS.test(text)) {
    signals.add('loading_signal');
    rawMatches.push('loading_signal');
  }

  // Score calculation
  let score = 0;
  score += addresses.length * 20;   // +20 per CA found
  score += tokens.length * 15;      // +15 per token symbol
  score += (signals.has('promo_language') ? 10 : 0);
  score += (signals.has('launch_language') ? 10 : 0);
  score += (signals.has('loading_signal') ? 10 : 0);
  score += (signals.has('bullish_call') ? 5 : 0);
  score = Math.min(score, 100);     // cap at 100

  return {
    detectedAddresses: addresses,
    detectedTokens: tokens,
    signalTypes: Array.from(signals),
    signalScore: score,
    rawMatches,
  };
}

// Common $ symbols that are NOT token tickers
const SKIP_TOKENS = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF',
  'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ALL', 'CAN', 'HER',
  'WAS', 'ONE', 'OUR', 'OUT', 'ARE', 'HAS', 'HIS', 'HOW',
  'ITS', 'LET', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY',
  'WHO', 'DID', 'GET', 'HIM', 'HAD', 'SAY', 'SHE', 'TOO',
  'USE', 'DAD', 'MOM',
]);
