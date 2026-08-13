/**
 * RFC 3161 timestamping via the OpenSSL `ts` CLI (real, third-party verifiable).
 * Sends the HASH only (never the file). Stores the full TSR + the CERT CHAIN
 * captured at stamping time so verification stays possible OFFLINE, forever,
 * even after the TSA certs expire or the authority goes away.
 *
 * URLs are CONFIGURABLE (no hard-coded authority). Routing by criticality:
 *   P0  → TSA_URL_PRIMARY (commercial), fallback TSA_URL_FALLBACK
 *   else→ TSA_URL_FALLBACK directly
 * ⚠️ Commercial free endpoints (DigiCert/Sectigo) are code-signing-scoped and
 * rate-limited (Sectigo asks ≥15s between scripted calls) — honour
 * TSA_COMMERCIAL_MIN_DELAY_MS; for guaranteed forensic use a PAID/eIDAS TSA is
 * required. Fallback authority tested GRANTED 2026-07-30: freetsa.org.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { envInt } from "@/lib/config/envNumber";

const pexec = promisify(execFile);

export interface TsaResult {
  token: Buffer;        // full RFC3161 response (TSR)
  genTime: Date;        // parsed timestamp
  provider: string;     // authority host
  certChainPem: string; // embedded signer/intermediates + fetched root CA (for offline verify)
}

function providerFromUrl(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "tsa-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function buildTsq(sha256hex: string): Promise<Buffer> {
  return withTmp(async (dir) => {
    const out = join(dir, "req.tsq");
    await pexec("openssl", ["ts", "-query", "-digest", sha256hex, "-sha256", "-cert", "-out", out]);
    return readFile(out);
  });
}

/**
 * Capture the verification material for long-term / offline validation:
 * the certs embedded in the token (signer + intermediates) plus the root CA
 * fetched from caUrl (the token does not embed the root). Concatenated PEM.
 */
export async function captureCertChain(tsr: Buffer, caUrl?: string): Promise<string> {
  const embedded = await withTmp(async (dir) => {
    const tsrF = join(dir, "resp.tsr");
    const tokF = join(dir, "token.der");
    const pemF = join(dir, "embedded.pem");
    await writeFile(tsrF, tsr);
    await pexec("openssl", ["ts", "-reply", "-in", tsrF, "-token_out", "-out", tokF]);
    await pexec("openssl", ["pkcs7", "-inform", "DER", "-in", tokF, "-print_certs", "-out", pemF]);
    return readFile(pemF, "utf8");
  });
  let ca = "";
  if (caUrl) {
    try {
      const res = await fetch(caUrl);
      if (res.ok) ca = await res.text();
      else console.warn(`[evidence-tsa] CA fetch ${caUrl} → HTTP ${res.status} (chaîne sans racine)`);
    } catch (e) {
      console.warn(`[evidence-tsa] CA fetch ${caUrl} échoué (${e instanceof Error ? e.message : e}) — chaîne sans racine`);
    }
  }
  // Keep only PEM certificate blocks.
  const certs = (embedded + "\n" + ca).match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
  return certs.join("\n") + "\n";
}

export async function requestTimestampOnce(
  sha256hex: string, tsaUrl: string, opts: { caUrl?: string; timeoutMs?: number } = {},
): Promise<TsaResult> {
  const tsq = await buildTsq(sha256hex);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000);
  let tsr: Buffer;
  try {
    const res = await fetch(tsaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body: new Uint8Array(tsq),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`TSA HTTP ${res.status}`);
    tsr = Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
  const genTime = await withTmp(async (dir) => {
    const f = join(dir, "resp.tsr");
    await writeFile(f, tsr);
    const { stdout } = await pexec("openssl", ["ts", "-reply", "-in", f, "-text"]);
    if (!/Status:\s*Granted/i.test(stdout)) throw new Error("TSA status not granted");
    const m = stdout.match(/Time stamp:\s*(.+)/i);
    if (!m) throw new Error("TSA reply missing Time stamp");
    const d = new Date(m[1].trim());
    if (isNaN(d.getTime())) throw new Error("TSA reply unparseable Time stamp");
    return d;
  });
  const certChainPem = await captureCertChain(tsr, opts.caUrl);
  return { token: tsr, genTime, provider: providerFromUrl(tsaUrl), certChainPem };
}

