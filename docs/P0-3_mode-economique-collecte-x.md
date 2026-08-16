# P0-3 — Mode économique de la collecte X

**Statut : PROPOSITION. Rien n'est appliqué.** Aucune variable d'environnement
n'a été modifiée, aucun cron n'a été touché, aucune donnée supprimée.
Mesures relevées sur `ep-square-band` le **2026-08-15** (lectures seules).

---

## 1. Ce qu'on paie, et ce que ça produit

### Dépense réelle (table `XApiUsage`, schéma live `monthStart` / `totalCostUsd`)

| Mois | Posts lus | Coût |
|---|---:|---:|
| 2026-06 | 2 060 | **11,95 $** |
| 2026-07 | 17 378 | **100,79 $** ← plafond mensuel atteint |
| 2026-08 (au 15) | 10 577 | **61,35 $** |

Rythme d'août : **4,09 $/jour** → **≈ 127 $** sur un mois plein, soit au-dessus
du plafond `X_API_HARD_CAP_USD` (100 $). À ce rythme le garde-fou posts bloquera
les runs autour du **23-24 août**, et la collecte s'arrêtera d'elle-même — mais
en fin de mois, après avoir dépensé.

### Production éditoriale sur la même période

| Fait | Valeur | Source |
|---|---|---|
| Dernière décision éditoriale (approve/reject) | **2026-06-29** | `CandidateStatusLog` |
| Approbations depuis la mise en service | **2** | `CandidateStatusLog.toStatus='approved_public'` |
| Rejets | **1** | idem |
| Drafts `KolTokenLink` en attente | **92** | `visibility='draft'` |
| Drafts dont `reviewedAt` est renseigné | **0 / 92** | `KolTokenLink` |
| Candidats jamais traités (`status='new'`) | **6 646**, le plus ancien du **2026-03-29** | `social_post_candidates` |
| Candidats collectés sur 30 jours | **1 563** | idem |

**Dépense depuis la dernière décision éditoriale (2026-06-29) : ≈ 162 $ pour
zéro lien publié.** C'est le chiffre qui fonde ce chantier.

### Concentration du stock

Les 92 drafts ne portent que sur **6 handles**, dont **88 sur deux d'entre eux**
(`Empire_sol1` 72, `captain_meme1` 16). Les 178 candidats `needs_review` sont
concentrés de la même façon (`Empire_sol1` 156). Le « corpus de validation »
n'a donc quasiment aucune diversité KOL — c'est un point à corriger avant de
s'en servir comme jeu d'entraînement de la revue humaine.

---

## 2. Constat qui change le calcul : la production tourne sur la liste ENTIÈRE

`src/app/api/cron/watcher-v2/route.ts:273` lit `WATCHER_MAX_HANDLES` avec un
défaut de **50**, et applique `handlesV2.slice(0, maxHandles)`.

Or sur les **7 derniers jours**, des candidats remontent de **65 handles
distincts**, tous présents dans `handles.ts`, **jusqu'à l'index 107** — c'est-à-dire
le dernier de la liste (`alterfind_`), au-delà de `captain_meme1` (54) et
`Empire_sol1` (56). Le seul écrivain de `social_post_candidates` dans le code
est ce cron (`route.ts:449`).

