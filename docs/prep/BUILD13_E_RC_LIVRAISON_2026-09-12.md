# BUILD 13 — E-RC · AUTHORITY — LIVRAISON, ET L'ORDRE DE MISE EN SERVICE

**État à l'issue de cette session.** Le code est écrit, typé, testé et lintré.
**Rien n'est déployé, rien n'est appliqué en base, aucun objet n'a été écrit,
lu, déplacé ou supprimé, aucune configuration de compartiment n'a été touchée,
aucune URL signée n'a été émise.**

Suite complète : **487 fichiers, 6 765 tests verts**, 2 échecs attendus,
2 ignorés — même total qu'avant le lot, zéro régression.
`tsc --noEmit` propre, `eslint` propre.

---

## §1 — CE QUI A ÉTÉ CONSTRUIT

| # | livrable | chemin | état |
|---|---|---|---|
| 1 | Le contrat — six faces, domaines fermés, doctrine | `src/lib/storage/registre/contrat.ts` | livré |
| 2 | L'allocateur d'identité + la règle legacy (D4) + les préfixes probatoires (D2) | `src/lib/storage/registre/identite.ts` | livré |
| 3 | L'éligibilité **dérivée**, fail-closed par liste blanche | `src/lib/storage/registre/eligibilite.ts` | livré |
| 4 | Le registre — les deux écritures, en SQL brut paramétré | `src/lib/storage/registre/registre.ts` | livré |
| 5 | Le classificateur de réconciliation, bidirectionnel | `src/lib/storage/registre/reconciliation.ts` | livré |
| 6 | L'écrivain gouverné + **le gate dans la primitive de signature** | `src/lib/storage/pdfStorage.ts` | livré |
| 7 | Le résiduel de `pdfGenerator.ts:664`, refermé | `src/lib/casefile/pdfGenerator.ts` | livré |
| 8 | Les deux invariants au registre (D6) | `src/lib/governance/invariants/registry.ts` | livré |
| 9 | Le réconciliateur, lecture seule par défaut | `scripts/casefile/reconcilier-registre-r2.ts` | livré, **jamais exécuté** |
| 10 | Le DDL additif | `docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql` | **NON APPLIQUÉ** |
| 11 | Les témoins (41 + 16 + 10 cas) | `src/lib/storage/**/__tests__`, `__tests__/security/registre-objets-gouvernes.test.ts` | verts |

### Ce qui a disparu, et c'est le cœur du lot

**`buildPdfKey`** — elle fabriquait `…/{lot}-{ms}-{slug}-{hash8}.pdf`, donc le
mint en clair dans un nom qui voyage. Supprimée, pas dépréciée : laisser une
fabriqueuse de clés exportée à côté d'un allocateur invite le prochain écrivain
à l'appeler. La capacité de **reconnaître** l'ancienne forme est conservée dans
`lireFormeDeCle`, où elle sert à lire le passé.

**`return null` sur échec** — l'ancien chemin attrapait l'erreur de `PutObject`,
journalisait, rendait `null`, et la route basculait en flux direct. Un PUT à
faux négatif laissait donc des octets en R2 dont personne ne connaissait la clé,
pendant que l'appelant recevait son PDF. `uploadPdf` **lève** désormais, et la
levée est typée.

---

## §2 — L'ORDRE DE MISE EN SERVICE — IL N'EST PAS NÉGOCIABLE

> **LE GATE D'ABORD. LA LIGNE `INVALIDATED` ENSUITE.**
>
> Écrire l'état d'invalidation avant qu'un lecteur existe reproduirait
> exactement `evidentiaryStatus` : « S4 a prononcé l'exclusion de 7 artefacts
> […] la colonne n'était lue NULLE PART : l'exclusion était une déclaration
> sans effet. »

### Étape 1 — le DDL, dans l'éditeur SQL Neon

Coller `docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql` **après
snapshot de branche**. Jamais `prisma db push`, jamais `prisma migrate`.

