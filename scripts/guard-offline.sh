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
    # ── Le gate de requêtes (admin + beta) ──────────────────────────────────
    # Next.js 16 a renommé le middleware en « proxy » : dans CE repo le gate
    # réel vit dans src/proxy.ts (checkBasicAuth, verifyAdminSession, beta-gate,
    # isBetaExempt, matcher). Il n'était couvert par AUCUN pattern —
    # "^src/middleware/" exige un slash et ne matche que src/middleware/adminAuth.ts.
    # Les deux emplacements conventionnels Next.js sont gardés comme tripwire :
    # un fichier créé là serait exécuté sur chaque requête, donc gelé d'office.
    "^src/proxy\.ts$"
    "^middleware\.ts$"
    "^src/middleware\.ts$"
    "^instrumentation\.ts$"
    "^prisma/"
    "^migrations/"
    "^src/middleware/"
    "^src/lib/scoring/"
    "^src/lib/tigerscore/"
    "^src/lib/watcher/"
    "^src/lib/pdf/"
    "^src/lib/evidence/"
    "^src/lib/kol/"
    "^src/lib/auth/"
    "^src/lib/security/"
    "^src/components/"
    "^src/app/api/"

    # ── Le guard lui-même ───────────────────────────────────────────────────
    # Sans ça, n'importe quel commit peut vider FORBIDDEN_PATTERNS au milieu de
    # 40 autres fichiers sans que rien ne le signale. Le hook pre-commit exécute
    # la version WORKING TREE du script : une modification du guard doit donc
    # passer par la voie de maintenance déclarée plus bas (branche dédiée +
    # guard seul dans le diff), sinon elle est bloquée.
    "^scripts/guard-offline\.sh$"

    # ── Fichiers de sécurité dont la compromission est INVISIBLE ────────────
    # Sélection volontairement resserrée (audit issue #46, décision David) :
    # uniquement ce qui ne laisse ni trace dans les logs ni trou dans le revenu.
    # Les rate-limiters, billing/entitlement et cap restent NON gelés — un
    # contournement s'y voit au monitoring ou à la facturation.
    "^src/lib/vault/auth\.server\.ts$"          # IDOR inter-clients + piste d'audit
    "^src/lib/intel-vault/auth\.ts$"            # requireAdmin() du vault
    "^src/lib/osint/retail/retailConfig\.ts$"   # kill switches retail + budget vision
    "^src/lib/featureFlags\.ts$"                # ouvre n'importe quelle surface non finie
    "^src/lib/osint/retail/turnstile\.ts$"      # anti-bot retail
    "^src/lib/billing/turnstile\.ts$"           # anti-bot checkout
    "^src/lib/osint/retail/privateVault\.ts$"   # cloisonnement données privées
    "^src/lib/osint/retail/ipHash\.ts$"         # pseudonymisation IP (RGPD)
)

