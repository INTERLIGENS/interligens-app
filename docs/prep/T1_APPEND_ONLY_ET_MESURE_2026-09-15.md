# T1-APPEND-ONLY-ET-MESURE — 2026-09-15

> **Finding an evidence object in one compartment establishes presence there; it
> establishes authoritative location only when competing governed compartments have
> also been measurably excluded.**

Branche : `feat/cc-offline-191-append-only-et-mesure`, depuis `origin/main` = `fffb78c`.

**Aucune des 31 inscrite. Aucun DDL. Aucun octet déplacé. Aucun déploiement.**
Rien de `.vercelignore`, `__tests__/preflight/` ni du wrapper n'est touché (T2 y travaille).

---

## 1 · Les quatre refus de l'append-only, en production

`src/scripts/evidence-chain/preuve-append-only-prod.ts` — joué contre `ep-square-band`.

| | ordre | SQLSTATE | |
|---|---|---|---|
| 1 | `INSERT` d'une ligne témoin | — | **ACCEPTÉ** |
| 2 | `UPDATE … SET bucket = …` | **`23001`** | REFUSÉ `restrict_violation` |
| 3 | `DELETE FROM …` | **`23001`** | REFUSÉ |
| 4 | `TRUNCATE …` | **`23001`** | REFUSÉ — il ne passe pas par les triggers de ligne |

Après les trois refus, **la ligne témoin est intacte** (1 ligne) : un refus qui aurait « à
moitié » agi ne serait pas un refus. **Après `ROLLBACK` : 0 ligne.** Les deux triggers sont
**toujours armés** (`tgenabled = 'O'`) — un verrou qu'on force ne doit pas s'être désarmé
en chemin.

La pièce témoin est une **vraie**, prise dans l'univers d'horodatage
(`evi_rep_615f749a1d56e9abf5fc2b07`) : la FK l'exige, et c'est ce qui rend la mesure
représentative.

### La séquence : `1 → 2`, et ce n'est pas une anomalie

L'`INSERT` témoin a consommé une valeur d'IDENTITY que le `ROLLBACK` **ne rend pas** — les
séquences ne sont pas transactionnelles. Deux répétitions ont eu lieu (une sur `pg`, une sur
Prisma) : `last_value` vaut **2**. **Le premier INSERT réel portera donc `id = 3`.** C'est
attendu et déjà écrit dans le DDL : `id` garantit un **ORDRE**, jamais une continuité ; les
trous sont normaux. Le SQL d'inscription généré le rappelle en en-tête, pour que personne ne
prenne un trou pour une ligne perdue.

### Trois sûretés, et pourquoi

- **Le script REFUSE de démarrer si la table n'est pas vide.** `TRUNCATE` prend un verrou
  `ACCESS EXCLUSIVE` *avant* que le trigger ne refuse : on ne force pas un verrou sur une
  table qui porte des faits probatoires.
- **Chaque tentative vit dans son `SAVEPOINT`.** En PostgreSQL une erreur **avorte** la
  transaction : sans savepoints, les deuxième et troisième ordres auraient rendu `25P02`
  (« current transaction is aborted ») et on aurait mesuré l'avortement, pas le verrou. Les
  trois refus sont trois mesures **indépendantes**, pas une mesure suivie de deux échos.
- **Il n'existe aucun chemin de code vers un `COMMIT`.** La transaction interactive Prisma
  ne s'annule que par une exception, et le corps se termine par un `throw`. Si elle
  aboutissait, le script le **signalerait comme un échec**. Un témoin le vérifie.

Note : la première version utilisait `pg` directement. Le paquet est déclaré mais sans
`@types/pg`, donc `tsc` échouait. Réécrit sur la transaction interactive Prisma — aucune
dépendance ajoutée, mêmes quatre résultats, et l'annulation est portée par la sémantique du
client au lieu d'un `finally`.

---

## 2 · Le script de mesure

`src/scripts/evidence-chain/mesure-localisation.ts` (câblage) +
`src/lib/evidence-chain/discrimination.ts` (table de décision, **pure**).

**Un seul instrument, pas deux.** J'ai fait évoluer celui de la fenêtre précédente plutôt
que d'en créer un second : deux instruments sur la même question, c'est deux autorités.

