#!/usr/bin/env python3
"""
P1 — UNIFY ADMIN AUTH
Patch script: applies all changes for the P1 unified admin auth PR.

Run from project root:
    python3 scripts/p1-unify-admin-auth.py

What it does:
  1. Creates src/lib/security/adminAuth.ts
  2. Creates src/lib/security/adminAuth.test.ts
  3. Migrates all /api/admin/* route.ts files → requireAdminApi()
  4. Removes checkAuth() / INTERLIGENS_API_TOKEN imports from admin routes
  5. Prints a summary of all changed files
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

# ─────────────────────────────────────────────────────────────────────────────
# 1.  Create src/lib/security/adminAuth.ts
# ─────────────────────────────────────────────────────────────────────────────

ADMIN_AUTH_TS = '''\
/**
 * src/lib/security/adminAuth.ts
 *
 * P1 — UNIFIED ADMIN AUTH
 * Single source of truth for all /api/admin/* route protection.
 *
 * - Token: ADMIN_TOKEN env var
 * - Header: x-admin-token
 * - Constant-time comparison (timingSafeEqual)
 * - Never throws 500 due to missing env; returns clear 401/403 JSON
 * - Compat: also accepts x-interligens-api-token for 7-day grace period (logs warning)
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// ── helpers ──────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Read the admin token from request headers.
 * Primary:  x-admin-token
 * Compat:   x-interligens-api-token (deprecated, remove after 2025-06-01)
 */
export function getAdminTokenFromReq(req: NextRequest): string | null {
  const primary = req.headers.get("x-admin-token");
  if (primary) return primary;

  const legacy = req.headers.get("x-interligens-api-token");
  if (legacy) {
    console.warn(
      "[adminAuth] DEPRECATION WARNING: x-interligens-api-token is deprecated. " +
        "Migrate to x-admin-token before 2025-06-01.",
    );
    return legacy;
  }

  return null;
}

/** Returns true if the request carries a valid admin token. */
export function isAdminApi(req: NextRequest): boolean {
  const envToken = process.env.ADMIN_TOKEN;
  if (!envToken) return false;

  const provided = getAdminTokenFromReq(req);
  if (!provided) return false;

  return safeCompare(provided, envToken);
}

/**
 * Asserts ADMIN_TOKEN is set in production.
 * Throws a descriptive Error if missing (caught → clear 500, NOT silent).
 */
export function assertProdEnv(): void {
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_TOKEN) {
    throw new Error(
      "[INTERLIGENS] FATAL: ADMIN_TOKEN is not set in production. " +
        "Set it in Vercel → Settings → Environment Variables.",
    );
  }
}

/**
 * requireAdminApi(req)
 *
 * Use at the top of every /api/admin/* route handler.
 * Returns a NextResponse (401/403/500) if auth fails, null if OK.
 *
 * Usage:
 *   const deny = requireAdminApi(req);
 *   if (deny) return deny;
 */
export function requireAdminApi(req: NextRequest): NextResponse | null {
  const envToken = process.env.ADMIN_TOKEN;

  if (!envToken) {
    return NextResponse.json(
      {
        error: "Server misconfiguration",
        detail:
          "ADMIN_TOKEN is not configured. Contact the server administrator.",
      },
      { status: 500 },
    );
  }

  const provided = getAdminTokenFromReq(req);

  if (!provided) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Missing x-admin-token header." },
      { status: 401 },
    );
  }

  if (!safeCompare(provided, envToken)) {
    return NextResponse.json(
      { error: "Forbidden", detail: "Invalid admin token." },
      { status: 403 },
    );
  }

  return null;
}
'''

ADMIN_AUTH_TEST_TS = '''\
/**
 * src/lib/security/adminAuth.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getAdminTokenFromReq,
  isAdminApi,
  requireAdminApi,
  assertProdEnv,
} from "./adminAuth";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/test", { headers });
}

// ── getAdminTokenFromReq ─────────────────────────────────────────────────────

describe("getAdminTokenFromReq", () => {
  it("returns null when no header present", () => {
    expect(getAdminTokenFromReq(makeReq())).toBeNull();
  });

  it("returns x-admin-token when present", () => {
    expect(getAdminTokenFromReq(makeReq({ "x-admin-token": "abc123" }))).toBe("abc123");
  });

  it("falls back to x-interligens-api-token (compat)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = getAdminTokenFromReq(makeReq({ "x-interligens-api-token": "legacytoken" }));
    expect(result).toBe("legacytoken");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATION"));
    warnSpy.mockRestore();
  });

  it("prefers x-admin-token over legacy header", () => {
    const result = getAdminTokenFromReq(
      makeReq({ "x-admin-token": "primary", "x-interligens-api-token": "legacy" }),
    );
    expect(result).toBe("primary");
  });
});

// ── isAdminApi ───────────────────────────────────────────────────────────────

describe("isAdminApi", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "supersecret"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; });

  it("returns false when no token header", () => {
    expect(isAdminApi(makeReq())).toBe(false);
  });

  it("returns false when wrong token", () => {
    expect(isAdminApi(makeReq({ "x-admin-token": "wrong" }))).toBe(false);
  });

  it("returns true when correct token", () => {
    expect(isAdminApi(makeReq({ "x-admin-token": "supersecret" }))).toBe(true);
  });

  it("returns false when ADMIN_TOKEN not set", () => {
    delete process.env.ADMIN_TOKEN;
    expect(isAdminApi(makeReq({ "x-admin-token": "anything" }))).toBe(false);
  });
});

// ── requireAdminApi ──────────────────────────────────────────────────────────

describe("requireAdminApi", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "mysecrettoken"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; });

  it("returns 401 when no token provided", async () => {
    const res = requireAdminApi(makeReq());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when wrong token", async () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "badtoken" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns null (auth OK) when correct token", () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "mysecrettoken" }));
    expect(res).toBeNull();
  });

  it("returns 500 with clear message when ADMIN_TOKEN missing", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = requireAdminApi(makeReq({ "x-admin-token": "anything" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("Server misconfiguration");
    expect(body.detail).toContain("ADMIN_TOKEN");
  });

  it("accepts legacy x-interligens-api-token (compat)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = requireAdminApi(makeReq({ "x-interligens-api-token": "mysecrettoken" }));
    expect(res).toBeNull();
    warnSpy.mockRestore();
  });
});

// ── assertProdEnv ────────────────────────────────────────────────────────────

describe("assertProdEnv", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  const originalNode = process.env.NODE_ENV;
  afterEach(() => {
    process.env.ADMIN_TOKEN = originalEnv;
    process.env.NODE_ENV = originalNode;
  });

  it("does not throw in development even if ADMIN_TOKEN missing", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ADMIN_TOKEN;
    expect(() => assertProdEnv()).not.toThrow();
  });

  it("does not throw in production if ADMIN_TOKEN is set", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "present";
    expect(() => assertProdEnv()).not.toThrow();
  });

  it("throws in production if ADMIN_TOKEN is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_TOKEN;
    expect(() => assertProdEnv()).toThrow(/ADMIN_TOKEN/);
  });
});
'''

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def write_file(path: Path, content: str, created: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    created.append(str(path.relative_to(ROOT)))
    print(f"  ✅  created  {path.relative_to(ROOT)}")


def patch_route(path: Path, patched: list, skipped: list):
    """
    Migrate a single route.ts:
    - Remove checkAuth / requireAdmin imports
    - Add requireAdminApi import if not present
    - Replace auth calls
    """
    text = path.read_text(encoding="utf-8")
    original = text
    rel = str(path.relative_to(ROOT))

    # ── 1. Remove legacy import lines ─────────────────────────────────────
    # Remove: import { checkAuth } from "@/lib/auth"  (any variant)
    text = re.sub(
        r'import\s*\{[^}]*\bcheckAuth\b[^}]*\}\s*from\s*["\'][^"\']+["\'];?\n?',
        "",
        text,
    )
    # Remove: import { requireAdmin } from "@/lib/..." (auth helpers)
    text = re.sub(
        r'import\s*\{[^}]*\brequireAdmin\b[^}]*\}\s*from\s*["\'][^"\']+["\'];?\n?',
        "",
        text,
    )

    # ── 2. Add requireAdminApi import if file has /api/admin in path ──────
    if "requireAdminApi" not in text:
        # Insert after the last "next/server" import or at top
        insert_line = 'import { requireAdminApi } from "@/lib/security/adminAuth";\n'
        # Try to place after next/server import
        next_match = re.search(
            r'(import\s+\{[^}]*\}\s*from\s*"next/server";?\n)', text
        )
        if next_match:
            insert_at = next_match.end()
            text = text[:insert_at] + insert_line + text[insert_at:]
        else:
            text = insert_line + text

    # ── 3. Replace checkAuth call patterns ────────────────────────────────
    # Pattern A: const isAuth = checkAuth(req); if (!isAuth) return ...
    text = re.sub(
        r'const\s+\w+\s*=\s*checkAuth\s*\(\s*req\s*\);\s*\n\s*if\s*\(!.*?\)\s*\{[^}]*\}\s*\n?',
        "  const deny = requireAdminApi(req);\n  if (deny) return deny;\n",
        text,
        flags=re.DOTALL,
    )
    # Pattern B: if (!checkAuth(req)) return NextResponse.json(...)
    text = re.sub(
        r'if\s*\(\s*!checkAuth\s*\(\s*req\s*\)\s*\)\s*\{[^}]*\}\s*\n?',
        "  const deny = requireAdminApi(req);\n  if (deny) return deny;\n",
        text,
        flags=re.DOTALL,
    )
    # Pattern C: if (!checkAuth(req)) return NextResponse.json(...) (one-liner)
    text = re.sub(
        r'if\s*\(\s*!checkAuth\s*\(\s*req\s*\)\s*\)\s+return[^\n]+;\n?',
        "  const deny = requireAdminApi(req);\n  if (deny) return deny;\n",
        text,
    )

    # ── 4. Replace requireAdmin() patterns ────────────────────────────────
    # Pattern: const authError = requireAdmin(req); if (authError) return authError;
    text = re.sub(
        r'const\s+\w+\s*=\s*requireAdmin\s*\(\s*req\s*\);\s*\n\s*if\s*\(\s*\w+\s*\)\s+return\s+\w+;\s*\n?',
        "  const deny = requireAdminApi(req);\n  if (deny) return deny;\n",
        text,
    )

    # ── 5. Remove duplicate deny declarations if patch ran twice ──────────
    text = re.sub(
        r'(  const deny = requireAdminApi\(req\);\n  if \(deny\) return deny;\n){2,}',
        r'\1',
        text,
    )

    if text != original:
        path.write_text(text, encoding="utf-8")
        patched.append(rel)
        print(f"  🔧  patched  {rel}")
    else:
        skipped.append(rel)


def find_admin_routes(src: Path):
    """Find all route.ts under app/api/admin/"""
    api_admin = src / "app" / "api" / "admin"
    if not api_admin.exists():
        return []
    return list(api_admin.rglob("route.ts"))


def check_residual_checkAuth(src: Path):
    """Scan for any remaining checkAuth usage in admin routes."""
    api_admin = src / "app" / "api" / "admin"
    if not api_admin.exists():
        return []
    issues = []
    for f in api_admin.rglob("*.ts"):
        text = f.read_text(encoding="utf-8")
        if "checkAuth" in text or (
            "requireAdmin" in text and "requireAdminApi" not in text
        ):
            issues.append(str(f.relative_to(ROOT)))
    return issues


# ─────────────────────────────────────────────────────────────────────────────
# Compliance page addition (D2 from spec)
# ─────────────────────────────────────────────────────────────────────────────

COMPLIANCE_PAGE = '''\
/**
 * app/admin/intel-vault/compliance/page.tsx
 * P1 — Admin token status page
 */

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  const tokenPresent = Boolean(process.env.ADMIN_TOKEN);

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Auth Compliance</h1>

      <div className="rounded-lg border p-4 mb-4">
        <p className="text-sm font-mono font-semibold mb-1">ADMIN_TOKEN</p>
        {tokenPresent ? (
          <span className="inline-flex items-center gap-2 text-green-600 font-medium">
            ✅ Present
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-red-600 font-medium">
            ❌ Missing — set in Vercel → Environment Variables
          </span>
        )}
      </div>

      <div className="rounded-lg border p-4 bg-amber-50 text-amber-800 text-sm">
        <strong>INTERLIGENS_API_TOKEN</strong> is deprecated (P1). It is no
        longer used by any admin route. Remove it from Vercel after confirming
        ADMIN_TOKEN works.
      </div>
    </main>
  );
}
'''


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    src = ROOT / "src"
    app = ROOT / "app"

    if not src.exists() and not app.exists():
        print("❌  Cannot find src/ or app/ — run from project root.")
        sys.exit(1)

    # Some Next.js 13+ projects keep app/ at root, others under src/
    app_root = src / "app" if (src / "app").exists() else app
    lib_root = src / "lib" if src.exists() else ROOT / "lib"

    print("\n═══════════════════════════════════════════════════════")
    print(" P1 — UNIFY ADMIN AUTH                                 ")
    print("═══════════════════════════════════════════════════════\n")

    created, patched, skipped = [], [], []

    # 1. adminAuth.ts
    write_file(lib_root / "security" / "adminAuth.ts", ADMIN_AUTH_TS, created)

    # 2. adminAuth.test.ts
    write_file(lib_root / "security" / "adminAuth.test.ts", ADMIN_AUTH_TEST_TS, created)

    # 3. Compliance page
    compliance_path = app_root / "admin" / "intel-vault" / "compliance" / "page.tsx"
    if not compliance_path.exists():
        write_file(compliance_path, COMPLIANCE_PAGE, created)
    else:
        print(f"  ℹ️   exists   app/admin/intel-vault/compliance/page.tsx  (skipped)")

    # 4. Patch admin routes
    print("\n── Patching /api/admin/* routes ────────────────────────")
    routes = find_admin_routes(app_root)
    if not routes:
        # fallback: try root app/
        routes = list((ROOT / "app" / "api" / "admin").rglob("route.ts")) if (ROOT / "app" / "api" / "admin").exists() else []

    if not routes:
        print("  ⚠️   No route.ts found under app/api/admin/ — check your project structure.")
    else:
        for r in sorted(routes):
            patch_route(r, patched, skipped)

    # 5. Residual check
    print("\n── Residual checkAuth scan ─────────────────────────────")
    issues = check_residual_checkAuth(app_root)
    if issues:
        print("  ⚠️   Still contains checkAuth / requireAdmin (manual review needed):")
        for i in issues:
            print(f"       {i}")
    else:
        print("  ✅  No residual checkAuth found.")

    # 6. Summary
    print("\n═══════════════════════════════════════════════════════")
    print(f" Created  : {len(created)}")
    print(f" Patched  : {len(patched)}")
    print(f" Skipped  : {len(skipped)}")
    print("═══════════════════════════════════════════════════════")
    print("\nNext steps:")
    print("  1. pnpm test --run")
    print("  2. pnpm tsc --noEmit")
    print("  3. Verify /admin/intel-vault/compliance in browser")
    print("  4. Deploy → confirm ADMIN_TOKEN set in Vercel prod")
    print("  5. Remove INTERLIGENS_API_TOKEN from Vercel after 7 days")
    print()


if __name__ == "__main__":
    main()
