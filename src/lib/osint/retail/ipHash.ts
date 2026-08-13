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
 * prod). Il n'y a PLUS de troisième repli.
 *
 * Le repli littéral "interligens_retail_ip_fallback_salt" a été retiré. Sa
 * documentation disait « le hash reste stable mais moins résistant » — c'est
 * trop doux. Le sel vivait dans le dépôt : le HMAC n'était plus un HMAC mais un
 * hachage nu, et l'espace IPv4 (2^32) se tabule en minutes. Les IP des
 * soumissions retail redevenaient donc ré-identifiables, ce qui est exactement
 * ce que la pseudonymisation RGPD de ce module doit empêcher.
 *
 * L'avertissement qui l'accompagnait ne rattrapait rien : `_warned` le limitait
 * à UNE occurrence par process, donc noyé dans les logs du premier démarrage et
 * jamais revu. C'est pour ce genre de dégradation muette que ce fichier est gelé
 * nommément par l'audit #46 (« compromission INVISIBLE »).
 */

import { createHmac } from "crypto";
import { requireSalt } from "@/lib/config/requireSalt";

function ipSalt(): string {
  // Chaîne vide = variable absente : on passe au repli suivant plutôt que de
  // partir avec une clé vide.
  const explicit = process.env.OSINT_RETAIL_IP_SALT;
  if (explicit && explicit.trim() !== "") return explicit;
  // Repli sur ADMIN_TOKEN — un VRAI secret, pas un littéral. S'il manque aussi,
  // requireSalt lève : un sel absent est une panne, pas une dégradation.
  return requireSalt("ADMIN_TOKEN");
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
