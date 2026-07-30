/**
 * RFC 3161 timestamping via the OpenSSL `ts` CLI (real, third-party verifiable).
 * Sends the HASH only (never the file). Stores the full TSR (contains the token).
 *
 * TSA_URL is CONFIGURABLE (no hard-coded authority). Tested authorities that
 * responded GRANTED (2026-07-30, real calls): freetsa.org, DigiCert, Sectigo.
 * freetsa is the default candidate because it publishes its CA for verification.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const pexec = promisify(execFile);

export interface TsaResult {
  token: Buffer;      // full RFC3161 response (TSR)
  genTime: Date;      // parsed timestamp
  provider: string;   // authority host
}

function providerFromUrl(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "tsa-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Build a DER TimeStampReq for a sha256 hex digest (certReq set). */
export async function buildTsq(sha256hex: string): Promise<Buffer> {
  return withTmp(async (dir) => {
    const out = join(dir, "req.tsq");
    await pexec("openssl", ["ts", "-query", "-digest", sha256hex, "-sha256", "-cert", "-out", out]);
    return readFile(out);
  });
}

/** One real request to a TSA. Throws on non-200 / non-granted. */
export async function requestTimestampOnce(sha256hex: string, tsaUrl: string, timeoutMs = 25000): Promise<TsaResult> {
  const tsq = await buildTsq(sha256hex);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
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
  // Parse status + genTime from the reply.
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
  return { token: tsr, genTime, provider: providerFromUrl(tsaUrl) };
}

/** Request with retry + backoff. Returns null if the TSA stays unreachable —
 *  ingestion proceeds with tsaToken null and a retry flag (never blocks). */
export async function requestTimestampWithRetry(
  sha256hex: string,
  opts: { tsaUrl?: string; retries?: number; backoffMs?: number[]; timeoutMs?: number } = {},
): Promise<TsaResult | null> {
  const tsaUrl = opts.tsaUrl ?? process.env.TSA_URL;
  if (!tsaUrl) {
    console.warn("[evidence-tsa] TSA_URL non configuré — horodatage sauté (tsaToken null).");
    return null;
  }
  const backoff = opts.backoffMs ?? [1000, 3000, 8000];
  const attempts = (opts.retries ?? backoff.length) + 1;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await requestTimestampOnce(sha256hex, tsaUrl, opts.timeoutMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i < attempts) {
        const wait = backoff[i - 1] ?? backoff[backoff.length - 1];
        console.warn(`[evidence-tsa] tentative ${i}/${attempts} échouée (${msg}) — retry ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.error(`[evidence-tsa] TSA indisponible après ${attempts} tentatives (${msg}) — tsaToken null, à rattraper.`);
      }
    }
  }
  return null;
}

/** Verify a stored TSR against a sha256 digest + a CA file. Returns true iff
 *  OpenSSL reports "Verification: OK". Configurable CA (TSA_CA_FILE). */
export async function verifyTimestamp(
  sha256hex: string,
  token: Buffer,
  opts: { caFile?: string; untrustedFile?: string } = {},
): Promise<{ ok: boolean; detail: string }> {
  const caFile = opts.caFile ?? process.env.TSA_CA_FILE;
  if (!caFile) return { ok: false, detail: "no CA file (TSA_CA_FILE)" };
  return withTmp(async (dir) => {
    const f = join(dir, "resp.tsr");
    await writeFile(f, token);
    const args = ["ts", "-verify", "-digest", sha256hex, "-in", f, "-CAfile", caFile];
    if (opts.untrustedFile) args.push("-untrusted", opts.untrustedFile);
    try {
      const { stdout, stderr } = await pexec("openssl", args);
      const out = stdout + stderr;
      return { ok: /Verification:\s*OK/i.test(out), detail: out.trim().split("\n").pop() ?? "" };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = (err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "");
      return { ok: false, detail: out.trim().split("\n").pop() ?? "verify failed" };
    }
  });
}
