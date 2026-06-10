#!/usr/bin/env bash
# CC OFFLINE GUARD
# Vérifie qu'une PR offline respecte les paths, branche, lockfile, env, dependencies.
# Usage: bash scripts/guard-offline.sh
# Exit 0 si OK, exit 1 si violation.

set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIFF_FILES=""

# Détermine quoi vérifier selon le contexte
if git diff --cached --name-only 2>/dev/null | grep -q .; then
    # On est dans un pre-commit : on vérifie le staged
    DIFF_FILES=$(git diff --cached --name-only)
    MODE="staged (pre-commit)"
elif git rev-parse --verify main >/dev/null 2>&1; then
    # On vérifie le diff branche vs main
    DIFF_FILES=$(git diff --name-only main...HEAD 2>/dev/null || echo "")
    MODE="branch diff vs main"
else
    echo "⚠️  GUARD: pas de fichiers à vérifier (ni staged, ni diff branche)"
    exit 0
fi

# Branches autorisées
BRANCH_OK=false
if [[ "$BRANCH" == "main" ]]; then
    BRANCH_OK=true
elif [[ "$BRANCH" == "feat/offline-mode-setup" ]]; then
    BRANCH_OK=true
elif [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-[a-z0-9-]+$ ]]; then
    BRANCH_OK=true
elif [[ "$BRANCH" =~ ^hotfix/ ]]; then
    BRANCH_OK=true
fi

if [[ "$BRANCH_OK" != "true" ]]; then
    echo "❌ GUARD: branche '$BRANCH' non conforme."
    echo "   Format attendu : main | feat/offline-mode-setup | feat/cc-offline-XX-nom | hotfix/..."
    exit 1
fi

# Patterns interdits (regex)
FORBIDDEN_PATTERNS=(
    "^package\.json$"
    "^package-lock\.json$"
    "^pnpm-lock\.yaml$"
    "^yarn\.lock$"
    "^\.env"
    "^\.vercel/"
    "^vercel\.json$"
    "^\.github/"
    "^\.gitignore$"
    "^\.gitattributes$"
    "^next\.config\."
    "^tsconfig\."
    "^vitest\.config\."
    "^eslint\.config\."
    "^\.eslintrc"
    "^tailwind\.config\."
    "^postcss\.config\."
    "^\.prettierrc"
    "^middleware\.ts$"
    "^instrumentation\.ts$"
    "^prisma/"
    "^migrations/"
    "^src/middleware/"
    "^src/server/db/"
    "^src/lib/db/"
    "^src/lib/scoring/"
    "^src/lib/tigerscore/"
    "^src/lib/partner/"
    "^src/lib/mobile/"
    "^src/lib/watcher/"
    "^src/lib/pdf/"
    "^src/lib/evidence/"
    "^src/lib/kol/"
    "^src/lib/auth/"
    "^src/lib/rate-limit/"
    "^src/lib/security/"
    "^src/lib/turnstile/"
    "^src/components/"
    "^src/app/api/"
    "^src/app/casefiles/"
    "^src/app/\(public\)/casefiles/"
)

# Exceptions sur la branche setup uniquement
if [[ "$BRANCH" == "feat/offline-mode-setup" ]]; then
    # Cette branche pose les garde-fous, elle a le droit de créer .github/, scripts/, CLAUDE.offline.md, etc.
    # On exempte les chemins de setup légitimes.
    EXEMPT_SETUP_PATTERNS=(
        "^\.github/workflows/guard-offline\.yml$"
        "^scripts/guard-offline\.sh$"
        "^CLAUDE\.offline\.md$"
        "^\.cc-allowed-paths$"
        "^\.cc-forbidden-paths$"
        "^docs/RUNBOOK_URGENCE_LOMBOK\.md$"
    )
fi

# Exceptions globales pour toutes les branches cc-offline-* :
# nouveaux sous-dossiers isolés du core gelé, créés pendant l'offline mode.
# Chaque ajout doit être explicite, scopé, et validé par revue humaine.
# - src/lib/pdf/nova/                : générateur PDF $NOVA (synthetic demo, admin-only)
# - src/app/api/admin/casefile-nova/ : route admin POST pour le PDF $NOVA
OFFLINE_EXEMPT_PATTERNS=(
    "^src/lib/pdf/nova/"
    "^src/app/api/admin/casefile-nova/"
)

# Exceptions pour le module Casefile Engine V1 (admin-only, feature-flagged,
# synthetic-only). Autorisation humaine explicite — voir PR description.
# Ne couvre PAS l'ensemble de prisma/ ni src/components/ : exemptions ciblées
# uniquement sur les paths scaffoldés du module.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-casefile-engine$ ]]; then
    EXEMPT_CASEFILE_ENGINE_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
        "^src/components/admin/casefile-engine/"
        "^MIGRATION_casefile_engine_v1\.sql$"
        "^MIGRATION_PLAN_casefile_engine_v1\.md$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le module Shill Correlation Engine (admin-only, shadow mode,
# internal investigation — pas de surface publique, pas de couplage TigerScore/PDF).
# Autorisation humaine explicite (David, PHASE 8 handoff) — voir PR description.
# Ne couvre PAS l'ensemble de prisma/ ni src/app/api/ : exemptions ciblées
# uniquement sur les paths scaffoldés / touchés par le module.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-shill-correlation$ ]]; then
    EXEMPT_SHILL_CORRELATION_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
        "^src/lib/kol/proceeds\.ts$"
        "^src/app/api/admin/shill-correlation/"
        "^scripts/guard-offline\.sh$"
    )
fi

VIOLATIONS=0
VIOLATING_FILES=()

if [[ -z "$DIFF_FILES" ]]; then
    echo "✅ GUARD: aucun fichier modifié à vérifier."
    exit 0
fi

while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    # Sur branche setup, exempter les fichiers de setup
    if [[ "$BRANCH" == "feat/offline-mode-setup" ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_SETUP_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Exemptions globales offline (scopées par sous-dossier, voir liste haut de fichier)
    EXEMPT=false
    for ex in "${OFFLINE_EXEMPT_PATTERNS[@]}"; do
        if [[ "$file" =~ $ex ]]; then
            EXEMPT=true
            break
        fi
    done
    [[ "$EXEMPT" == "true" ]] && continue

    # Sur la branche casefile-engine, exempter les paths du module.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-casefile-engine$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_CASEFILE_ENGINE_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche shill-correlation, exempter les paths du module.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-shill-correlation$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_SHILL_CORRELATION_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]]; then
            VIOLATIONS=$((VIOLATIONS + 1))
            VIOLATING_FILES+=("$file (matched $pattern)")
            break
        fi
    done
done <<< "$DIFF_FILES"

FILE_COUNT=$(echo "$DIFF_FILES" | grep -c . || echo 0)

echo "📋 GUARD: branche=$BRANCH, mode=$MODE, fichiers=$FILE_COUNT"

if [[ $VIOLATIONS -gt 0 ]]; then
    echo ""
    echo "🛑 BLOCKED — $VIOLATIONS violation(s) :"
    for v in "${VIOLATING_FILES[@]}"; do
        echo "   ❌ $v"
    done
    echo ""
    echo "Si cette modification est légitime, contacte David."
    echo "Ne bypass pas le guard sans validation humaine explicite."
    exit 1
fi

echo "✅ GUARD: aucun chemin interdit modifié."
exit 0
