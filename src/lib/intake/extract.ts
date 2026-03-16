import { extractAddresses } from "@/lib/ingest/extractAddresses";

export type ParserUsed = "csv" | "json" | "pdf_text" | "text" | "sheet_csv" | "unknown";

export interface ExtractedAddress { chain: string; address: string; occurrences?: number; evidence?: string; }
export interface ExtractedHandle  { handle: string; platform?: string; occurrences?: number; }
export interface ExtractedDomain  { domain: string; occurrences?: number; }

export interface ExtractResult {
  parserUsed: ParserUsed;
  rawText?: string;
  rawTextTruncated: boolean;
  extracted: {
    addresses: ExtractedAddress[];
    handles:   ExtractedHandle[];
    domains:   ExtractedDomain[];
    txHashes:  string[];
  };
  warnings: string[];
}

const MAX_TEXT_LEN        = 200_000;
const MAX_RAW_STORE       = 50_000;
const MAX_FILE_BYTES      = 10 * 1024 * 1024;
const MAX_RESPONSE_BYTES  = 5  * 1024 * 1024;
const FETCH_TIMEOUT_MS    = 15_000;

const RAW_GITHUB   = /^https:\/\/raw\.githubusercontent\.com\//;
const DIRECT_EXT   = /\.(csv|json|txt)(\?.*)?$/i;
const GOOGLE_SHEET = /^https:\/\/docs\.google\.com\/spreadsheets\//;
const GITHUB_BLOB  = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;

// Handle: strict — min 3 chars, no email, no url context
const HANDLE_RE    = /(?<![a-zA-Z0-9._@])@([a-zA-Z0-9_]{3,50})(?![.\w@])/g;
const EMAIL_RE     = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DOMAIN_RE    = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|xyz|app|finance|exchange|co|dev|tech|pro|info)\b/gi;
const EVM_TX_RE    = /\b0x[a-fA-F0-9]{64}\b/g;
const SOL_SIG_RE   = /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g;

function mkIntakeError(msg: string, code: string, status: number): Error {
  return Object.assign(new Error(msg), { code, status });
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_RAW_STORE) return { text, truncated: false };
  return { text: text.slice(0, MAX_RAW_STORE), truncated: true };
}

function extractHandles(text: string): ExtractedHandle[] {
  // strip URLs to avoid @user inside them
  const clean = text.replace(/https?:\/\/\S+/g, " ");
  // collect emails to exclude
  const emails = new Set<string>();
  for (const m of clean.matchAll(EMAIL_RE)) emails.add(m[0]);

  const seen = new Map<string, number>();
  for (const m of clean.matchAll(HANDLE_RE)) {
    const raw = m[1];
    // skip if this looks like part of an email we found
    if ([...emails].some(e => e.includes(raw))) continue;
    const handle = "@" + raw.toLowerCase();
    seen.set(handle, (seen.get(handle) ?? 0) + 1);
  }
  return [...seen.entries()].map(([handle, occurrences]) => ({ handle, occurrences }));
}

function extractDomains(text: string): ExtractedDomain[] {
  const seen = new Map<string, number>();
  for (const m of text.matchAll(DOMAIN_RE)) {
    const domain = m[0].toLowerCase();
    seen.set(domain, (seen.get(domain) ?? 0) + 1);
  }
  return [...seen.entries()].map(([domain, occurrences]) => ({ domain, occurrences }));
}

function extractTxHashes(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(EVM_TX_RE)) seen.add(m[0]);
  for (const m of text.matchAll(SOL_SIG_RE)) seen.add(m[0]);
  return [...seen];
}

