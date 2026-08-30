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
| `src/lib/shill-correlation/v2/__tests__/persistence.test.ts` | 9 tests : registre, fragment, sérialisation jsonb, I1, cohérence registre↔moteur, unicité par ligne |

## 2. Ce qui ATTEND une décision (chemins gelés, patches non appliqués)

| Fichier | Nature |
|---|---|
| `docs/prep/MIGRATION_C_SHILL_NATURE_2026-08-30.sql` | **le DDL** — à coller dans le Neon SQL Editor |
| `docs/prep/patches/C_schema_prod_shill_nature_2026-08-30.patch` | 3 champs dans `prisma/schema.prod.prisma` |
| `docs/prep/patches/C_guard_exemption_2026-08-30.patch` | exemption ciblée du guard — **2 hunks obligatoires** |

---

## 3. Mesure préalable — lecture seule, ep-square-band, 2026-08-30

```
total : 1 532   |   kolHandle distincts : 3   |   reviewStatus <> 'draft' : 0
première écriture : 2026-06-10   |   dernière : 2026-08-28
colonnes nature / natureBasis / naturePolicyVersion : ABSENTES
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

- `nature='INFERENCE'` partout serait **juste** ;
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
            → fragment { nature, natureBasis, naturePolicyVersion }
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
