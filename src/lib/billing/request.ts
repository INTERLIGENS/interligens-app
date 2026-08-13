import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { requireSalt } from "@/lib/config/requireSalt";

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
  // Le repli littéral "interligens" est retiré. Ici le sel préfixe un SHA-256 nu
  // (pas un HMAC) : sel connu = hachage cassé encore plus vite, sur des IP de
  // clients payants. requireSalt lève ici, à l'usage — pas à l'import.
  const salt = requireSalt("IP_HASH_SALT");
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
