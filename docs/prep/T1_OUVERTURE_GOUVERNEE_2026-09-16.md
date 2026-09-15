# T1-OUVERTURE-GOUVERNÉE — 2026-09-16

> **A governed compartment may be opened only when governed location authority names it for
> that specific object. A compartment must never be selected by default, fallback, key
> convention, object age, or failed lookup.**
>
> **Storage-location authority SELECTS the compartment; runtime configuration only PROVIDES
> THE CAPABILITY to access the compartment selected by that authority. Configuration must
> never become location authority.**

Branche : `feat/cc-offline-193-ouverture-gouvernee`, depuis `origin/main` = `e7acf43`.

**Aucun appel TSA. Les 31 lignes du registre n'ont pas été touchées. Aucun octet déplacé,
aucun DDL, aucun déploiement.** Rien du chemin de déploiement ni du preflight.

---

## 1 · L'ouvreur : vocabulaire fermé, et `R2_BUCKET_NAME` n'intervient pas

Il y a désormais **deux portes**, et elles ne répondent pas à la même question :

| | |
|---|---|
| `ouvrirCompartimentGouverne()` | **où NAÎT une pièce nouvelle** — la configuration nomme le compartiment canonique. Aucune autorité n'existe encore : l'objet non plus. |
| `ouvrirCompartimentDesigne(bucket)` | **où VIVENT les octets de CETTE pièce** — le registre nomme, et lui seul. La configuration ne fournit que la capacité d'accès. |

`COMPARTIMENTS_GOUVERNES = ["interligens-evidence", "interligens-reports"]`, **en dur**. Un
vocabulaire lu dans l'environnement ne serait pas fermé : il suffirait d'une variable pour
élargir ce qui est ouvrable, et la configuration redeviendrait autorité.

**C'est une liste de PERMISSION, jamais de SÉLECTION.** Elle dit quels compartiments peuvent
être ouverts *du tout* ; elle ne dit jamais lequel ouvrir pour une pièce donnée.

### Le témoin « `R2_BUCKET_NAME` n'intervient pas »

Il cherche le **geste**, pas le mot — le nom figure légitimement dans le *texte* d'un refus
(« il ne se rabat pas sur `R2_BUCKET_NAME` »), et l'interdire là rendrait le refus muet sur
ce qu'il refuse. Ce qui doit être introuvable, c'est une **lecture** :

- aucun `env.R2_BUCKET_NAME` ni `process.env.R2_BUCKET_NAME` dans `compartment.ts` ni dans
  `storageResolution.ts` ;
- le corps de `ouvrirCompartimentDesigne` ne contient **aucun** nom de compartiment tiré de
  l'environnement — ni `R2_BUCKET_NAME`, ni même `R2_EVIDENCE_BUCKET_NAME`.

Et deux preuves **runtime**, qui valent mieux qu'une inspection de source :

- `R2_BUCKET_NAME = interligens-reports`, on désigne `evidence` → **`evidence` s'ouvre** ;
- `R2_EVIDENCE_BUCKET_NAME = interligens-evidence`, on désigne `reports` → **`reports`
  s'ouvre**. C'est le cas réel des 31 : la configuration nomme un compartiment, l'autorité en
  nomme un autre, et **l'autorité l'emporte** ;
- retirer `R2_EVIDENCE_BUCKET_NAME` ne change **rien** à l'ouverture sur désignation.

---

## 2 · Les cinq causes de refus, distinctes

| | cas | ce qui refuse |
|---|---|---|
| 1 | localisation **absente** | `aucune autorité de localisation ne revendique` |
| 2 | **hors domaine** | objection `ROW_OUT_OF_DOMAIN` |
| 3 | **ambiguë** | objection `AMBIGUOUS_LATEST` |
| 4 | `storage_key` ≠ `r2Key` | objection `KEY_DIVERGENCE` |
| 5 | bucket **hors vocabulaire** | `compartiment_hors_vocabulaire_gouverne` |

Un témoin exerce les cinq et vérifie que les cinq détails sont **deux à deux différents** —
aucune ne se dégrade en une autre. Et la cinquième est volontairement distincte des deux
causes de configuration : celles-là se réparent dans `.env.local`, celle-ci se répare **en
base**. Les confondre ferait chercher une variable là où il y a une ligne de registre.

Le cas 1 vérifie aussi l'absence de la faute nommée par le ruling : le refus ne dit nulle part
« essayons `evidence` au cas où ».

---

## 3 · 31 NOMMÉES → 31 RÉSOLUES

```
1 · NOMMÉES par le registre gouverné : 31 / 31
      → interligens-reports : 31
2 · RÉSOLUES (nommées ET desservies)  : 31 / 31
✅ La dette de localisation est SOLDÉE, et le chemin gouverné dessert le compartiment.
```

Et le détail qui compte : **chacune résolue par le registre, pas par une variable.**
`R2_EVIDENCE_BUCKET_NAME` vaut `interligens-evidence` pendant cette mesure, et les 31
s'ouvrent pourtant sur `interligens-reports`. Si la configuration participait à la sélection,
ce résultat serait impossible.

`autorite` = `registre-de-localisation` sur les 31.

---

## 4 · Les six mutants

`bash scripts/evidence-chain/mutants-ouverture-gouvernee.sh` — **6 / 6 rouges.**

| | faute réintroduite | |
|---|---|---|
| M1 | repli vers `evidence` quand l'autorité donne `reports` | 🔴 |
| M2 | sélection par `R2_BUCKET_NAME` | 🔴 |
| M3 | sélection par convention de préfixe sur `r2Key` | 🔴 |
| M4 | bucket hors vocabulaire accepté | 🔴 |
| M5 | `KEY_DIVERGENCE` ignorée | 🔴 |
| M6 | absence dégradée en « essaye `evidence` » | 🔴 |

