#!/usr/bin/env python3
"""
PATCH P0.3-B — Insertion IntelVaultBadge dans les pages demo
Détecte les pages demo en/fr, trouve la zone chips résultat,
insère le badge après les chips et avant l'input.
Idempotent.
"""
import os, re, glob

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

IMPORT_LINE = 'import { IntelVaultBadge } from "@/components/vault/IntelVaultBadge";\n'

def find_demo_pages():
    candidates = [
        "src/app/en/demo/page.tsx",
        "src/app/fr/demo/page.tsx",
        "src/app/[locale]/demo/page.tsx",
    ]
    found = []
    for c in candidates:
        p = os.path.join(ROOT, c)
        if os.path.exists(p):
            found.append((p, c))
    return found

def detect_locale_from_path(rel_path: str) -> str:
    if "/fr/" in rel_path:
        return "fr"
    return "en"

def add_import(content: str) -> str:
    if "IntelVaultBadge" in content:
        return content
    # Insert after first "use client" or after first import
    if '"use client"' in content:
        idx = content.find('"use client"')
        end = content.find("\n", idx) + 1
        return content[:end] + IMPORT_LINE + content[end:]
    idx = content.find("import ")
    end = content.find("\n", idx) + 1
    return content[:end] + IMPORT_LINE + content[end:]

def find_scan_result_state(content: str) -> str | None:
    """Try to find the variable name holding scan results (intelVault field)."""
    # Common patterns: scanResult, result, data, scanData
    for pattern in [r'const \[(\w*[Rr]esult\w*),', r'const \[(\w*[Dd]ata\w*),', r'const \[(\w*[Ss]can\w*),']:
        m = re.search(pattern, content)
        if m:
            return m.group(1)
    return None

def patch_demo_page(path: str, rel: str):
    with open(path, "r") as f:
        content = f.read()

    if "IntelVaultBadge" in content:
        print(f"✅ {rel} — badge déjà présent, skip.")
        return

    locale = detect_locale_from_path(rel)
    result_var = find_scan_result_state(content)

    content = add_import(content)

    # Strategy: find chip zone (SAFE/WARNING/SCAM/COPY LINK pattern)
    # Look for the chips row container and insert after it
    badge_jsx = f'\n        {{/* Intel Vault Badge */}}\n        <IntelVaultBadge\n          intelVault={{{result_var}?.intelVault ?? null}}\n          locale="{locale}"\n        />\n'

    # Pattern 1: look for COPY LINK / copyLink chip area and insert after its parent closing div
    # We'll search for common patterns around the result chips

    inserted = False

    # Try to find "COPY LINK" or chip row pattern
    patterns_to_try = [
        # Pattern: chips row followed by something — insert after last chip container
        (r'(\{[^}]*?(?:COPY|copy|copyLink|SAFE|WARNING|SCAM)[^}]*?\}[^<]*?</(?:div|span|button)>)', 'after_chips'),
    ]

    # Simpler approach: find the div/section containing the result chips
    # Look for a div with className containing flex and chips/verdict keywords
    # Then insert IntelVaultBadge after it

    # Find where scanResult chips are rendered — look for conditional rendering on scanResult
    # Common pattern: {scanResult && ( ... chips ... )}
    chip_block_re = re.search(
        r'(\{[\s\S]{0,50}(?:scanResult|result|data)[\s\S]{0,200}(?:SAFE|WARNING|SCAM|tier|score)[\s\S]{0,500}?\})',
        content
    )

    if chip_block_re and result_var:
        # Find position after this block and insert badge
        end_pos = chip_block_re.end()
        badge_jsx_simple = f'\n        <IntelVaultBadge intelVault={{{result_var}?.intelVault ?? null}} locale="{locale}" />\n'
        content = content[:end_pos] + badge_jsx_simple + content[end_pos:]
        inserted = True
        print(f"✅ {rel} — IntelVaultBadge inséré après chips résultat.")
    else:
        print(f"⚠️  {rel} — pattern chips introuvable.")
        print(f"   Variable résultat détectée: {result_var}")
        print(f"   Insertion manuelle requise — ajoute après les chips SAFE/WARNING/SCAM:")
        print(f'   <IntelVaultBadge intelVault={{{result_var}?.intelVault ?? null}} locale="{locale}" />')
        # Still write import + save for manual insertion
        inserted = True  # partial

    with open(path, "w") as f:
        f.write(content)

    if not inserted:
        print(f"   Fichier sauvé avec l'import ajouté.")

def show_manual_instructions(pages):
    """If auto-insertion failed, show what to add manually."""
    print("\n─── INSERTION MANUELLE (si non détectée) ──────────────────────────────")
    for _, rel in pages:
        locale = detect_locale_from_path(rel)
        print(f"\nDans {rel}:")
        print(f"  1) Import déjà ajouté en haut du fichier.")
        print(f"  2) Trouve la zone des chips SAFE/WARNING/SCAM/COPY LINK")
        print(f"  3) Ajoute JUSTE APRÈS ces chips:")
        print(f'     <IntelVaultBadge intelVault={{scanResult?.intelVault ?? null}} locale="{locale}" />')
        print(f"  (remplace 'scanResult' par le nom de ta variable de résultat scan)")

def patch():
    pages = find_demo_pages()
    if not pages:
        print("⚠️  Pages demo introuvables. Cherche manuellement:")
        for f in glob.glob(os.path.join(ROOT, "src/**/*demo*page*"), recursive=True):
            print(f"   {f.replace(ROOT+'/', '')}")
        return

    print(f"✅ {len(pages)} page(s) demo trouvée(s):")
    for _, rel in pages:
        print(f"   {rel}")

    for path, rel in pages:
        patch_demo_page(path, rel)

    show_manual_instructions(pages)

    print("\n✅ Patch P0.3-B terminé.")
    print("   Lance: pnpm test")

patch()
