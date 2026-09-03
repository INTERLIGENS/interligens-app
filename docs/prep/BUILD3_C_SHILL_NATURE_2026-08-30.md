# BUILD3 · TÂCHE C — nature native de `ShillCorrelationCandidate`

**État : PRÉPARÉ, NON ARMÉ. STOP au DDL, comme demandé.**
Rien n'a été écrit en base. `prisma/` n'a pas été touché (chemin gelé).
`scripts/guard-offline.sh` n'a pas été touché (auto-gelé).

---

## 1. Ce qui est LIVRÉ dans cette branche (chemins non gelés)

| Fichier | Rôle |
|---|---|
| `src/lib/data-nature/registry.ts` | entrée `ShillCorrelationCandidate` — régime **DECLARED**, nature **INFERENCE**, `basis: ["PRIMARY_OBSERVATION"]`, stage S6 |
| `src/lib/shill-correlation/v2/persistence.ts` | construit le fragment d'écriture et le fait valider par `assertNatureWritable` (S6). **Aucun import de prisma, aucune requête.** |
| `src/lib/shill-correlation/v2/__tests__/persistence.test.ts` | 16 tests : registre, contrat enum TS↔PG, fragment, sérialisation jsonb, I1, cohérence registre↔moteur, unicité par ligne, nom de colonne |

## 2. Ce qui ATTEND une décision (chemins gelés, patches non appliqués)

| Fichier | Nature |
|---|---|
| `docs/prep/MIGRATION_C_SHILL_NATURE_2026-08-30.sql` | **le DDL** — à coller dans le Neon SQL Editor |
| `docs/prep/patches/C_schema_prod_shill_nature_2026-08-30.patch` | 3 champs dans `prisma/schema.prod.prisma` |
| `docs/prep/patches/C_guard_exemption_2026-08-30.patch` | exemption ciblée du guard — **2 hunks obligatoires** |

### Ajustements du 2026-08-30 (fondateur)

1. `unmeasuredLiftCapsClassification` **reste `true`** — doctrine **ratifiée**.
   Valeur inchangée ; la clé sort de `AWAITING_RATIFICATION` et entre dans
   `RATIFIED` (date + auteur). Une liste d'attente qui garde ce qui a été
   tranché ment sur ce qui reste à trancher.
2. `rowNature` est typée **`"DataNature"` (enum), pas TEXT.** Vérifié en base le
   2026-08-30 : le type existe avec 6 labels, et 17 colonnes du produit
   l'utilisent déjà. `natureBasis` (jsonb) et `naturePolicyVersion` (text)
   inchangés.

### Nom de colonne — TRANCHÉ le 2026-09-03 : `rowNature`

La colonne s'appelle **`rowNature`**, pas `nature`. C'est la convention du
produit : 7 tables sur 7 la portent (`EvidenceItem`, `KolCase`,
`KolTokenInvolvement`, `KolTokenLink`, `KolWallet`, `TokenPriceTracker`,
`token_casefiles`) ; `ShillCorrelationCandidate` devient la 8e.

**Le renommage ne coûte rien** : la migration n'a jamais été exécutée, aucune
colonne `nature` n'existe en base, donc aucun DDL de rattrapage, aucune donnée
à déplacer. Cinq fichiers touchés — le SQL, le patch `schema.prod.prisma`,
`persistence.ts`, la prose du registre, et le test (qui verrouille désormais le
nom de la clé du fragment).

`natureBasis` et `naturePolicyVersion` sont **inchangés** : ils ne nomment pas
la nature, ils nomment sa piste d'audit.

Les **deux** `CHECK` suivent le nom de la colonne :

- `shillcorrcand_nature_declared_chk` → **`shillcorrcand_rownature_declared_chk`**
- `shillcorrcand_nature_auditable_chk` → **`shillcorrcand_rownature_auditable_chk`**