Chaque patch vérifie qu'il a bien **modifié** le fichier — un mutant périmé ment dans les deux
sens. Le verdict est pris sur les **trois** suites du périmètre, pas sur un échantillon.

### Quatre témoins antérieurs ont dû changer de sens, et c'est assumé

Ils fixaient l'ancien modèle : « un compartiment nommé qu'aucun ouvreur ne dessert reste non
résolu », le cas étant `interligens-reports`. Depuis le ruling, désigner `reports` est
l'**exécution** d'une autorité, pas un échec. Ils ont été **réécrits plus fort**, pas
affaiblis : ce qui reste refusé est le **hors-vocabulaire**, et un nouveau témoin fixe que
retirer `R2_EVIDENCE_BUCKET_NAME` ne change rien à la résolution — la conséquence directe de
« configuration must never become location authority ».

Suite complète : **511 fichiers, 7 552 tests verts** · `tsc` 0 · ESLint 0.

---

## 5 · ⚠️ LA MESURE DE PORTÉE — CE QUI FERAIT ÉCHOUER SAMEDI

Lecture seule. **Aucune écriture tentée. Aucun credential créé.**

| credential | `interligens-reports` | `interligens-evidence` |
|---|---|---|
| **principal** (`R2_ACCESS_KEY_ID`) | ✅ `HeadBucket` OK · `HeadObject` OK | ❌ **403** `HeadBucket` · **403 `AccessDenied`** `ListObjectsV2` |
| **mesure RO** (`R2_EVIDENCE_RO_*`) | ❌ **403** | ✅ `HeadBucket` OK · `ListObjectsV2` OK (`KeyCount: 1`) |

**Les deux credentials sont DISJOINTS.** Aucun des deux ne couvre les deux compartiments.

### a) Les credentials principaux peuvent-ils écrire dans `interligens-evidence` ?

**Non.** Et voici la force exacte de cette réponse.

Je **n'ai pas pu lire la portée déclarée du token** : il n'existe aucun `CLOUDFLARE_API_TOKEN`
sur cet hôte, donc l'API Cloudflare est hors d'atteinte. La conclusion est donc **déduite du
comportement observé**, pas lue dans une politique :

- `ListObjectsV2` sur `interligens-evidence` rend `AccessDenied` (403) — une erreur S3 nommée,
  pas un `Unknown` : le service a bien évalué la politique et a refusé ;
- dans le modèle de jetons R2, les permissions d'objet sont attribuées **par bucket**, en
  « Object Read only » / « Object Read & Write » / Admin. **Il n'existe pas de jeton en
  écriture-sans-lecture.** Un jeton à qui la lecture d'un bucket est refusée n'a **aucune**
  permission sur ce bucket.

→ La déduction tient, **sous cette seule hypothèse** sur le modèle R2. Je ne l'ai pas
confirmée en écrivant, et je ne le ferai pas : une tentative d'écriture pour « en avoir le
cœur net » créerait l'objet qu'elle prétend tester.

### b) Ce qui manquera samedi, nommé exactement

**Le témoin ne pourra pas créer son objet dans `interligens-evidence`.** Et il y a pire que
l'échec attendu — deux pièges qui se referment ensemble :

1. **La capacité est résolue par PROCESSUS, pas par compartiment.** Les deux portes lisent
   `R2_EVIDENCE_ACCESS_KEY_ID || R2_ACCESS_KEY_ID`, et `R2_EVIDENCE_ACCESS_KEY_ID` est
   **absente**. Le chemin gouverné utilise donc les credentials **principaux** pour *tous* les
   compartiments. C'est exactement pourquoi les 31 se résolvent aujourd'hui : les principaux
   atteignent `reports`.

2. **`R2_EVIDENCE_BUCKET_NAME = interligens-evidence` est désormais posée.** Les pièces neuves
   naîtront donc dans un compartiment où les credentials en usage rendent **403**.

3. **Et le piège de la réparation naïve :** poser `R2_EVIDENCE_ACCESS_KEY_ID` avec un jeton
   scopé sur `evidence` seul **casserait les 31 résolutions qui marchent** — ce jeton rend 403
   sur `reports`, comme le montre la ligne « mesure RO » du tableau. Un credential ne peut pas
   être remplacé par l'autre ; il faut qu'**un seul couvre les deux**.

**Ce qu'il faut, en une phrase :** un credential R2 en **Object Read & Write** portant
**`interligens-evidence` ET `interligens-reports`** — soit en élargissant le jeton principal
existant, soit en créant un jeton scopé sur les deux buckets et en le posant en
`R2_EVIDENCE_ACCESS_KEY_ID` / `R2_EVIDENCE_SECRET_ACCESS_KEY`.

**C'est une action du fondateur. Je n'ai créé aucun credential, et je n'en créerai pas.**

L'alternative — router les credentials par compartiment dans le code — serait du nouveau
mécanisme, et la fenêtre l'interdit. Elle reste envisageable plus tard si les deux buckets
doivent rester sous des jetons séparés ; ce serait alors une décision, pas un contournement.

Note factuelle au passage : `interligens-evidence` contient déjà **au moins un objet**
(`KeyCount: 1` via le jeton RO). Je ne l'ai pas inspecté — hors périmètre.

---

## État à la clôture

- Registre : **31 lignes**, intactes, ids 3 → 33.
- **31 NOMMÉES → 31 RÉSOLUES**, par le registre.
- Le chemin de lecture exécute l'autorité ; la configuration ne fait que permettre.
- **Bloquant samedi** : un credential en écriture couvrant les deux compartiments.
- Aucun appel TSA. STOP avant le premier.
