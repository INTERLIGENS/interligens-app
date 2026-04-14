/**
 * Server-side session fingerprint builder.
 *
 * Produces an opaque string tying together the client IP, a truncated
 * user-agent, and a timestamp. Used only for audit-trail purposes — never
 * returned to the client, never used for authentication.
 *
 * Works with both NextRequest and standard Request (Headers-based).
 */

type ReqLike = Request | { headers: Headers };

export function buildFingerprint(req: ReqLike): string {
  const h = (req as { headers: Headers }).headers;
  const xff = h.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0]?.trim() : null) ?? h.get("x-real-ip") ?? "unknown";
  const ua = (h.get("user-agent") ?? "unknown").slice(0, 50);
  const timestamp = new Date().toISOString();
  return `${ip}|${ua}|${timestamp}`;
}
