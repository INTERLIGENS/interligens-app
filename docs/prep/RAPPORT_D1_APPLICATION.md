# D1 — Application de la décision

**Branche :** `feat/cc-offline-76-ci-bloc2` — reprise conforme de `prep/bloc2-ci`, sous exemption nommée, **aucun `--no-verify`**
**Date :** 2026-08-18
**Run CI :** [`32135319549`](https://github.com/INTERLIGENS/interligens-app/actions/runs/32135319549)

---

## LE LIVRABLE : LA LISTE DE CE QUI RESTE ROUGE

**La CI n'est pas verte sur les quatre gates. Trois le sont, un ne l'est pas —
et pour une raison qui n'était pas dans le périmètre autorisé.**

| Gate | Avant | Maintenant | Pourquoi |
|---|---|---|---|
| Secret Scanning (Gitleaks) | ✅ | ✅ | — |
| **SAST (Semgrep)** | ❌ | ✅ | les 9 tags épinglés au SHA étaient ses seuls findings bloquants |
| **Type check** | ❌ *(523 erreurs)* | ✅ | étape `pnpm prisma:generate` ajoutée |
| **Tests** | `skipped` | ❌ | **2 fichiers sur 291** — `retractionEngine.test.ts`, `resolve.test.ts` |
| **Build** | `skipped` | ❌ | **`ADMIN_TOKEN` manquante** — voir ci-dessous |
| Lint | ❌ | ❌ | 1 244 problèmes de dette legacy |
| Dependency Audit | ❌ | ❌ | 108 vulns `moderate+` sur 951 dépendances |

**Les quatre gates s'exécutent tous, à chaque run.** C'était l'objet de B1 et
c'est acquis : plus aucun ne masque les autres.

---

## LE GATE `BUILD` — CE QUI L'A DÉBLOQUÉ, ET CE QUI LE BLOQUE ENCORE

**`DATABASE_URL` factice : posée, et elle a fait son travail.** Le build passe
« Collecting page data » sans lever sur `DATABASE_URL`.

**Il s'arrête un cran plus loin :**

```
Error: [env] Missing required env var in prod: ADMIN_TOKEN
  Failed to collect page data for /api/admin/ingest/pdf
```

`src/lib/config/env.ts:12-19` exige **cinq** variables quand
`NODE_ENV === "production"`, et les vérifie dans l'ordre :

```ts
requireInProd("DATABASE_URL");     // ← satisfaite
requireInProd("ADMIN_TOKEN");      // ← bloque ici
requireInProd("VAULT_AUDIT_SALT");
requireInProd("ADMIN_BASIC_USER");
requireInProd("ADMIN_BASIC_PASS");
```

**Poser les quatre restantes n'a pas été fait, et ne devrait pas l'être à la
légère.** `DATABASE_URL` désigne une base ; les quatre autres sont des
**secrets d'authentification**, et le dépôt porte déjà une doctrine explicite
sur l'une d'elles — `vitest.config.ts` :

> *« `ADMIN_TOKEN` n'est **PAS** posé ici : plusieurs tests vérifient justement
> le fail-closed quand il manque, et le poser globalement les rendrait verts
> pour la mauvaise raison. »*

Le même raisonnement vaut pour le build : poser un `ADMIN_TOKEN` factice ferait
passer un gate en désarmant, dans l'artefact, la vérification que ce jeton
existe. **Ce n'est pas le même geste que de poser une base injoignable.**

**Trois options, aucune prise :**

| # | Option | Effet | Coût |
|---|---|---|---|
| 1 | Poser les 4 autres en CI, valeurs manifestement factices | `Build` vert | Pose 4 secrets factices. Le garde `env.ts` ne prouve plus rien en CI. |
| 2 | Retirer `NODE_ENV: production` de l'étape | `Build` vert | Le build ne teste plus le chemin de production. Le gate perd sa raison d'être. |
| 3 | Ne rien changer | `Build` rouge | État actuel. Le gate s'exécute et échoue pour une raison exacte et nommée. |

---

## LES DEUX AUTRES ROUGES

### `Tests` — 2 fichiers sur 291

`src/lib/intelligence/__tests__/retractionEngine.test.ts` et
`src/lib/shill-correlation/__tests__/resolve.test.ts`, tous deux via :

```
PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"
  ❯ src/lib/kol/pricing.ts:7
```

Défaut mesuré en B1 : un `PrismaClient` construit **au chargement du module**
avec `datasources: { db: { url: process.env.DATABASE_URL } }`. Vitest charge les
`.env` dans `process.env` — les 3 016 tests verts en local l'étaient **avec** une
`DATABASE_URL`. **Non corrigé** : `^src/lib/kol/` est gelé, et poser la variable
dans `vitest.config.ts` heurte la doctrine citée plus haut.

*La `DATABASE_URL` factice ne les couvre pas : elle est posée sur l'étape
`Build`, pas sur l'étape `Tests`. L'étendre à `Tests` rendrait ces deux fichiers
verts — et masquerait le défaut qu'ils révèlent.*

### `Lint` — 1 244 problèmes

Dette legacy cartographiée au rapport d'août. Décision produit (lot B/C/E).

---

## LES DEUX TRAITEMENTS DÉCIDÉS

### 1. `src/app/admin/intel-vault/compliance/page.tsx` → `force-dynamic`

**Chemin gelé — patch vérifié, non commité :**
`docs/prep/patches/D1-surface-compliance-force-dynamic.patch`

**Vérifié, pas supposé.** Build local avec le patch appliqué :

```
avant :  ├ ○ /admin/intel-vault/compliance
après :  ├ ƒ /admin/intel-vault/compliance
```

La page quitte le prérendu. Le commentaire posé dans le fichier dit pourquoi —
et pourquoi **ce n'est pas un compromis pour la CI** : une page de conformité
dont l'unique donnée est `auditLog.count()` figeait ce compteur dans l'artefact
**jusqu'à la construction suivante**, et aurait figé `-1` si la base n'était pas
joignable au build. Sortir du prérendu est l'effet de bord, pas le motif.

### 2. `src/app/en/news/page.tsx` → **inchangée**

L'ISR est conservé (`revalidate = 300`). La `DATABASE_URL` factice est posée
**uniquement dans le workflow**, avec un hôte `.invalid` — TLD réservé par la
**RFC 2606**, qui ne résout nulle part, ne résoudra jamais, et n'est
enregistrable par personne. **Jamais dans Vercel, jamais dans un `.env`.**

---

## LE COMMENTAIRE AU-DESSUS DE `BUILD`

Il occupe 33 lignes et il est le point de ce chantier autant que le reste. Il
dit :

- **ce que le gate prouve** — le projet compile, le prérendu s'exécute jusqu'au
  bout sans lever, `Collecting page data` traversé pour chaque route ;
- **ce qu'il ne prouve pas** — que l'artefact prérendu est correct ;
- **le mécanisme exact** — `/en/news` exécute 3 requêtes Prisma au prérendu,
  chacune sous un `try/catch` qui **avale** ; en CI elles échouent en silence et
  la page se prérend **vide** ;
- **pourquoi ce n'est pas grave ici** — l'artefact de CI n'est jamais déployé ;
- **la conséquence à retenir** — *« une régression qui ferait sortir une requête
  de son `try/catch` resterait INVISIBLE à ce gate. Il attrape ce qui ne compile
  pas et ce qui lève ; il n'attrape pas ce qui échoue en silence. »* ;
- **pourquoi un hôte inexistant** plutôt qu'une vraie base.

Il **remplace** un commentaire qui affirmait l'inverse de la réalité :

> ~~*« Build sans variables secrètes — les routes qui en ont besoin doivent
> gérer l'absence gracieusement (feature flags / fallback) »*~~

Elles ne la gèrent pas gracieusement. **Elles échouent, délibérément** — c'est
`env.ts` qui refuse de démarrer sans ses cinq variables, et c'est exactement ce
qu'on attend d'un fail-fast. Le commentaire promettait une propriété que le
code n'a jamais eue, et il était écrit **avant que quiconque ait pu voir
l'étape s'exécuter**.

---

## UN CORRECTIF DE DÉCLENCHEUR, TROUVÉ EN CHEMIN

`prep/**` avait été ajouté aux déclencheurs `push` en B1 — pour une convention
de branche que **le guard n'accepte pas** : une branche `prep/` ne peut être
commitée qu'avec `--no-verify`. Le déclencheur ne pouvait donc jamais servir.
Remplacé par les deux formes réellement utilisables : `feat/cc-offline-**` et
`hotfix/**`.

---

## CONTRÔLE

| Contrainte | État |
|---|---|
| `--no-verify` | **aucun** — exemption nommée ouverte par la voie de maintenance |
| Variable posée hors CI | **aucune** — ni Vercel, ni `.env` ; la valeur n'existe que dans `security.yml` |
| Secrets d'authentification posés | **aucun** — `ADMIN_TOKEN` et les trois autres restent absents |
| Chemin gelé forcé | **aucun** — `compliance/page.tsx` reste en patch |
| Écriture en base, migration, `db:*` | **aucune** |
| `BOTIFY_MINT`, `TSA_*`, `R2_PUBLIC_BASE_URL` | non touchés |