### Les quatre verdicts, et une seule autorise une ligne

| sondes | verdict | |
|---|---|---|
| `PRESENT` + `ABSENT` | **`LOCALISATION_DISCRIMINEE`** | candidate → compartiment nommé |
| `PRESENT` + `PRESENT` | `AMBIGUOUS` | STOP |
| `ABSENT` + `ABSENT` | `ABSENT_DES_DEUX` | STOP |
| `CANNOT_MEASURE` sur l'un | `NON_MESURABLE` | STOP |

Quatre **valeurs distinctes**, jamais un booléen ; et la présence est elle-même à **trois**
valeurs (`PRESENT` / `ABSENT` / `CANNOT_MEASURE`). Le mot `CANNOT_MEASURE` est repris **tel
quel** du garde de conservation : même doctrine, même nom.

Le type porte la distinction du ruling : `compartiment` est non nul **si et seulement si**
le verdict est `LOCALISATION_DISCRIMINEE`. Une localisation non discriminée n'a pas de
compartiment — le type l'**interdit** plutôt que de le déconseiller.

**`CANNOT_MEASURE` est évalué en PREMIER**, et l'ordre est le contrat : placé plus bas, un
`200 + 403` conclurait à une localisation discriminée, c'est-à-dire **établie sur une
non-observation**. Un témoin vérifie l'ordre dans le source. Seuls `200` et `404` signifient
quelque chose ; tout le reste — 403, 5xx, timeout, code inconnu, **aucune information** —
tombe en `CANNOT_MEASURE`. Fail-closed par héritage.

La règle se généralise à N compartiments : un troisième compartiment gouverné entre dans la
liste et la discrimination l'exige aussi, sans qu'une ligne change.

### Le fail-closed sans credential — prouvé en vif

```
UNABLE [evidence_readonly_credential_unconfigured]
variables manquantes : R2_EVIDENCE_RO_ACCESS_KEY_ID, R2_EVIDENCE_RO_SECRET_ACCESS_KEY.
⛔ Il ne se rabat PAS sur R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY : ces identifiants
   sont scopés sur les archives et rendraient un 403 sur le compartiment de preuves.
   Ce 403 serait alors présenté comme une mesure, alors qu'il n'en est pas une.
   Mieux vaut ne pas mesurer que mesurer faux.
```

Sortie **1**, aucune sonde émise. Aucun `||` entre les deux identités — un témoin vérifie
qu'aucune ligne lisant `R2_EVIDENCE_RO_*` ne porte d'alternative.

**Aucune valeur de secret n'est imprimée**, nulle part : un témoin vérifie qu'aucun
`console.*` ne touche une variable de credential.

---

## 3 · La mesure a pu tourner — et elle a trouvé autre chose

Les deux variables **étaient posées** quand j'ai vérifié en fin de fenêtre. La mesure a
tourné : **62 HeadObject, 0 octet transféré.**

| | |
|---|---|
| `LOCALISATION_DISCRIMINEE` | **0** |
| `AMBIGUOUS` | 0 |
| `ABSENT_DES_DEUX` | 0 |
| `NON_MESURABLE` | **31 / 31** |

`interligens-reports` = `PRESENT` (31/31). `interligens-evidence` = **HTTP 403** (31/31).
**0 candidate à `VERIFIED_BY_HEAD`.**

### ⚠️ Le 403 n'est PAS un défaut de portée. Le credential est mal RECOPIÉ.

Trente-et-un 403 identiques ressemblaient trait pour trait au 403 de la veille. Un
diagnostic en lecture seule a montré tout autre chose :

```
RO / ListObjectsV2 interligens-evidence → SignatureDoesNotMatch (403)
    « The request signature we calculated does not match the signature you provided.
      Check your secret access key and signing. »
```

Caractérisation, **sans révéler la valeur** :

| variable | attendu | observé |
|---|---|---|
| `R2_EVIDENCE_RO_ACCESS_KEY_ID` | 32 hex | **32 hex — conforme** |
| `R2_EVIDENCE_RO_SECRET_ACCESS_KEY` | 64 hex | **65 caractères**, dont **1 hors hexadécimal en position 64** |

(Témoin : le secret des archives, qui fonctionne, fait exactement 64 hex.)

