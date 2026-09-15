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
 * Sel : OSINT_RETAIL_IP_SALT, et RIEN D'AUTRE. Absente ⇒ panne.
 *
 * ── CC-OFFLINE-217 — SÉPARATION DES AUTORITÉS DE SECRET ───────────────────
 *
 * INVARIANT : un credential d'authentification ne doit pas servir de clé de
 * pseudonymisation. Là où le coût mesuré de la continuité historique est nul,
 * la rotation d'un secret doit SUPPRIMER le couplage, pas préserver un secret
 * dérivé compromis.
 *
 * Le repli `OSINT_RETAIL_IP_SALT || ADMIN_TOKEN` est retiré. Il n'était pas un
 * littéral public — ADMIN_TOKEN est un vrai secret — mais il faisait emprunter
 * à un module de pseudonymisation le secret d'une garde d'administration. Deux
 * conséquences, l'une théorique, l'autre actuelle :
 *
 *   1. Deux autorités sur une même valeur. Roter ADMIN_TOKEN re-cléait en
 *      silence les hachages d'IP ; et qui obtient le jeton d'administration
 *      obtient du même coup la clé de pseudonymisation.
 *   2. ADMIN_TOKEN est, à cette date, COMPROMIS et VIVANT (inventaire de
 *      rotation). Le geler sous un autre nom aurait promu une valeur fuitée au
 *      rang de clé de pseudonymisation — pour toutes les soumissions FUTURES.
 *      Un HMAC dont la clé est connue n'est plus un HMAC : l'espace IPv4 (2^32)
 *      se tabule en minutes, et l'IP redevient ré-identifiable.
 *
 * La rupture de continuité est AUTORISÉE et documentée sous le nom
 * ZERO_HISTORICAL_ROWS_AT_ROTATION : les surfaces concernées portaient 0 ligne
 * au moment de la bascule (OsintSubmission.submitter : 0 ; EvidenceItem
 * .submittedBy : 0 sur 1 107 pièces ; IntakeRecord : 0). Ce n'est donc pas une
 * migration — il n'y a rien à migrer. Ce n'est pas non plus une continuité
 * préservée : c'est une continuité qui n'avait pas de sujet.
 *
 * Le repli littéral "interligens_retail_ip_fallback_salt" avait été retiré. Sa
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
  // Sel dédié, SANS repli d'aucune forme. Absente ou vide ⇒ requireSalt lève.
  // Fail closed : un sel manquant refuse de hacher, il n'emprunte pas le secret
  // d'un autre domaine. C'est la moitié « exécutable » de l'invariant ci-dessus.
  return requireSalt("OSINT_RETAIL_IP_SALT");
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
