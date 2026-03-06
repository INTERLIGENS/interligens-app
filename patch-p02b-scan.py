#!/usr/bin/env python3
"""
PATCH P0.2-B — Branchement /api/scan + tests
1. Détecte la route /api/scan existante
2. Injecte vaultLookup + rate limit + audit
3. Crée les tests P0.2
Idempotent.
"""
import os, glob, json

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

# ─── Detect scan route ────────────────────────────────────────────────────────
def find_scan_route():
    candidates = [
        "src/app/api/scan/route.ts",
        "src/app/api/scan/[chain]/route.ts",
        "src/pages/api/scan.ts",
    ]
    for c in candidates:
        p = os.path.join(ROOT, c)
        if os.path.exists(p):
            return p, c
    # Broader search
    results = glob.glob(os.path.join(ROOT, "src/**/*scan*route*"), recursive=True)
    results += glob.glob(os.path.join(ROOT, "src/**/*scan*"), recursive=True)
    for r in results:
        if "route.ts" in r and "explain" not in r and "test" not in r:
            return r, r.replace(ROOT + "/", "")
    return None, None

# ─── Vault injection snippet ──────────────────────────────────────────────────
VAULT_IMPORTS = '''\
import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";
import { requireAdmin } from "@/lib/intel-vault/auth";
'''

VAULT_RATE_LIMIT_SNIPPET = '''\
  // ── Intel Vault: anti-enumeration rate limit ────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkScanLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
'''

VAULT_LOOKUP_SNIPPET = '''\
  // ── Intel Vault lookup ───────────────────────────────────────────────────────
  const vaultResult = await vaultLookup(chain, address);
  const isAdmin = requireAdmin(req) === null;
  await auditScanLookup({
    address,
    chain,
    match: vaultResult.match,
    categoriesCount: vaultResult.categories.length,
  });
  const intelVault = {
    match: vaultResult.match,
    categories: vaultResult.categories,
    ...(vaultResult.topLabel   ? { topLabel:   vaultResult.topLabel   } : {}),
    ...(vaultResult.confidence ? { confidence: vaultResult.confidence } : {}),
    ...(vaultResult.severity   ? { severity:   vaultResult.severity   } : {}),
    explainAvailable: vaultResult.match && isAdmin,
  };
'''

# ─── Tests ─────────────────────────────────────────────────────────────────────
TESTS = '''\
// src/lib/vault/__tests__/vaultLookup.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    riskSummaryCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    addressLabel: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { vaultLookup } from "../vaultLookup";
import { prisma } from "@/lib/prisma";

const KENT_LABEL = {
  chain: "ethereum",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  labelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  confidence: "low",
  sourceName: "wearekent_",
  sourceUrl: null,
  evidence: "eth=1.5",
  entityName: null,
  visibility: "internal_only",
};

describe("vaultLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne match=false si aucun label", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await vaultLookup("ethereum", "0x000000000000000000000000000000000000dead");
    expect(result.match).toBe(false);
    expect(result.categories).toHaveLength(0);
  });

  it("retourne match=true avec categories pour adresse connue", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([KENT_LABEL]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.match).toBe(true);
    expect(result.categories).toContain("airdrop_target");
  });

  it("severity=info pour airdrop_target", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([KENT_LABEL]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.severity).toBe("info");
  });

  it("severity=danger pour scam", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...KENT_LABEL, labelType: "scam", confidence: "high" }
    ]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.severity).toBe("danger");
    expect(result.confidence).toBe("high");
  });

  it("utilise le cache si disponible", async () => {
    const cached = { match: true, categories: ["whale"], severity: "info", confidence: "medium" };
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      summary: JSON.stringify(cached),
    });
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.match).toBe(true);
    expect(prisma.addressLabel.findMany).not.toHaveBeenCalled();
  });

  it("ne retourne jamais entityName", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...KENT_LABEL, entityName: "SECRET_ENTITY" }
    ]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(JSON.stringify(result)).not.toContain("SECRET_ENTITY");
    expect(JSON.stringify(result)).not.toContain("entityName");
  });
});
'''

RATE_LIMIT_TESTS = '''\
// src/lib/vault/__tests__/scanRateLimit.test.ts
import { describe, it, expect, beforeEach } from "vitest";

// Reset module between tests to clear in-memory store
describe("scanRateLimit", () => {
  it("permet les premières requêtes", async () => {
    const { checkScanLimit } = await import("../scanRateLimit");
    const result = checkScanLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("bloque après dépassement du seuil", async () => {
    vi.resetModules();
    // Mock ENV to low limit
    process.env.SCAN_RATE_LIMIT = "3";
    process.env.RATE_WINDOW_MS = "60000";
    const { checkScanLimit } = await import("../scanRateLimit");
    const ip = "5.5.5.5";
    checkScanLimit(ip); // 1
    checkScanLimit(ip); // 2
    checkScanLimit(ip); // 3
    const result = checkScanLimit(ip); // 4 -> blocked
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    delete process.env.SCAN_RATE_LIMIT;
    delete process.env.RATE_WINDOW_MS;
  });
});
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

def patch_scan_route():
    scan_path, scan_rel = find_scan_route()
    if not scan_path:
        print("⚠️  Route /api/scan introuvable — liste des fichiers scan détectés:")
        for f in glob.glob(os.path.join(ROOT, "src/**/*scan*"), recursive=True):
            print(f"   {f.replace(ROOT+'/', '')}")
        print("\n   → Indique le chemin exact de ta route /api/scan pour le patch suivant.")
        return

    with open(scan_path, "r") as f:
        content = f.read()

    print(f"✅ Route scan trouvée: {scan_rel}")

    if "vaultLookup" in content:
        print(f"✅ {scan_rel} — vaultLookup déjà branché, skip.")
        return

    print(f"\n📄 Contenu actuel de {scan_rel} (50 premières lignes):")
    lines = content.split("\n")[:50]
    for i, l in enumerate(lines, 1):
        print(f"  {i:3}: {l}")

    print(f"\n⚠️  La route /api/scan nécessite un patch manuel.")
    print("   Voici les snippets à injecter:\n")
    print("── IMPORTS (ajouter en haut du fichier) ──")
    print(VAULT_IMPORTS)
    print("── RATE LIMIT (ajouter au début du handler GET/POST) ──")
    print(VAULT_RATE_LIMIT_SNIPPET)
    print("── VAULT LOOKUP (ajouter avant le return, après avoir chain+address) ──")
    print(VAULT_LOOKUP_SNIPPET)
    print("── DANS LE RETURN JSON (ajouter le champ) ──")
    print("   intelVault,")

def patch():
    write_file("src/lib/vault/__tests__/vaultLookup.test.ts", TESTS)
    write_file("src/lib/vault/__tests__/scanRateLimit.test.ts", RATE_LIMIT_TESTS)
    patch_scan_route()
    print("\n✅ Patch P0.2-B terminé.")
    print("   Tests créés:")
    print("     src/lib/vault/__tests__/vaultLookup.test.ts (6 tests)")
    print("     src/lib/vault/__tests__/scanRateLimit.test.ts (2 tests)")

patch()