C2 ne porte pas sur la colonne de nature mais sur sa piste d'audit ; il est
renommé pour la cohérence de nommage avec C1, pas par nécessité technique.
Conséquence à connaître : le `conname LIKE 'shillcorrcand_nature%'` de la
requête de vérification ne ramènerait plus **aucun** des deux — et un LIKE qui
rend zéro ligne se lit comme « pas de contrainte ». Le motif est donc recalé sur
`'shillcorrcand_rownature%'`, qui les couvre tous les deux.

---

## 3. Mesure préalable — lecture seule, ep-square-band, 2026-08-30

```
total : 1 532   |   kolHandle distincts : 3   |   reviewStatus <> 'draft' : 0
première écriture : 2026-06-10   |   dernière : 2026-08-28
colonnes rowNature / natureBasis / naturePolicyVersion : ABSENTES
```

Les 1 532 lignes sont toutes en `draft` : **aucune n'a encore été reprise à son
compte par un humain.** C'est ce qui rend la table mono-nature aujourd'hui — le
jour où une revue humaine produira une affirmation éditoriale, elle sera portée
ailleurs, pas dans cette colonne.

---

## 4. La tension assumée : DECLARED **et** des colonnes

Le registre dit : `DECLARED → aucune colonne, aucun DDL`. On ajoute pourtant
trois colonnes. Ce n'est pas une entorse, c'est une distinction :

- **la nature vient du registre**, et couvre déjà les 1 532 lignes, colonne ou
  pas. `natureForTable("ShillCorrelationCandidate")` rend `INFERENCE` même pour
  une ligne dont la colonne est `NULL`. Une ligne legacy n'est **pas**
  `UNCLASSIFIED` ;
- **les colonnes sont la piste d'audit**, et portent deux faits *par ligne* que
  le registre ne peut pas porter :
  - `natureBasis` — de quelles natures d'entrée **cette** ligne est tirée. Le
    résolveur V3 ajoute une `INFERENCE` au basis quand il a tranché pour ce
    token, pas sinon. C'est une propriété de la ligne, pas de la table ;
  - `naturePolicyVersion` — sous quels seuils elle a été produite. Deux lignes
    scorées sous deux versions ne sont pas comparables, et sans ce champ rien
    ne le dirait.

## 5. Pourquoi AUCUN backfill, et pourquoi aucun DEFAULT

`MIGRATION_PROVENANCE` posait `DEFAULT 'LIVE'` sur 7 054 lignes — légitime :
elles **étaient** toutes des captures live. Ici, aucune valeur ne peut être
posée sans mentir :

- `rowNature='INFERENCE'` partout serait **juste** ;
- `naturePolicyVersion=<version du jour>` sur des lignes calculées entre le
  10 juin et le 28 août serait **faux** — et une version fausse est pire
  qu'absente : elle rend comparables deux lignes qui ne le sont pas ;
- `natureBasis` dépend d'une résolution de token propre à chaque ligne. Le
  déduire en masse serait l'inventer.

Un `DEFAULT` produirait exactement ce mensonge à la lecture. D'où : colonnes
nullables, sans défaut, **écrites uniquement sur les lignes que le moteur
(re)produit**. Une ligne legacy reste `NULL` jusqu'à son propre recalcul —
pas indéfiniment, mais jamais par `UPDATE` global.

Le refus est écrit à trois endroits qui ne peuvent pas dériver ensemble :
le module (`BACKFILL_IS_FORBIDDEN`, aucune fonction de backfill exportée),
le SQL (aucun `DEFAULT`, contrôle post-migration attendant `avec_nature = 0`),
la base (`CHECK` C2 : pas de nature sans sa piste d'audit).

## 6. Chemin d'écriture — un seul

```
runEngine() → CandidateInference._nature (INFERENCE, jamais autre chose)
            → buildCandidateNatureWrite(candidate, ligneExistante)
            → assertNatureWritable()          ← chokepoint S6
            → contrôle de cohérence avec le registre
            → fragment { rowNature, natureBasis, naturePolicyVersion }
            → fusionné dans le `create`/`update` de l'upsert  ← PAS ENCORE CÂBLÉ
```

La dernière flèche n'est pas branchée : `aggregate.ts` (le seul upsert
existant) n'est pas modifié tant que les colonnes n'existent pas. Le fragment
est construit et testé, il n'est passé à personne.

