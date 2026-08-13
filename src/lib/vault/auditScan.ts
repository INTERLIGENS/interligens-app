// src/lib/vault/auditScan.ts
// Hash address before logging — never store in clear text.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function hashAddress(address: string): string {
  // `||` et non `??` : un sel posé à la chaîne vide vaut ABSENT. Avec `??`,
  // VAULT_AUDIT_SALT="" donnait un HMAC à clé vide — les adresses auditées
  // devenaient ré-identifiables par simple table de hachage, sans aucun signal.
  // Le repli littéral est déjà public, mais il n'est pas une chaîne vide.
  const salt = process.env.VAULT_AUDIT_SALT || "interligens_default_salt";
  return crypto.createHmac("sha256", salt).update(address.toLowerCase().trim()).digest("hex").slice(0, 16);
}

export async function auditScanLookup(opts: {
  address: string;
  chain: string;
  match: boolean;
  categoriesCount: number;
  action?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action ?? "SCAN_LOOKUP",
        actorId: "public",
        meta: JSON.stringify({
          addressHash: hashAddress(opts.address),
          chain: opts.chain,
          match: opts.match,
          categoriesCount: opts.categoriesCount,
        }),
      },
    });
  } catch {
    // Non-blocking — audit failure must never break scan
  }
}
