// ─────────────────────────────────────────────────────────────
// Token & Signal Detector — WatcherV2 (2026 patterns)
// Grok-confirmed + Claude Code analysis · pump.fun era
// Extracts CAs, $TOKEN, coded language, emoji signals,
// coordination markers, narrative patterns, nice_pump format
// ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'ca_drop'
  | 'ca_redirect'
  | 'nice_pump'
  | 'coded_bullish'
  | 'coordination_signal'
  | 'discovery_narrative'
  | 'launch_language'
  | 'promo_language'
  | 'emoji_signal';

export interface DetectionResult {
  detectedAddresses: string[];
  detectedTokens: string[];
  signalTypes: SignalType[];
  signalScore: number;
  rawMatches: string[];
}

/** High-value signals that bypass the minimum score threshold */
const ALWAYS_KEEP: SignalType[] = ['ca_drop', 'ca_redirect', 'nice_pump'];

export function shouldKeep(result: DetectionResult, minScore: number): boolean {
  if (result.signalScore >= minScore) return true;
  return result.signalTypes.some((t) => ALWAYS_KEEP.includes(t));
}

// ═══════════════════════════════════════════════════════════════
// ADDRESS & TOKEN PATTERNS
// ═══════════════════════════════════════════════════════════════

// SOL base58: 32-44 chars of [1-9A-HJ-NP-Za-km-z]
const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

// EVM 0x address: 42 hex chars
const EVM_ADDR_RE = /\b0x[0-9a-fA-F]{40}\b/g;

// CA: / Ca: / CA>> prefix followed by address
const CA_PREFIX_RE = /(?:CA|contract|ca)\s*[:：>]{1,2}\s*([1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40})/gi;

// $TOKEN pattern — min 2 chars after $
const TOKEN_RE = /\$([A-Za-z][A-Za-z0-9_]{1,19})\b/g;

// ═══════════════════════════════════════════════════════════════
// NICE PUMP — dominant 2026 post-pump brag format (HIGH VALUE)
// ═══════════════════════════════════════════════════════════════

// "NICE PUMP" exact phrase
const NICE_PUMP_EXACT_RE = /nice pump/i;

// Multiplier claims: "7.8x", "hits 6x", "78x return", "massive 10x"
const MULTIPLIER_RE = /\b(\d+\.?\d*)\s*x\s*(return|from|pump|hit|entry)?|hits?\s+(\d+\.?\d*)\s*x|massive\s+(\d+\.?\d*)\s*x\s*return/i;

// Post-call brag patterns
const PUMP_BRAG_RE = /\b(early entry delivered|another strong entry from TG|from call.{0,15}\d+\.?\d*\s*x|who caught it|premium early entry)\b/i;

// ═══════════════════════════════════════════════════════════════
// CODED BULLISH — new vocabulary replacing old pump language
// ═══════════════════════════════════════════════════════════════

const CODED_BULLISH_RE = new RegExp(
  '\\b(' + [
    'has legs', 'got legs', 'room to run', 'got room to run',
    'caught my eye', 'interesting one', 'on my radar',
    'positioned', 'sized this', 'meaningful position',
    'asymmetric', 'conviction', 'high conviction',
    'my thesis on', "thesis hasn'?t changed",
    'ultra[- ]?bullish', 'getting increasingly more bullish',
    'rarely see coins like this',
    'cult vibes', 'real cult vibes',
    'aggressively accumulating',
    'slow grind up',
    'teleport',
    'kickstart the memecoin',
    'historical meme with lore',
    'imagine not having exposure',
    'sharing alpha',
    'putting this on your radar',
    'early on this', 'been here since day 1',
  ].join('|') + ')\\b',
  'i',
);

// ═══════════════════════════════════════════════════════════════
// CA REDIRECT — CA distribution evasion methods
// ═══════════════════════════════════════════════════════════════

const CA_REDIRECT_TEXT_RE = new RegExp(
  '\\b(' + [
    'check pinned', 'link in bio', 'bio link', 'check bio',
    'access .{0,5} bio',
    'inner circle.{0,15}bio',
    'access the inner circle',
    'dm me', 'dm for ca',
    'tg fam', 'our tg', 'premium tg',
    "best entries aren'?t posted on the timeline",
  ].join('|') + ')\\b',
  'i',
);

// Platform URLs used to share CAs indirectly
const CA_REDIRECT_URL_RE = /(?:dexscreener\.com|birdeye\.so|pump\.fun)\/[^\s]+/i;

// Bio redirect emoji: 🔐 near "bio" text
const BIO_LOCK_RE = /🔐/;

// ═══════════════════════════════════════════════════════════════
// COORDINATION SIGNAL — coordinated group buy markers
// ═══════════════════════════════════════════════════════════════

const COORDINATION_RE = new RegExp(
  '\\b(' + [
    'iykyk', 'if you know,? you know',
    'ct knows', 'crypto twitter knows',
    'make of that what you will',
    'lfg sol ape wake',
    'crypto kings', 'raking in profits',
    'timing,? structure,? and execution',
  ].join('|') + ')\\b',
  'i',
);

