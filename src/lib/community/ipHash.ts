
import { createHmac } from "crypto";
import { requireSalt } from "@/lib/config/requireSalt";

export function hashIp(ip: string): string {
  // Le repli littéral "default-salt" est retiré : l'espace des IPv4 fait 2^32,
  // une table complète se calcule en minutes dès que la clé du HMAC est connue.
  // requireSalt lève ici, à l'usage — pas à l'import.
  const salt = requireSalt("VAULT_AUDIT_SALT");
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export function getClientIp(req: Request): string {
  const h = (req.headers as any);
  return h.get?.("x-forwarded-for")?.split(",")[0]?.trim()
    ?? h.get?.("x-real-ip")
    ?? "unknown";
}