**Le secret porte un caractère parasite en fin de chaîne — un vestige de copier-coller.**
Le token n'est pas mal *porté*, il est mal *recopié*. Les deux pannes appellent des gestes
opposés : refaire un token, ou corriger une ligne de `.env.local`.

**Je n'ai pas rogné le caractère.** Deviner un credential, c'est mesurer avec une valeur que
personne n'a validée — un repli sous un autre nom. Le mutant **M6** sanctionne précisément
cette « réparation » silencieuse.

**Ce que j'ai fait à la place :** le script REFUSE désormais **avant la première sonde**,
avec une troisième cause distincte, `evidence_readonly_credential_malformed`, qui nomme
l'anomalie sans jamais montrer la valeur — que des longueurs et des positions. Trente-et-un
échecs identiques qui ressemblent à un problème de droits coûtent bien plus cher qu'une
vérification de forme.

### Ce qui reste à faire, et c'est une ligne

Corriger `R2_EVIDENCE_RO_SECRET_ACCESS_KEY` dans `.env.local` de Host-001 (retirer le
dernier caractère, ou recopier la valeur depuis Cloudflare), puis :

```
npx tsx src/scripts/evidence-chain/mesure-localisation.ts --inserts docs/prep/INSCRIPTION_31.sql
```

---

## 4 · Les INSERT préparés

**Aucun fichier.** `0` candidate ⇒ rien à préparer, et le générateur **refuse** de rendre
un bloc vide : il inviterait à le compléter à la main, c'est-à-dire à inscrire une
localisation que personne n'a discriminée.

Mais ce SQL ne tournera qu'**une seule fois**, et il produira une écriture de production
irréversible. Un code qui n'a qu'une occasion d'être juste s'éprouve **avant** cette
occasion : `rendreInscriptions` vit donc dans la lib — pur, sans `process.env` — et il est
éprouvé sur 7 points (une ligne par candidate, toutes `VERIFIED_BY_HEAD` avec observation ;
bloc syntaxiquement clos ; post-check qui compte exactement ; apostrophes échappées ;
avertissement sur `id` qui ne commencera pas à 1 ; aucune pièce non discriminée ne peut
l'atteindre ; refus du bloc vide).

---

## 5 · Preuves

**46 tests verts** — `__tests__/evidence-chain/discrimination-de-localisation.test.ts`.
Suite complète : **510 fichiers, 7 512 tests**. `tsc` 0 · ESLint 0 erreur.

**6 / 6 mutants rouges** — `bash scripts/evidence-chain/mutants-discrimination.sh`

| | faute réintroduite |
|---|---|
| M1 | un 403 devient une ABSENCE |
| M2 | `CANNOT_MEASURE` évalué en dernier |
| M3 | repli sur les credentials des archives |
| M4 | ambiguïté arbitrée |
| M5 | `COMMIT` au lieu de `ROLLBACK` dans la preuve append-only |
| M6 | credential mal recopié « réparé » en silence |

### Un piège du harnais, rencontré en vif

M5 est d'abord resté **vert** — non parce que la suite ne voyait rien, mais parce que le
code avait changé sous le patch : la substitution ne s'appliquait plus et **le mutant ne
mutait rien**. Un mutant périmé ment dans les deux sens. Chaque patch vérifie désormais
qu'il a bien **modifié** le fichier, et sort en `UNABLE` sinon.

Un témoin de la fenêtre précédente a aussi dû être **affûté** : il cherchait le *mot*
`INSERT` dans l'instrument de mesure. Or l'instrument **génère** maintenant un texte SQL
d'INSERT — c'est son livrable, et le mot y est légitime. Ce qui doit rester impossible,
c'est qu'il l'**exécute** : le témoin mesure désormais la **surface d'appel** à la base
(`$queryRawUnsafe` + `$disconnect`, et rien d'autre), jamais la présence du mot.

---

## État à la clôture

- `evidence_storage_location_journal` : **0 ligne**, deux triggers armés, séquence à 2.
- Les 31 : **31/31 `NON_MESURABLE`**, 0 candidate. Aucune ligne inscrite.
- `D` reste en HOLD, `A` et la convention de préfixe restent NO-GO.
- Bloqué sur **un caractère** dans `.env.local`.
