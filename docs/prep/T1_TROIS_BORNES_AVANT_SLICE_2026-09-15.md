# T1-TROIS-BORNES-AVANT-SAMEDI — mesures du 2026-09-15

Fenêtre lecture seule. Aucune écriture de production, aucun DDL, aucune ligne de
journal, aucun déploiement, aucune variable `TSA_*`, aucun appel d'autorité
d'horodatage. Les seuls appels réseau sont **deux lectures R2**, nommées en
borne 3.

---

## BORNE 1 — LE BANC PGLITE

### Ils sont TROIS, pas cinq

`*-pglite.mts` recensés sur l'arbre de travail, sur le worktree T2, et sur
**toutes** les branches (`git log --all --diff-filter=A -- "*pglite*"`) :

| script | posé par | ce qu'il prouve |
|---|---|---|
| `scripts/casefile/executor-e2e-pglite.mts` | `9ee790c` | l'exécuteur gouverné de bout en bout — fondation `ATTACHED`, libération sur décision persistée relue, versionnement, les 16 causes de refus |
| `scripts/casefile/harnais-provenance-journal-pglite.mts` | `565e711` | le DDL du journal de provenance : contraintes, triggers no-rewrite / no-truncate, index, FK `RESTRICT/RESTRICT`, et un **post-check qui rougit** sur chaque dégradation rejouée à la main |
| `scripts/casefile/harnais-ecrivain-journal-pglite.mts` | `d42a6dc` | l'écrivain append-only : refus gouvernés, filets `CHECK` en SQL brut, `UPDATE`/`DELETE`/`TRUNCATE` refusés, relecture `READBACK_MISMATCH`, équivalence motif TypeScript ↔ `CHECK` SQL sur 80 cas |

Quatre autres `.mts` du même dossier ont la forme d'un harnais — `prouver-contraintes-cause-pg17-rollback`,
`revoke-rehearsal-pg17-rollback`, `qualifications-vine-rehearsal-rollback`,
`qualifications-vine-inscription-reelle` — mais ils visent **PG17 réel via
`DATABASE_URL`**, pas PGlite. Ils ne sont pas lancés dans cette fenêtre.

### Le mécanisme T2 : `PGLITE_PATH`

Les trois scripts lisent `process.env.PGLITE_PATH` et importent le module par ce
chemin (`executor-e2e-pglite.mts:487`, `harnais-provenance…:49`,
`harnais-ecrivain…:53`). Sans la variable, ils sortent en `UNABLE`. Le mode
d'emploi est écrit dans `docs/prep/T1_DDL_PHASE_A_PRET_A_POSER_2026-09-14.md:43`
et `T1_JOURNAL_AMENDE_ET_MESURE_2026-09-14.md:48`.

### Le paquet existe sur cet hôte

```
/Users/dood/.npm/_npx/2778af9cee32ff87/node_modules/@electric-sql/pglite
  version 0.4.3 · dist/index.js · posé le 2026-09-07
  → PostgreSQL 17.5 on wasm32-unknown-linux-gnu
```

Cache `npx`, **hors dépôt**. `package.json` n'est pas touché, aucune
installation n'a été faite.

### Les trois verdicts, rejoués

```
PGLITE_PATH=/Users/dood/.npm/_npx/2778af9cee32ff87/node_modules/@electric-sql/pglite/dist/index.js \
  npx tsx scripts/casefile/<script>.mts
```

| script | sortie | code |
|---|---|---|
| `harnais-provenance-journal-pglite` | `✅ scénarios KO = 0 / 109` | **0** |
| `harnais-ecrivain-journal-pglite` | `✅ scénarios KO = 0 / 34` | **0** |
| `executor-e2e-pglite` | `⚠️ ÉCHEC ATTENDU, DOCUMENTÉ` — `SOURCE_PROVENANCE_UNQUALIFIED @ SRC-001.provenanceKind` | **4** |

