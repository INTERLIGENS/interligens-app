# Correctif du contrat de schéma — 2026-08-19

**Branche :** `hotfix/contrat-prisma-schema` · **Fenêtre :** PR #118, deux fichiers nommés.
**Aucune exécution SQL, aucune migration, aucun déploiement.**

---

# Q1 — QUEL SCHÉMA GÉNÈRE LE CLIENT ?

## Réponse : `prisma/schema.prod.prisma`, **seul**. `prisma/schema.prisma` n'en génère jamais.

```console
$ node -e "…scripts…"
prisma:generate = prisma generate --schema prisma/schema.prod.prisma
vercel-build    = prisma generate --schema prisma/schema.prod.prisma && next build
build           = next build

$ node -e "…vercel.json…"
buildCommand: undefined | installCommand: undefined

$ grep -A2 '"ignoredBuilds"' node_modules/.modules.yaml
  "ignoredBuilds": [
    "@prisma/client@6.19.3(prisma@6.19.3(typescript@5.9.3))(typescript@5.9.3)"
  ],
```

**Trois faits, et ils se recoupent :**

1. **`vercel.json` ne déclare ni `buildCommand` ni `installCommand`.** Vercel
   retombe donc sur les scripts npm, et **`vercel-build` a priorité sur
   `build`** quand il existe. Le seul `prisma generate` du build nomme
   explicitement `--schema prisma/schema.prod.prisma`.

2. **Le chemin par lequel `schema.prisma` aurait pu servir est coupé.**
   `@prisma/client` porte un `postinstall` (`node scripts/postinstall.js`) qui
   génère depuis l'emplacement **par défaut** — donc `prisma/schema.prisma`. Or
   **pnpm 10 le bloque**, et l'a écrit : `ignoredBuilds` nomme
   `@prisma/client@6.19.3`. Il n'y a ni `.npmrc`, ni champ `pnpm` dans
   `package.json`, ni bloc `prisma` de configuration.

3. **Mesure de contrôle sur le client réellement présent :** il porte
   **159 `ScalarFieldEnum`** — exactement le nombre de modèles de
   `schema.prod.prisma`. `schema.prisma` en a 53. Et `proceedsPublication`, qui
   n'existe **que** dans `schema.prod.prisma`, y apparaît 62 fois.

**Donc : éditer `prisma/schema.prisma` ne changerait rien, ni en production ni
en local.** Un seul schéma fait foi, à tous les moments. C'est pourquoi la
fenêtre d'exemption ne nomme que `schema.prod.prisma`.

**Réserve, dite plutôt que tue :** je n'ai pas lu un journal de build Vercel.
La priorité `vercel-build > build` est un comportement documenté de la
plateforme, pas une mesure que j'ai faite ici. Ce qui la rend robuste : même si
le `postinstall` tournait — si quelqu'un ajoutait `pnpm.onlyBuiltDependencies` —
il générerait **avant** `vercel-build`, qui régénérerait par-dessus. Le schéma
de production gagne dans les deux branches, parce qu'il passe en dernier.

---

# Q2 — LE CLIENT GÉNÉRÉ EST-IL COMMITÉ ?

## Réponse : NON. Confirmé.

```console
$ git ls-files node_modules | wc -l
       0
$ git check-ignore -v node_modules
.gitignore:4:/node_modules	node_modules
```

Zéro fichier suivi sous `node_modules`, zéro chemin suivi nommant
`.prisma/client`, aucun répertoire `generated/` versionné.

**Conséquence, et c'est la bonne façon de lire tout ce qui suit :** ma
régénération locale ne déploie rien. Ce qui compte en production est ce que
**Vercel régénère au build**, à partir du schéma versionné. **Le livrable réel
de ce correctif est donc le diff de `schema.prod.prisma`** — les 54 lignes
ci-dessous. Le reste (client régénéré, typecheck) ne sert qu'à rendre la
vérification honnête ici, et à faire du typecheck un garde plutôt qu'un décor.

---

# CORRECTION 1 — Les trois objets déclarés

## Diff : `prisma/schema.prod.prisma`, **54 lignes, 0 suppression**

```prisma
# KolProfile — juste après le témoin proceedsPublication
+  monetaryClaimsPublication String                @default("published")

# LaundryTrail
+  publication        String             @default("published")
+  @@index([publication])
+  @@index([kolHandle, publication])

# nouveau modèle
+model LaundryTrailPublicationLog { … 14 champs, 4 index … }
```

## Contrat, caractère par caractère