# ══════════════════════════════════════════════════════════════════════════════
# LEASES — l'autorisation cesse d'être un nom de branche éternel
# ══════════════════════════════════════════════════════════════════════════════
#
#   Static exemptions converge to zero. Legitimate openings become explicit,
#   bounded, versioned leases.
#
#   Branch naming may select a workflow; it must never itself grant authority.
#
# Une lease AUTORISE. Le nom de branche ne fait que SÉLECTIONNER laquelle : il ne
# suffit pas, et il ne dure pas. Pour qu'un chemin gelé passe, il faut SIX
# conditions simultanées — chemin EXACT, sujet, SHA de base, état OPEN, forme
# valide, et NON EXPIRÉE. Une seule manque, c'est rouge.
#
# ─── L'ASYMÉTRIE, ET ELLE EST LA CLEF ────────────────────────────────────────
#
#   Authority is required to widen, never to narrow. A change that only removes
#   an authorization needs no authorization.
#
#   ajouter · élargir · PROLONGER une lease  →  soumis à autorité
#   retirer · réduire  une lease             →  TOUJOURS autorisé
#   lease EXPIRÉE                            →  n'autorise plus rien, MÊME SI
#                                               SON BLOC EST ENCORE DANS L'ARBRE
#
# La troisième ligne est celle qu'on oublie : un bloc PRÉSENT mais périmé n'est
# pas un bloc ABSENT. Les deux refusent, pour des raisons DISTINCTES au journal —
# « aucune lease » et « lease EXPIRÉE le … » — parce qu'on ne répare pas les deux
# de la même façon.
#
# « Prolonger » est soumis à autorité non par une comparaison d'états — le
# verifier ne voit que celui de `main` — mais STRUCTURELLEMENT : toute écriture
# de l'état passe par le guard, donc par `hotfix/guard-*` et sa revue. Il n'y a
# pas de prolongation silencieuse parce qu'il n'y a pas d'écriture silencieuse.
#
# ─── LE THÉORÈME QUI REND L'HORLOGE INOFFENSIVE ──────────────────────────────
#
# La voie de
# maintenance `continue` AVANT toute évaluation de lease : un diff qui ne touche
# que le système de garde — donc toute fermeture de lease — n'interroge jamais
# l'horloge. Une lease expirée ne peut donc PAS bloquer sa propre fermeture, et
# l'expiration ne peut pas fabriquer une fenêtre qu'on ne peut pas refermer.
#
# ─── L'HORLOGE ───────────────────────────────────────────────────────────────
#
#   effectiveNow := max( runnerNow , trustedBaseLowerBound )
#
# ⚠️ LES DEUX TERMES NE SONT PAS DE MÊME NATURE, et les confondre serait une
# prose qui décrit autre chose que le code.
#
#   runnerNow              LA SOURCE NORMATIVE. L'horloge UTC du runner, et elle
#                          seule, dit quelle heure il est.
#   trustedBaseLowerBound  PAS une horloge. Un horodatage Git n'est pas une
#                          source de temps fiable. Sa SEULE utilité est de
#                          fournir un PLANCHER de fraîcheur, qui ne peut que
#                          RACCOURCIR la fenêtre — jamais l'allonger, jamais la
#                          définir.
#
# L'ordre est donc `max(normatif, plancher)`, JAMAIS l'inverse : un plancher ne
# devient jamais l'autorité. Et AUCUN horodatage contrôlé par l'auteur de la PR
# n'entre dans le calcul — la date de commit de la PR est écartée, `git commit
# --date` acceptant n'importe quoi. Une entrée hostile ne peut produire qu'un
# refus d'élargir.
#
# Le verdict de fraîcheur n'est PAS rejouable : rejoué demain, il change. Il est
# donc EXPLICABLE plutôt que reproductible — le `now` évalué est imprimé dans la
# preuve, à chaque exécution, pour l'audit.
#
#   When the governed property is elapsed exposure time, wall-clock time is
#   authority-relevant input, not nondeterminism to be abstracted away.
#
# GUARD_NOW_UTC injecte l'instant pour les tests. En CI la variable n'est pas
# posée ; et quiconque peut poser une variable d'environnement sur le runner
# contrôle déjà le runner — ce n'est donc pas une surface nouvelle.
#
# ─── FORMAT D'UNE LEASE ──────────────────────────────────────────────────────
#
#   windowId|propriété|chemins|baseSha|sujet|openedAt|expiresAt|état
#
#   chemins   chemins EXACTS séparés par une virgule. AUCUN motif, aucun
#             joker, aucun préfixe de répertoire : l'égalité de chaîne, et
#             rien d'autre. Un `^src/app/api/osint/` est impossible à écrire ici.
#   baseSha   le SHA de `main` sur lequel la lease a été ouverte. Il doit être
#             un ancêtre de HEAD.
#   sujet     la branche à qui elle est accordée — SÉLECTEUR, pas autorité.
#   *At       ISO-8601 UTC strict, `Z` obligatoire. Aucune heure locale.
#   état      OPEN | CLOSED.
#
# Durée maximale : 45 minutes. Mesurée, pas choisie — sur 64 fenêtres réelles,
# 60 tiennent en ≤30 mn et les 4 autres sont à ≥127 mn : il n'y a RIEN entre les
# deux. La borne est ICI, dans le mécanisme, et pas seulement dans une consigne.
#
# AUCUNE PROLONGATION IMPLICITE. Renouveler, c'est une nouvelle lease, avec un
# nouveau windowId — jamais la modification silencieuse d'une expiration active.
#
# Critère : __tests__/garde/leases.test.ts
# ══════════════════════════════════════════════════════════════════════════════