// "N callers" pattern (scanner output)
const CALLERS_RE = /\b\d+\s*callers?\b/i;

// Timing pressure — only triggers with token or address context
const COORDINATION_TIMING_RE = /\b(48 hours?|this week|soon|not telling you to)\b/i;

// Whale watching
const WHALE_WATCHING_RE = /\b(same wallet that|whale just|whale wallet|smart money (?:is|just))\b/i;

// ═══════════════════════════════════════════════════════════════
// DISCOVERY NARRATIVE — fake organic discovery framing
// ═══════════════════════════════════════════════════════════════

const DISCOVERY_NARRATIVE_RE = new RegExp(
  '\\b(' + [
    'been digging into', 'noticed heavy accumulation',
    'is anyone else seeing', 'what am I missing',
    'someone tell me why', "a friend who'?s usually right",
    'found something interesting',
    'the chart looks.{0,5}familiar',
    'just noticed this', 'doing research on',
    'dev wallet.{0,20}(?:ran to|launched from)',
    'launched from same dev wallet',
    'years ago that wallet',
    'game in development',
    'strong community building',
  ].join('|') + ')\\b',
  'i',
);

// Bear case reverse psychology — only with token mention
const BEAR_CASE_RE = /\b(bear case|why shouldn'?t|tell me why.{0,20}shouldn'?t)\b/i;

// ═══════════════════════════════════════════════════════════════
// LAUNCH LANGUAGE (legacy — still active)
// ═══════════════════════════════════════════════════════════════

const LAUNCH_WORDS = /\b(launch|pre-tge|pre tge|f&f|friends and family|whitelist|new launch|dropping|just dropped|stealth launch|fair launch)\b/i;

// Promo language (2025 holdovers — stripped of obsolete terms)
const PROMO_WORDS = /\b(shill|add more|adding more|huge week|aping|aped|generational|life changing)\b/i;

// ═══════════════════════════════════════════════════════════════
// EMOJI SIGNAL PATTERNS
// ═══════════════════════════════════════════════════════════════

const EMOJI_PATTERNS: { re: RegExp; label: string; points: number }[] = [
  { re: /🍀/,       label: '🍀',     points: 15 },  // dominant 2026 bullish marker
  { re: /🤑/,       label: '🤑',     points: 15 },  // pump claim
  { re: /🔐/,       label: '🔐',     points: 20 },  // bio redirect / CA evasion
  { re: /👀/,       label: '👀',     points: 10 },  // soft shill
  { re: /🤫|🤐/,    label: '🤫/🤐', points: 10 },  // insider signal
  { re: /👨‍🍳|🧑‍🍳/, label: '👨‍🍳',   points: 10 },  // cooking = launch incoming
  { re: /🎯/,       label: '🎯',     points: 15 },  // target near token
  { re: /🔬|🧪/,    label: '🔬/🧪', points: 5 },   // faux DYOR
  { re: /🫡/,       label: '🫡',     points: 5 },   // coordination ack
  { re: /💀/,       label: '💀',     points: 5 },   // meme signal
];

