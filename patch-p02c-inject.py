#!/usr/bin/env python3
"""
PATCH P0.2-C — Grep export async function POST/GET dans src/app/api/scan
et injecte vaultLookup sans toucher au JSON de réponse existant.
"""
import os, glob, re, subprocess

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

VAULT_IMPORTS = """\
import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";
"""

def find_scan_routes():
    """Trouve tous les fichiers route.ts sous api/scan (hors explain)."""
    pattern = os.path.join(ROOT, "src/app/api/scan/**/*.ts")
    all_ts = glob.glob(pattern, recursive=True)
    all_ts += glob.glob(os.path.join(ROOT, "src/app/api/scan/*.ts"))
    results = []
    for f in all_ts:
        if "explain" in f or "test" in f or "__tests__" in f:
            continue
        with open(f) as fh:
            content = fh.read()
        if re.search(r"export async function (POST|GET)", content):
            results.append(f)
    return results

def detect_address_and_chain(content: str):
    """
    Détecte comment chain et address sont extraits dans la route.
    Retourne (chain_expr, address_expr) ou None.
    """
    # Patterns courants dans INTERLIGENS
    patterns = [
        # const { chain, address } = await req.json()
        (r"const\s*\{[^}]*\bchain\b[^}]*\}\s*=\s*await req\.json\(\)",
         "chain", "address"),
        # searchParams.get("chain") / searchParams.get("address")
        (r'searchParams\.get\(["\']chain["\']\)',
         'searchParams.get("chain") ?? ""',
         'searchParams.get("address") ?? ""'),
        # const chain = ... const address = ...
        (r'const chain\s*=',
         "chain", "address"),
    ]
    for pat, chain_expr, addr_expr in patterns:
        if re.search(pat, content):
            return chain_expr, addr_expr
    return None, None

