# BUILD 9 — CE QUI RESTE AVANT LA CLÔTURE

Rendu depuis `main` refermé, guard `ce13d0c0…13e50`. Aucune exemption ouverte.

---

## 1 · CLASSIFICATION DE `/api/casefile/generate` (POST)

**Verdict : OUI, il appartient encore à la surface CaseFile active — pour une
partie de ses entrées. Il doit figurer au gate final.**

La route a deux modes, et ils ne se classent pas pareil.

| entrée | autorité | classement |
|---|---|---|
| `source=botify` / `source=vine` | **canonique** — les claims viennent de `CaseFileClaim` depuis l'étape 7 ; le preset ne fournit plus que chronologie et réquisitions, qu'aucune table ne porte | **DANS le gate final.** À exercer sur les deux fixtures. |
| `body.data` | aucune — données fournies par l'appelant à la génération | **HORS autorité.** Utilitaire de rendu, pas une projection de dossier. |

### Le trou trouvé en classant, et refermé

L'étiquette « Claims — HORS autorité canonique » ne s'affichait **que** si la
charge portait des `new_claims`. Une génération à la demande sans claim
produisait donc un rapport qui ne disait **rien** de sa provenance — et qui,
posé à côté d'un rapport canonique, en avait exactement l'apparence.

Le générateur pose désormais une bannière **inconditionnelle** dès qu'aucun
bloc canonique n'est présent. Un lecteur doit pouvoir dire d'où vient ce qu'il
lit sans ouvrir le code, y compris quand la réponse est « de nulle part de
gouverné ».

### Ce que le gate final doit exercer sur cette route

- `source=botify` → claims canoniques BOTIFY, états visibles, provenance rendue
- `source=vine` → claims canoniques VINE, idem
- dossier absent en base → `canonical_casefile_missing`, **pas** de repli preset
- `body.data` → bannière « aucun dossier canonique » présente

Auth admin exigée dans les quatre cas (`requireAdminApi`).

---

## 2 · LE SCELLEMENT — CE QUE JE NE PEUX PAS FAIRE, ET POURQUOI

**Je n'ai pas exécuté `seal-claims`.** Il n'existe pas de `.env.local` dans le
worktree T2 : aucune connexion base n'y est disponible, et je ne suis pas allé
en chercher une.

### Pourquoi je n'ai pas calculé les empreintes hors ligne

C'était possible — les claims migrés viennent de `data/cases/botify.json` et
`src/data/vine-osint.json`, et j'aurais pu recalculer depuis ces fichiers.

**Je ne l'ai pas fait, et c'est délibéré.** Le sceau doit porter sur la LIGNE
RÉELLE. Entre le JSON et la ligne en base il y a un `INSERT`, une normalisation
`jsonb`, un `::date`. La moindre différence d'un octet produit un sceau faux —
et un sceau faux ne se manifeste pas comme une erreur : il fait crier
`CONTENT_MUTATED` sur des lignes que personne n'a touchées, jusqu'à ce que
plus personne ne croie l'audit.

Un sceau approximatif est pire que pas de sceau.

### La procédure, pour qui a la connexion

```bash
npx tsx scripts/casefile/seal-claims.ts IL-SHILL-BOTIFY-001 > seal-botify.sql
npx tsx scripts/casefile/seal-claims.ts IL-SHILL-VINE-001   > seal-vine.sql
```

Le script **lit** et **écrit du SQL sur la sortie standard**. Il n'écrit rien en
base. Relecture humaine, puis exécution dans l'éditeur SQL Neon.

Ses garanties, par construction :

- l'empreinte est calculée par la **seule** implémentation (`claimContentHash`) —
  jamais par un `sha256()` côté Postgres, qui devrait s'accorder à l'octet près
- `WHERE "contentHash" IS NULL` : un rejeu ne réécrit jamais un sceau posé
- s'il n'y a rien à sceller, **aucun `UPDATE` n'est rendu** — un UPDATE sans
  cible ne se signalerait pas
- trois post-checks, dont « 0 claim non scellé » et « aucune version qui ne
  change rien »

### Les trois propriétés sont déjà démontrées

Elles ne dépendent pas de l'exécution : elles sont prouvées par test
déterministe, `__tests__/casefile/seal-three-properties.test.ts`, 14 cas.

| propriété | preuve |
|---|---|
| contenu intact → validation verte | sceau tenu, audit sans constat |
| mutation contrôlée → `CONTENT_MUTATED` | et **uniquement** ce constat |
| aucune réécriture silencieuse | `assertNoSilentRewrite` **refuse** avant écriture |

Ce que l'exécution ajoutera : la preuve que les 16 claims **réels** sont
scellés. Tant que `contentHash` est `NULL`, l'audit sait détecter une
altération mais n'a rien à comparer.

---

## 3 · PROTOCOLE DE DÉPLOIEMENT — VERSION À JOUR

T1 a rencontré un « Not authorized » **sans création de déploiement**, alors que
`whoami` et `ls` fonctionnaient ; le retry avec `--scope` explicite a abouti.
L'inférence de scope Vercel est instable.

Le contrôle avant toute mesure comporte donc **quatre** vérifications, dans cet
ordre :

1. **arbre et marqueur** — le working tree porte bien le correctif attendu
   (`vercel --prod` embarque l'arbre, pas le commit de `main`)
2. **projet lié** — `interligens-app`, pas `interligens-web`
3. **scope explicite** — `--scope` posé, jamais laissé à l'inférence
4. **version servie** — vérifiée sur la réponse, avant toute mesure

Un « Not authorized » sans déploiement créé n'est pas un échec de droits : c'est
une résolution de scope. Le retry doit nommer le scope, pas changer de compte.

---

## 4 · CE QUI RESTE, ET À QUI

| élément | détenteur |
|---|---|
| exécuter `seal-claims` et appliquer le SQL | fondateur (write prod) |
| déployer et mesurer la version servie | T1 |
| exercer le gate final sur les surfaces | T1, avec le protocole ci-dessus |
| reformuler VINE C11 si le contenu doit être publié | décision éditoriale — `renderSupersedeSql` rend le SQL, l'ancienne version reste |

**Rien de BUILD 9 n'est servi en production tant que T1 n'a pas déployé.** Le
merge sur `main` n'arme aucun déploiement.