function processText(text: string, parserUsed: ParserUsed): ExtractResult {
  const warnings: string[] = [];

  if (text.length > MAX_TEXT_LEN) {
    warnings.push(`INPUT_TOO_LARGE: truncated to ${MAX_TEXT_LEN} chars`);
    text = text.slice(0, MAX_TEXT_LEN);
  }

  const { text: storedText, truncated } = truncate(text);
  const rawAddresses = extractAddresses(text);
  const addresses: ExtractedAddress[] = rawAddresses.map(a => ({ chain: a.chain, address: a.address }));
  const handles  = extractHandles(text);
  const domains  = extractDomains(text);
  const txHashes = extractTxHashes(text);

  if (handles.length > 200) warnings.push("HIGH_HANDLE_COUNT_VERIFY: >200 handles, check for false positives");

  return { parserUsed, rawText: storedText, rawTextTruncated: truncated, extracted: { addresses, handles, domains, txHashes }, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function extractFromText(text: string): Promise<ExtractResult> {
  return processText(text, "text");
}

export async function extractFromFile(
  fileBuffer: Buffer, mime: string, filename: string, sizeBytes: number,
): Promise<ExtractResult> {
  if (sizeBytes > MAX_FILE_BYTES) {
    return { parserUsed: "unknown", rawText: undefined, rawTextTruncated: false,
      extracted: { addresses: [], handles: [], domains: [], txHashes: [] },
      warnings: ["FILE_TOO_LARGE: max 10MB"] };
  }

  const lname = filename.toLowerCase();

  if (mime === "application/pdf" || lname.endsWith(".pdf")) {
    const warnings: string[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(fileBuffer);
      const text = data.text ?? "";
      if (text.length < 100 && sizeBytes > 100 * 1024)
        warnings.push("PDF_LIKELY_SCANNED_IMAGE: text <100 chars on large PDF — may need OCR");
      const result = processText(text, "pdf_text");
      result.warnings.unshift(...warnings);
      return result;
    } catch (e) {
      return { parserUsed: "pdf_text", rawText: undefined, rawTextTruncated: false,
        extracted: { addresses: [], handles: [], domains: [], txHashes: [] },
        warnings: [`PDF_PARSE_ERROR: ${(e as Error).message}`] };
    }
  }

  const text = fileBuffer.toString("utf-8");
  if (mime === "text/csv" || lname.endsWith(".csv")) return processText(text, "csv");
  if (mime === "application/json" || lname.endsWith(".json")) return processText(text, "json");
  return processText(text, "text");
}

export async function extractFromUrl(url: string): Promise<ExtractResult> {
  if (GITHUB_BLOB.test(url))
    throw mkIntakeError("Use the Raw link, not the GitHub blob URL", "URL_NOT_DIRECT_FILE", 422);

  const isSheet = GOOGLE_SHEET.test(url);
  const isRaw   = RAW_GITHUB.test(url);
  const isDirect = DIRECT_EXT.test(url.split("?")[0]);

  if (!isSheet && !isRaw && !isDirect)
    throw mkIntakeError("URL must be raw.githubusercontent.com, end in .csv/.json/.txt, or be a public Google Sheet", "URL_NOT_DIRECT_FILE", 422);

  let fetchUrl = url;
  if (isSheet) {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) throw mkIntakeError("Invalid Google Sheets URL", "URL_NOT_DIRECT_FILE", 422);
    fetchUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`;
  }

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(fetchUrl, { signal: ctrl.signal });
    clearTimeout(timer);

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/html"))
      throw mkIntakeError("URL returned HTML — no scraping allowed", "URL_RETURNS_HTML", 422);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES)
      throw mkIntakeError("URL response exceeds 5MB limit", "URL_FETCH_LIMIT", 422);

    const text = new TextDecoder().decode(buf);
    let parserUsed: ParserUsed = isSheet ? "sheet_csv" : url.match(/\.json(\?|$)/i) ? "json" : url.match(/\.csv(\?|$)/i) ? "csv" : "text";
    return processText(text, parserUsed);

  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && "status" in e) throw e;
    if (e instanceof Error && e.name === "AbortError")
      throw mkIntakeError("URL fetch timed out (15s)", "URL_FETCH_LIMIT", 422);
    throw mkIntakeError(`Fetch failed: ${(e as Error).message}`, "URL_FETCH_ERROR", 422);
  }
}
