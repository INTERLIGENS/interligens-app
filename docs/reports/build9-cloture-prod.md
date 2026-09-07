# BUILD 9 — clôture : SQL de scellement rendu, lot d'arbitrage déployé et validé

Deux livrables. Le premier est **rédigé, non exécuté**. Le second est mesuré en
production, en **lecture seule** — à une exception documentée, le `POST` sans
effet de bord sur `/api/casefile/generate` (§2.4).

`0 écriture en base · 0 DDL · 0 appel Helius.`

| | |
|---|---|
| `main` | `c80a4a959c1e551ee6b27c0002b59d0273216d25` |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — inchangé |
| déploiement | **`interligens-mjyo7j3xe`** · Ready · Production · émis depuis `c80a4a9` |
| horodatage | 2026-09-07, 21:15–21:40 UTC+2 |

---

## VERDICT

> ## Tout passe.
>
> Une nuance de méthode à consigner : le gate des métriques gouvernées **n'est
> pas démontré isolément** par cette mesure — il est masqué par un gate plus
> large qui retient déjà tous les claims (§2.1).

| # | objet | verdict |
|---|---|---|
| 1 | SQL de scellement rendu, non exécuté | **LIVRÉ** — 8 + 8 `UPDATE` |
| 2.1 | notation `X/100` sur surfaces publiques | **PASS** — 0 occurrence |
| 2.2 | PDF dossier-agnostique, sans fuite croisée | **PASS** |
| 2.3 | échec fermé sur mint sans dossier | **PASS** |
| 2.4 | bannière `/generate` inconditionnelle | **PASS** |
| 2.5 | 7 signatures — non-régression | **PASS** — 0 occurrence |
| 2.6 | tigerScore `null`, sans repli vers 0 | **PASS** |

---

# ÉTAPE 1 · LE SQL DE SCELLEMENT

## Vérification préalable du script

`scripts/casefile/seal-claims.ts` a été **lu avant exécution** : il ne fait
qu'un `$queryRawUnsafe` de `SELECT` sur `CaseFileClaim`, puis des `console.log`.
**Aucune écriture.** La vérification n'était pas de pure forme — le script se
connecte à `ep-square-band`.

## Ce qui a été rendu

| fichier | taille | révisions lues | déjà scellées | `UPDATE` rendus |
|---|---|---|---|---|
| `docs/prep/patches/BUILD9/06_seal_botify.sql` | 3 331 o | 8 | 0 | **8** |
| `docs/prep/patches/BUILD9/06_seal_vine.sql` | 3 316 o | 8 | 0 | **8** |

**Aucun des deux n'est vide.** Les deux fichiers sont joints à cette PR, à
l'emplacement conventionnel des patches BUILD 9.

### Empreintes — BOTIFY (`IL-SHILL-BOTIFY-001`)

| claim | version | `contentHash` |
|---|---|---|
| C1 | 1 | `0d2a01ba5a5e69bffbbe9eb3df43e1b99e4953307f87528ed98bd97f88ce11d9` |
| C2 | 1 | `c3f0e805d53d7451380d313ec8c8546a945176f6ab5b517c06e4ea2e59648522` |
| C3 | 1 | `34ee37ce44f3cc995310c72bcd2a56b651dac44c5542afd701ed8ed81e77d426` |
| C4 | 1 | `ae69f1979976f0e9f1582c4fd10bfbcd231640e6c60b33ee44c012b065775cc4` |
| C5 | 1 | `b7a1911e63b1228453766953fdc92157f7c6d54d27f7483facc0c9df7db165dd` |
| C6 | 1 | `3592f00e767540fb6fc9f765fdf1f22e65f7a2e494d17382aef58937e1282fdf` |
| C7 | 1 | `502aa802044d179a74092477c916a98f612bb4e9f080f556af3efd25ec482f7f` |
| C8 | 1 | `7f262a2950a30a9c41b97a21b28c07a05135d40c836853b851d6a0d4eab085d9` |

### Empreintes — VINE (`IL-SHILL-VINE-001`)