| Objet | SQL | Prisma | Identique |
|---|---|---|---|
| nom | `"publication"` | `publication` | **OUI** |
| type | `TEXT` | `String` | équivalent déclaré |
| nullabilité | `NOT NULL` | pas de `?` | **OUI** |
| défaut | `DEFAULT 'published'` | `@default("published")` | **OUI** |
| nom | `"monetaryClaimsPublication"` | `monetaryClaimsPublication` | **OUI** |
| type / null / défaut | `TEXT NOT NULL DEFAULT 'published'` | `String @default("published")` | **OUI** |
| table | `"LaundryTrailPublicationLog"` | `model LaundryTrailPublicationLog` | **OUI** |
| `id` | `TEXT PK DEFAULT gen_random_uuid()::text` | `@default(dbgenerated("gen_random_uuid()::text"))` | **OUI** |
| `assertedValueUsd`, `primaryEvidenceUsd` | `NUMERIC` | `Decimal?` | **OUI** |
| `createdAt` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | `DateTime @default(now())` | **OUI** |

Style calqué sur le témoin `proceedsPublication` : commentaire au-dessus, motif,
fichier du garde, fichier de migration.

**Les `CHECK` ne sont PAS répliqués dans le schéma** — Prisma ne sait pas les
déclarer. Les dupliquer en commentaire les ferait diverger en silence : le
modèle renvoie au fichier SQL, qui fait foi.

## Ce que je n'ai pas fait, et pourquoi

- **`prisma format` : annulé.** Il a d'abord reformaté **203 lignes** de modèles
  sans rapport. Sur un chemin gelé, un diff illisible n'est pas relisible, donc
  pas relu. J'ai repris à la main : **54 insertions, 0 suppression.**
- **`KolProceedsPublicationLog` reste non déclarée.** Elle existe en base et
  manque au schéma — dérive **préexistante**, hors du motif de cette fenêtre. Je
  la signale ; je ne l'élargis pas de moi-même.

## Preuve — client régénéré via `pnpm prisma:generate` uniquement

| | avant | après |
|---|---|---|
| `proceedsPublication` *(témoin)* | 62 | 62 |
| `monetaryClaimsPublication` | **0** | **62** |
| `LaundryTrailPublicationLog` | **0** | **431** |
| `publication` dans `LaundryTrailScalarFieldEnum` | **absent** | **présent** |
| modèles | 159 | **160** |

**VERIFIED.**

---

# CORRECTION 2 — Le typecheck redevient un garde

## Diff

```ts
// src/lib/kol/canonical.ts  — le cast menteur
-  ...(MONETARY_PUBLICATION_SELECT as { proceedsPublication: true }),
+  ...MONETARY_PUBLICATION_SELECT,

// src/lib/laundry/publicationGate.ts
-export const LAUNDRY_PUBLICATION_SELECT: Record<string, true> = { publication: true };
-export const PUBLISHED_LAUNDRY_FILTER: Record<string, string> = { publication: "published" };
+export const LAUNDRY_PUBLICATION_SELECT = { publication: true } satisfies Prisma.LaundryTrailSelect;
+export const PUBLISHED_LAUNDRY_FILTER = { publication: "published" } satisfies Prisma.LaundryTrailWhereInput;

// src/lib/publication/monetaryGate.ts  — idem, KolProfileSelect / KolProfileWhereInput
```

`publicationGate.ts` et `monetaryGate.ts` ne sont pas sur chemins gelés
(`src/lib/laundry/`, `src/lib/publication/`) — aucune extension de fenêtre.

## Preuve

```console
$ npx tsc --noEmit  →  0 erreur
```

**Un typecheck vert ne vaut que si le rouge est atteignable.** Contrôle négatif
— j'ai injecté une clé inexistante, puis restauré :

```console
src/lib/laundry/publicationGate.ts(110,69): error TS2353:
  Object literal may only specify known properties,
  and 'colonneQuiNExistePas' does not exist in type 'LaundryTrailWhereInput'.
→ 1 erreur ; après restauration → 0
```

