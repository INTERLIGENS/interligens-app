#!/usr/bin/env python3
"""
PATCH P0.2-A — Intel Vault branchement sur /api/scan
- src/lib/vault/vaultLookup.ts
- src/lib/vault/scanRateLimit.ts
- src/lib/vault/auditScan.ts
- Patch approve route (rebuild cache)
Idempotent.
"""
import os, glob

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

FILES = {}

# ─── vaultLookup.ts ────────────────────────────────────────────────────────────
FILES["src/lib/vault/vaultLookup.ts"] = '''\
// src/lib/vault/vaultLookup.ts
import { prisma } from "@/lib/prisma";

export type VaultSeverity = "info" | "warn" | "danger";
export type VaultConfidence = "low" | "medium" | "high";

export interface VaultResult {
  match: boolean;
  categories: string[];
  topLabel?: string;
  confidence?: VaultConfidence;
  severity?: VaultSeverity;
}

const DANGER_TYPES = new Set(["scam","phishing","drainer","exploiter","sanction"]);
const WARN_TYPES   = new Set(["insider","kol","cluster_member","incident_related"]);

function severityFor(categories: string[]): VaultSeverity {
  if (categories.some(c => DANGER_TYPES.has(c))) return "danger";
  if (categories.some(c => WARN_TYPES.has(c)))   return "warn";
  return "info";
}

function topLabelFor(categories: string[]): string | undefined {
  for (const t of ["scam","phishing","drainer","exploiter","sanction","insider","kol","cluster_member","incident_related","whale","airdrop_target","other"]) {
    if (categories.includes(t)) return t;
  }
  return categories[0];
}

function confidenceFrom(labels: Array<{ confidence: string }>): VaultConfidence {
  if (labels.some(l => l.confidence === "high"))   return "high";
  if (labels.some(l => l.confidence === "medium")) return "medium";
  return "low";
}

export async function vaultLookup(chain: string, address: string): Promise<VaultResult> {
  const normChain   = chain.trim().toLowerCase();
  const normAddress = address.trim();

  // Fast-path: cache
  try {
    const cached = await prisma.riskSummaryCache.findUnique({
      where: { chain_address: { chain: normChain, address: normAddress } },
    });
    if (cached) {
      const parsed = JSON.parse(cached.summary) as VaultResult;
      return parsed;
    }
  } catch {}

  // Fallback: direct lookup
  const labels = await prisma.addressLabel.findMany({
    where: { chain: normChain, address: normAddress },
    take: 20,
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return { match: false, categories: [] };
  }

  const categories = [...new Set(labels.map(l => l.labelType))];
  const confidence = confidenceFrom(labels);
  const severity   = severityFor(categories);
  const topLabel   = topLabelFor(categories);

  const result: VaultResult = { match: true, categories, topLabel, confidence, severity };

  // Write cache
  try {
    await prisma.riskSummaryCache.upsert({
      where: { chain_address: { chain: normChain, address: normAddress } },
      create: { chain: normChain, address: normAddress, summary: JSON.stringify(result) },
      update: { summary: JSON.stringify(result) },
    });
  } catch {}

  return result;
}

/** Rebuild cache for a list of addresses after approve */
export async function rebuildCacheForAddresses(
  entries: Array<{ chain: string; address: string }>
): Promise<void> {
  const seen = new Set<string>();
  for (const { chain, address } of entries) {
    const key = `${chain}:${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Delete stale cache — vaultLookup will rebuild on next call
    try {
      await prisma.riskSummaryCache.deleteMany({
        where: { chain: chain.toLowerCase(), address: address.trim() },
      });
    } catch {}
  }
}
'''

# ─── scanRateLimit.ts ──────────────────────────────────────────────────────────
FILES["src/lib/vault/scanRateLimit.ts"] = '''\
// src/lib/vault/scanRateLimit.ts
// Simple in-memory rate limiter. Best-effort on Vercel (stateless).
// For prod: swap store with Upstash Redis.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const SCAN_LIMIT    = parseInt(process.env.SCAN_RATE_LIMIT    ?? "60");
const EXPLAIN_LIMIT = parseInt(process.env.EXPLAIN_RATE_LIMIT ?? "30");
const WINDOW_MS     = parseInt(process.env.RATE_WINDOW_MS     ?? "300000"); // 5 min

function check(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const win = store.get(key);

  if (!win || now > win.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (win.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  win.count++;
  return { allowed: true, remaining: limit - win.count };
}

export function checkScanLimit(ip: string)    { return check(`scan:${ip}`,    SCAN_LIMIT); }
export function checkExplainLimit(ip: string) { return check(`explain:${ip}`, EXPLAIN_LIMIT); }
'''

# ─── auditScan.ts ──────────────────────────────────────────────────────────────
FILES["src/lib/vault/auditScan.ts"] = '''\
// src/lib/vault/auditScan.ts
// Hash address before logging — never store in clear text.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function hashAddress(address: string): string {
  const salt = process.env.VAULT_AUDIT_SALT ?? "interligens_default_salt";
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
'''

# ─── index.ts ──────────────────────────────────────────────────────────────────
FILES["src/lib/vault/index.ts"] = '''\
export * from "./vaultLookup";
export * from "./scanRateLimit";
export * from "./auditScan";
'''

def write_file(rel_path: str, content: str):
    abs_path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if os.path.exists(abs_path):
        with open(abs_path, "r") as f:
            if f.read().strip() == content.strip():
                print(f"✅ {rel_path} — déjà à jour, skip.")
                return
    with open(abs_path, "w") as f:
        f.write(content)
    print(f"✅ {rel_path} — écrit.")

def patch_approve_route():
    """Patch the approve route to rebuild cache after merge."""
    candidates = [
        "src/app/api/admin/batches/[id]/approve/route.ts",
    ]
    for rel in candidates:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, "r") as f:
            content = f.read()
        if "rebuildCacheForAddresses" in content:
            print(f"✅ {rel} — rebuild cache déjà présent, skip.")
            return
        # Add import
        content = content.replace(
            'import { upsertRows } from "@/lib/intel-vault/dedup";',
            'import { upsertRows } from "@/lib/intel-vault/dedup";\nimport { rebuildCacheForAddresses } from "@/lib/vault/vaultLookup";'
        )
        # Add rebuild call after upsertRows
        content = content.replace(
            'const { created, updated } = await upsertRows(rows, params.id);',
            'const { created, updated } = await upsertRows(rows, params.id);\n\n  // Rebuild vault cache for affected addresses\n  await rebuildCacheForAddresses(rows.map(r => ({ chain: r.chain, address: r.address })));'
        )
        with open(path, "w") as f:
            f.write(content)
        print(f"✅ {rel} — rebuild cache ajouté.")
        return
    print("⚠️  approve/route.ts introuvable — skip rebuild patch.")

def patch():
    for path, content in FILES.items():
        write_file(path, content)
    patch_approve_route()
    print("\n✅ Patch P0.2-A terminé.")
    print("   Modules créés:")
    print("     src/lib/vault/vaultLookup.ts")
    print("     src/lib/vault/scanRateLimit.ts")
    print("     src/lib/vault/auditScan.ts")

patch()
