#!/usr/bin/env python3
"""
PATCH FIX — corrige 2 erreurs:
1. parseText: regex EVM avec ancres ^ $ ne matche pas dans du texte
2. dedup.ts: chemin @/lib/prisma — cherche le bon chemin dans le projet
"""
import os, sys, glob

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

# ─── Fix 1: parseText — regex sans ancres pour extraction dans du texte ────────
TEXT_PATH = os.path.join(ROOT, "src/lib/intel-vault/parsers/text.ts")

TEXT_CONTENT = '''\
// src/lib/intel-vault/parsers/text.ts
import type { ParseOptions, ParseResult } from "../types";
import { isValidAddress } from "../address";
import { buildRow } from "../normalizer";

// Regex SANS ancres pour extraire des adresses dans du texte libre
const EVM_IN_TEXT = /0x[a-fA-F0-9]{40}/g;
const SOL_IN_TEXT = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export function parseText(content: string, opts: ParseOptions): ParseResult {
  const warnings: string[] = [];

  const evmMatches = content.match(EVM_IN_TEXT) ?? [];
  const solMatches = (content.match(SOL_IN_TEXT) ?? [])
    .filter(m => !/^0x/.test(m));

  const all = [...new Set([...evmMatches, ...solMatches])].filter(isValidAddress);

  if (all.length === 0) {
    warnings.push("Aucune adresse trouvée dans le texte");
    return { rows: [], totalScanned: 0, warnings };
  }

  const snippet = content.slice(0, 200).replace(/\s+/g, " ").trim();
  const rows = all.map(addr =>
    buildRow(addr, { ...opts, evidence: opts.sourceUrl ? `snippet: "${snippet}"` : undefined })
  );

  return { rows, totalScanned: all.length, warnings };
}
'''

# ─── Fix 2: trouver le bon chemin prisma dans le projet ────────────────────────
def find_prisma_path():
    candidates = [
        "src/lib/prisma.ts",
        "src/lib/prisma/index.ts",
        "src/lib/db.ts",
        "src/lib/db/index.ts",
        "lib/prisma.ts",
    ]
    for c in candidates:
        if os.path.exists(os.path.join(ROOT, c)):
            # Convert to @/ alias
            rel = c.replace("src/", "@/")
            return rel.replace(".ts", "")
    return None

def patch():
    # Fix 1: parseText
    os.makedirs(os.path.dirname(TEXT_PATH), exist_ok=True)
    with open(TEXT_PATH, "w") as f:
        f.write(TEXT_CONTENT)
    print("✅ parsers/text.ts — regex EVM corrigée (sans ancres ^$)")

    # Fix 2: prisma path
    prisma_import = find_prisma_path()
    if prisma_import:
        print(f"✅ Prisma trouvé à: {prisma_import}")
        # Patch dedup.ts
        dedup_path = os.path.join(ROOT, "src/lib/intel-vault/dedup.ts")
        with open(dedup_path, "r") as f:
            content = f.read()
        fixed = content.replace('from "@/lib/prisma"', f'from "{prisma_import}"')
        with open(dedup_path, "w") as f:
            f.write(fixed)
        print(f"✅ dedup.ts — import prisma corrigé → {prisma_import}")

        # Patch scan-lookup.ts
        lookup_path = os.path.join(ROOT, "src/lib/intel-vault/scan-lookup.ts")
        if os.path.exists(lookup_path):
            with open(lookup_path, "r") as f:
                content = f.read()
            fixed = content.replace('from "@/lib/prisma"', f'from "{prisma_import}"')
            with open(lookup_path, "w") as f:
                f.write(fixed)
            print(f"✅ scan-lookup.ts — import prisma corrigé → {prisma_import}")

        # Patch API routes
        for pattern in [
            "src/app/api/admin/ingest/route.ts",
            "src/app/api/admin/batches/*/route.ts",
            "src/app/api/admin/batches/*/approve/route.ts",
            "src/app/api/scan/explain/route.ts",
        ]:
            for path in glob.glob(os.path.join(ROOT, pattern)):
                with open(path, "r") as f:
                    content = f.read()
                if '@/lib/prisma"' in content:
                    fixed = content.replace('from "@/lib/prisma"', f'from "{prisma_import}"')
                    with open(path, "w") as f:
                        f.write(fixed)
                    print(f"✅ {path.replace(ROOT+'/', '')} — prisma corrigé")
    else:
        print("⚠️  Prisma introuvable — cherche manuellement et indique le chemin")
        # Show what files exist in src/lib
        lib_path = os.path.join(ROOT, "src/lib")
        if os.path.exists(lib_path):
            files = os.listdir(lib_path)
            print(f"   Fichiers dans src/lib: {files}")

    print("\n✅ Fix terminé — lance: pnpm test")

patch()