def inject_vault(path: str):
    with open(path) as f:
        content = f.read()

    rel = path.replace(ROOT + "/", "")

    if "vaultLookup" in content:
        print(f"✅ {rel} — vaultLookup déjà présent, skip.")
        return

    # 1. Ajouter imports après le dernier import existant
    last_import_match = list(re.finditer(r"^import .+;?\s*$", content, re.MULTILINE))
    if not last_import_match:
        print(f"⚠️  {rel} — aucun import trouvé, skip.")
        return
    insert_pos = last_import_match[-1].end()
    content = content[:insert_pos] + "\n" + VAULT_IMPORTS + content[insert_pos:]

    # 2. Trouver le(s) handler(s) POST/GET
    handler_matches = list(re.finditer(
        r"export async function (POST|GET)\s*\(([^)]*)\)[^{]*\{",
        content
    ))
    if not handler_matches:
        print(f"⚠️  {rel} — handler POST/GET introuvable après import injection.")
        _dump_manual(rel, content)
        return

    print(f"✅ {rel} — {len(handler_matches)} handler(s) trouvé(s): "
          f"{[m.group(1) for m in handler_matches]}")

    # 3. Pour chaque handler, trouver le premier NextResponse.json({...}) return
    #    et injecter juste avant.
    #    On cherche le pattern: return NextResponse.json({
    offset = 0
    for match in handler_matches:
        handler_start = match.end() + offset

        # Find the return NextResponse.json({ ... }) in this handler
        # We look for it after the handler opening brace
        rest = content[handler_start:]

        # Detect chain/address extraction style
        chain_var, addr_var = detect_address_and_chain(rest)
        if not chain_var:
            # Fallback: try common variable names in this chunk
            if re.search(r'\bchain\b', rest[:500]):
                chain_var, addr_var = "chain", "address"
            elif re.search(r'searchParams', rest[:500]):
                chain_var = 'searchParams.get("chain") ?? "ethereum"'
                addr_var  = 'searchParams.get("address") ?? searchParams.get("mint") ?? ""'
            else:
                chain_var, addr_var = '"ethereum"', "address"

        VAULT_BLOCK = f"""\

  // ── Intel Vault lookup (non-breaking) ────────────────────────────────────────
  let intelVault: {{
    match: boolean;
    categories: string[];
    topLabel?: string;
    confidence?: string;
    severity?: string;
    explainAvailable: boolean;
  }} = {{ match: false, categories: [], explainAvailable: false }};
  try {{
    const _vaultChain   = String({chain_var}).toLowerCase();
    const _vaultAddress = String({addr_var}).trim();
    if (_vaultAddress) {{
      const _ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const _rl  = checkScanLimit(_ip);
      if (!_rl.allowed) {{
        return NextResponse.json({{ error: "Too many requests" }}, {{ status: 429 }});
      }}
      const _vr = await vaultLookup(_vaultChain, _vaultAddress);
      await auditScanLookup({{
        address: _vaultAddress, chain: _vaultChain,
        match: _vr.match, categoriesCount: _vr.categories.length,
      }});
      const _adminHeader = req.headers.get("x-admin-token");
      const _isAdmin = !!(_adminHeader && _adminHeader === process.env.ADMIN_TOKEN);
      intelVault = {{
        match:       _vr.match,
        categories:  _vr.categories,
        ...(_vr.topLabel   ? {{ topLabel:   _vr.topLabel   }} : {{}}),
        ...(_vr.confidence ? {{ confidence: _vr.confidence }} : {{}}),
        ...(_vr.severity   ? {{ severity:   _vr.severity   }} : {{}}),
        explainAvailable: _vr.match && _isAdmin,
      }};
    }}
  }} catch {{ /* vault non-blocking */ }}
  // ─────────────────────────────────────────────────────────────────────────────
"""

        # Find first `return NextResponse.json(` in this handler
        return_match = re.search(r"\n(\s*)return NextResponse\.json\(", rest)
        if not return_match:
            print(f"⚠️  {rel} — return NextResponse.json introuvable dans handler {match.group(1)}, skip injection.")
            continue

        insert_at = handler_start + return_match.start()

        # Also patch the return to add intelVault field
        # Find the opening { of the return object
        return_obj_start = content.find("{", insert_at + len(return_match.group(0)) - 1 + offset)
        # Inject intelVault field at start of return object
        if return_obj_start != -1:
            content = (
                content[:insert_at + offset]
                + VAULT_BLOCK
                + content[insert_at + offset:]
            )
            offset += len(VAULT_BLOCK)

            # Now find the return object opening brace again (offset shifted)
            new_return_match = re.search(
                r"return NextResponse\.json\(\s*\{",
                content[handler_start + offset - len(VAULT_BLOCK):]
            )
            if new_return_match:
                brace_pos = (handler_start + offset - len(VAULT_BLOCK)
                             + new_return_match.end() - 1)
                content = content[:brace_pos + 1] + "\n      intelVault," + content[brace_pos + 1:]
                offset += len("\n      intelVault,")
                print(f"✅ {rel} — intelVault injecté dans return NextResponse.json")
        break  # Only patch first handler to be safe

    with open(path, "w") as f:
        f.write(content)
    print(f"✅ {rel} — patch appliqué.")

def _dump_manual(rel, content):
    print(f"\n   ── Snippet à injecter manuellement dans {rel} ──")
    print("   1) Ajoute les imports en haut")
    print("   2) Colle le bloc vault avant ton return NextResponse.json")
    print("   3) Ajoute `intelVault,` dans l'objet retourné\n")

def patch():
    routes = find_scan_routes()
    if not routes:
        print("⚠️  Aucune route /api/scan trouvée avec export async function POST/GET")
        print("   Fichiers dans src/app/api/scan/:")
        for f in glob.glob(os.path.join(ROOT, "src/app/api/scan/**/*"), recursive=True):
            print(f"   {f.replace(ROOT+'/', '')}")
        return

    print(f"🔍 Routes scan trouvées: {len(routes)}")
    for r in routes:
        print(f"   {r.replace(ROOT+'/', '')}")
        inject_vault(r)

    print("\n✅ Patch P0.2-C terminé.")
    print("   → pnpm test && pnpm tsc --noEmit")

patch()
