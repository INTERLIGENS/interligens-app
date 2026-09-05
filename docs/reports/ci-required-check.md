# La CI devient bloquante — CC-OFFLINE-146

**Branche** : `feat/cc-offline-146-ci-required-check`
**Date** : 2026-09-05
**Prédécesseurs** : `ci-signal-classification.md` (141) · `ci-signal-restore.md` (142/143)
**État** : ✅ **P0 CI — CLOSED**

Étape 2 avait rendu le signal *lisible*. Celle-ci le rend *opposable* : un merge
qui ne satisfait pas les gardes est désormais refusé, et c'est démontré, pas
supposé.

---

## Résumé

| Étape | Verdict |
|---|---|
| G1 — Agrégateur vérifié | ✅ `needs:` complet, non-green fiable sur échec parent |
| G2 — Required status checks | ✅ **deux** checks, justifié par une contrainte technique |
| G3 — Démonstration du blocage | ✅ merge **refusé** sans `--admin`, PR/branche nettoyées |

---

## G1 — L'agrégateur, vérifié

```yaml
  all-gates-passed:
    name: All Security Gates Passed
    needs: [gitleaks, semgrep, audit, quality]
    if: always()
    steps:
      - name: Check all jobs
        run: |
          if [[ "${{ needs.gitleaks.result }}"  != "success" ]] ||
             [[ "${{ needs.semgrep.result }}"   != "success" ]] ||
             [[ "${{ needs.audit.result }}"     != "success" ]] ||
             [[ "${{ needs.quality.result }}"   != "success" ]]; then
            echo "❌ Un ou plusieurs security gates ont échoué."
            exit 1
          fi
```

**Le `needs:` couvre les quatre gates obligatoires** — `gitleaks`, `semgrep`,
`audit`, `quality` : la totalité des jobs de `security.yml` autres que
l'agrégateur lui-même.

**Il devient non-green de façon fiable.** Le test n'est pas `failure()` mais
`!= "success"` sur chaque parent, sous `if: always()`. Il attrape donc les trois
issues non-vertes — `failure`, `cancelled`, `skipped` — et pas seulement l'échec.
C'est ce qui compte ici : `security.yml` déclare `cancel-in-progress: true`, donc
un parent `cancelled` est un cas courant, pas théorique. Et si le run entier est
annulé, le job agrégateur l'est aussi : le check est alors `cancelled`, jamais
`success` — donc non satisfait, donc bloquant.

Vérifié sur des runs réels, pas seulement par lecture :