# ─── LA PREMIÈRE LEASE RÉELLE, ET L'INVENTAIRE À ZÉRO ────────────────────────
#
# `OFFLINE_EXEMPT_PATTERNS` était la DERNIÈRE exemption statique du dépôt :
# VIVANTE — le module `casefile-nova` existe dans `main` — mais NON BORNÉE et
# SANS CONDITION. Elle s'appliquait à TOUTE branche, `main` comprise.
#
#   vivant + non borné + valable sur toute branche = AUTORISATION PERMANENTE.
#
# Elle ne devient pas acceptable parce qu'elle est ancienne : elle devient une
# lease. C'est le premier client RÉEL du mécanisme, et c'est une preuve plus
# forte qu'un cas fabriqué — un besoin qui existait déjà s'exprime désormais
# dans la forme gouvernée, ou ne s'exprime plus.
#
#   STATIC PROJECT EXEMPTIONS = 0
#
# ⚠️ L'ancienne exemption portait deux RÉPERTOIRES. Une lease ne prend que des
# chemins EXACTS : ils devront être énumérés fichier par fichier au moment de
# l'ouverture, sur le SHA de base du jour. Tant qu'aucun chantier ne les touche,
# l'état reste VIDE — et c'est la bonne valeur par défaut : zéro autorité.
#
# Ce que cela coûte, dit franchement : toucher `src/lib/pdf/nova/` ou
# `src/app/api/admin/casefile-nova/` exige désormais une lease, donc une PR de
# maintenance et une revue. C'est le prix, et c'est le même que pour tout le
# reste du gel.

LEASE_DUREE_MAX_S=2700   # 45 minutes

# L'ÉTAT. Vide = ZÉRO AUTORITÉ : le vide est la lecture la plus stricte, jamais
# « rien à vérifier ». Une lease n'existe qu'une fois MERGÉE dans main — c'est la
# même propriété que le guard lui-même : on ne se juge pas avec ses propres règles.
LEASES=(
)

lease_rouge() {
    echo "🛑 GUARD/LEASE: $1"
    exit 1
}