`ligneExistante` n'est pas décoratif : c'est ce qui arme I1. L'omettre revient
à écrire sans savoir ce qu'on écrase.

## 7. Ce que les gardes tiennent réellement (vérifié, pas supposé)

- **I1, sens utile** : une ligne déjà `INFERENCE` ne peut pas être promue
  `PRIMARY_OBSERVATION`. Le moteur calcule, il n'observe pas.
- **I1, sens inverse** : `PRIMARY_OBSERVATION → INFERENCE` est une *descente*
  dans l'échelle d'autorité — `canTransition` l'**autorise**. S6 seul ne
  suffirait donc pas à tenir la table mono-nature ; c'est le contrôle de
  cohérence avec le registre (`persistence.ts`) puis le `CHECK` C1 en base qui
  la tiennent. Trois couches, dont deux hors application.
- **Corpus mixte** : `isMixedAssertionArtifact` matche sur `id`/`sha256` de
  pièces `EvidenceItem`. Une ligne candidate (cuid, pas de sha256) ne peut pas
  collider — vérifié, pas supposé.
- **Contrat enum, et l'ordre des refus** : S0 (`requireNatureValue`) rejette
  toute valeur inventée *avant* le contrôle enum — celui-ci est donc
  inatteignable par ce chemin, et c'est voulu. Il couvre le seul cas que S0 ne
  **peut pas** voir : une nature ajoutée à `DATA_NATURES` côté TS sans être
  ajoutée au type Postgres. S0 dirait oui, la base répondrait `22P02` en
  production, au premier upsert. Le test d'égalité d'ensembles
  (`PG_DATA_NATURE_LABELS` ≡ `ALL_NATURE_VALUES`) rend ce cas visible avant
  qu'il n'arrive.
- **Ce que l'enum ne fait pas** : il borne le *domaine* (6 valeurs), pas cette
  table. C'est le `CHECK` C1 qui la tient mono-nature — sans lui, `ESTIMATE`
  serait un type parfaitement valide dans cette colonne.

## 8. Ordre d'exécution proposé — chaque étape est un STOP

1. **[DÉCISION]** valider ce pack.
2. Branche de maintenance guard **seule dans le diff** (le guard est auto-gelé) :
   appliquer `C_guard_exemption_2026-08-30.patch`. **Les deux hunks** — une
   exemption déclarée mais non consommée par une boucle n'existe pas.
3. Branche `feat/cc-offline-NNN-shill-v2-nature` : appliquer
   `C_schema_prod_shill_nature_2026-08-30.patch`, puis `pnpm prisma:generate`
   (jamais `npx prisma generate` sans flag — 53 modèles au lieu de 159).
4. **[DÉCISION]** exécuter `MIGRATION_C_SHILL_NATURE_2026-08-30.sql` dans le
   Neon SQL Editor. Jamais `db push`, jamais `prisma migrate` (verrou A9).
5. Coller les trois requêtes de vérification. **Attendu : 1 532 lignes,
   1 532 `NULL`, 0 écrite, `column_default` NULL sur les trois.** Un
   `avec_nature` non nul juste après le DDL signifierait qu'un backfill a eu
   lieu — c'est le contrôle, pas une formalité.
6. Câbler le fragment dans l'upsert d'`aggregate.ts` + test d'intégration.
7. Premier run : les lignes recalculées prennent leur nature ; les autres
   restent `NULL`. Le compter, et le dire.

---

## 9. Hors périmètre

- **Tâche D** (collecteur M1 + chiffrage Helius) : non commencée. Rappel de
  conséquence produit : sans collecteur témoin, aucun lift n'est mesurable,
  donc `unmeasuredLiftCapsClassification: true` plafonne **tout** candidat à
  `watch`. C'est voulu et visible en télémétrie.
- **Aucune surface** : ni route, ni cron, ni composant. Le module v2 n'est
  importé par personne.