| claim | version | `contentHash` |
|---|---|---|
| C9 | 1 | `33e20c096311d34eab1c18b17d77df607031552c6ce533d6aac76e7a5ce34cb6` |
| C10 | 1 | `b3d7d834c63f4d527a5de916c92368d730bb7ab51435eed0c2731a172d7ef036` |
| C11 | 1 | `602b9d6c1042612b6a55febf7dd5b51d7152c78a1fa79f6bddfb9440497a59c6` |
| C12 | 1 | `cd6121e630e4320250de833e310a051a9934779032ec7f5e2ca9c6fe53a70967` |
| C14 | 1 | `d7e30ff5aedfe5102305893aaa13f00e6bcafdb676d1e308287135d3481efd87` |
| C15 | 1 | `d01b483ab8ca5eba51d66d655e0ac0f1304f72fa6e1cac44abca2b356cfb9925` |
| C16 | 1 | `07924d3f761c82e4d854ac3d8ae2ec4e6291dca5a0f5bdfe966e87759e13058c` |
| C17 | 1 | `093f7a254ff11ed370216024ea606e933ccb34005c1b0d7ad37a31c0a6ba02b7` |

Chaque `UPDATE` porte `AND "contentHash" IS NULL` : un rejeu ne réécrit jamais
un sceau posé.

## Post-checks fournis, et leurs valeurs attendues

| # | contrôle | attendu |
|---|---|---|
| 6.1 | `SELECT count(*) AS non_scelles … WHERE "contentHash" IS NULL` | **0** |
| 6.2 | `SELECT count(*) AS versions_sans_changement … GROUP BY "claimId","contentHash" HAVING count(*)>1` | **0** |
| 6.3 | `auditCaseFileIntegrity(ref)` — `CONTENT_MUTATED` | **0** |

## État de la base après génération — inchangé

Vérifié en lecture seule, après coup :

| dossier | révisions | non scellées | scellées |
|---|---|---|---|
| `IL-SHILL-BOTIFY-001` | 8 | **8** | **0** |
| `IL-SHILL-VINE-001` | 8 | **8** | **0** |

**La génération n'a rien écrit.** Le premier `write` reste la décision du
fondateur.

## Une observation, à ne pas confondre avec un défaut

Les `claimId` de VINE sont `C9, C10, C11, C12, C14, C15, C16, C17` — **`C13` est
absent**. Huit claims pour une numérotation qui va de 9 à 17. Le script a scellé
les huit lignes qui existent ; il ne pouvait rien faire d'autre. Que `C13` ait
été supprimé, jamais créé, ou vive ailleurs n'est pas mesurable d'ici, et n'est
pas de mon ressort.

---

# ÉTAPE 2 · DÉPLOIEMENT ET VALIDATION

## Contrôles avant vol

| # | contrôle | attendu | observé | |
|---|---|---|---|---|
| 1 | `git rev-parse HEAD` | `c80a4a9` | **`c80a4a959c1e…16d25`** | OK |
| 2 | `status --porcelain -uno` | vide | vide **après stash** de la fixture REFLEX | OK |
| 3 | `projectName` | `interligens-app` | **`interligens-app`** | OK |
| 4 | `--scope` explicite dès la 1re tentative | — | **appliqué** | OK |

**Le `--scope` a tenu sa promesse** : déploiement abouti du premier coup, aucun
`Not authorized`. Le protocole issu de BUILD 9 fonctionne.

Les deux `.sql` générés vivent sous `docs/`, **exclu par `.vercelignore:10`** :
ils ne partent pas dans l'artefact.

## Contrôle bloquant de version servie

`engine_version` **n'a pas été incrémenté** par ce lot : il reste `CaseFile-v2.0`,
comme sous `6b9df7f`. Le marqueur habituel ne discrimine donc pas.

J'ai utilisé deux **discriminants de comportement** — des choses que l'ancien
artefact ne pouvait pas faire :

| discriminant | sous `6b9df7f` | sous `mjyo7j3xe` |
|---|---|---|
| PDF VINE | **refusé** (gabarit BOTIFY) | **`%PDF-` rendu** |
| PDF VINE, taille | — | 104 414 o |

| surface | résultat | |
|---|---|---|
| `interligens-mjyo7j3xe….vercel.app` | PDF VINE rendu | OK |
| `app.interligens.com` | PDF VINE rendu | OK |

Les deux servent le même artefact — ni code non déployé, ni déploiement non
aliasé.

> **À verser au protocole** : quand un lot ne bump pas la version, il faut un
> discriminant de comportement, et il doit être choisi *avant* de mesurer.
> Sans le PDF VINE, ce lot aurait été indiscernable du précédent.

## 2.1 · La notation « X / 100 »

Recherche par expression régulière couvrant les trois formes —
`100/100`, `100 / 100`, `100 sur 100` :