Le code 4 est le code prévu par le script : ni 0 (tolérer), ni 1 (confondre avec
une régression). L'échec attendu **s'exécute**, il est daté (`depuis 2026-09-14`,
décision GPT 3 — `UNKNOWN` n'est plus fondable) et sa levée est nommée : témoin
synthétique `VERIFIED` dans le fixture, au vertical slice.

### La réserve de ce matin tombe

Elle était fausse sur le chiffre (trois scripts, pas cinq) et fausse sur la
capacité : le banc tourne sur cet hôte, sans rien installer. Le vertical slice
peut s'y appuyer, y compris sur l'échec attendu — il est exécutable, donc il
prouve.

---

## BORNE 2 — LE COMPARTIMENT

Livrable : `__tests__/evidence-chain/compartiment-autorite.test.ts`, **16
scénarios verts**. Aucun refactor de `evidenceStorage.get`.

### (a) et (b) — les deux témoins

Les deux compartiments rendent **aujourd'hui la même valeur** :
`R2_EVIDENCE_BUCKET_NAME` n'est pas provisionné (**vérifié en vif le
2026-09-15**), donc les deux chemins retombent sur `interligens-reports`. Un
témoin qui comparerait deux chaînes serait vert par coïncidence. Les témoins
posés exercent donc les verbes sous une configuration où les deux compartiments
sont **distincts**, et trois mutants prouvent qu'ils rougissent :

| mutant posé | témoin qui rougit |
|---|---|
| `getEvidenceObject` relit `process.env` pour son compte | (a) — mutant d'environnement + borne « aucun verbe ne lit l'env » |
| un `evidenceStorage.get` ajouté dans `stampGate.ts` | (b) — univers dérivé + recensement (c) |
| un site de production fige `bucket: "interligens-rawdocs"` | (a) — « chaque site passe le bucket de l'autorité » |

L'univers du témoin (b) est **dérivé** (`readdirSync` sur
`src/lib/evidence-chain/**` et `src/scripts/evidence-chain/**`), pas recopié :
le futur intake y entre sans que personne pense à l'inscrire.

### CE QUE LE TÉMOIN (b) A TROUVÉ

`src/scripts/evidence-chain/recover-snapshots-d.ts` (CC-OFFLINE-55) construit
son **propre** `GetObjectCommand` au lieu de passer par la porte unique.

* **Compartiment : correct.** Son bucket vient de `evidenceR2ConfigFromEnv()`.
  Le premier volet du ruling tient.
* **Identité d'objet : PAS celle du chemin d'écriture gouverné.** Sa clé vient
  de `r2KeyFromUrl(imageUrl)` — dérivée d'une URL stockée — et non de
  `contentAddressedKey`. C'est le second volet du ruling, mot pour mot :
  *« object identity selected by the governed write path »*.

Non corrigé : hors fenêtre, et hors chemin TSA vivant (job, relecture, gate,
ingestion, éligibilité — un témoin dédié vérifie qu'aucun d'eux n'a de porte
propre). Figé comme **exception nommée** : toute nouvelle porte rougit, et
celle-ci ne peut pas dériver de compartiment sans rougir.

### (c) — LE RECENSEMENT, qui est la condition du ruling

Mesuré sur tout `src/` et `scripts/`, hors tests :

| verbe | consommateurs | chemin probatoire RC ? |
|---|---|---|
| **`evidenceStorage.get`** | **0 — AUCUN** | sans objet : **le lecteur est mort** |
| `evidenceStorage.exists` | 0 | sans objet |
| `evidenceStorage.put` | `src/lib/surveillance/evidencePack.ts` | **NON** |
| `evidenceStorage.put` | `src/lib/surveillance/reports/generateCaseFile.ts` | **NON** |

Preuve de non-appartenance des deux `put` : ni l'un ni l'autre ne mentionne
`evidence-chain`, `EvidenceItem`, `ingestBuffer` ou `putEvidenceObject` — leurs
objets n'entrent jamais dans la chaîne. `evidencePack.storageKeys` n'a qu'un
seul lecteur dans tout le dépôt, une route admin d'affichage.

**La condition posée par GPT n'est donc pas déclenchée — et sa prémisse ne tient
pas non plus.** « Il a d'autres consommateurs » est faux : `evidenceStorage.get`
n'en a aucun. La dette *STORAGE COMPARTMENT AUTHORITY* n'est pas P1 hors chemin
critique ; c'est du **code mort**, dont la suppression n'élargirait aucune
fenêtre. À arbitrer par GPT, pas ici.

### ⚠️ LA MÊME FAILLE, CÔTÉ ÉCRITURE — à nommer

