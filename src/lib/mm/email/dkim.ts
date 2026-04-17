// Basic DKIM / email-domain verification for the MM challenge workflow.
// Phase 1 scope: extract and validate the domain of the challenger email,
// confirm it belongs to the registered entity, and attempt a lightweight MX
// lookup to ensure the domain is real. Full DKIM signature verification
// (DNS TXT lookup + RSA signature validation) is not implemented here: it
// belongs in a separate server-side mail processor that parses MIME headers
// from a dedicated inbound address. This module produces a deterministic
// pre-check suitable for the POST /challenge endpoint.

import { promises as dns } from "node:dns";

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})$/;

export interface DkimPrecheckResult {
  ok: boolean;
  reason?: string;
  emailDomain?: string;
}

export function extractEmailDomain(email: string): string | null {
  const match = EMAIL_RE.exec(email.trim().toLowerCase());
  return match ? match[1] : null;
}

export function domainMatchesEntity(
  emailDomain: string,
  officialDomains: string[],
): boolean {
  const ed = emailDomain.toLowerCase();
  return officialDomains.some((d) => {
    const candidate = d.trim().toLowerCase();
    if (!candidate) return false;
    return ed === candidate || ed.endsWith(`.${candidate}`);
  });
}

export async function checkDomainResolvable(domain: string): Promise<boolean> {
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    try {
      const a = await dns.resolve4(domain);
      return a.length > 0;
    } catch {
      return false;
    }
  }
}

export interface DkimPrecheckInput {
  email: string;
  officialDomains: string[];
  skipDns?: boolean;
}

export async function dkimPrecheck(input: DkimPrecheckInput): Promise<DkimPrecheckResult> {
  const domain = extractEmailDomain(input.email);
  if (!domain) return { ok: false, reason: "invalid_email" };
  if (input.officialDomains.length === 0) {
    return { ok: false, reason: "no_official_domain_registered", emailDomain: domain };
  }
  if (!domainMatchesEntity(domain, input.officialDomains)) {
    return { ok: false, reason: "domain_does_not_match_entity", emailDomain: domain };
  }
  if (input.skipDns) return { ok: true, emailDomain: domain };
  const resolvable = await checkDomainResolvable(domain);
  if (!resolvable) return { ok: false, reason: "domain_not_resolvable", emailDomain: domain };
  return { ok: true, emailDomain: domain };
}