| surface | nature | occurrences | |
|---|---|---|---|
| PDF public BOTIFY (EN) | publique | **0** | OK |
| PDF public BOTIFY (FR) | publique | **0** | OK |
| PDF public VINE | publique | **0** | OK |
| `/api/casefile/public?mint=…` | publique | **0** | OK |
| `/api/casefile?mint=<BOTIFY>` | **interne** | **0** | — |
| `/api/casefile?mint=<VINE>` | **interne** | **1** — `100/100` | voir ci-dessous |

**Sur les surfaces publiques : 0 occurrence.** Le critère est tenu.

### L'occurrence restante, et pourquoi elle n'est pas un écart

Elle est sur `/api/casefile`, dans la prose du claim VINE `C11`. Cette route
n'est pas une projection publique, et le code le dit explicitement
(`src/lib/casefile/internalView.ts`) :

> *« `/api/casefile` est authentifiée (SEC P0, `checkAuth` toujours exigé). Elle
> n'est donc pas une projection publique : lui appliquer le filtre PUBLIC
> rendrait zéro claim à un opérateur qui a précisément besoin de voir ce qui
> n'est pas publié. »*

Elle rend le dossier entier, **chaque claim portant son `state`** — vérifié : les
8 claims VINE sortent en `ATTACHED`, aucun en `PUBLIC`. Un opérateur distingue
donc ce qui est publiable de ce qui est seulement rattaché. Sans jeton, la route
répond `401 NOMINATIVE_ACCESS_REQUIRED`.

Le régime de publication (`projectForPublication` → PDF) porte le gate, et il
fonctionne : 0 occurrence là où le lecteur retail regarde.

### La nuance de méthode, à consigner

La table de retrait des deux PDF dit :

```
REASON   Excluded from publication
FIELD    state
ITEMS    8
```

et le corps ajoute : *« No claim in this file currently meets the publication
requirements. »*

**Aucun claim n'est PUBLIC aujourd'hui, ni pour VINE ni pour BOTIFY.** Les huit
sont retenus sur `state`. La notation n'atteint donc pas une surface publique —
mais **le gate des métriques gouvernées n'est pas la raison observable** de ce
retrait : il est masqué par un gate plus large qui retient déjà tout.

Je le dis parce que la différence compte pour la suite : le jour où un claim VINE
sera promu vers `PUBLIC`, c'est à ce moment-là que le gate `governedMetrics`
devra montrer qu'il refuse `C11` en particulier. **Cette mesure ne le démontre
pas.** Elle démontre seulement que rien ne fuit aujourd'hui.

## 2.2 · Le renderer dossier-agnostique

| entrée | document rendu | taille | texte | réf. citées |
|---|---|---|---|---|
| mint BOTIFY canonique | **PDF BOTIFY** | 112 336 o | 5 641 o | `IL-SHILL-BOTIFY-001` seule |
| mint VINE canonique | **PDF VINE** | 104 414 o | 5 044 o | `IL-SHILL-VINE-001` seule |
| alias 43 car. | PDF BOTIFY | 112 336 o | 5 641 o | `IL-SHILL-BOTIFY-001` seule |

Deux documents de tailles distinctes : ce n'est pas un gabarit unique dont on
change le nom.

### Fuite croisée — le vrai risque, mesuré dans les deux sens

| marqueur cherché | dans le PDF VINE | |
|---|---|---|
| `BOTIFY` · `$BOTIFY` · `Botify` | **0** | OK |
| `IL-SHILL-BOTIFY-001` | **0** | OK |
| mint BOTIFY 44 car. | **0** | OK |
| `rugcheck` (source propre à BOTIFY) | **0** | OK |

| marqueur cherché | dans le PDF BOTIFY | |
|---|---|---|
| `VINE` · `$VINE` | **0** | OK |
| `IL-SHILL-VINE-001` | **0** | OK |
| mint VINE | **0** | OK |
| `Wi11em` (acteur propre à VINE) | **0** | OK |

Comparaison structurelle des lignes longues (> 40 caractères) : **1 propre à
VINE, 12 propres à BOTIFY, 20 communes** — les communes étant du gabarit
vérifié à la lecture (coordonnées AMF, avertissement légal, phrase d'introduction
de la section claims). Aucune donnée de dossier parmi elles.

