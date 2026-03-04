/**
 * SSRF Guard — src/lib/security/ssrfGuard.ts
 * Bloque les URLs vers localhost/IPs privées avant que Puppeteer ne les charge.
 */

const BLOCKED_HOSTS = new Set([
  "localhost", "ip6-localhost", "ip6-loopback", "broadcasthost",
  "metadata.google.internal", "169.254.169.254",
]);

const BLOCKED_SCHEMES = new Set(["file:", "ftp:", "gopher:", "data:", "jar:"]);

const PRIVATE_RANGES: Array<{ prefix: number[]; bits: number }> = [
  { prefix: [127, 0, 0, 0], bits: 8   },  // loopback
  { prefix: [169, 254, 0, 0], bits: 16 },  // link-local / AWS metadata
  { prefix: [10, 0, 0, 0], bits: 8    },  // RFC-1918
  { prefix: [172, 16, 0, 0], bits: 12  },  // RFC-1918
  { prefix: [192, 168, 0, 0], bits: 16 },  // RFC-1918
];

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIPv4(ip: number[]): boolean {
  for (const { prefix, bits } of PRIVATE_RANGES) {
    let match = true;
    let rem = bits;
    for (let i = 0; i < 4 && rem > 0; i++) {
      const maskBits = Math.min(rem, 8);
      const mask = 0xff & (0xff << (8 - maskBits));
      if ((ip[i] & mask) !== (prefix[i] & mask)) { match = false; break; }
      rem -= maskBits;
    }
    if (match) return true;
  }
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "::1" || h.startsWith("fc") || h.startsWith("fd") ||
    h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb");
}

export interface SsrfCheckResult { blocked: boolean; reason?: string; }

export function isBlockedUrl(rawUrl: string): SsrfCheckResult {
  let parsed: URL;
  try { parsed = new URL(rawUrl); }
  catch { return { blocked: true, reason: "invalid_url" }; }

  if (BLOCKED_SCHEMES.has(parsed.protocol))
    return { blocked: true, reason: `blocked_scheme:${parsed.protocol}` };

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host))
    return { blocked: true, reason: `blocked_host:${host}` };

  const ipv4 = parseIPv4(host);
  if (ipv4 && isPrivateIPv4(ipv4))
    return { blocked: true, reason: `private_ipv4:${host}` };

  if (isPrivateIPv6(host))
    return { blocked: true, reason: `private_ipv6:${host}` };

  return { blocked: false };
}

/** Handler Puppeteer — usage:
 *   await page.setRequestInterception(true);
 *   page.on("request", puppeteerSsrfGuard);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function puppeteerSsrfGuard(request: any): void {
  const result = isBlockedUrl(request.url() as string);
  if (result.blocked) {
    console.warn(`[SSRF-GUARD] Blocked: ${request.url()} — ${result.reason}`);
    Promise.resolve(request.abort("blockedbyclient")).catch(() => null);
  } else {
    Promise.resolve(request.continue()).catch(() => null);
  }
}