**Conclusion : en production, `WATCHER_MAX_HANDLES` vaut au moins 108, pas 50.**
Toute estimation calée sur « 50 handles » est fausse. La valeur exacte se lit
dans la Vercel UI (l'interdit du chantier proscrit `vercel env ls` non rédigé) —
**à confirmer avant d'appliquer quoi que ce soit**.

### Paramètres effectifs (défauts du code)

| Variable | Défaut code | Effet |
|---|---:|---|
| `WATCHER_MAX_HANDLES` | 50 (**≥108 en prod**) | nombre de handles lus par run |
| `WATCHER_MAX_POSTS_PER_HANDLE` | 15 | plafond de posts par handle (**GordonGekko : 100, EN DUR**) |
| `WATCHER_LOOKBACK_HOURS` | 30 | fenêtre de rattrapage (cron quotidien + 6 h de recouvrement) |
| `X_API_HARD_CAP_POSTS` | 24 000 | plafond dur en posts par cycle X (décision de blocage) |
| `X_API_HARD_CAP_USD` | 100 | plafond mensuel en $ (**reporting uniquement**, plus la décision) |
| `X_API_COST_PER_POST` | 0,0058 | prix unitaire facturé |

Pire cas théorique par run : 107 × 15 + 100 = **1 705 posts**. Mesuré :
**705 posts/jour**, soit 41 % du pire cas — la majorité des handles ne produisent
pas 15 posts en 30 h, donc le plafond par handle ne mord que sur les plus actifs
(29 handles sur 72 dépassent 15 candidats sur 30 jours).

---

## 3. Les leviers, et ce qu'ils valent

Tous sont des variables d'environnement lues **à l'exécution** : aucun diff de
code. **Un redéploiement Vercel reste nécessaire** pour qu'un changement d'env
prenne effet — c'est un `vercel --prod` sans modification de source.

| # | Levier | Variable | Valeur proposée | Effet | Certitude |
|---|---|---|---|---|---|
| L1 | Réduire le périmètre | `WATCHER_MAX_HANDLES` | 108 → **20** | sous-ensemble strict : seuls les 20 premiers de `handles.ts` sont lus | **déterministe** |
| L2 | Réduire la profondeur | `WATCHER_MAX_POSTS_PER_HANDLE` | 15 → **3** | pire cas 1 705 → 421 posts/run | partiel : ne mord que sur les handles prolifiques ; **ne touche pas** les 100 posts en dur de GordonGekko |
| L3 | Plafond dur en posts | `X_API_HARD_CAP_POSTS` | 24 000 → **3 500** | blocage **avant tout appel facturé** | **absolu** |
| L4 | Kill switch total | `X_API_HARD_CAP_POSTS` | **0** | `usage + estimate >= 0` toujours vrai → run sauté, 0 handle, **0 $** | **absolu** |
| L5 | Cadence | `vercel.json` | quotidien → hebdo | ÷7 runs, mais fenêtre de 30 h → 138 h de trou par semaine | déterministe, **coût produit réel** |
| L6 | Robinet du stock | `WATCHER_BRIDGE_ENABLED` | → **false** | plus aucun nouveau draft | **déterministe** |

`L4` est un vrai kill switch, pas un contournement : `envInt`
(`src/lib/config/envNumber.ts:65`) conserve explicitement le zéro — le fichier
documente que « sur un plafond, `0` est un kill switch légitime ». Une chaîne
vide, elle, retomberait sur le défaut 24 000 : **poser `0`, jamais une valeur
vide.**

### Deux robinets distincts, à ne pas confondre

L'énoncé du chantier dit « on arrête de payer pour accumuler du stock non revu ».
Les mesures montrent que ce sont **deux robinets séparés** :

- **Robinet A — l'argent** : le scan X quotidien → `social_post_candidates`.
  ≈ 127 $/mois. Fermé par L1/L2/L3/L4.
- **Robinet B — le stock nominatif** : le bridge → `KolTokenLink` en `draft`.
  Coût X nul (Helius + DexScreener seulement), mais **c'est lui qui fabrique les
  associations nominatives non revues**. Fermé par L6.

**Fermer A ne tarit pas B** : le bridge a **6 646 candidats `new`** d'avance,
remontant au 2026-03-29. Il continuerait à produire des drafts pendant des mois
même si la collecte X s'arrêtait aujourd'hui. Les deux journaux `JobRunLog` du
2026-08-15 (06:45 et 13:11, `status='success'`) ont créé **13 drafts chacun**, à
partir de ce backlog déjà payé.

---

## 4. Proposition retenue — « veille réduite »

| Variable | Actuel | Proposé |
|---|---:|---:|
| `WATCHER_MAX_HANDLES` | ≥108 | **20** |
| `WATCHER_MAX_POSTS_PER_HANDLE` | 15 | **3** |
| `X_API_HARD_CAP_POSTS` | 24 000 | **3 500** |
| `WATCHER_BRIDGE_ENABLED` | (voir §5) | **false** |
| Cadence cron | quotidienne | **inchangée** |
| `WATCHER_LOOKBACK_HOURS` | 30 | **inchangé** |

**Pourquoi garder la cadence quotidienne :** un watcher dont la fenêtre est
hebdomadaire laisse 138 h de trou par semaine et cesse d'être un watcher. La
décision de l'architecte est « on ne coupe pas le Watcher » — on réduit son
périmètre et sa profondeur, pas sa fraîcheur.

**Pourquoi 20 handles :** ce sont les 20 premiers de `handles.ts`, c'est-à-dire
les `priority: 'high'` documentés, et ils incluent les 6 profils investigués en
profondeur (`bkokoski` 7, `sxyz500` 8, `GordonGekko` 9, `planted` 10,
`DonWedge` 11, `lynk0x` 12). On garde la veille là où il existe déjà un dossier.

### Effet chiffré

Sur 30 jours, les 20 premiers handles produisent **214 candidats sur 1 563**,
soit **13,7 %**. En prenant cette part comme proxy du volume de posts (proxy, pas
preuve : le taux de conversion post→candidat varie d'un handle à l'autre) et en
bornant par l'hypothèse uniforme 20/108 = 18,5 % :

- dépense estimée : **0,56 à 0,76 $/jour** → **17 à 23 $/mois**
- contre **≈ 127 $/mois** au rythme actuel
- **économie ≈ 104 à 110 $/mois, soit −82 % à −87 %**

`X_API_HARD_CAP_POSTS = 3 500` borne le tout de façon **absolue** :
3 500 × 0,0058 = **20,30 $ par cycle**, quoi qu'il arrive, quelle que soit la
justesse du proxy ci-dessus.

### Retour arrière

1. Restaurer les 4 variables à leurs valeurs actuelles dans la Vercel UI.
2. `npx vercel --prod` (aucun diff de code).
3. Effet au run suivant, 06:00 UTC.

**Aucune donnée n'est touchée.** Les 92 drafts, les 6 646 candidats et les 187
liens publics restent en base à l'identique. Le mode économique n'écrit rien :
il lit moins.

### Escalade si nécessaire

`X_API_HARD_CAP_POSTS = 0` arrête toute dépense X immédiatement, sans retirer le
cron ni toucher au code. Le run écrit quand même sa ligne de log — l'arrêt est
visible, pas silencieux.

---

## 5. À vérifier avant d'appliquer (non prouvé ici)

1. **Valeur réelle de `WATCHER_MAX_HANDLES`** en production. Déduite ≥108 par
   l'observation, jamais lue directement (`vercel env ls` non rédigé est
   interdit). À lire dans la Vercel UI.