Hier, la même faute compilait **sans un mot**. C'est très exactement ce qui a
laissé passer le défaut : le vert d'hier était produit par le `Record<string,
string>` et par le cast, pas par la réalité du schéma.

**VERIFIED.** Suite complète : **295 fichiers · 3 171 tests verts**.

## L'import mort de `v1/kol/[handle]/route.ts:6` — HORS FENÊTRE

`MONETARY_PUBLICATION_SELECT` y est importé et **jamais épandu** : la route
utilise `include:`, pas `select:`.

**Il n'entre pas dans cette fenêtre.** `src/app/api/` est gelé, et le motif est
distinct : ici on referme un contrat de schéma, là on retirerait du code mort.

**Et il n'est plus urgent — le mode B silencieux se referme tout seul.**
`include:` sans `select:` ramène **tous les scalaires** du modèle. La colonne
étant désormais déclarée, `kol.monetaryClaimsPublication` cesse d'être
`undefined`, donc `isOpen(undefined) → false` ne s'applique plus, donc le
fail-closed silencieux qui vidait tous les montants disparaît.

**VERIFIED par construction** — je n'ai pas exécuté la route contre une base.
Ce qui trancherait définitivement : le test 3.2 de la passe 1
(`totalDocumented` non `null` après déploiement).

L'import reste **cosmétique**. Sa propre fenêtre, un jour, avec d'autres
nettoyages de la même famille — pas seul.

---

# CORRECTION 3 — Les deux doublons

## Décision appliquée : on ne verse pas les deux `latest.pdf`. Le BLOC 3 verse **32** pièces.

|  | clé écartée | sha256 | copie de |
|---|---|---|---|
| 1 | `reports/deployer_pool/latest.pdf` | `71bef305…effca` | `CASE_deployer_pool_2026-08-13T04-49-47.pdf` |
| 2 | `reports/GordonGekko/latest.pdf` | `b5598a39…a928cf` | `CASE_GordonGekko_2026-08-16T04-22-56.pdf` |

Vérifié : ce sont les **seuls** `latest.pdf` de l'inventaire, et **les seuls**
doublons. Aucun objet écarté n'était unique.

## Ce qui a changé dans `EXECUTION_2026-08-19.sql`

- **32 lignes `VALUES`** au lieu de 34 · **32 sha256 distincts** · **0 doublon**.
- **Garde-fou : `Attendu 32`**, et il lève sur toute autre valeur.
- **Second garde-fou ajouté :** la transaction échoue si l'une des deux clés
  écartées apparaît malgré tout dans `EvidenceItem`.
- **`ON CONFLICT ("sha256") DO NOTHING` : refusé.** Il aurait fait disparaître
  les deux lignes **en silence**, et le compte serait tombé à 32 sans que rien
  ne l'explique. Une exclusion écrite vaut mieux qu'un compte qui se corrige
  tout seul.
- **Trace durable en base :** le champ `notes` des **deux pièces conservées**
  nomme la clé écartée, son identité de sha256, et dit pourquoi.
- **BLOC 5 :** les deux clés, leurs sha256 et leurs pièces datées sont nommés,
  plus trois `RAISE NOTICE` qui les font apparaître à l'exécution.

**Un écart assumé sur ta consigne :** je n'ai **pas** écrit la mention dans les
six lignes de `KolProceedsPublicationLog`. Ce sont des décisions **monétaires** ;
y loger une information d'archive corromprait six enregistrements pour
documenter un fait qui ne les concerne pas. La mention vit donc dans le BLOC 5
en commentaire + `RAISE NOTICE`, et la trace durable dans les `notes` des pièces
conservées — là où une chaîne de conservation se lit. Dis-moi si tu veux
l'inverse ; c'est ta décision, pas la mienne.

**VERIFIED.**

---

# CORRECTION 4 — Les deux fichiers de préparation

- **`EXECUTION_2026-08-19.sql`** — voir correction 3. Contrôles : `5 BEGIN /
  5 COMMIT` · 32 `VALUES` · 1 seul `DROP`, documenté · 0 `DELETE FROM`,
  0 `TRUNCATE`.
- **`SMOKE_TESTS_2026-08-19.md`** — nouvelle **section 0**, en tête de la passe 1 :
  le `grep` sur le client généré, **avant** `vercel --prod`, avec son témoin
  `proceedsPublication` et la consigne *« n'exécute pas `vercel --prod` si l'un
  des trois rend 0 »*. Avec sa limite écrite : il lit le client **local**, et
  vaut comme proxy parce qu'il lit le **même schéma** — d'où l'exigence d'un
  arbre propre avant déploiement.

**VERIFIED.**

---

# LE BLOC 1 PEUT-IL TOURNER AVANT QUE CETTE FENÊTRE SOIT MERGÉE ?

## **OUI.**

Le BLOC 1 est purement additif en base : deux colonnes `DEFAULT 'published'`,
une table, six index. Il ne dépend d'aucun code et ne change aucun comportement
servi — le code actuellement **déployé** ignore ces colonnes.

**Ce qui doit être mergé avant, ce n'est pas le BLOC 1 : c'est le
DÉPLOIEMENT.** Sans ce correctif, `vercel-build` régénère un client qui ne
connaît pas les colonnes, et six familles de routes tombent — que la migration
ait tourné ou non.

Ordre valide, inchangé sauf sur ce point :

```
BLOC 0 → BLOC 1 → BLOC 2 → [cette fenêtre mergée] → SMOKE §0 → DÉPLOIEMENT
       → BLOC 3 → BLOC 4 → BLOC 5
```

Le seul ordre qui casse quelque chose reste le même : **déployer avant le
BLOC 1**. Ce correctif en ajoute un second, jusqu'ici invisible : **déployer
sans lui**.
