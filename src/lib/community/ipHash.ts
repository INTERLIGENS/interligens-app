
import { createHmac } from "crypto";

export function hashIp(ip: string): string {
  const salt = process.env.VAULT_AUDIT_SALT ?? "default-salt";
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export function getClientIp(req: Request): string {
  const h = (req.headers as any);
  return h.get?.("x-forwarded-for")?.split(",")[0]?.trim()
    ?? h.get?.("x-real-ip")
    ?? "unknown";
}
