// @client-only — Web Worker entry. Runs inside a Worker context.
//
// Extracts candidate entities (WALLET / TX_HASH / HANDLE / URL / DOMAIN)
// from user-uploaded files. Runs entirely on the user's device before the
// file is encrypted. Never sees the key, never contacts the network.
//
// Supported: CSV, JSON, TXT / LOG. PDF returns MANUAL_REQUIRED (pdf.js not
// bundled in this module — add via dynamic import later if desired).

type EntityType =
  | "WALLET"
  | "TX_HASH"
  | "HANDLE"
  | "URL"
  | "DOMAIN"
  | "ALIAS"
  | "EMAIL"
  | "IP"
  | "CONTRACT"
  | "OTHER";

type ParsedEntity = {
  type: EntityType;
  value: string;
  confidence: number;
  extractionMethod: string;
};

type WorkerResult = {
  parseStatus: "PARSED" | "PARTIAL" | "MANUAL_REQUIRED" | "FAILED";
  entities: ParsedEntity[];
  entitiesFound: number;
  parseMode?: string;
  error?: string;
};

// Worker global — avoid lib.webworker import to keep tsconfig untouched
const _self = self as unknown as {
  onmessage: ((e: MessageEvent<{ file: File }>) => unknown) | null;
  postMessage: (msg: unknown) => void;
};

_self.onmessage = async (e: MessageEvent<{ file: File }>) => {
  try {
    const result = await parseFile(e.data.file);
    _self.postMessage(result);
  } catch (err) {
    const result: WorkerResult = {
      parseStatus: "FAILED",
      entities: [],
      entitiesFound: 0,
      error: String(err),
    };
    _self.postMessage(result);
  }
};

async function parseFile(file: File): Promise<WorkerResult> {
  const mime = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "text/csv" || ext === "csv") return parseCsv(file);
  if (mime === "application/json" || ext === "json") return parseJson(file);
  if (
    mime === "text/plain" ||
    ext === "txt" ||
    ext === "log" ||
    ext === "md"
  ) {
    return parseTxt(file);
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return {
      parseStatus: "MANUAL_REQUIRED",
      entities: [],
      entitiesFound: 0,
      parseMode: "pdf-unavailable",
    };
  }
  return {
    parseStatus: "MANUAL_REQUIRED",
    entities: [],
    entitiesFound: 0,
    parseMode: "unsupported",
  };
}

// ── Regex suite ─────────────────────────────────────────────────────────────

const RE = {
  eth: /0x[a-fA-F0-9]{40}\b/g,
  sol: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
  ethTx: /0x[a-fA-F0-9]{64}\b/g,
  twitter: /(?:^|[^a-zA-Z0-9_])@([A-Za-z0-9_]{1,50})/g,
  telegram: /t\.me\/([a-zA-Z0-9_]{3,50})/g,
  url: /\bhttps?:\/\/[^\s<>"')]+/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  domain: /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi,
};

function extractFromText(text: string): ParsedEntity[] {
  const out: ParsedEntity[] = [];
  const conf = 0.7;
  const m = "regex";

  for (const match of text.matchAll(RE.ethTx)) {
    out.push({ type: "TX_HASH", value: match[0], confidence: conf, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.eth)) {
    out.push({ type: "WALLET", value: match[0].toLowerCase(), confidence: conf, extractionMethod: m });
  }
  // SOL: greedy — filter obvious false positives (hex-only strings already matched as eth)
  for (const match of text.matchAll(RE.sol)) {
    const v = match[0];
    if (/^0x/i.test(v)) continue;
    if (v.length < 32) continue;
    out.push({ type: "WALLET", value: v, confidence: 0.6, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.twitter)) {
    out.push({ type: "HANDLE", value: "@" + match[1], confidence: conf, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.telegram)) {
    out.push({ type: "HANDLE", value: "t.me/" + match[1], confidence: conf, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.email)) {
    out.push({ type: "EMAIL", value: match[0].toLowerCase(), confidence: conf, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.ipv4)) {
    out.push({ type: "IP", value: match[0], confidence: conf, extractionMethod: m });
  }
  for (const match of text.matchAll(RE.url)) {
    out.push({ type: "URL", value: match[0], confidence: conf, extractionMethod: m });
  }
  return dedupe(out);
}

function dedupe(entities: ParsedEntity[]): ParsedEntity[] {
  const seen = new Set<string>();
  const out: ParsedEntity[] = [];
  for (const e of entities) {
    const k = e.type + "::" + e.value;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

// ── CSV ─────────────────────────────────────────────────────────────────────

async function parseCsv(file: File): Promise<WorkerResult> {
  const text = await file.text();
  const entities = extractFromText(text);
  return {
    parseStatus: entities.length ? "PARSED" : "PARTIAL",
    entities,
    entitiesFound: entities.length,
    parseMode: "csv-naive",
  };
}

// ── JSON ────────────────────────────────────────────────────────────────────

async function parseJson(file: File): Promise<WorkerResult> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Fall back to regex over the raw text
    const entities = extractFromText(text);
    return {
      parseStatus: entities.length ? "PARTIAL" : "FAILED",
      entities,
      entitiesFound: entities.length,
      parseMode: "json-malformed",
    };
  }
  // Recurse + concatenate all string leaves, then regex
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v as object).forEach(walk);
  };
  walk(data);
  const entities = extractFromText(parts.join("\n"));
  return {
    parseStatus: entities.length ? "PARSED" : "PARTIAL",
    entities,
    entitiesFound: entities.length,
    parseMode: "json-walk",
  };
}

// ── TXT / LOG ───────────────────────────────────────────────────────────────

async function parseTxt(file: File): Promise<WorkerResult> {
  const text = await file.text();
  const entities = extractFromText(text);
  return {
    parseStatus: entities.length ? "PARSED" : "PARTIAL",
    entities,
    entitiesFound: entities.length,
    parseMode: "txt-regex",
  };
}

export {}; // ensures this is treated as a module