2. **État réel de `WATCHER_BRIDGE_ENABLED`.** `JobRunLog` du 2026-08-15 montre
   des runs `success` (06:45, 13:11) ET `disabled` (07:40, 12:21, 18:45) le même
   jour. Le kill switch est donc soit basculé manuellement en cours de journée,
   soit surchargé par un appel programmatique (`runBridgeJob(overrides)`).
   **Constaté, non expliqué.**
3. **Les 100 posts en dur de GordonGekko** (`route.ts:127` et `:188`) ne sont
   pilotables par aucune variable. À `WATCHER_MAX_POSTS_PER_HANDLE = 3`, ce seul
   handle pèserait 100 des 157 posts du pire cas, soit **64 % du budget réduit**.
   Le rendre pilotable par env est un correctif de code d'une ligne — hors
   périmètre de cette proposition, mais à faire avant que le mode économique ne
   devienne durable.

---

## 6. Métriques de la reprise graduelle

L'énoncé demande de remplacer « nombre de drafts » par des métriques de valeur.
Voici où chacune se lit — et ce qui manque.

| Métrique | Se lit aujourd'hui | Verdict |
|---|---|---|
| **% revus** | `KolTokenLinkStatusLog` (P0-2, table **non encore créée**). Aujourd'hui : `KolTokenLink.reviewedAt IS NOT NULL` → renseigné sur **2 liens sur 280**. | **Non calculable** avant la migration P0-2. Le journal la rend calculable dès sa création. |
| **% approuvés** | `KolTokenLinkStatusLog` où `reasonCode='approved'` / total des décisions. Proxy actuel : `CandidateStatusLog` (`approved_public` vs `rejected`) → 2 vs 1, et **uniquement pour les liens issus du bridge** (2 des 187 publics). | Calculable après P0-2 ; proxy actuel non représentatif. |
| **% réellement consommés** | **Rien.** Aucune table de télémétrie de lecture n'existe (`ReflexAnalysis` / `ReflexWatch` couvrent REFLEX, pas Explorer / cluster / watchlist). | **Manquant.** Il faut un compteur d'affichage par `linkId` sur les surfaces publiques — c'est le seul point de cette liste qui exige une nouvelle table. |
| **Diversité KOL** | `SELECT count(DISTINCT "kolHandle") FROM "KolTokenLink" WHERE visibility='public'` → **20 handles / 187 liens**. Côté drafts : **6 handles / 92 liens**, dont 88 sur deux. | **Calculable maintenant.** |
| **Impact PRE-BUY GUARD** | Deux chemins, à ne pas confondre. (a) `src/lib/prebuy/index.ts:60` lit les signaux `source === "casefileMatch"` de REFLEX, et `src/lib/reflex/casefileMatch.ts:61` requête bien `KolTokenLink` en `visibility='public'` : **un lien approuvé fait donc remonter `casefilePresent`, un lien archivé le retire** (prouvé par `__tests__/security/publication-lifecycle-cycle.test.ts`). (b) `src/lib/prebuy/casefile.ts` n'utilise **pas** `KolTokenLink` — il couvre `token_casefiles` + presets BOTIFY/VINE, en complément. | **Calculable maintenant** via le compte de liens publics portant un `caseId` et un `contractAddress`. |
| **Impact TigerScore** | Aucun chemin de `KolTokenLink` vers `src/lib/tigerscore/`. | **Effet nul**, à ne pas invoquer. |
| **Impact Explorer** | `getExplorerStats().linkedLaunches` et `getLeaderboardStats().totalLinkedTokens`, tous deux filtrés `visibility='public'` (corrigé en P0-2). | **Calculable maintenant.** |

### Ce qui manque, par ordre de coût

1. **Le journal de publication** (`KolTokenLinkStatusLog`) — migration P0-2 déjà
   écrite, non appliquée. Débloque « % revus » et « % approuvés ».
2. **Un compteur de consommation par lien** — nouvelle table, aucune existante ne
   convient. C'est le seul vrai trou.
3. **Rien d'autre.** Diversité et impact Explorer se lisent déjà.

### Seuils de reprise proposés

Ne rouvrir la collecte à pleine capacité qu'une fois **les trois** vérifiés :

- **% revus ≥ 80 %** du stock de 92 drafts (soit ≥ 74 décisions consignées) ;
- **diversité ≥ 10 handles distincts** parmi les liens approuvés (contre 6 dans
  le stock actuel, dont 2 pèsent 96 %) ;
- **délai médian de revue ≤ 7 jours** entre `createdAt` du lien et sa décision
  au journal.

Tant que ces trois-là ne tiennent pas, augmenter la collecte revient à
augmenter le stock non revu — c'est-à-dire la situation exacte que ce chantier
corrige.