| Run | `gitleaks` | `semgrep` | `audit` | `quality` | **agrégateur** |
|---|---|---|---|---|---|
| [33970480505](https://github.com/INTERLIGENS/interligens-app/actions/runs/33970480505) | success | failure | failure | failure | **failure** |
| [33969980894](https://github.com/INTERLIGENS/interligens-app/actions/runs/33969980894) | success | failure | failure | failure | **failure** |
| [33973251708](https://github.com/INTERLIGENS/interligens-app/actions/runs/33973251708) | success | success | success | success | **success** |

Aucun cas où un parent non-vert laisse l'agrégateur vert.

### `Paths / branch guard` n'est PAS dans le `needs:` — et ne peut pas y être

C'est le point qui décide de G2.

```
.github/workflows/security.yml       jobs: gitleaks, semgrep, audit, quality, all-gates-passed
.github/workflows/guard-offline.yml  jobs: guard  ← name: "Paths / branch guard (règles de main)"
```

Le guard vit dans un **workflow différent**. `needs:` de GitHub Actions ne
relie que des jobs d'un même run de workflow : une dépendance inter-workflows
n'existe pas. L'ajouter au `needs:` de l'agrégateur est donc **impossible**, pas
seulement non trivial.

Et le déplacer dans `security.yml` serait sémantiquement faux :

- `guard-offline.yml` fait partie du **système de garde** (`GUARD_SYSTEM_FILES`),
  avec sa propre voie de maintenance gelée. Le fondre dans `security.yml` sortirait
  le runner du guard de son propre périmètre de protection ;
- son job a un `checkout` distinct (`ref: ${{ github.head_ref }}`, `fetch-depth: 0`)
  parce qu'il doit voir le **vrai nom de branche**, et il exécute délibérément le
  guard **d'`origin/main`**, pas celui de la PR. Rien de tout cela ne se transpose
  dans un job de `security.yml` sans réécrire les deux workflows ;
- il ne se déclenche que sur `pull_request`, quand `security.yml` tourne aussi sur
  `push`. Un `needs:` le rendrait `skipped` sur chaque push de branche — donc
  l'agrégateur rouge sur tous les push, pour rien.

**→ R3, seconde branche : les DEUX checks deviennent obligatoires.**

---

## G2 — Le ruleset

### Avant

```
protect-main (id 16637172) — enforcement: active — bypass_actors: []
conditions: ref_name include ["~DEFAULT_BRANCH"]
rules:
  - deletion
  - non_fast_forward
  - pull_request              (0 approbation, résolution des fils requise)
  - required_linear_history
```

**Aucun `required_status_checks`.** Aucun check n'était requis : `main` pouvait
être mergée rouge, et l'a été.

### Après

```
protect-main (id 16637172) — enforcement: active — bypass_actors: []
conditions: ref_name include ["~DEFAULT_BRANCH"]      ← inchangé
rules:
  - deletion                                          ← conservé
  - non_fast_forward                                  ← conservé
  - pull_request              (0 approbation, ...)    ← conservé
  - required_linear_history                           ← conservé
  - required_status_checks                            ← AJOUTÉ
      strict_required_status_checks_policy: false
      required_status_checks:
        ✓ All Security Gates Passed
        ✓ Paths / branch guard (règles de main)
```

Appliqué par `gh api --method PUT repos/INTERLIGENS/interligens-app/rulesets/16637172`,
en réinjectant les règles existantes telles quelles — l'API remplace le tableau
complet, une omission aurait silencieusement supprimé une règle.

### Deux choix explicites

**`strict_required_status_checks_policy: false`.** À `true`, chaque PR devrait
être à jour avec `main` avant merge — donc un rebase à chaque avancée de `main`.
C'est un changement de flux de travail, pas un durcissement de garde ; non demandé,
donc non fait.

**`bypass_actors: []`, inchangé.** Aucune voie de contournement n'a été créée.
`current_user_can_bypass: never` avant, `never` après.

---

## G3 — La démonstration

Une PR jetable, [#246](https://github.com/INTERLIGENS/interligens-app/pull/246),
portant un unique fichier de test qui échoue exprès :

```ts
it("échoue exprès, pour prouver que le merge est bloqué", () => {
  expect(1).toBe(2);
});
```

La chaîne s'est propagée exactement comme prévu :

```
FAILURE   Quality Gates                        ← Tests échoue
FAILURE   All Security Gates Passed            ← required check #1
SUCCESS   Paths / branch guard (règles de main) ← required check #2
SUCCESS   Dependency Audit
SUCCESS   SAST (Semgrep)
SUCCESS   Secret Scanning (Gitleaks)
```

Un seul des deux required checks est rouge — et c'est suffisant.

### Le merge est refusé

```
$ gh pr view 246 --json mergeable,mergeStateStatus
mergeable=MERGEABLE  mergeStateStatus=BLOCKED

$ gh pr merge 246 --rebase
X Pull request INTERLIGENS/interligens-app#246 is not mergeable:
  the base branch policy prohibits the merge.
```

`mergeable=MERGEABLE` signifie seulement « pas de conflit de contenu » ;
`mergeStateStatus=BLOCKED` est le verdict de la politique. Aucun `--admin`
n'a été employé — c'est précisément ce qui était à démontrer.

### Nettoyage

```
PR 246          : state=CLOSED   mergedAt=null
branche distante: supprimée
branche locale  : supprimée
fichier jetable : absent de origin/main, absent de l'arbre local
main            : 83a4e24, inchangé
```

Aucune régression réelle n'a été introduite, et rien de la démonstration n'a
atteint `main`.

---

## Attestation

| Point | État |
|---|---|
| PR requirement | **conservé** — règle `pull_request` intacte, 0 approbation, résolution des fils requise |
| Historique linéaire | **conservé** — `required_linear_history` + `non_fast_forward` intacts |
| Protection contre suppression | **conservé** — `deletion` intacte |
| Nouvelle voie de bypass | **aucune** — `bypass_actors: []` avant et après |
| Baisse de gate | **aucune** — aucun `continue-on-error` ajouté, aucun seuil relevé, aucun garde désactivé |
| Cliquet LINT (`fetch-depth`) | **non touché** — reste phase 3 |
| Workflows | **non modifiés** — `security.yml` et `guard-offline.yml` sont byte-identiques à `83a4e24` |

Le seul changement de cette étape est l'ajout d'une règle au ruleset. Aucun
fichier du dépôt n'est modifié en dehors de ce rapport.

---

## Ce que ça change, concrètement

Avant : `main` a accumulé 200 runs rouges sans que rien ne s'y oppose — la CI
observait, elle n'empêchait pas.

Maintenant : une PR dont les gardes ne sont pas vertes ne peut plus être mergée,
et le contournement demande des droits d'administrateur, donc un geste humain
délibéré et tracé.

**P0 CI = CLOSED.**

Reste ouvert, hors P0 : le durcissement de phase 3 — `fetch-depth: 0` pour que le
cliquet de lint compare réellement, et `--fail-on-prod` pour l'audit.
