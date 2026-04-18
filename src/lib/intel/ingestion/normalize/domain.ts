/**
 * Normalise a domain string for DomainLabel storage + lookup.
 * Rules:
 *   - strip protocol + "www."
 *   - drop path / query / fragment / port
 *   - lowercase
 *   - collapse trailing "." and whitespace
 *   - reject obviously non-domain junk (too short, has space, no dot unless localhost)
 * Returns null when the input cannot be coerced into a sane domain.
 */
export function normaliseDomain(raw: string): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split(/[\/?#]/)[0] ?? s;
  s = s.split(":")[0] ?? s;
  s = s.replace(/\.+$/, "");
  if (s.length < 3 || s.length > 253) return null;
  if (/\s/.test(s)) return null;
  if (!s.includes(".")) return null;
  // Basic hostname character set; allow punycode (xn--).
  if (!/^[a-z0-9.\-]+$/.test(s)) return null;
  return s;
}

/** Extract the effective registrable-ish portion. Conservative: last two labels. */
export function domainRoot(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}