// Emoji cluster: 3+ distinct emojis without much text = likely signal post
const EMOJI_CLUSTER_RE = /(?:[\u{1F300}-\u{1FAF8}][\uFE0F\u200D]?){3,}/u;
// Text-to-emoji ratio check: short text with many emojis
function isEmojiHeavy(text: string): boolean {
  const stripped = text.replace(/[\u{1F300}-\u{1FAF8}\uFE0F\u200D\s]/gu, '');
  return stripped.length < 30 && EMOJI_CLUSTER_RE.test(text);
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR
// ═══════════════════════════════════════════════════════════════

export function detectSignals(text: string): DetectionResult {
  const addresses: string[] = [];
  const tokens: string[] = [];
  const signals = new Set<SignalType>();
  const rawMatches: string[] = [];
  let score = 0;

  // ─── Address detection ────────────────────────────────────

  for (const match of text.matchAll(CA_PREFIX_RE)) {
    const addr = match[1];
    if (addr && !addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(match[0]);
      signals.add('ca_drop');
    }
  }

  for (const match of text.matchAll(SOL_ADDR_RE)) {
    const addr = match[0];
    if (addr.length >= 32 && !addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(addr);
      signals.add('ca_drop');
    }
  }

  for (const match of text.matchAll(EVM_ADDR_RE)) {
    const addr = match[0];
    if (!addresses.includes(addr)) {
      addresses.push(addr);
      rawMatches.push(addr);
      signals.add('ca_drop');
    }
  }

  // ─── Token detection ──────────────────────────────────────

  for (const match of text.matchAll(TOKEN_RE)) {
    const symbol = match[1].toUpperCase();
    if (!SKIP_TOKENS.has(symbol) && !tokens.includes(symbol)) {
      tokens.push(symbol);
      rawMatches.push(match[0]);
    }
  }

  const hasTokenMention = tokens.length > 0;
  const hasAddress = addresses.length > 0;

  // ─── NICE PUMP (highest value) ────────────────────────────

  if (NICE_PUMP_EXACT_RE.test(text)) {
    signals.add('nice_pump');
    rawMatches.push('nice_pump');
  }
  if (MULTIPLIER_RE.test(text)) {
    signals.add('nice_pump');
    const m = text.match(MULTIPLIER_RE);
    if (m) rawMatches.push(m[0]);
  }
  if (PUMP_BRAG_RE.test(text)) {
    signals.add('nice_pump');
    rawMatches.push('pump_brag');
  }

  // ─── Coded bullish ────────────────────────────────────────

  if (CODED_BULLISH_RE.test(text)) {
    signals.add('coded_bullish');
    rawMatches.push('coded_bullish');
  }

  // ─── CA redirect ──────────────────────────────────────────

  if (CA_REDIRECT_TEXT_RE.test(text)) {
    signals.add('ca_redirect');
    rawMatches.push('ca_redirect');
  }
  if (CA_REDIRECT_URL_RE.test(text)) {
    signals.add('ca_redirect');
    const urlMatch = text.match(CA_REDIRECT_URL_RE);
    if (urlMatch) rawMatches.push(urlMatch[0]);
  }
  if (BIO_LOCK_RE.test(text) && /bio/i.test(text)) {
    signals.add('ca_redirect');
    rawMatches.push('bio_lock_redirect');
  }

  // ─── Coordination signals ─────────────────────────────────

  if (COORDINATION_RE.test(text)) {
    signals.add('coordination_signal');
    rawMatches.push('coordination_signal');
  }
  if (CALLERS_RE.test(text)) {
    signals.add('coordination_signal');
    rawMatches.push('n_callers');
  }
  if (COORDINATION_TIMING_RE.test(text) && (hasTokenMention || hasAddress)) {
    signals.add('coordination_signal');
    rawMatches.push('coordination_timing');
  }
  if (WHALE_WATCHING_RE.test(text)) {
    signals.add('coordination_signal');
    rawMatches.push('whale_watching');
  }

  // ─── Discovery narrative ──────────────────────────────────

  if (DISCOVERY_NARRATIVE_RE.test(text)) {
    signals.add('discovery_narrative');
    rawMatches.push('discovery_narrative');
  }
  if (BEAR_CASE_RE.test(text) && hasTokenMention) {
    signals.add('discovery_narrative');
    rawMatches.push('bear_case_reverse');
  }

  // ─── Launch & promo (legacy) ──────────────────────────────

  if (LAUNCH_WORDS.test(text)) {
    signals.add('launch_language');
    rawMatches.push('launch_language');
  }
  if (PROMO_WORDS.test(text)) {
    signals.add('promo_language');
    rawMatches.push('promo_language');
  }

  // ─── Emoji signals ────────────────────────────────────────

  for (const ep of EMOJI_PATTERNS) {
    if (ep.re.test(text)) {
      signals.add('emoji_signal');
      rawMatches.push(ep.label);
      score += ep.points;
    }
  }

  // Emoji cluster without much text
  if (isEmojiHeavy(text)) {
    signals.add('emoji_signal');
    rawMatches.push('emoji_cluster');
    score += 10;
  }

  // ─── Score calculation ────────────────────────────────────

  // Address & token base
  score += addresses.length * 20;
  score += tokens.length * 15;

  // Signal type scores
  score += signals.has('nice_pump')            ? 30 : 0;
  score += signals.has('ca_redirect')          ? 25 : 0;
  score += signals.has('coordination_signal')  ? 25 : 0;
  score += signals.has('coded_bullish')        ? 20 : 0;
  score += signals.has('discovery_narrative')   ? 15 : 0;
  score += signals.has('launch_language')       ? 10 : 0;
  score += signals.has('promo_language')        ? 10 : 0;

  // Emoji score already added inline above

  score = Math.min(score, 100);

  return {
    detectedAddresses: addresses,
    detectedTokens: tokens,
    signalTypes: Array.from(signals),
    signalScore: score,
    rawMatches,
  };
}

// ═══════════════════════════════════════════════════════════════
// FALSE POSITIVE FILTERS
// ═══════════════════════════════════════════════════════════════

const SKIP_TOKENS = new Set([
  // Fiat currencies
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF',
  // Major tokens (too generic — not useful as shill signals)
  'BTC', 'ETH', 'SOL', 'USDC', 'USDT',
  // Common English words after $
  'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ALL', 'CAN', 'HER',
  'WAS', 'ONE', 'OUR', 'OUT', 'ARE', 'HAS', 'HIS', 'HOW',
  'ITS', 'LET', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY',
  'WHO', 'DID', 'GET', 'HIM', 'HAD', 'SAY', 'SHE', 'TOO',
  'USE', 'DAD', 'MOM',
]);