export async function requestTimestampWithRetry(
  sha256hex: string,
  opts: { tsaUrl?: string; caUrl?: string; retries?: number; backoffMs?: number[]; timeoutMs?: number } = {},
): Promise<TsaResult | null> {
  const tsaUrl = opts.tsaUrl ?? process.env.TSA_URL;
  if (!tsaUrl) {
    console.warn("[evidence-tsa] aucune TSA configurée — horodatage sauté (tsaToken null).");
    return null;
  }
  const backoff = opts.backoffMs ?? [1000, 3000, 8000];
  const attempts = (opts.retries ?? backoff.length) + 1;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await requestTimestampOnce(sha256hex, tsaUrl, { caUrl: opts.caUrl, timeoutMs: opts.timeoutMs });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i < attempts) {
        const wait = backoff[i - 1] ?? backoff[backoff.length - 1];
        console.warn(`[evidence-tsa] ${tsaUrl} tentative ${i}/${attempts} (${msg}) — retry ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.error(`[evidence-tsa] ${tsaUrl} indisponible après ${attempts} tentatives (${msg}).`);
      }
    }
  }
  return null;
}

// ─── Routing by criticality ──────────────────────────────────────────────────

export interface TsaEndpoint { url: string; caUrl?: string }
export interface TsaRouting { primary: TsaEndpoint | null; fallback: TsaEndpoint | null; commercialMinDelayMs: number }

export function tsaRoutingFromEnv(): TsaRouting {
  const primary = process.env.TSA_URL_PRIMARY
    ? { url: process.env.TSA_URL_PRIMARY, caUrl: process.env.TSA_CA_URL_PRIMARY } : null;
  const fallback = process.env.TSA_URL_FALLBACK
    ? { url: process.env.TSA_URL_FALLBACK, caUrl: process.env.TSA_CA_URL_FALLBACK }
    : (process.env.TSA_URL ? { url: process.env.TSA_URL, caUrl: process.env.TSA_CA_URL } : null);
  // Non fini -> 15000. Ce délai espace les appels au TSA commercial (payant) :
  // en NaN, le `sleep(NaN)` ne temporise plus et les requêtes partent en rafale.
  const commercialMinDelayMs = envInt("TSA_COMMERCIAL_MIN_DELAY_MS", 15000);
  return { primary, fallback, commercialMinDelayMs };
}

export type Criticality = "P0" | "OTHER";

export interface RoutedTsa { result: TsaResult; tsaUsed: "primary" | "fallback"; url: string }

/**
 * P0 → primary (commercial) then fallback; else fallback only. Logs which TSA
 * served. Honours the commercial min-delay before hitting the primary.
 */
export async function timestampWithRouting(
  sha256hex: string,
  opts: { criticality: Criticality; routing?: TsaRouting; retries?: number },
): Promise<RoutedTsa | null> {
  const r = opts.routing ?? tsaRoutingFromEnv();
  const order: Array<{ ep: TsaEndpoint; kind: "primary" | "fallback"; commercial: boolean }> = [];
  if (opts.criticality === "P0" && r.primary) order.push({ ep: r.primary, kind: "primary", commercial: true });
  if (r.fallback) order.push({ ep: r.fallback, kind: "fallback", commercial: false });
  if (order.length === 0) {
    console.warn("[evidence-tsa] aucune TSA routée (primary/fallback non configurés).");
    return null;
  }
  for (const step of order) {
    if (step.commercial && r.commercialMinDelayMs > 0) {
      await new Promise((res) => setTimeout(res, r.commercialMinDelayMs)); // anti-hammer (Sectigo ≥15s)
    }
    const result = await requestTimestampWithRetry(sha256hex, { tsaUrl: step.ep.url, caUrl: step.ep.caUrl, retries: opts.retries });
    if (result) {
      console.log(`[evidence-tsa] horodaté via ${step.kind} (${result.provider})`);
      return { result, tsaUsed: step.kind, url: step.ep.url };
    }
    console.warn(`[evidence-tsa] ${step.kind} (${step.ep.url}) échec — bascule.`);
  }
  return null;
}

// ─── Verification ────────────────────────────────────────────────────────────

/** OFFLINE verify: uses ONLY the token + the archived cert chain. No network. */
export async function verifyTimestampOffline(
  sha256hex: string, token: Buffer, certChainPem: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!certChainPem || !/BEGIN CERTIFICATE/.test(certChainPem)) return { ok: false, detail: "no archived cert chain" };
  return withTmp(async (dir) => {
    const tsrF = join(dir, "resp.tsr");
    const caF = join(dir, "chain.pem");
    await writeFile(tsrF, token);
    await writeFile(caF, certChainPem);
    try {
      const { stdout, stderr } = await pexec("openssl", ["ts", "-verify", "-digest", sha256hex, "-in", tsrF, "-CAfile", caF]);
      const out = stdout + stderr;
      return { ok: /Verification:\s*OK/i.test(out), detail: (out.trim().split("\n").pop() ?? "").trim() };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = (err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "");
      return { ok: false, detail: (out.trim().split("\n").pop() ?? "verify failed").trim() };
    }
  });
}

/** Online verify against an external CA file (kept for ad-hoc use). */
export async function verifyTimestamp(
  sha256hex: string, token: Buffer, opts: { caFile?: string } = {},
): Promise<{ ok: boolean; detail: string }> {
  const caFile = opts.caFile ?? process.env.TSA_CA_FILE;
  if (!caFile) return { ok: false, detail: "no CA file (TSA_CA_FILE)" };
  const chain = await readFile(caFile, "utf8");
  return verifyTimestampOffline(sha256hex, token, chain);
}
