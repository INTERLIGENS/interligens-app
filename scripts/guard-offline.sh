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

    # ── LE CHEMIN DE DÉPLOIEMENT EXÉCUTABLE ─────────────────────────────────
    #
    #   Deployment safety is a property of the executable deployment path;
    #   a correct optional preflight is not a deployment guard.
    #
    # Le preflight livré le 2026-09-15 était correct et démontré. Il n'était pas
    # GOUVERNÉ : ses trois surfaces — le moteur qui rejoue le filtre du CLI, le
    # vocabulaire de refus, et `GENERATED_ALLOWED`, la SEULE soupape du
    # prédicat — pouvaient être modifiées par n'importe quel commit, au milieu
    # de n'importe quel chantier.
    #
    # Sans ces entrées, nous aurions protégé la porte tout en laissant n'importe
    # qui modifier la serrure : il suffisait d'ajouter une ligne dans
    # `GENERATED_ALLOWED` pour faire passer n'importe quel fichier hors commit,
    # et la porte serait restée verte en le disant.
    #
    # Les trois fichiers sont indissociables, et le gel les prend tous les
    # trois — geler le moteur en laissant l'orchestrateur ou le wrapper ouverts
    # ne protégerait rien : c'est le wrapper qui décide si le garde est appelé.
    "^scripts/preflight/"                        # moteur + vocabulaire + GENERATED_ALLOWED
    "^scripts/preflight-deploy\.mjs$"            # les quatre portes et le marqueur
    "^scripts/deploy-production\.mjs$"           # LE chemin : preflight → vercel épinglé → deploy

    # ── LE FILTRE, ET L'ORACLE — les deux moitiés qui manquaient ────────────
    #
    #   A filter that defines the deployment comparison universe is part of
    #   the deployment authority and must be governed with the guard it
    #   configures.
    #
    # 1. LE FILTRE. Le prédicat du §3 est une ÉGALITÉ :
    #
    #        manifeste d'upload − GENERATED_ALLOWED  ==  HEAD filtré
    #
    #    « filtré » par QUOI ? Par `.vercelignore`, et par lui seul — mesuré
    #    dans `getVercelIgnore2` : `.gitignore` figure dans la liste codée en
    #    dur du CLI, donc EXCLU DU TÉLÉVERSEMENT, jamais lu comme règle.
    #
    #    Le même filtre s'applique aux DEUX TERMES de l'égalité. Y ajouter une
    #    ligne retire donc le fichier du manifeste ET du HEAD filtré : les deux
    #    côtés bougent ensemble, l'égalité tient, LE PREFLIGHT RESTE VERT — et
    #    le fichier cesse silencieusement de partir en production. Le contrôle
    #    ne peut pas voir ça : il compare deux ensembles que le filtre définit.
    #
    #    Qui contrôle le filtre contrôle ce qui « doit » être déployé. C'est une
    #    partie de l'AUTORITÉ du preflight, pas un réglage à côté de lui.
    #
    #    ⚠️ `^\.vercel/` ne le couvrait PAS : ce motif exige un slash, et
    #    `.vercelignore` n'en a pas à cet endroit. Mesuré motif par motif sur
    #    l'ensemble de FORBIDDEN_PATTERNS : aucun ne matchait.
    #
    #    `.nowignore` est gelé avec lui, et ce n'est pas du zèle : le CLI lit
    #    LES DEUX (`buildIgnore`), et `.nowignore` seul EST le filtre. La forme
    #    est gouvernée, pas l'instance trouvée — c'est la même doctrine que
    #    `.env*` dans le vocabulaire des secrets.
    #
    # 2. L'ORACLE. Geler le mécanisme en laissant ses tests libres, c'est geler
    #    le garde et laisser affaiblir ce qui dit s'il est correct. Le cliquet
    #    de cardinalité de `GENERATED_ALLOWED` en fait partie PAR CONSTRUCTION :
    #    la soupape ne peut s'élargir qu'au prix de DEUX modifications, dans
    #    DEUX fichiers — et la seconde est ce test. Non gelé, il suffisait
    #    d'élargir le test dans une PR ordinaire, puis la soupape dans une PR
    #    de maintenance qui n'aurait plus rien eu à justifier.
    #
    #    ⚠️ CHEMINS EXACTS, PAS `^__tests__/preflight/`. Un préfixe de
    #    répertoire gèlerait aussi les tests GÉNÉRIQUES à venir — un chargeur
    #    de fixture, une mesure de durée — qui ne portent aucune frontière de
    #    sécurité, et transformerait chaque ajout en PR de maintenance. Seuls
    #    les tests NORMATIFS sont ici. Les deux fichiers présents le sont
    #    intégralement : classés bloc par bloc, aucun n'est générique.
    #
    #    Le coût, dit franchement : un futur test normatif ne sera pas protégé
    #    tant que son chemin n'est pas ajouté ici. C'est pourquoi le cliquet de
    #    CLASSEMENT vit dans deploy-path.test.ts — tout fichier de
    #    `__tests__/preflight/` qui n'est ni gelé ni déclaré générique rougit.
    "^\.vercelignore$"                           # LE filtre : il définit l'univers comparé
    "^\.nowignore$"                              # l'autre nom du même filtre (buildIgnore lit les deux)
    "^__tests__/preflight/upload-set\.test\.ts$" # l'oracle : cliquet GENERATED_ALLOWED, portes, fail-closed
    "^__tests__/preflight/deploy-path\.test\.ts$" # l'oracle : séquence, épinglage, gel, cliquet de classement

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
    # ── T2-HOTFIX-DEPLOYMENT-GUARD ───────────────────────────────────────────
    # LA PREMIÈRE LEASE OUVERTE PAR NÉCESSITÉ MESURÉE, et il faut dire laquelle.
    #
    # La consigne de la fenêtre supposait que `hotfix/guard-*` suffisait à
    # toucher `package.json`. MESURÉ, c'est faux : la voie de maintenance
    # n'ouvre QUE `GUARD_SYSTEM_FILES`, et seulement quand ils sont SEULS dans
    # le diff. Le câblage a besoin de quatre chemins gelés que cette voie ne
    # couvre pas. Ils ne passent donc pas par un élargissement de la voie de
    # maintenance — qui les ouvrirait pour toujours, sur toute branche
    # `hotfix/guard-*` — mais par une lease : bornée, nominative, expirable.
    #
    #   package.json                      expose `deploy:prod` (UNE ligne)
    #   scripts/preflight-deploy.mjs      son en-tête affirmait « ce fichier
    #                                     n'est pas un script package.json » et
    #                                     que l'épinglage était structurellement
    #                                     impossible : les deux deviennent faux
    #   scripts/preflight/vocabulary.mjs  son bloc analyst.png affirmait « le
    #                                     preflight reste ROUGE dessus »
    #   scripts/deploy-production.mjs     le wrapper CRÉÉ par ce chantier, et
    #                                     gelé par ce même commit — sans la
    #                                     lease, sa création serait refusée
    #
    # Les deux fichiers de prose ne sont pas de la cosmétique : ils sont la
    # DESCRIPTION d'un contrôle. Les laisser affirmer le contraire de ce que le
    # mécanisme fait désormais, c'est exactement la prose adjacente qui finit
    # par faire autorité à la place du code.
    #
    # 45 minutes, la borne du mécanisme. Le sujet est la branche de câblage, pas
    # celle-ci : le nom SÉLECTIONNE, la lease AUTORISE.
    # FERMÉE le 2026-09-15T08:46Z, le câblage mergé (418b6d7). Retirer une
    # lease NARROWS, donc n'exige aucune autorité — mais passe quand même par
    # la voie de maintenance, parce que toute ÉCRITURE de l'état passe par le
    # guard. C'est ce qui fait qu'il n'y a pas de prolongation silencieuse :
    # il n'y a pas d'écriture silencieuse.
    #
    # Elle n'est pas laissée à expirer d'elle-même. Une lease périmée cesse
    # bien d'autoriser, mais un enregistrement OPEN qui traîne dans `main`
    # ressemble à une exemption, et c'est précisément la confusion que
    # « STATIC PROJECT EXEMPTIONS = 0 » existe pour interdire.
    #
    #   T2-HOTFIX-DEPLOYMENT-GUARD | cablage-du-chemin-de-deploiement
    #   4 chemins · hotfix/deployment-preflight-wiring
    #   2026-09-15T08:30:00Z → 09:15:00Z (45 mn) · consommée à 08:34

    # ── T2-GEL-DU-FILTRE ─────────────────────────────────────────────────────
    # UN SEUL chemin, et c'est le minimum strict : le commit ci-dessus gèle
    # `deploy-path.test.ts`, et c'est ce même fichier qui doit porter le cliquet
    # de CLASSEMENT — celui qui rougit sur tout test de `__tests__/preflight/`
    # ni gelé ni déclaré générique.
    #
    # L'ordre est contraint et il n'y a pas d'autre découpe possible :
    #   le motif doit exister dans `main` AVANT que le test puisse l'affirmer,
    #   et le test doit être GELÉ pour que son affirmation ne puisse plus être
    #   retirée. Les deux gestes ne tiennent donc pas dans la même PR — la CI
    #   juge avec le guard de `main`, pas celui de la branche.
    #
    # `upload-set.test.ts` n'est PAS dans la lease : il est gelé par le même
    # commit et n'a aucune raison d'être touché. Une lease n'ouvre que ce dont
    # on démontre le besoin.
    # FERMÉE le 2026-09-15T09:20Z, le cliquet mergé (69579cb). Consommée à
    # 09:14, dans sa fenêtre. Le sujet n'existe plus : la branche est supprimée.
    #
    # Deuxième lease du dépôt, même discipline que la première : fermée, pas
    # laissée expirer. Une lease périmée cesse d'autoriser, mais un
    # enregistrement OPEN qui traîne dans `main` RESSEMBLE à une exemption.
    #
    #   T2-GEL-DU-FILTRE | cliquet-de-classement-de-l-oracle
    #   1 chemin · hotfix/preflight-oracle
    #   2026-09-15T09:10:00Z → 09:55:00Z (45 mn) · consommée à 09:14

    # ── CC-OFFLINE-217-SEPARATION-AUTORITES ──────────────────────────────────
    # DEUX chemins, et c'est le minimum strict : ce sont les deux SEULS sites du
    # dépôt où ADMIN_TOKEN sert de clé de pseudonymisation.
    #
    #   src/lib/osint/retail/ipHash.ts      le repli `|| ADMIN_TOKEN`
    #   src/app/api/admin/intake/route.ts   ADMIN_TOKEN en clé DIRECTE, pour
    #                                       ipHash ET userAgentHash
    #
    # Invariant ratifié par l'architecte, et c'est lui qui justifie la lease :
    # « un credential d'authentification ne doit pas servir de clé de
    # pseudonymisation ; là où le coût mesuré de la continuité historique est
    # nul, la rotation doit SUPPRIMER le couplage plutôt que préserver un
    # secret dérivé compromis. »
    #
    # POURQUOI CE N'EST PAS REPORTABLE APRÈS LA ROTATION. ADMIN_TOKEN est
    # compromis ET vivant. Le geste que l'inventaire prescrivait encore —
    # recopier sa valeur dans OSINT_RETAIL_IP_SALT pour « figer le sel » —
    # promouvrait une valeur fuitée au rang de clé de pseudonymisation
    # permanente. La séparation doit donc précéder la rotation, pas la suivre.
    #
    # CE QUI N'EST PAS DANS LA LEASE, ET POURQUOI :
    #   vitest.config.ts   gelé lui aussi, et il aurait porté un commentaire
    #                      expliquant pourquoi les deux nouveaux sels n'y sont
    #                      pas. Retiré du chantier : le commentaire a été
    #                      déplacé dans le fichier de test qu'il protège. Une
    #                      lease n'ouvre que ce dont on démontre le besoin, et
    #                      un gain narratif n'est pas un besoin.
    #   src/lib/security/  investigatorAuth.ts hache l'IP sous un littéral non
    #                      salé. Dette réelle, NOMMÉE et non corrigée : elle ne
    #                      dépend pas d'ADMIN_TOKEN, donc elle ne bloque pas la
    #                      rotation. Hors périmètre, donc hors lease.
    #
    # 45 minutes, la borne du mécanisme. Le sujet est la branche du chantier :
    # le nom SÉLECTIONNE, la lease AUTORISE.
    # FERMÉE le 2026-09-15T12:43Z, la séparation mergée (41b97ef). Consommée à
    # 12:37, dans sa fenêtre — 5 minutes sur les 45 ouvertes.
    #
    # Troisième lease du dépôt, même discipline que les deux premières : fermée,
    # pas laissée expirer. Une lease périmée cesse bien d'autoriser, mais un
    # enregistrement OPEN qui traîne dans `main` RESSEMBLE à une exemption — et
    # c'est précisément la confusion que « STATIC PROJECT EXEMPTIONS = 0 »
    # existe pour interdire.
    #
    # Le sujet n'existe plus : la branche a été supprimée au merge.
    #
    #   CC-OFFLINE-217-SEPARATION-AUTORITES | separation-des-autorites-de-secret
    #   2 chemins · feat/cc-offline-217-separation-autorites-secret
    #   2026-09-15T12:32:00Z → 13:17:00Z (45 mn) · consommée à 12:37

    # ── CC-OFFLINE-236-VERDICT-BADGE ─────────────────────────────────────────
    # UN SEUL chemin, et c'est le minimum strict.
    #
    # L'architecte a autorisé trois fichiers ; UN SEUL est gelé. Les deux pages
    # `cases/lab` qui alimentent le composant vivent sous `src/app/` et ne
    # demandent aucune autorité. Une lease n'ouvre que ce dont on démontre le
    # besoin — pas ce qu'on a le droit d'ouvrir.
    #
    #   src/components/cases/TokenCasefileView.tsx
    #
    # Motif, et il n'est pas cosmétique : CC-OFFLINE-234 a déclaré
    # `token_casefiles.verdict` LEGACY / NON-AUTHORITATIVE et l'a retiré des deux
    # projections autoritatives. Ce composant en reste la DERNIÈRE consommation
    # connue — une lecture Prisma directe, rendue comme un badge coloré contre le
    # TigerScore.
    #
    #   UNE AUTORITÉ N'EST PAS RETIRÉE SI UNE SURFACE PRODUIT CONTINUE
    #   À LA PRÉSENTER COMME AUTORITATIVE.
    #
    # Le patch existe déjà : écrit, compilé et vérifié pendant CC-OFFLINE-234,
    # puis REVERTI quand le garde l'a refusé. Il n'a pas été contourné.
    #
    # 45 minutes, la borne du mécanisme. Le sujet SÉLECTIONNE, la lease AUTORISE.
    # FERMÉE le 2026-09-16T11:11Z, le retrait mergé (991b2f6). Consommée à 11:09,
    # soit 11 minutes après l'ouverture — dans sa fenêtre, et de loin.
    #
    # Quatrième lease du dépôt, même discipline que les trois premières : fermée,
    # pas laissée expirer. Une lease périmée cesse bien d'autoriser, mais un
    # enregistrement OPEN qui traîne dans `main` RESSEMBLE à une exemption, et
    # c'est exactement ce que « STATIC PROJECT EXEMPTIONS = 0 » interdit.
    #
    # Le sujet n'existe plus : la branche a été supprimée au merge.
    #
    #   CC-OFFLINE-236-VERDICT-BADGE | retrait-de-la-derniere-consommation-du-verdict-legacy
    #   1 chemin · feat/cc-offline-236-verdict-badge-removal
    #   2026-09-16T10:58:00Z → 11:43:00Z (45 mn) · consommée à 11:09

    # ── CC-OFFLINE-246-EXPOSITION-ROUTE ──────────────────────────────────────
    # UN SEUL chemin, et c'est le minimum strict.
    #
    #   src/app/api/casefile/pdf/route.ts
    #
    # CF-3 (CC-OFFLINE-244) a livré l'assemblage, la projection par audience et
    # le renderer gouverné — tous testés, tous mergés. Il manque UNE ligne de
    # câblage : la route canonique n'appelle pas encore ce chemin. Le patch
    # `?template=governed` a été écrit, compilé et vérifié pendant CF-3, puis
    # REVERTI quand le garde l'a refusé. Il n'a pas été contourné.
    #
    #   UNE PREUVE PRÉSENTE DANS LA SOURCE MAIS ABSENTE DE LA PAGE RENDUE
    #   N'EST PAS UNE PREUVE FOURNIE.
    #
    # Les gabarits `public` et `internal` de cette route ne sont PAS touchés :
    # la branche est AJOUTÉE, en fail-closed.
    #
    # 45 minutes, la borne du mécanisme. Le sujet SÉLECTIONNE, la lease AUTORISE.
    #
    # CONSOMMÉE ET FERMÉE — le câblage est sur `main` (462d6ba), un seul fichier
    # dans le diff, vérifié par `gh pr view 470 --json files`. La route expose
    # `?template=governed` ; `public` et `internal` sont intacts.
    #
    #   CC-OFFLINE-246-EXPOSITION-ROUTE | exposition-de-la-route-canonique
    #   1 chemin · feat/cc-offline-246-lease-route-canonique-exposition
    #   2026-09-16T13:06:00Z → 13:51:00Z (45 mn) · consommée à 13:18

    # ── CC-OFFLINE-280-CASEFILE-CTA-VERIDIQUE ────────────────────────────────
    # UN SEUL chemin, et l'architecte l'a nommé lui-même.
    #
    #   src/components/CaseFileCTA.tsx
    #
    # OBJET STRICTEMENT BORNÉ, repris mot pour mot du ruling : retirer
    # l'assertion inconditionnelle et statique « DETECTIVE REFERENCED », et
    # rendre le contrôle CaseFile VRAI sous l'autorité courante.
    #
    # Mesuré en anonyme sur le runtime servi : `/api/casefile/public` rend 401
    # NOMINATIVE_ACCESS_REQUIRED. `handleOpen` ouvrait un onglet sur une erreur
    # JSON ; `handleDownload` affichait « PDF generation failed » — un
    # DIAGNOSTIC FAUX : rien n'avait échoué à se générer, le visiteur n'avait
    # jamais été autorisé.
    #
    #   UN CONTRÔLE ACTIF EST UNE PROMESSE DE LIVRAISON.
    #
    # ⛔ AUCUN FICHIER GELÉ ADJACENT. La raison affichée doit être CAUSALEMENT
    #    DÉRIVÉE d'une autorité existante — le renderer n'en invente aucune.
    #
    # 30 minutes : durée pratique MINIMALE, la consigne le demande.
    #
    # CONSOMMÉE ET FERMÉE — le correctif est sur `main` (d6e5e08). Un seul
    # fichier gelé dans le diff, vérifié par `gh pr view 489 --json files` ; les
    # deux pages de démo qui remontent le contrôle ne sont pas gelées.
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ. Aucun fichier gelé adjacent.
    #
    #   CC-OFFLINE-280-CASEFILE-CTA-VERIDIQUE | casefile-cta-veridique
    #   1 chemin · feat/cc-offline-280-casefile-cta-veridique
    #   2026-09-17T10:30:00Z → 11:00:00Z (30 mn) · consommée à 10:41

    # ── CC-OFFLINE-282-COUVERTURE-GRAVITE-LEGACY ─────────────────────────────
    # TROIS chemins gelés, et l'architecte en avait nommé quatre. La différence
    # est MESURÉE, pas négociée :
    #
    #   src/app/api/v1/score/route.ts          A · contrat de couverture
    #   src/components/scan/RetailVerdictBanner.tsx   B · projection UI
    #   src/app/api/scan/solana/route.ts       C · retrait du legacy
    #
    # ⚠️ DEUX RÉSOLUTIONS DE CHEMIN, CONSIGNÉES AVANT OUVERTURE :
    #
    #   `canonicalDecision.ts` — UNE SEULE implémentation dans tout le dépôt,
    #   `src/lib/prebuy/canonicalDecision.ts`, et c'est bien celle que
    #   `projectPreBuy` importe. Elle N'EST PAS GELÉE : aucune lease n'est
    #   ouverte pour elle. Ouvrir une lease sur un chemin libre serait une
    #   fiction, et c'est une doctrine ratifiée de ce dépôt.
    #
    #   `RetailVerdictBanner` — le ruling nommait
    #   `src/components/RetailVerdictBanner.tsx`. CE FICHIER N'EXISTE PAS. Le
    #   composant réellement monté par les trois pages de démo est
    #   `src/components/scan/RetailVerdictBanner.tsx`, et c'est LUI qui porte la
    #   boucle de remplissage. C'est donc lui qui est ouvert, et lui seul.
    #
    # ⛔ Aucun fichier gelé adjacent. ⛔ Aucune expansion par joker.
    #
    # Le code est ÉCRIT, TESTÉ et VERT avant l'ouverture : la lease ne couvre
    # que les commits. 30 minutes, durée pratique minimale.
    #
    # CONSOMMÉE ET FERMÉE — les trois étapes A, B et C sont commitées, en
    # 47 SECONDES de lease vivante (11:14:03Z → 11:14:50Z), sur une borne de
    # 30 minutes. Le code était écrit, testé et vert AVANT l'ouverture : la
    # lease n'a couvert que les commits, et c'est tout ce qu'elle doit couvrir.
    #
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : trois chemins gelés, exactement
    # ceux listés. Aucun fichier gelé adjacent. `canonicalDecision.ts` et les
    # pages de démo, non gelés, n'ont jamais eu besoin d'elle.
    #
    # ÉCART DÉCLARÉ : une seule PR pour trois étapes, au lieu de trois. Le
    # champ `sujet` d'une lease lie UNE branche ; livrer A, B et C sur trois
    # branches aurait exigé trois leases, donc trois fois la surface ouverte.
    # Les trois étapes restent trois COMMITS distincts, avec leurs messages.
    #
    #   CC-OFFLINE-282-COUVERTURE-GRAVITE-LEGACY | couverture-gravite-legacy
    #   3 chemins · feat/cc-offline-282-couverture-positive
    #   2026-09-17T11:05:00Z → 11:35:00Z (30 mn) · consommée à 11:14:50

    # ── CC-OFFLINE-288-AFFICHAGE-LEGACY ──────────────────────────────────────
    # UN SEUL chemin, DÉJÀ autorisé pour l'étape C, et le MÊME objectif.
    #
    #   src/app/api/scan/solana/route.ts
    #
    # POURQUOI UNE SECONDE LEASE. Le témoin réel exigé par le ruling a montré le
    # premier passage de C INCOMPLET : les claims legacy ne SCORAIENT plus, mais
    # BOTIFY rendait toujours `off_chain.status = "Confirmed"` et ses huit
    # claims, chacune marquée CONFIRMED.
    #
    #   RETIRER L'AUTORITÉ DE SCORE NE SUFFIT PAS :
    #   UNE CLAIM AFFICHÉE « CONFIRMED » FAIT AUTORITÉ À L'ÉCRAN.
    #
    # C'est la preuve qui a trouvé le manque — c'est exactement pourquoi elle
    # est exigée. Aucun périmètre nouveau : même fichier, même étape C, même
    # frontière, appliquée à la présentation comme elle l'était au score.
    #
    # ⛔ Aucun fichier gelé adjacent. Le code est écrit, testé et vert avant
    #    l'ouverture. 15 minutes.
    #
    # CONSOMMÉE ET FERMÉE — en 2 secondes de lease vivante (11:29:06Z →
    # 11:29:08Z), sur une borne de 15 minutes. Le code était écrit, testé et
    # vert avant l'ouverture.
    #
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : un chemin, celui de l'étape C.
    #
    #   CC-OFFLINE-288-AFFICHAGE-LEGACY | affichage-legacy-retire
    #   1 chemin · feat/cc-offline-288-affichage-legacy
    #   2026-09-17T11:20:00Z → 11:35:00Z (15 mn) · consommée à 11:29:08

    # ── CC-OFFLINE-290-LEGACY-SURFACE-MACHINE ────────────────────────────────
    # UN SEUL chemin, DÉJÀ autorisé pour l'étape A, et le MÊME objectif que C.
    #
    #   src/app/api/v1/score/route.ts
    #
    # POURQUOI. Le témoin réel a montré une ASYMÉTRIE : `/api/scan/solana` avait
    # cessé de consommer les claims du fichier plat, mais la route de DÉCISION
    # MACHINE continuait. BOTIFY y rendait `BLOCK` sur un score de 70 DÉRIVÉ DES
    # MÊMES assertions que l'autorité gouvernée refuse.
    #
    #   LE LEGACY NE PRIME PAS SUR L'AUTORITÉ GOUVERNÉE —
    #   ET LA DÉCISION DE SWAP EST LA SURFACE QUI COMPTE LE PLUS.
    #
    # Aucun périmètre nouveau : même frontière, même étape C, sur l'autre
    # surface. Le délta mesuré est rapporté sans être maquillé.
    #
    # ⛔ Aucun fichier gelé adjacent. Code écrit, testé, vert. 15 minutes.
    #
    # CONSOMMÉE ET FERMÉE — 1 seconde de lease vivante, sur une borne de 15 mn.
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : un chemin.
    #
    #   CC-OFFLINE-290-LEGACY-SURFACE-MACHINE | legacy-surface-machine
    #   1 chemin · feat/cc-offline-290-legacy-surface-machine
    #   2026-09-17T11:35:00Z → 11:50:00Z (15 mn) · consommée à 11:42:14

    # ── CC-OFFLINE-294-SCORE-SOUS-UNVERIFIED ─────────────────────────────────
    # UN SEUL chemin, et l'architecte l'a nommé lui-même dans le ruling.
    #
    #   src/components/scan/RetailVerdictBanner.tsx
    #
    # POURQUOI. CC-OFFLINE-292 a fermé la PERMISSION : `computeScore([])` ne
    # peut plus rendre ALLOW machine, SAFE partenaire, ni SAFE/CLEAN/Proceed
    # retail. Il restait la DERNIÈRE MOITIÉ, et elle est PUREMENT VISUELLE : la
    # bannière servait encore le nombre de repli à un humain sous le libellé
    # « RISK SCORE ».
    #
    #   UN REPLI INTERNE N'EST PAS UNE MESURE HUMAINE.
    #   PRÉSENTER SON NOMBRE LUI REDONNE UNE AUTORITÉ QUE LA MESURE
    #   NE LUI DONNE PAS.
    #
    # OBJET STRICTEMENT BORNÉ : l'encadré numérique n'est plus MONTÉ quand
    # `nonVerifie` — la variable EXISTANTE, celle de CC-OFFLINE-284. Aucune
    # seconde règle, aucun seuil, aucun nombre en dur.
    #
    # ⛔ AUCUNE SUBSTITUTION. Ni zéro, ni tiret, ni « N/A » : la présentation
    #    est RETENUE, jamais remplacée — inventer un nombre serait le défaut
    #    symétrique.
    # ⛔ UN SCORE RÉELLEMENT MESURÉ N'EST PAS MASQUÉ : couverture suffisante,
    #    `undefined`, RED et ORANGE gardent tous leur nombre.
    # ⛔ AUCUN FICHIER GELÉ ADJACENT. Les deux autres présentations numériques
    #    (anneau, preuve « Score ») vivent sur les pages de démo, LIBRES.
    #    `ClusterRiskBadge.tsx` reste FERMÉ : la trace causale a établi le
    #    CAS A, donc aucun changement de code — ouvrir une lease sur un
    #    fichier qu'on ne touche pas serait une fiction.
    #
    # Code ÉCRIT, TESTÉ et VERT avant l'ouverture : M12 injecté et mesuré ROUGE
    # (4 témoins rendus en jsdom), contrôle « score légitime encore affichable »
    # vert. La lease ne couvre que la minute de la PR. 30 minutes — la borne
    # pratique d'un cycle CI complet sur ce dépôt, sous les 45 mn du mécanisme.
    #
    # CONSOMMÉE ET FERMÉE — ouverte 12:35, exercée au commit 12:40:19, PR #502
    # fusionnée 12:45. Elle n'est pas laissée expirer : une lease périmée cesse
    # d'autoriser, mais un enregistrement OPEN qui traîne est un mensonge sur
    # l'état.
    #
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : un chemin, vérifié par
    # `gh pr view 502 --json files` — les trois autres fichiers du diff sont
    # LIBRES (deux pages de démo, un fichier de témoins).
    #
    #   CC-OFFLINE-294-SCORE-SOUS-UNVERIFIED | score-sous-unverified
    #   1 chemin · feat/cc-offline-294-score-sous-unverified
    #   2026-09-17T12:35:00Z → 13:05:00Z (30 mn) · consommée à 12:40:19

    # ── CC-OFFLINE-296-SURFACES-HUMAINES ─────────────────────────────────────
    # TROIS chemins, et l'architecte les a accordés un par un, après que §0 a
    # remonté la liste complète en une seule fois.
    #
    #   src/components/TigerRevealCard.tsx
    #   src/components/scan/AdvancedSignals.tsx
    #   src/app/api/scan/ask/route.ts
    #
    # POURQUOI. Le témoin humain du fondateur a mesuré, sur le servi et sous un
    # bandeau UNVERIFIED : « Score 20/100. Relatively clean — no major flags
    # from this scan. » SIX surfaces vivantes partageaient une frontière —
    # `AnalysisSummary` — dont `tierToVerdict` traduisait un GREEN NON COUVERT
    # en `LOW`. Quatre se ferment sur des chemins LIBRES. Trois ne le peuvent
    # pas, et voici pourquoi, chemin par chemin.
    #
    #   UNKNOWN ≠ LOW ≠ CLEAN ≠ SAFE ≠ ALLOW.
    #
    # ① TigerRevealCard — la chaîne « Verdict: {tier} » est À L'INTÉRIEUR du
    #   composant, dont la seule entrée est `tier: "GREEN"|"ORANGE"|"RED"`.
    #   Aucune valeur transmissible ne l'évite ; le seul levier externe serait
    #   de ne pas monter la carte, ce qui détruirait AUSSI la liste de proofs
    #   qu'elle rend. On conditionne une affirmation, on n'ampute pas une
    #   surface. Prop optionnelle, `undefined` = historique.
    #
    # ② AdvancedSignals — `"low"` était la branche PAR DÉFAUT de la cascade
    #   `kolLvl`. `null`, `""`, `"UNKNOWN"`, `"GREEN"` y tombaient toutes :
    #   « Influence: Low » était CRÉÉ par le seul repli vert. Les deux
    #   autorités RÉELLES — `manipulationLevel` red/orange, et une gravité de
    #   palier — passent d'abord et INTACTES.
    #
    # ③ api/scan/ask — la prémisse `VERDICT: LOW (relatively clean…)` se
    #   corrige à la SOURCE (normalizer, libre) : la route la projette, elle ne
    #   la fabrique pas. Ce qui EXIGE la lease, ce sont les EXEMPLAIRES DE TON
    #   « GOOD », qui enseignaient inductivement la réassurance avant même que
    #   le modèle lise le verdict.
    #
    #   LE LLM NE PEUT PAS RECEVOIR UNE AFFIRMATION PLUS FORTE QUE L'AUTORITÉ
    #   QUI LUI FOURNIT SON CONTEXTE.
    #
    # ⛔ AUCUN QUATRIÈME CHEMIN GELÉ. `ExplanationLayer.tsx` et
    #    `AskInterligensChat.tsx` ne contiennent AUCUNE occurrence de
    #    `verdict` ; `TokenPicker.tsx` est `type="button"` et jamais désactivé ;
    #    `api/mobile/v1/ask` indexe ses tables par `string`. Aucun n'a été
    #    demandé « par précaution ».
    #
    # Code ÉCRIT, TESTÉ et VERT avant l'ouverture : 60 témoins de lot, dont un
    # témoin DOM qui rend la page entière et clique les contrôles réellement
    # rendus. M13–M18 injectés et mesurés ROUGES, un par un. 40 minutes — la
    # borne pratique d'un cycle CI sur trois fichiers, sous les 45 du mécanisme.
    #
    # CONSOMMÉE ET FERMÉE — ouverte 13:42, exercée au commit 13:47:11, PR #505
    # fusionnée 13:52. Elle n'est pas laissée expirer : une lease périmée cesse
    # d'autoriser, mais un enregistrement OPEN qui traîne est un mensonge sur
    # l'état.
    #
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : les TROIS chemins accordés, et
    # eux seuls, vérifié par `gh pr view 505 --json files` — 14 fichiers au
    # diff, dont 11 LIBRES (deux pages de démo, la troisième implémentation
    # dupliquée, la couche d'explication, trois fichiers de témoins).
    #
    #   CC-OFFLINE-296-SURFACES-HUMAINES | surfaces-humaines
    #   3 chemins · feat/cc-offline-296-surfaces-humaines
    #   2026-09-17T13:42:00Z → 14:22:00Z (40 mn) · consommée à 13:47:11

    # ── CC-OFFLINE-298-RESIDUS-SERVIS ────────────────────────────────────────
    # DEUX chemins, accordés après une passe de LECTURE SEULE qui a tracé les
    # trois résidus et n'a demandé que ce que la trace imposait.
    #
    #   src/components/scan/AdvancedSignals.tsx
    #   src/components/TigerRevealCard.tsx
    #
    # ① COORDINATION RISK « Low 20 ». `computeCabalScore` ouvre sur
    #   `let score = 20` — une BASE CONSTANTE (`src/lib/risk/cabal.ts:27`).
    #   Sans aucun driver, le score EST ce plancher et `LOW` n'en est que
    #   l'arithmétique : sous UNVERIFIED, la carte présentait une NON-MESURE
    #   comme un niveau établi.
    #
    #     UN PLANCHER ÉMIS EN L'ABSENCE DE MESURE N'EST PAS UNE MESURE.
    #
    #   `cabalVal`, `cabalLvl` et `cabalBadge` sont composés À L'INTÉRIEUR du
    #   composant, à partir d'un `computeCabalScore` appelé DANS le composant.
    #   La page ne passe ni score ni tier : AUCUNE valeur de prop ne peut
    #   empêcher « Low 20 » d'être rendu. ⛔ `cabal.ts` n'est pas touché, et
    #   toute VRAIE mesure — dès qu'un driver existe — est servie telle quelle.
    #
    # ② « AUDIT VERIFIED ». Littéral STATIQUE dans le JSX : aucune prop, aucun
    #   état, aucune condition, rendu sur CHAQUE scan — sur une page qui
    #   affirme par ailleurs que rien n'a été vérifié. La chaîne n'existait
    #   nulle part ailleurs dans le dépôt : aucun moteur d'audit ne la fondait.
    #   La page ne peut pas retirer un nœud qu'elle ne passe pas.
    #   ⛔ Ni renommé ni remplacé : retiré. Le titre et les proofs restent.
    #
    # ⛔ AUCUN TROISIÈME CHEMIN GELÉ. Le résidu « Scan this » — un frère
    #    postérieur en `-mt-20` qui recouvrait le TokenPicker de 80 px et
    #    captait ses clics — vit entièrement dans `src/app/en/demo/page.tsx`,
    #    LIBRE. Aucun chemin demandé par précaution.
    #
    # Code ÉCRIT, TESTÉ et VERT avant l'ouverture : 11 témoins de lot, M19–M21
    # injectés et mesurés ROUGES. 30 minutes.
    #
    # CONSOMMÉE ET FERMÉE — ouverte 14:20, exercée au commit 14:25:46, PR #508
    # fusionnée 14:31. Une lease périmée cesse d'autoriser, mais un
    # enregistrement OPEN qui traîne est un mensonge sur l'état.
    #
    # PÉRIMÈTRE EXERCÉ = PÉRIMÈTRE AUTORISÉ : les DEUX chemins accordés, et eux
    # seuls, vérifié par `gh pr view 508 --json files` — 5 fichiers au diff,
    # dont 3 LIBRES (la page de démo EN, deux fichiers de témoins).
    #
    #   CC-OFFLINE-298-RESIDUS-SERVIS | residus-servis
    #   2 chemins · feat/cc-offline-298-residus-servis
    #   2026-09-17T14:20:00Z → 14:50:00Z (30 mn) · consommée à 14:25:46

    # ── CC-OFFLINE-300-CADRAGE-ADVANCED-SIGNALS ──────────────────────────────
    # UN SEUL chemin, accordé après une passe de LECTURE SEULE.
    #
    #   src/components/scan/AdvancedSignals.tsx
    #
    # POURQUOI. Le badge « NOT ESTABLISHED » de COORDINATION RISK était COUPÉ à
    # droite. La cause est entièrement INTERNE au composant :
    #
    #   · `Chip` (:81) porte `whiteSpace: "nowrap"` mais AUCUN `flexShrink` ;
    #   · `bCard` (:144) n'a pas `minWidth: 0` — or un item de grille a
    #     `min-width: auto`, donc il ne peut PAS descendre sous la largeur de
    #     son contenu : l'ellipsis que `bVal` porte déjà ne s'active JAMAIS, et
    #     c'est la ligne entière qui déborde ;
    #   · la grille est figée à `repeat(2, 1fr)`, sans repli à une colonne.
    #
    # La page ne passe AUCUNE de ces valeurs : aucune prop transmissible ne
    # peut corriger le cadrage depuis l'extérieur.
    #
    # ⛔ PRÉSENTATION SEULE. Aucune donnée, aucun score, aucune autorité,
    #    aucune méthodologie. Les gardes d'influence (CC-OFFLINE-296) et de
    #    coordination (CC-OFFLINE-298) sont laissées intactes, et des témoins
    #    les tiennent.
    #
    # ⛔ AUCUN CHEMIN ADJACENT. Le second point du lot — la règle
    #    d'identité « plusieurs exactes sur une même chaîne ⇒ ambiguous » —
    #    vit dans `src/lib/marketProviders.ts`, LIBRE. Aucun chemin demandé
    #    par précaution.
    #
    # Code ÉCRIT, TESTÉ et VERT avant l'ouverture : 10 témoins, M22–M24
    # injectés et mesurés ROUGES. 25 minutes.
    "CC-OFFLINE-300-CADRAGE-ADVANCED-SIGNALS|cadrage-advanced-signals|src/components/scan/AdvancedSignals.tsx|2c83568a15c8d02a1c7b290564d2e875a0d7e130|feat/cc-offline-300-identite-et-cadrage|2026-09-17T14:57:00Z|2026-09-17T15:22:00Z|OPEN"
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