**Un PDF faussement complet ne se verrait pas** — c'est pourquoi le contrôle
porte sur des marqueurs propres à chaque dossier, dans les deux sens, et pas sur
la seule présence du bon titre.

## 2.3 · Échec fermé

| entrée | attendu | observé | |
|---|---|---|---|
| `So1111…1112` (WSOL, aucun dossier) | refus | **HTTP 400** · `{"error":"mint has no linked case file"}` | OK |
| `PASUNMINTDUTOUT123` (chaîne invalide) | refus | **HTTP 400** · même refus | OK |

Aucun PDF rendu, aucun repli sur un dossier voisin.

## 2.4 · La bannière de `/api/casefile/generate`

Le code place désormais la bannière sous `if (!input.canonical)` — donc
inconditionnelle sur l'absence de dossier canonique, là où elle dépendait
auparavant de la présence de claims de preset.

**Exercé** par un `POST` avec `case_meta` seul : aucun claim, aucun bloc
canonique, `uploadToR2` omis (défaut `false`).

| contrôle | observé | |
|---|---|---|
| HTTP | **200**, PDF de 37 323 o | OK |
| bannière | *« Ce document n'est adossé à AUCUN dossier canonique. Ses sections proviennent d'un preset ou de données fournies à la génération. Il ne constitue pas une projection de l'autorité CaseFile. »* | **OK** |
| notation `X/100` | **0** | OK |

Un rapport généré sans claim **n'est plus muet sur sa provenance**.

> **Sur le `POST`** : la route a été lue avant d'être appelée — aucun `prisma`,
> aucun `create`, aucun `update`, aucune écriture de fichier, et `uploadToR2`
> défaut `false`. C'est un rendu pur. Je le signale parce que mes validations
> précédentes s'interdisaient tout `POST` et déclaraient ce point non mesuré ;
> ici il est mesuré, et la raison du changement est explicite.

## 2.5 · Les 7 signatures — non-régression

Balayage identique à celui de la validation précédente : **7 signatures + 7
marqueurs de cluster + 10 fragments distinctifs**, sur 8 surfaces.

| surface | valeurs | fragments | |
|---|---|---|---|
| `/api/casefile?mint=<44>` | **0** | **0** | OK |
| `/api/casefile?mint=<43>` | **0** | **0** | OK |
| `/api/casefile/public?mint=<44>` | **0** | **0** | OK |
| `/api/casefile/pdf` EN · FR · alias | **0** | **0** | OK |
| `/en/cases/lab` · `/fr/cases/lab` | **0** | **0** | OK |

PDF contrôlés sur le **texte extrait** par `pdftotext`, jamais sur le flux.
Aucune régression.

## 2.6 · tigerScore

| dossier | `off_chain.tiger_score` | notation publique | repli vers 0 | |
|---|---|---|---|---|
| **BOTIFY** | **`null`** | **0** | **aucun** | OK |
| **VINE** | **`null`** | **0** | **aucun** | OK |

---

## CE QUI RESTE NON MESURÉ

1. **UI au rendu** — `/en/cases/lab` et `/fr/cases/lab` répondent `403` derrière
   le gate beta `/access`. Aucun code d'accès saisi. Contrôle statique déjà fait
   au rapport précédent (0 occurrence dans `TokenCasefileView.tsx` et les deux
   pages) ; le rendu reste à confirmer par un porteur de code.
2. **Le gate `governedMetrics` en situation** — voir §2.1 : il ne pourra être
   démontré que sur un dossier ayant au moins un claim `PUBLIC`.
3. **Les post-checks de scellement** — ils s'exécutent après application du SQL
   dans Neon, qui n'a pas eu lieu.

---

## MÉTHODE

- Script de scellement **lu avant exécution**, pour vérifier l'absence
  d'écriture ; état de la base **revérifié après** génération.
- Contrôles avant vol appliqués dans l'ordre, `--scope` explicite dès la
  première tentative.
- Version servie contrôlée **avant toute mesure**, par discriminant de
  comportement faute de bump de version, sur l'URL du déploiement puis sur le
  domaine.
- PDF : `pdftotext` sur le document, jamais `grep` sur le flux.
- Notation cherchée par expression régulière couvrant `/`, ` / ` et ` sur `.
- Fuite croisée mesurée **dans les deux sens**, sur marqueurs propres.
- Un seul `POST`, sur une route lue au préalable et sans effet de bord.
- `0 écriture en base · 0 DDL · 0 appel Helius.`
