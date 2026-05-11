import { createHash } from "crypto";
import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "interligens";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// RFC 5322-lite. We intentionally keep it strict-ish to keep card-testers off.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
