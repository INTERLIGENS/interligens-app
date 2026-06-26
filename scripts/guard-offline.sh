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

# Exceptions pour la watchlist expansion (ajout de KOL reviewés au watcher).
# Autorisation humaine explicite (David, WAVES 1-3 approuvées) — voir PR description.
# Exemption ciblée UNIQUEMENT sur handles.ts (la source de vérité du watcher) ;
# ne couvre PAS le reste de src/lib/watcher/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watchlist-expansion$ ]]; then
    EXEMPT_WATCHLIST_EXPANSION_PATTERNS=(
        "^src/lib/watcher/handles\.ts$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le module PRE-BUY GUARD V1 (admin-only, shadow mode — couche
# de convergence REFLEX + shill correlation + KOL referral, pas de surface
# publique, additif uniquement, zéro modification de REFLEX).
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route admin du module + le guard lui-même ;
# ne couvre PAS l'ensemble de src/app/api/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-prebuy-guard$ ]]; then
    EXEMPT_PREBUY_GUARD_PATTERNS=(
        "^src/app/api/admin/prebuy/"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le tracking conso X API dans le cron watcher-v2.
# Ajout purement additif : 1 compteur userLookups + 1 upsert XApiUsage
# (SQL brut ON CONFLICT, table + index déjà en prod via Neon). Aucune
# autre logique du cron modifiée, aucun appel X API supplémentaire.
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route cron watcher-v2 + le guard
# lui-même ; ne couvre PAS le reste de src/app/api/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-xapi-usage-cron$ ]]; then
    EXEMPT_XAPI_USAGE_PATTERNS=(
        "^src/app/api/cron/watcher-v2/route\.ts$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le fix fenêtre du watcher (mode reprise start_time +
# pagination). Additif : le cron passe une fenêtre temporelle + un cap
# posts/handle au client X API. Aucune écriture DB, aucune migration.
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route cron watcher-v2 + le guard ;
# le client src/lib/xapi/ n'est pas un chemin protégé (hors exemption).
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watcher-window-fix$ ]]; then
    EXEMPT_WATCHER_WINDOW_PATTERNS=(
        "^src/app/api/cron/watcher-v2/route\.ts$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le cleanup sweep (dette technique post-merge — additif uniquement).
# Autorisation humaine explicite (David, FULL CLEANUP SWEEP) — voir PR description.
# Périmètre ciblé : sync du schema sur la prod DB (colonnes lifecycle KolProfile
# déjà live), retrait d'un handle mort du watcher, et le short-circuit spend-cap
# de la route cron watcher-v2. Aucune logique core / scoring / auth touchée.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-cleanup-sweep$ ]]; then
    EXEMPT_CLEANUP_SWEEP_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
        "^src/lib/watcher/handles\.ts$"
        "^src/app/api/cron/watcher-v2/route\.ts$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le sync schema Evidence (file-only — additif uniquement).
# La table EvidenceNegative + les colonnes forensic EvidenceSnapshot existent
# DÉJÀ en DB ep-square-band (ajoutées par les sessions seeder OSINT en SQL brut) ;
# ce sync ne fait que refléter cette réalité dans schema.prod.prisma. AUCUNE
# migration DB. Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur le schema + le guard lui-même.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-evidence-schema-sync$ ]]; then
    EXEMPT_EVIDENCE_SCHEMA_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le scan ticker resolver (DexScreener fallback — additif au
# résolveur ticker→token du scan /demo). Le résolveur retombe sur DexScreener
# search puis CoinGecko quand l'interne manque, avec matching tolérant scoré et
# désambiguïsation par déroulant. Read-only, aucune écriture DB. Aucun couplage
# scoring/TigerScore/PDF. Autorisation humaine explicite (David) — voir PR.
# Exemption ciblée UNIQUEMENT sur la route resolve + le composant TokenPicker +
# le guard lui-même. Les fichiers non gelés (src/lib/marketProviders.ts,
# src/app/{fr,en}/demo/page.tsx) passent sans exemption (hors paths interdits).
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-scan-resolver-dexscreener$ ]]; then
    EXEMPT_SCAN_RESOLVER_PATTERNS=(
        "^src/app/api/scan/resolve/route\.ts$"
        "^src/components/scan/TokenPicker\.tsx$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour l'ajout du handle moonbag au watcher (TOES campaign).
# moonbag a un KolProfile (draft) + un KolTokenLink TOES curated déjà en DB
# (ep-square-band) ; l'ajout à handlesV2 le fait remonter sur la Watchlist
# comme GordonGekko/DonWedge. Additif : 1 entrée WatchHandle, priority low.
# Aucune écriture DB, aucune migration, aucun autre handle modifié.
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur handles.ts (source de vérité du watcher) +
# le guard lui-même ; ne couvre PAS le reste de src/lib/watcher/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-moonbag-watchlist$ ]]; then
    EXEMPT_MOONBAG_WATCHLIST_PATTERNS=(
        "^src/lib/watcher/handles\.ts$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour le fix budget + cadence du watcher (P3 observabilité XApiUsage,
# P2 cadence quotidienne). Additif : remontée de l'erreur d'écriture XApiUsage
# dans les stats du run, lookback 26h→30h, et schedule cron 72h→quotidien dans
# vercel.json. Aucune écriture DB, aucune migration (l'index unique monthStart
# existe déjà). Aucune logique de détection / KolTokenLink touchée.
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route cron watcher-v2 + vercel.json (où vit
# le schedule) + le guard lui-même ; ne couvre PAS le reste de src/app/api/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watcher-budget-cadence$ ]]; then
    EXEMPT_WATCHER_BUDGET_CADENCE_PATTERNS=(
        "^src/app/api/cron/watcher-v2/route\.ts$"
        "^vercel\.json$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour l'Evidence Intake Bridge — Sprint 1 (schema ADDITIF seul).
# La migration SQL (ALTER ADD COLUMN IF NOT EXISTS + CREATE TABLE SignalIntake +
# backfill) est appliquée sur ep-square-band via connexion brute (jamais
# prisma db push) ; ce commit ne fait que refléter ces colonnes/table dans
# schema.prod.prisma (anti-drift) + le fichier MIGRATION racine. Aucune
# suppression, aucun filtre de lecture touché (la gate visibility arrive au
# Sprint 8). Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur le schema + le guard ; le fichier
# MIGRATION_intake_bridge_sprint1.sql (racine) n'est pas un chemin gelé.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-intake-bridge-sprint1-schema$ ]]; then
    EXEMPT_INTAKE_BRIDGE_S1_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
        "^scripts/guard-offline\.sh$"
    )
fi

# Exceptions pour l'Evidence Intake Bridge — Sprint 4 (promotion draft).
# Le bridge crée des KolTokenLink visibility='draft' (jamais public) + des
# SignalIntake. Pour garantir « draft = jamais public », on AVANCE la part
# minimale du filtre Sprint 8 : les lectures publiques resolve + watchlist
# filtrent strictement sur visibility='public'. Behavior-preserving (les 187
# lignes legacy sont toutes 'public'), prouvé par curl AVANT/APRÈS identique.
# Aucune autre logique de scan/watchlist modifiée. Autorisation humaine
# explicite (David) — voir PR description. Exemption ciblée UNIQUEMENT sur ces
# deux routes + le guard ; les fichiers du module (src/lib/watcher-bridge/,
# src/scripts/) ne sont pas des chemins gelés.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-intake-bridge-sprint4-draft-bridge$ ]]; then
    EXEMPT_INTAKE_BRIDGE_S4_PATTERNS=(
        "^src/app/api/scan/resolve/route\.ts$"
        "^src/app/api/watchlist/route\.ts$"
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

    # Sur la branche watchlist-expansion, exempter handles.ts (source watcher).
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watchlist-expansion$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_WATCHLIST_EXPANSION_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche prebuy-guard, exempter les paths du module.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-prebuy-guard$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_PREBUY_GUARD_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche xapi-usage-cron, exempter la route cron watcher-v2.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-xapi-usage-cron$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_XAPI_USAGE_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche watcher-window-fix, exempter la route cron watcher-v2.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watcher-window-fix$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_WATCHER_WINDOW_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche moonbag-watchlist, exempter handles.ts (source watcher).
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-moonbag-watchlist$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_MOONBAG_WATCHLIST_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche cleanup-sweep, exempter les paths de la dette technique.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-cleanup-sweep$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_CLEANUP_SWEEP_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche evidence-schema-sync, exempter le schema (sync file-only).
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-evidence-schema-sync$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_EVIDENCE_SCHEMA_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche scan-resolver-dexscreener, exempter la route resolve + TokenPicker.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-scan-resolver-dexscreener$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_SCAN_RESOLVER_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche watcher-budget-cadence, exempter la route cron watcher-v2 + vercel.json.
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-watcher-budget-cadence$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_WATCHER_BUDGET_CADENCE_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche intake-bridge-sprint1-schema, exempter le schema prod (sync anti-drift).
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-intake-bridge-sprint1-schema$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_INTAKE_BRIDGE_S1_PATTERNS[@]}"; do
            if [[ "$file" =~ $ex ]]; then
                EXEMPT=true
                break
            fi
        done
        [[ "$EXEMPT" == "true" ]] && continue
    fi

    # Sur la branche intake-bridge-sprint4-draft-bridge, exempter resolve + watchlist (filtre visibility).
    if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-intake-bridge-sprint4-draft-bridge$ ]]; then
        EXEMPT=false
        for ex in "${EXEMPT_INTAKE_BRIDGE_S4_PATTERNS[@]}"; do
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