`evidencePack.ts` écrit sous **`evidence/`** — un `PREFIXE_PROBATOIRE` — via
`evidenceStorage.put`, donc via `R2_BUCKET_NAME`, **une autorité différente** de
celle du PUT gouverné. Aujourd'hui les deux coïncident. Le jour où le
compartiment de preuves dédié est posé, les captures de surveillance partent
dans l'ancien bucket pendant que la chaîne écrit et relit le nouveau — deux
objets distincts sous la même clé, dans deux compartiments. Ce n'est **pas** un
consommateur de `.get`, donc ce n'est pas la condition du ruling. C'est la face
écriture du même problème, et elle est figée par un témoin.

---

## BORNE 3 — `auto-delete-30d`, RECONNAISSANCE BORNÉE

Lecture seule. Deux appels R2 (`GetBucketLifecycleConfiguration` ×1, et la
résolution de configuration), des `SELECT` nuls, aucun `GetObject`, aucune
écriture.

### (a) QUI A PRODUIT `evi_rep_bd69380a45529aebeba7bc52`

Deux producteurs distincts, et la distinction compte.

**L'OBJET** — `src/lib/pdf/engine.ts:472`. Le générateur de dossier KOL, cron
quotidien ~04:38 UTC, écrit par `PutObjectCommand` brut sur `R2_BUCKET_NAME` :

```
reports/${handle}/CASE_${handle}_${ts}.pdf
→ reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf
```

Ni `evidenceStorage`, ni `pdfStorage` (registre gouverné), ni
`putEvidenceObject`. Chemin **gelé, jamais câblé au registre** — le dépôt le
nomme lui-même `PRODUCTEUR_NON_CABLE_ENGINE`.

**LA LIGNE** — `docs/prep/EXECUTION_2026-08-19.sql:566`. Un lot SQL manuel du
**2026-08-19**, `sourceType='GENERATED_CASE_PDF'`,
`provenanceType='MIGRATED_BACKFILL'`, `'retroactive'`, `sha256` calculé en flux
sur le contenu : `0467e0c8…3b06f`, 182 296 octets.

> **L'écart qui décide de l'urgence.** La pièce est inscrite dans la chaîne de
> conservation le **2026-08-19**. L'échéance annoncée sur ses octets était
> `Thu, 20 Aug 2026 04:38:57 GMT`. L'infrastructure a détruit les octets
> **le lendemain de leur inscription probatoire**, sans autorité consultée, sans
> diff, sans revue.

### (b) SA CLASSE RÉELLE — prouvée par la donnée, pas par la forme de la clé

Les classificateurs du dépôt, exécutés sur la clé :

```
lireFormeDeCle            : {"forme":"ARCHIVE_ENGINE","handle":"GordonGekko"}
estFormeAllouee (registre): false
estDansPerimetreGouverne  : true          (PREFIXE_GOUVERNE = "reports/")
préfixes probatoires      : ["reports/","evidence/"]  → la clé tombe dedans : true
causeProbable             : PRODUCTEUR_NON_CABLE_ENGINE
corpus MIXED_ASSERTION    : OUI (1 des 34)

le JUMEAU mutable  pointers/GordonGekko/latest.pdf
  dans périmètre gouverné : false
  dans préfixe probatoire : false
```

