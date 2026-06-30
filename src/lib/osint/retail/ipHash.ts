/**
 * src/lib/osint/retail/ipHash.ts
 *
 * SPRINT C1 — Pseudonymisation de l'IP du soumetteur.
 *
 * On ne stocke JAMAIS l'IP en clair : la clé `submitter` d'une soumission retail
 * est un HMAC-SHA256 de l'IP avec un sel serveur. Cela suffit pour le rate-limit
 * (compter les soumissions d'une même origine) et l'audit, sans conserver de
 * donnée personnelle directement ré-identifiante.
 *
 * Sel : OSINT_RETAIL_IP_SALT si présent, sinon ADMIN_TOKEN (toujours défini en
 * prod), sinon un fallback constant — dans ce dernier cas le hash reste stable
 * mais moins résistant ; on log un avertissement une seule fois.
 */

import { createHmac } from "crypto";

let _warned = false;

function ipSalt(): string {
  const explicit = process.env.OSINT_RETAIL_IP_SALT;
  if (explicit) return explicit;
  const admin = process.env.ADMIN_TOKEN;
  if (admin) return admin;
  if (!_warned) {
    console.warn("[osint/retail] OSINT_RETAIL_IP_SALT and ADMIN_TOKEN unset — using weak fallback salt for IP hashing.");
    _warned = true;
  }
  return "interligens_retail_ip_fallback_salt";
}

/**
 * Extrait l'IP cliente d'une requête derrière proxy (Vercel) : on prend la
 * première entrée de x-forwarded-for, sinon x-real-ip, sinon "unknown".
 */
export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** HMAC-SHA256(ip, sel) en hex. Déterministe pour une même IP et un même sel. */
export function hashIp(ip: string): string {
  return createHmac("sha256", ipSalt()).update(ip).digest("hex");
}