# ISO-8601 UTC strict → epoch. BSD et GNU.
lease_epoch() {
    local iso="$1" out
    [[ "$iso" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || return 1
    out=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$iso" +%s 2>/dev/null) \
        || out=$(date -u -d "$iso" +%s 2>/dev/null) || return 1
    echo "$out"
}

# effectiveNow := max(runnerNow, trustedBaseLowerBound). Injectable pour les tests.
LEASE_NOW=""
lease_maintenant() {
    if [[ -n "$LEASE_NOW" ]]; then echo "$LEASE_NOW"; return 0; fi
    local runner_now plancher_fiable=0 b

    # LA SOURCE NORMATIVE — l'horloge UTC du runner.
    runner_now=$(date -u +%s)
    if [[ -n "${GUARD_NOW_UTC:-}" ]]; then
        runner_now=$(lease_epoch "${GUARD_NOW_UTC}") \
            || lease_rouge "GUARD_NOW_UTC illisible — un instant douteux ne devient pas un instant permissif."
    fi

    # LE PLANCHER — un horodatage Git, qui n'est PAS une horloge. Il ne sert
    # qu'à borner la fraîcheur par le bas, donc à raccourcir. Il ne définit
    # jamais l'heure : c'est pourquoi il n'intervient que par un `max`, et
    # jamais comme valeur de repli.
    for b in "${LEASE_BASES[@]+"${LEASE_BASES[@]}"}"; do
        local d
        d=$(git log -1 --format=%ct "$b" 2>/dev/null || echo 0)
        [[ "$d" =~ ^[0-9]+$ ]] && (( d > plancher_fiable )) && plancher_fiable=$d
    done

    (( plancher_fiable > runner_now )) && runner_now=$plancher_fiable
    LEASE_NOW="$runner_now"
    echo "$runner_now"
}

# Forme + NON-VACUITÉ. Toute lease illisible est ROUGE, jamais ignorée : sans
# cette borne, un état que l'analyseur ne comprend plus rendrait « 0 lease
# extraite = rien à autoriser », vert par vacuité — la panne exacte que ce
# mécanisme existe pour interdire.
LEASE_BASES=()
LEASE_IDS=()
lease_valider() {
    local brutes=${#LEASES[@]} lues=0 l
    for l in "${LEASES[@]+"${LEASES[@]}"}"; do
        [[ -z "${l// }" ]] && lease_rouge "lease vide dans l'état — l'état ne se lit pas."
        IFS='|' read -r w prop chemins base sujet ouvert expire etat <<< "$l"
        [[ -n "$w" && -n "$prop" && -n "$chemins" && -n "$base" && -n "$sujet" \
           && -n "$ouvert" && -n "$expire" && -n "$etat" ]] \
            || lease_rouge "lease « ${w:-?} » : champ manquant — 8 champs exigés."
        [[ "$etat" == "OPEN" || "$etat" == "CLOSED" ]] \
            || lease_rouge "lease « $w » : état « $etat » inconnu."
        local eo ee
        eo=$(lease_epoch "$ouvert") || lease_rouge "lease « $w » : openedAt non ISO-8601 UTC strict."
        ee=$(lease_epoch "$expire") || lease_rouge "lease « $w » : expiresAt non ISO-8601 UTC strict."
        (( ee > eo )) || lease_rouge "lease « $w » : expiresAt n'est pas postérieur à openedAt."
        (( ee - eo <= LEASE_DUREE_MAX_S )) \
            || lease_rouge "lease « $w » : durée $(( (ee-eo)/60 )) mn > 45 mn — la borne est dans le mécanisme."
        # Aucun motif : la comparaison est une ÉGALITÉ DE CHAÎNE, jamais une
        # regex. `[handle]` est donc un nom de répertoire Next.js parfaitement
        # légitime — ce qu'on interdit, c'est le joker et l'ancre, c'est-à-dire
        # tout ce qui ferait d'un chemin une FAMILLE de chemins.
        case "$chemins" in
            *'*'*|*'^'*|*'$'*|*'?'*) lease_rouge "lease « $w » : joker ou ancre interdit — chemins EXACTS uniquement." ;;
        esac
        # AUCUNE PROLONGATION IMPLICITE : renouveler, c'est un NOUVEAU windowId.
        # Deux enregistrements sous la même identité, c'est une réécriture
        # silencieuse d'une expiration active — refusée.
        case " ${LEASE_IDS[*]+${LEASE_IDS[*]}} " in
            *" $w "*) lease_rouge "windowId « $w » en double — une expiration active ne se réécrit pas, elle se remplace par une NOUVELLE lease." ;;
        esac
        LEASE_IDS+=("$w")
        LEASE_BASES+=("$base")
        lues=$((lues + 1))
    done
    (( lues == brutes )) \
        || lease_rouge "$lues lease(s) lue(s) pour $brutes enregistrée(s) — l'analyseur n'a pas compris l'état."
}

# Ce fichier est-il autorisé ? SIX conditions, toutes obligatoires.
LEASE_MOTIF=""
lease_autorise() {
    local fichier="$1" l maintenant
    LEASE_MOTIF=""
    (( ${#LEASES[@]} == 0 )) && return 1
    maintenant=$(lease_maintenant)
    for l in "${LEASES[@]}"; do
        IFS='|' read -r w prop chemins base sujet ouvert expire etat <<< "$l"
        [[ "$etat" == "OPEN" ]]      || continue
        [[ "$sujet" == "$BRANCH" ]]  || continue
        local trouve=false c
        IFS=',' read -ra _cs <<< "$chemins"
        for c in "${_cs[@]}"; do [[ "$c" == "$fichier" ]] && trouve=true && break; done
        [[ "$trouve" == "true" ]]    || continue
        git merge-base --is-ancestor "$base" HEAD 2>/dev/null \
            || { LEASE_MOTIF="lease « $w » : baseSha $base n'est pas un ancêtre de HEAD"; continue; }
        local ee; ee=$(lease_epoch "$expire") || continue
        if (( maintenant >= ee )); then
            LEASE_MOTIF="lease « $w » EXPIRÉE le $expire — une lease expirée ne s'annule pas, elle CESSE D'AUTORISER"
            continue
        fi
        LEASE_MOTIF="$w"
        return 0
    done
    return 1
}

lease_valider

# ── VOIE DE MAINTENANCE DU GUARD ────────────────────────────────────────────
# Le guard se gèle lui-même via "^scripts/guard-offline\.sh$". C'est le point :
# sans ça, n'importe quel commit peut vider FORBIDDEN_PATTERNS noyé au milieu
# de 40 autres fichiers, et rien ne le signale.
#
# Mais un guard qu'on ne peut plus modifier est un guard qu'on finira par
# bypasser. Cette voie est la SEULE issue, et elle est permanente — ce n'est
# pas une exemption de chantier à retirer après merge (le retrait serait
# lui-même bloqué : la « danse » en 2 commits ne peut pas se terminer sur un
# fichier auto-gelé). Elle exige DEUX conditions simultanées :
#
#   1. branche dédiée  ^hotfix/guard-[a-z0-9-]+$
#   2. le guard SEUL dans le diff (aucun autre fichier)
#
# Les deux sont visibles d'un coup d'œil sur la PR : nom de branche explicite,
# et un diff qui ne contient que le système de garde. Modifier le guard reste
# possible, mais plus jamais discrètement ni en passager clandestin d'un autre
# chantier.
#
# LE SYSTÈME DE GARDE = 2 fichiers, indissociables :
#   scripts/guard-offline.sh            les règles
#   .github/workflows/guard-offline.yml le runner CI qui les applique
# Le workflow tombe sous "^\.github/" (gelé) : sans cette entrée, la voie de
# maintenance bloquerait toute évolution du runner, ou forcerait à modifier les
# deux fichiers dans des PR séparées — le diff de branche vu par la CI contient
# les deux, et « guard SEUL » échouerait. Les deux ensemble, seuls, sont donc
# le périmètre légitime d'un chantier de maintenance du guard.
GUARD_SYSTEM_FILES=(
    "scripts/guard-offline.sh"
    ".github/workflows/guard-offline.yml"
)

is_guard_system_file() {
    local f="$1"
    for g in "${GUARD_SYSTEM_FILES[@]}"; do
        [[ "$f" == "$g" ]] && return 0
    done
    return 1
}

GUARD_MAINTENANCE=false
if [[ "$BRANCH" =~ ^hotfix/guard-[a-z0-9-]+$ ]]; then
    _only_guard_system=true
    while IFS= read -r _f; do
        [[ -z "$_f" ]] && continue
        is_guard_system_file "$_f" || _only_guard_system=false
    done <<< "$DIFF_FILES"
    if [[ "$_only_guard_system" == "true" ]]; then
        GUARD_MAINTENANCE=true
        echo "🔧 GUARD: mode maintenance — branche dédiée + système de garde seul dans le diff."
    fi
fi

VIOLATIONS=0
VIOLATING_FILES=()
LEASED_FILES=()

if [[ -z "$DIFF_FILES" ]]; then
    echo "✅ GUARD: aucun fichier modifié à vérifier."
    exit 0
fi

while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    # Voie de maintenance : le guard, et lui seul, sur une branche hotfix/guard-*.
    if [[ "$GUARD_MAINTENANCE" == "true" ]] && is_guard_system_file "$file"; then
        continue
    fi

    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]]; then
            # Une lease OUVERTE, NON EXPIRÉE, nommant EXACTEMENT ce fichier,
            # accordée à cette branche, sur ce SHA de base. Sinon : violation.
            if lease_autorise "$file"; then
                LEASED_FILES+=("$file — lease $LEASE_MOTIF")
                break
            fi
            VIOLATIONS=$((VIOLATIONS + 1))
            if [[ -n "$LEASE_MOTIF" ]]; then
                VIOLATING_FILES+=("$file (matched $pattern) — $LEASE_MOTIF")
            else
                VIOLATING_FILES+=("$file (matched $pattern)")
            fi
            break
        fi
    done
done <<< "$DIFF_FILES"

FILE_COUNT=$(echo "$DIFF_FILES" | grep -c . || echo 0)

echo "📋 GUARD: branche=$BRANCH, mode=$MODE, fichiers=$FILE_COUNT"
echo "🔑 GUARD/LEASE: ${#LEASES[@]} lease(s) dans l'état · now évalué = $(date -u -r "$(lease_maintenant)" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$(lease_maintenant)" +%Y-%m-%dT%H:%M:%SZ)"
if (( ${#LEASED_FILES[@]} > 0 )); then
    for lf in "${LEASED_FILES[@]}"; do echo "   🔓 $lf"; done
fi

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