Donc : **ni `CASEFILE_RENDER`** (cette nature vaut pour les clés allouées par le
registre, `reports/<env>/YYYY/MM/<uuid>.pdf` — celle-ci n'en est pas), **ni
evidence source** (c'est un rapport produit par INTERLIGENS, et le dépôt porte
la règle « un rapport généré par INTERLIGENS n'est JAMAIS preuve primaire de ses
propres conclusions »).

C'est une **ARCHIVE_ENGINE** : la moitié *immuable* de la séparation A2 que
`engine.ts:463-470` documente lui-même —

> *« L'archive datée est IMMUABLE : sa clé porte l'horodatage, elle n'est jamais
> réécrite, et elle reste sous `reports/` — le préfixe qu'un Bucket Lock de
> conservation figera. Le pointeur « dernière version » est MUTABLE […] il vit
> désormais HORS de `reports/`. »*

**Et elle n'est PAS reconstructible.** `engine.ts` rend depuis l'état DB vivant,
incruste la date de génération (`now`), le score calculé à l'instant, et
`nextVersion = pdfVersion + 1` — un compteur **monotone**. Une régénération
imprimerait une autre version, une autre date, un autre score : le sha256
`0467e0c8…` est **inatteignable pour toujours** (`VERIF_R2_2026-08-20.md:144`).
Artefact unique, registre `EvidenceItem` → `BYTES_LOST`.

### (c) LA RÈGLE, ET SON PRÉDICAT LITTÉRAL

**Elle ne vit nulle part dans le dépôt.** Aucun commit sur aucune branche ne
contient `PutBucketLifecycle*` ni d'écriture de `LifecycleConfiguration`. La
chaîne `auto-delete-30d` n'apparaît que dans des documents du 2026-08-20 ou
après, qui **citent** un en-tête capturé. Action console, hors diff, hors revue.

**Son prédicat littéral est ILLISIBLE.** Vérifié en vif aujourd'hui, pas repris
d'un rapport d'août :

```
compartiment interrogé              : interligens-reports
R2_EVIDENCE_BUCKET_NAME provisionné : NON
GetBucketLifecycleConfiguration     : AccessDenied — HTTP 403
```

Le seul observable a jamais été l'en-tête `x-amz-expiration`, recalculé par R2 à
chaque requête :

```
expiry-date="Thu, 20 Aug 2026 04:38:57 GMT", rule-id="auto-delete-30d"
```

soit création + 31 j. Dernière émission observée : 2026-08-19 20:12:33 UTC, sur
31/31 clés `reports/`. Première non-émission : 2026-08-20 10:08 UTC. Au
2026-09-12 : **0 en-tête d'expiration sur 1 136 objets**, 266 préfixes, 1 103
clés du registre. « Inactive » est donc un **proxy d'en-tête**, jamais une
lecture de configuration — et « désactivée » ne se distingue pas de
« supprimée » sans la console.

### (d) LE POINT QUI DÉCIDE

> **Ce prédicat peut-il atteindre une EVIDENCE SOURCE, un ORIGINAL GOUVERNÉ ou
> un ARTEFACT UNIQUE ?**
>
> # OUI.

Et la preuve ne peut pas venir de la lecture du prédicat, **parce que le
prédicat ne peut pas être lu** — 403, aujourd'hui, avec les credentials de ce
dépôt. C'est le premier terme de la réponse : personne ici ne peut énoncer sa
portée. « Limitée aux dérivés de présentation reconstructibles » n'est pas
établissable ; c'est une espérance, pas une mesure.

Le second terme est qu'**il l'a déjà fait**, et les quatre propriétés sont
établies séparément :

1. **Original gouverné** — la clé détruite est dans `PREFIXE_GOUVERNE`
   (`reports/`) et dans `PREFIXES_PROBATOIRES`. Mesuré, pas inféré.
2. **Artefact unique, non reconstructible** — `ARCHIVE_ENGINE`, sha256
   enregistré, `nextVersion` monotone : la régénération ne rend pas le même
   objet.
3. **Le dérivé reconstructible n'a PAS été touché** — `pointers/<handle>/latest.pdf`,
   « MUTABLE PAR CONCEPTION », vit hors `reports/`. La règle a emporté
   exactement la moitié que la séparation A2 existe pour conserver, et épargné
   celle qu'on peut refaire. C'est l'inverse d'une politique limitée aux
   dérivés.
4. **La seule exclusion écrite ne conserve rien** — `PREFIXES_PROBATOIRES` porte
   son propre aveu : *« Cette liste ne CONSERVE rien par elle-même. Aucun
   mécanisme n'applique la rétention : 0/1136 objets portent une échéance,
   aucune règle de cycle de vie n'est en vigueur, ce compartiment n'est pas
   WORM. »* La règle vit dans une console que cette constante n'atteint pas.

Et la portée sur `evidence/` — le vrai préfixe des sources — **n'est pas
exclue** : la lecture « règle portée par `reports/` » a toujours été donnée comme
**inférence**, jamais comme fait, faute d'avoir interrogé une clé `evidence/`
pendant que la règle émettait. Un prédicat illisible dont on sait qu'il a
atteint un préfixe probatoire ne peut pas être déclaré hors d'atteinte du
second.

**Sous le gate binaire de GPT : RC BLOCKER IMMÉDIAT.** Correction avant le
20 octobre.

Rien n'a été désactivé, déplacé, supprimé ni corrigé. La décision appartient
à GPT.
