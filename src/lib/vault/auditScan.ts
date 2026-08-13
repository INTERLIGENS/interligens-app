// src/lib/vault/auditScan.ts
// Hash address before logging — never store in clear text.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSalt } from "@/lib/config/requireSalt";

function hashAddress(address: string): string {
  // Le repli littéral "interligens_default_salt" est retiré : il vivait dans le
  // dépôt, donc publiquement. Une adresse auditée hachée avec lui se ré-identifie
  // par simple table. requireSalt lève ici, à l'usage — pas à l'import.
  const salt = requireSalt("VAULT_AUDIT_SALT");
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