Puis **vérifier, et lire la vérification** — un message de commit sur l'état de
la base n'est pas une source de vérité :

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'governed_objects' ORDER BY ordinal_position;
SELECT indexname FROM pg_indexes WHERE tablename = 'governed_objects';
```

> ⚠️ **LA TABLE DOIT EXISTER AVANT LE DÉPLOIEMENT DU CODE.** Sans elle,
> `uploadPdf` lève `TABLE_ABSENTE` **avant tout PutObject** — aucun objet n'est
> écrit hors registre, ce qui est le comportement voulu (D5) — mais
> `/api/pdf/casefile` rend alors 500 au lieu de produire un dossier.
> `/api/pdf/{handle}` n'est **pas** affecté : `pointers/` est hors périmètre de
> phase 1 et ne consulte pas le registre.

### Étape 2 — le déploiement du code (le gate)

`npx vercel --prod`, selon le protocole de pré-vol habituel : HEAD, arbre
propre, marqueur du correctif **avant** ; version **servie** vérifiée avant
toute mesure.

À ce stade le gate MORD : toute clé sous `reports/` sans ligne de registre est
refusée, nommément. Les objets existants sous `reports/` — dont le témoin
« avant » — deviennent donc **non délivrables par la primitive**, avant même
qu'une seule ligne d'invalidation n'ait été écrite.

### Étape 3 — l'inventaire réel, en lecture seule

```bash
npx tsx scripts/casefile/reconcilier-registre-r2.ts          # lecture seule
npx tsx scripts/casefile/reconcilier-registre-r2.ts --json   # pour archive
```

C'est **ici** que la clé exacte du témoin « avant » est obtenue. Elle n'est pas
recopiée dans ce document, et elle n'est pas devinée : elle se mesure.

Le script sort **3** s'il trouve des incidents, **2** si la table est absente,
**0** sinon.

### Étape 4 — la quarantaine du témoin

**Une ligne. Aucune écriture d'objet.** Les valeurs marquées `⟨…⟩` viennent de
la sortie de l'étape 3 — ne rien inventer, ne rien deviner :

```sql
INSERT INTO governed_objects (
  id, bucket, storage_key, object_nature, provenance, authority_state,
  invalidation_state, invalidation_reason, invalidated_at, invalidated_by,
  retention_class, subject, sha256, size_bytes, content_type, producer
) VALUES (
  gen_random_uuid()::text,
  ⟨bucket⟩,
  ⟨storage_key mesuré à l'étape 3⟩,
  'LEGACY_UNCLASSIFIED',
  'UNKNOWN_PREEXISTING',   -- l'origine n'est pas établie, et on ne la fabrique pas
  'ORPHAN_CONFIRMED',
  'INVALID_AUTHORITY',
  'Artefact produit sous une autorite que le systeme n''avait pas. '
  'Octets CONSERVES : ils sont la preuve du defaut. Autorite de publication RETIREE.',
  now(),
  ⟨qui décide⟩,
  'EVIDENTIARY_INDEFINITE',
  ⟨subject lu en métadonnée R2 — DÉCLARÉ, non établi⟩,
  ⟨sha256 métadonnée, ou NULL si absente — ne jamais l'établir en lisant les octets⟩,
  ⟨size_bytes mesuré⟩,
  ⟨content_type mesuré, ou NULL⟩,
  'reconciliation-manuelle-E-RC'
);
```

**Pourquoi cet ordre.** Après l'étape 2, le témoin est déjà non délivrable
(fail-closed sur clé sans ligne). L'étape 4 ne change donc pas son
**exposition** — elle change son **statut** : d'« inconnu du registre » à
« conservé, invalidé, et nommément ». La différence n'est pas cosmétique :
c'est la différence entre un silence et un jugement.

### Étape 5 — armer le réconciliateur

> **F5 — sans ordonnanceur, l'échéance T est une fiction.** Et *fusionner
> `main` n'arme pas un cron.*

Le lot n'est « livré » que lorsque la **première exécution planifiée est
constatée**, avec son `trigger`. Précédent exact : la sonde C4.

---

## §3 — LES DEUX LEASES QUE JE DEMANDE — ET CE QUI MANQUE SANS ELLES

Aucune n'était **nécessaire** pour livrer : tout ce qui précède tient sur la
voie libre. Les deux referment des trous réels.

### Lease A — `src/app/api/pdf/casefile/route.ts` (chemin `^src/app/api/`)

**Ce qui manque sans elle — deux choses, et la seconde est sérieuse :**

1. **Le code de refus.** `uploadPdf` lève ; le `catch` de la route rend
   `500 {error:"PDF generation failed", detail:"[registre] TABLE_ABSENTE: …"}`.
   Le motif est **nommé dans `detail`**, mais le statut devrait être `503` :
   une autorité indisponible n'est pas un échec de génération.
2. **Le trou de configuration.** La route n'appelle `uploadPdf` que
   `if (isStorageEnabled())`. Si `PDF_STORAGE_ENABLED` n'est pas `"true"` en
   production, elle **sert le PDF en flux direct, hors registre**, exactement
   comme avant le lot. Le gate ne peut rien : aucun objet n'est écrit, donc
   aucune clé n'est délivrée — l'artefact sort par le corps de la réponse.
   **C'est le seul chemin par lequel un CaseFile non enregistré peut encore
   atteindre un lecteur.** Il dépend d'une variable d'environnement, pas d'une
   décision.

### Lease B — `prisma/schema.prod.prisma` (chemin `^prisma/`)

**Ce qui manque sans elle :** rien de fonctionnel. Le registre passe par du SQL
brut paramétré, précédent du dépôt (`generateCaseFile.ts:210`), et
`governed_objects` est déclarée au titre des racines SQL gouvernées
(`racinesSqlParCapacite.ts`) — donc **pas hors inventaire**. La lease
n'apporterait que la cohérence documentaire du schéma.

---

## §4 — LES DETTES E, COMPTÉES

> *Un trou compté est une dette ; un trou non compté est un oubli.*

`__tests__/security/registre-objets-gouvernes.test.ts` **parcourt le dépôt** et
compare l'ensemble mesuré à l'ensemble déclaré. Un dixième écrivain ou un
quatrième signeur rend le test rouge.

| dette | ce que c'est | pourquoi elle reste |
|---|---|---|
| `src/lib/pdf/engine.ts` | écrit `reports/{handle}/CASE_…` et `pointers/…` sans registre | chemin **GELÉ** ; ses archives sortent au réconciliateur comme `ORPHELIN` + `PRODUCTEUR_NON_CABLE_ENGINE`, **nommément**, pour ne pas noyer le témoin |
| `presign/route.ts` | PUT présigné écrit par un **navigateur**, aucune ligne liée à la réussite du PUT | l'écrivain n'est pas notre code ; hors périmètre D3 |
| `r2-vault.ts` | appelle `getSignedUrl` **en direct** — contourne le gate | autre compartiment, chiffré ; hors périmètre D3 |
| 6 autres écrivains | `evidence/`, vaults, mm-reporting | hors `reports/` ; phase 2 |
| compteur de passages | **local au processus**, meurt avec l'instance serverless | la mesure durable est le décompte `HORS_PERIMETRE` du réconciliateur |

---

## §5 — CE QUE CE LOT NE COUVRE PAS

1. **La quarantaine est prospective.** Elle retire l'éligibilité **à venir**.
   Elle ne révoque **ni** une URL signée déjà émise (TTL 900 s, plafond
   3600 s) **ni** un téléchargement passé. C'est **écrit dans le contrat**
   (`DOCTRINE.QUARANTAINE_PROSPECTIVE`) et **rendu dans chaque refus**
   d'artefact invalidé — pas découvert le jour où on le demande.
2. **La rétention n'est appliquée par rien.** `retention_class` enregistre une
   DÉCISION. Ce compartiment n'est pas WORM, aucun object lock n'est en
   vigueur, et l'absence de politique de cycle de vie n'est pas une politique
   de conservation. Un test interdit au contrat les mots « immutable » et
   « WORM ». **Toute politique de cycle de vie future devra exclure nommément
   `PREFIXES_PROBATOIRES`** — l'exclusion a un domicile dans le code, revu en
   PR ; elle n'y est pas encore *appliquée*, parce qu'il n'y a rien à exclure
   tant qu'aucune politique n'existe.
3. **Les 26 legacy.** Une RÈGLE (`BORNE_LEGACY`, 2026-07-20), pas 26 lignes. Le
   réconciliateur les classe `LEGACY_NON_ENREGISTRE` et **ne crée aucune
   ligne** pour eux : créer une autorité pour un objet dont on n'établit ni la
   provenance ni le sujet **fabriquerait** une autorité. Leur enregistrement
   est une décision, pas une conséquence. **Aucune conclusion historique n'est
   tirée : non enregistrés, et qualifiés comme tels.**
4. **Le comportement réel de R2 sous panne.** PUT à faux négatif, cohérence de
   `ListObjectsV2` juste après écriture, 5xx partiel. Les témoins les
   **injectent** sur un client simulé : cela prouve la réaction du code, jamais
   le comportement du fournisseur. Le canari de D1 est le lot de T2, dans
   `integrity-canary/` — **jamais** mêlé à `evidence/` ni à `reports/`.
5. **La vérité du contenu.** Un artefact parfaitement gouverné peut être faux.
   C'est ASSERTION CORRECTNESS, l'autre axe.
6. **L'origine du témoin « avant ».** Non mesurée, non mesurable par ce
   mécanisme. Je ne la reconstitue pas.

---

## §6 — LE FILTRE, APPLIQUÉ

> *Rend-il la démonstration plus convaincante, ou empêche-t-il une affirmation
> non défendable ?*

**La première.** Ce qui devient dicible à un cabinet, et vérifiable :

- l'artefact remis porte un **identifiant de registre** (`registreId`), rendu
  par la primitive et consigné avec son empreinte et sa taille ;
- son intégrité se vérifie **sans lire les octets** — taille + métadonnée
  `sha256`, jamais l'ETag, jamais `GetObject` ;
- un artefact **non enregistré n'est pas délivrable**, et le refus est nommé ;
- un artefact **invalidé reste conservé** et cesse d'être publiable — sans
  qu'un seul octet ait été réécrit, déplacé ou supprimé.

Ce qui reste **indicible**, et doit le rester : que la conservation soit
garantie (elle est un processus), qu'une copie déjà remise puisse être
rappelée (elle ne peut pas), et que tout R2 soit gouverné (seul `reports/`
l'est, phase 1).
