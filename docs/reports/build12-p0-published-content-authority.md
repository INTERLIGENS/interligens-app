# P0 PRODUCT INTEGRITY / PUBLISHED CONTENT AUTHORITY
## UNGOVERNED NOMINATIVE OR PROTECTED CONTENT — INVENTAIRE DE DÉCOUVERTE

**Lot de découverte. Aucun code, aucun fix, aucune remédiation.**
Portée : RC BLOCKER. **Trois** surfaces d'émission : Watchlist, Explorer, et —
par ruling GPT — la commande Telegram `/kol`. Les deux surfaces web ont une
exposition anonyme mesurée **ZÉRO** (§1.3). Le canal Telegram, lui, **n'oppose
aucune restriction de destinataire dans le code** et il est **actif en
production** (`configured:true`, §1.4) : son exposition n'est pas nulle, elle
est **non mesurable depuis le dépôt** — ce qui n'est pas la même chose, et la
ligne précédente de ce rapport disait « ZÉRO » sans cette distinction.

---

## 1. LE COMMIT DE MESURE, ET LES EMPREINTES

### 1.1 Commit

| | |
|---|---|
| Worktree | `/Users/dood/dev/interligens-t2` (T2) |
| Branche | `feat/cc-offline-174-build12-s0-s1` |
| HEAD | `b05ac816dd904c1fc14e0514036e7e1edc111507` |
| Arbre | propre (`git status --porcelain` vide) |
| Base prod interrogée | `ep-square-band` via `DATABASE_URL` (lecture seule, aucun DDL, aucune écriture) |
| Déploiement servi sondé | `dpl_EhukLiaHrrarbUL19rnBQ896QTPw` (app.interligens.com) |

### 1.2 Empreintes des blobs dont dépendent les lignes

Les lignes sont ancrées sur l'**empreinte du blob**, pas sur le chemin. Chaque
empreinte est comparée à `origin/main` : les **treize** fichiers portants sont
**byte-identiques à main**, donc la mesure vaut pour la version servie.

| fichier | blob HEAD | = origin/main |
|---|---|---|
| `src/app/en/watchlist/page.tsx` | `5ee1e5046a562e61c85ee3bc553984e44358c1f3` | OUI |
| `src/app/fr/watchlist/page.tsx` | `5073283718f7…` | OUI |
| `src/app/api/watchlist/route.ts` | `0b94ccd9c262a901729a3dff84809358f052f31b` | OUI |
| `src/app/en/explorer/page.tsx` | `2aab53cfec9015da3984ac63c9c46c9e2d6d9d97` | OUI |
| `src/app/fr/explorer/page.tsx` | `8425dea0020e…` | OUI |
| `src/app/en/explorer/[caseId]/page.tsx` | `6cf43ff0e40c06be4a43291bd5549f11824a296f` | OUI |
| `src/app/api/explorer/route.ts` | `758b66f710631c12fb577d5da179311045958139` | OUI |
| `src/lib/explorer/explorerItems.ts` | `a6819352ca58631a93a13b6b4cc60eb0b21998f2` | OUI |
| `src/lib/watcher/handles.ts` | `a7d345820ef19f910f9b8bbc4c20c194ff27c04a` | OUI |
| `src/proxy.ts` | `123ef439ba85a158a2ca0b6191fdd8d3c604ec9b` | OUI |
| `src/lib/security/nominativeApiGate.ts` | `a29fb492567b…` | OUI |
| `src/lib/telegram/bot.ts` | `4b55698f207a449bf131377658c50de28757e644` | OUI |
| `src/app/api/telegram/webhook/route.ts` | `f528d7ef30df89ed79c09c363097b61306ab530c` | OUI |

Les deux dernières lignes étaient en annexe au tirage précédent. Le ruling GPT
les fait passer **portantes** : elles portent maintenant huit lignes du tableau
principal (§4.C).

Fichiers secondaires cités (non portants pour le décompte, portants pour la
frontière) :

| fichier | blob |
|---|---|
| `src/components/case/CaseSnapshot.tsx` | `a3504b9a14856a1579afb065de0ab1d1ebd932fa` |
| `src/lib/case/snapshotSelectors.ts` | `0e5502e60b92835301d18ae9a6a03a0786da2b0f` |
| `src/components/explorer/IntelligenceOverview.tsx` | `92c147ad29881250f1142357f3716897b6a0df6b` |
| `src/lib/kol/canonical.ts` | `94e24c6f1a1f74aec7d29c6288c336a3c247ae1b` |
| `src/app/api/kol/[handle]/wallet-history/route.ts` | `ce27c600cd8a32729a64d5620aae0fef5a106fe1` |
| `src/app/api/pdf/kol/route.ts` | `e71debb2375240bb8413d235791cbc1b7417f827` |
| `src/lib/governance/audienceProjection.ts` | `2ef92d113c82fd0815ec25a072c8372c872c2c70` |
| `src/lib/prisma.ts` | `1bee0b98d231fb221b5b84ecb263c089b70c5ef6` (7 lignes, ni `$extends` ni `$use`) |
| `src/lib/ops/alerting.ts` | `c77944a2683b1c88318ee827fb84774228d6dbac` — cité §7 pour **contraste**, non instruit |

**Fenêtre T1 — non touchée.** `pdf/casefile`, `casefile/generate`, `report/v2`,
`pdfGenerator.ts` : zéro lecture, zéro mesure, zéro ligne qui en dépend.
`src/app/api/pdf/kol/route.ts` est un fichier distinct, hors fenêtre T1, lu en
seule lecture pour la section frontière ; il est ancré par son blob.

**Chemins gelés : aucun fichier touché.** Ce lot n'écrit qu'un fichier,
`docs/reports/build12-p0-published-content-authority.md`, hors des motifs
`^prisma/ ^src/app/api/ ^src/components/ ^vercel\.json ^.github/ ^src/lib/kol/
^src/lib/security/ ^migrations/ ^\.gitignore`.

### 1.3 La version SERVIE, et ce que l'exposition zéro veut dire

Sonde `curl` anonyme : **inutilisable**. `https://app.interligens.com/api/watchlist`
rend 401 et `/en/watchlist` rend 403, mais les deux corps sont une page
Cloudflare « Attention Required! ». Un refus d'un intermédiaire n'est pas une
mesure de l'autorisation applicative : **un refus n'est pas une garde**.

Sonde re-jouée depuis un navigateur réel (même origine, `credentials:'omit'`) :

| chemin | statut | corps |
|---|---|---|
| `/api/watchlist` | 401 | `{"error":"unauthorized","code":"NOMINATIVE_ACCESS_REQUIRED",…}` (209 o) |
| `/api/explorer` | 401 | idem |
| `/api/explorer?kind=launch` | 401 | idem |
| `/en/watchlist` | 200, 13 830 o | la page `/access` (redirection suivie par `fetch`) |
| `/en/explorer` | 200, 13 830 o | la page `/access`, **longueur identique** |

Donc, en production :

- **Anonyme : émission nulle.** `src/proxy.ts` (blob `123ef439ba85`) gate les
  pages par `isBetaExempt` → redirection `/access`, et gate `/api/watchlist` et
  `/api/explorer` par `isNominativeApiPath` → `resolveNominativeCaller`
  (session investigateur validée en base, révocable).
- **L'audience réelle n'est pas « le public »** : c'est le porteur d'un
  `investigator_session` valide, plus admin / `x-partner-key` /
  `x-mobile-api-token`. Toutes les lignes ci-dessous portent cette audience.
- **Aucune unité de contenu des surfaces WEB n'est peinte pour un anonyme.** Le
  P0 est bien un RC BLOCKER : le contenu est non gouverné, une garde de ROUTE
  grossière empêche aujourd'hui son émission. La garde est au niveau du chemin,
  pas de l'unité — c'est exactement l'objet de ce lot.

Cette conclusion **ne s'étend pas au canal Telegram**, et la phrase qui la
portait au tirage précédent la sur-généralisait. §1.4 la corrige.

### 1.4 Le canal Telegram, sondé — et ce que la sonde établit

`GET https://app.interligens.com/api/telegram/webhook`, anonyme, sans cookie :

| | |
|---|---|
| statut | **200** |
| `content-type` | `application/json` |
| taille | **58 octets** |
| corps, verbatim | `{"ok":true,"service":"telegram-webhook","configured":true}` |

Cette sonde-là est utilisable, contrairement à celles de §1.3, et pour une
raison qu'il faut dire : le corps est une réponse **applicative** — celle de
`route.ts:70-78` — pas une page Cloudflare. C'est exactement le test qui
manquait à mon erreur n°1 (§12.1). `configured:true` n'est vrai que si
`TELEGRAM_BOT_TOKEN` **et** `TELEGRAM_WEBHOOK_SECRET` sont tous deux posés en
production (l. 74-76). **Le canal est armé.**

Ce que la sonde **n'établit pas**, et que je ne comblerai pas : je n'ai envoyé
aucun message au bot. Je n'ai ni son `@nom`, ni le `TELEGRAM_WEBHOOK_SECRET`, et
je n'ai demandé ni l'un ni l'autre. Le chemin P-T (§3) est établi par **lecture
de code ancrée sur deux blobs**, pas par un aller-retour réel.

Trois faits de code, mesurés, sur l'admission de ce canal :

| fait | mesure |
|---|---|
| `src/proxy.ts` gate-t-il ce chemin ? | **non.** `isBetaExempt` rend `true` pour tout `/api/` (l. 53) |
| `isNominativeApiPath("/api/telegram/webhook")` ? | **false.** Ni dans `NOMINATIVE_EXACT`, ni sous un préfixe, ni sous un motif |
| que vérifie `verifySecret` ? | **Telegram**, pas l'abonné. Un secret partagé entre l'application et le serveur de Telegram |

Et le troisième est la raison pour laquelle N sous-comptait une **classe**, pas
une unité : `nominativeApiGate.ts` définit « nominatif » comme « **la réponse**
porte un handle, un displayName, un tier, un rôle » (l. 55-59). La réponse HTTP
de ce chemin vaut `{"ok":true}`. **La définition du gate exclut ce canal par
construction**, quelle que soit la charge réellement émise — parce que l'émission
n'est pas dans la réponse, elle est dans un appel **sortant**.

---

## 2. CE QUE COMPTENT LES LIGNES

L'unité est la plus petite unité sémantique capable de porter seule une
assertion gouvernée. Sur la Watchlist, elle se répète à l'identique sur 107
lignes de personne : reporter 107 fois la même ligne serait du bruit. Le tableau
donne donc **une ligne par TYPE d'unité**, avec son **compte d'instances
mesuré** et sa **répartition fondée / non fondée** dans la colonne « governed
foundation ». **46 types** au total (20 Watchlist + 18 Explorer + 8 Telegram),
aucun échantillon.

**Sur un canal, l'unité inclut le SILENCE.** Une page qui n'affiche pas un champ
ne dit rien ; un bot qui ne répond pas a répondu. Le refus est donc compté comme
une unité de contenu à part entière (T7), avec sa propre assertion et sa propre
fondation. C'est la seule adaptation de la règle de comptage, et elle vient du
canal, pas d'un choix.

**« Governed foundation » = il existe une décision de publication enregistrée
dans un magasin gouverné qui autorise CETTE assertion.** Les cinq seules
décisions de ce type dans le dépôt :
`KolProfile.publishStatus='published'` (ou `publishable && draft`),
`KolTokenLink.visibility='public'`, `EvidenceSnapshot.isPublic && reviewStatus='approved'`,
`PlatformCaseFile.publishStatus='published'`, `KolProfile.proceedsPublication='published'`.

**Aucune blacklist de noms de champ n'a été construite.** Le critère est
(assertion sémantique × provenance causale mesurée), jamais le nom JSON.

---

## 3. LES TROIS CHEMINS D'ÉMISSION MESURÉS

### P-W — WATCHLIST

```
src/lib/watcher/handles.ts : handlesV2  (TS statique, 108 entrées, 107 après dédup)
Postgres : KolProfile, KolTokenLink, KolPromotionMention,
           KolTokenInvolvement, SocialPostCandidate, Influencer
   ↓
src/app/api/watchlist/route.ts : GET            [0b94ccd9c262]
   • buildKolCanonicalSnapshotBatch({handle:{in,mode:'insensitive'}})
     → AUCUN filtre de publication sur le profil
   • redaction ligne 228 : 7 champs annulés si !isPublished
   ↓
src/proxy.ts : isNominativeApiPath → resolveNominativeCaller  [123ef439ba85]
   ↓  (401 identique si non admis)
JSON { entries[107], stats }
   ↓
src/app/en/watchlist/page.tsx : fetch l.112     [5ee1e5046a56]
src/app/fr/watchlist/page.tsx                   [5073283718f7]
   ↓
React render → nœud texte du DOM
```

Ce chemin a **deux sorties distinctes** et il faut les compter séparément :
**(a) le DOM peint**, **(b) les octets JSON sur le fil**. Six champs de la
réponse ne sont jamais peints (`notes`, `source`, `category`,
`completenessLevel`, `proceedsCoverage`, `lastUpdated`) et sont pourtant émis.
`displayName` est émis intégralement et n'est peint que par sa première lettre
(`initial`, l. 246) — et il sert le filtre de recherche client (l. 125), donc il
est bien dans le bundle reçu.

### P-E — EXPLORER

```
Postgres : KolCase, KolTokenLink, KolProfile, PlatformCaseFile, EvidenceSnapshot
   ↓
src/lib/explorer/explorerItems.ts                [a6819352ca58]
   • getCaseDossiers      : summary = KolCase.evidence.slice(0,2).join(' | ')
   • getLaunchDossiers    : summary = KolTokenLink.note.slice(0,2).join(' | ')
   • getPlatformCaseDossiers : summary = PlatformCaseFile.summary ?? title
   ↓
src/app/api/explorer/route.ts : GET              [758b66f71063]
   ↓
src/proxy.ts (même garde nominative)
   ↓
src/app/{en,fr}/explorer/page.tsx  : {d.summary} l. 215-219 / 206-208
src/app/{en,fr}/explorer/[caseId]/page.tsx : {dossier.summary} l. 105
   ↓
nœud texte du DOM
```

**`note` n'est sélectionné qu'à un seul endroit du dépôt.** Vérifié par
`rg "note: true" src/` → une occurrence unique, `explorerItems.ts:150`. Le
contenu C1/C2/C3 n'a donc **pas** d'autre chemin d'émission que l'Explorer.
C'est un résultat positif, et il est déclaré comme tel.

### P-T — CANAL TELEGRAM `/kol`

```
un abonné Telegram — chat_id ENTRANT, jamais émis ni validé par l'application
   ↓  (serveurs Telegram)
POST /api/telegram/webhook                       [f528d7ef30df]
   • proxy.ts : isBetaExempt("/api/…") = true    → aucune garde de page
   • isNominativeApiPath(…)        = false       → aucune garde nominative
   • verifySecret()  : authentifie TELEGRAM, pas l'abonné
   ↓
route()  l. 263-267  → handleKolCommand(arg)     [4b55698f207a, l. 194-233]
   • arg.replace(/^@/,"").toLowerCase().trim()   ← la casse est écrasée ICI
   • new PrismaClient()  l. 203-204              ← client LOCAL, pas src/lib/prisma.ts
   • kolProfile.findUnique({ where:{ handle } }) ← AUCUN filtre de publication
   • select: handle, displayName, rugCount, tier, riskFlag
   ↓
gabarit Markdown l. 216-223 — les cinq champs cessent d'être des champs
   et deviennent une CHAÎNE. Rien en aval ne peut plus les relire.
   ↓
sendReply()  l. 281-317  → POST api.telegram.org/bot<TOKEN>/sendMessage
   ↓
message dans le chat — archivé chez le destinataire, irrévocable
   ↓
et pendant ce temps, la réponse HTTP de la route vaut {"ok":true}   [l. 66]
```

**Ce chemin a une sortie, et ce n'est pas la réponse.** C'est la différence de
nature avec P-W et P-E, et c'est toute la question du §9.

Deux propriétés mesurées du gabarit, qui décident du tableau :

- `findUnique` est **sensible à la casse** ; l'argument est mis en minuscules
  l. 195. Une ligne dont le `handle` porte une majuscule est donc **inatteignable**,
  et la requête est en revanche **déterministe** — l'indécidable I2 (§8.1), qui
  naît de `mode:'insensitive'` sur P-W, **ne s'étend pas à P-T**.
- `msg.from` (l. 29) et `msg.chat.type` (l. 27) sont **déclarés et jamais lus**.
  Aucune liste d'admission, aucun contrôle de type de chat, aucune limite de
  débit applicative (`rg "rateLimit" src/app/api/telegram/ src/lib/telegram/` →
  zéro occurrence). Le destinataire peut être un **groupe de N membres**, N
  inconnu et non borné.

---

## 4. LE TABLEAU

Colonnes : **unité · sujet · provenance · état actuel · assertion publiée ·
prohibition/exigence · fondation gouvernée · audience · frontière la plus
étroite · nature · chemin d'émission**.

Audience, **en 4.A et 4.B** : **BETA** = porteur d'un `investigator_session`
valide (+ admin / partenaire / mobile). Chemin d'émission : **P-W** ou **P-E**.

**En 4.C l'audience est dé-factorisée et porte sa propre colonne**, parce qu'elle
n'est pas la même et qu'elle n'a pas de nom ratifié. Elle vaut partout
**ABONNÉ ‡** — voir §9.1 pour ce que je mesure de cette audience et pourquoi je
refuse de la ranger dans l'axe 1. **‡ = nature d'audience non ratifiée.**

### 4.A — WATCHLIST (`/en/watchlist`, `/fr/watchlist`) — 20 types

| # | unité de contenu | sujet | provenance (mesurée) | état actuel | assertion publiée | prohibition / exigence | fondation gouvernée | frontière la plus étroite | nature |
|---|---|---|---|---|---|---|---|---|---|
| W1 | `whyLine(e)` — la phrase-motif | **nominatif direct** ×107 | `handles.ts:category` (TS écrit à la main) → `WHY_LINE[]` côté client | servi, non gouverné | « Pushes tokens, sells before the crash. » et 15 variantes | assertion nominative sans autorité de publication | **0 / 107.** 54 ont un motif par catégorie, **53 tombent sur `DEFAULT_WHY`** dont `organic_mention` ×12 — une mention *organique* reçoit « vend avant la chute ». Seuls **11** des 107 ont un dossier publié | l'unité `whyLine`, mais voir §6 : non contenable seule | **ASSERTION** |
| W2 | bandeau « UNDER ACTIVE SURVEILLANCE » | les 107 | appartenance à `handlesV2` | servi | INTERLIGENS surveille activement ces 107 | état de workflow publié comme fait | **0 / 1.** 63 des 107 seulement ont ≥1 signal en 30 j ; le cron scanne `handlesV2.slice(0, WATCHER_MAX_HANDLES)`, défaut **50** sur 108 | bandeau de page | **STATE** |
| W3 | « · INTERLIGENS is watching » par ligne | **nominatif** ×107 | idem W2 | servi | idem, par personne | idem | **0 / 107** | ligne | **STATE** |
| W4 | « They're selling. You're buying. » | les 107 | littéral de page | servi | conseil implicite au lecteur | projection produit sans règle propre | **0 / 1** | bandeau | **VERDICT/ADVICE** |
| W5 | `@handle` | **coordonnée → personne** ×107 | `handles.ts` | servi | « cette personne est sur la liste » | l'appartenance est elle-même une assertion | **11 fondés / 96 non fondés** | la LISTE (§6) | ASSERTION |
| W6 | `displayName` (JSON entier, initiale peinte, filtre de recherche) | **nominatif direct** | `KolProfile.displayName` via `buildKolCanonicalSnapshotBatch` — **aucun filtre de publication** | servi | nom civil rattaché au handle | nominatif non publié | **11 fondés / 53 non fondés** (64 lignes ont un profil). 2 divergents publiés (`bkokoski → « Brandon Kokoski »`, état civil) ; **7 divergents non publiés** (`solana_daily→Solana Daily`, `0xSweep→SWEEP`, `CrashiusClay69→Crash`, `captain_meme1→CAPTAIN`, `Empire_sol1→Empire`, `moonbag→ray`, `UniswapVillain→👀`) | le champ, à la projection | ASSERTION |
| W7 | `followerCount` | nominatif | `KolProfile.followerCount` sinon `handles.ts` (nombres ronds saisis à la main) | servi | audience de la personne | observation sans provenance | **0 / 107** | champ | OBSERVATION |
| W8 | « At least $X taken » | nominatif | `KolProfile.totalDocumented` derrière `isProceedsPublished` | **gouverné** | montant encaissé | — | **fondé** (`proceedsPublication`) | déjà posée (`proceedsGate`) | OBSERVATION |
| W9 | grille cash-out d1/d7/d30/ytd/total | nominatif | `KolTokenInvolvement.proceedsUsd`, filtré par `withdrawnHandles` (route l. 99) | **gouverné** | montants par fenêtre | — | **fondé** | déjà posée | OBSERVATION |
| W10 | prose `FLAG_LINE` (« Hides the money trail… ») | nominatif | `KolProfile.behaviorFlags`, annulé si non publié (l. 234) | **gouverné** | comportement de blanchiment | — | **fondé** | déjà posée | ASSERTION |
| W11 | pastilles « Tickers pushed · $SYM » | nominatif | `KolTokenLink` (`visibility='public'`) puis repli `KolPromotionMention` (**sans aucun filtre de visibilité**) | servi | « cette personne a poussé ce token » | assertion de promotion sur personne non publiée | **6 fondés / 9 non fondés** sur 15 porteurs. Les 9 : `empire_sol1, solana_daily, cookerflips, moonbag, 0xsweep, fuelkek, solana___trader, captain_meme1, crashiusclay69`. Le repli `KolPromotionMention` contribue **0 aujourd'hui** (latence, pas fuite active) | le champ + fermer le repli non gaté | ASSERTION |
| W12 | « Open case file → » vs « Case file under review » | nominatif ×107 | `isPublished` (route l. 190) | servi | existence/absence d'un dossier | **publication d'un état interne — et ORACLE** | **0 / 107.** Partition **11 / 96** peinte telle quelle | voir §6 | **STATE** |
| W13 | « All tokens touched » (pastilles wallet-history) | nominatif | `/api/kol/[handle]/wallet-history` → `PUBLIC_KOL_FILTER` (l. 146) | **gouverné** | tokens touchés on-chain | — | **fondé** | déjà posée | OBSERVATION |
| W14 | badge « Data may be outdated » / « Last updated Nd ago » | nominatif | `KolProfile.proceedsComputedAt` | servi | fraîcheur de notre mesure | état interne publié | **0** | champ | **STATE** |
| W15 | `priority` high/medium/low (bordure + compteurs de filtre) | nominatif ×107 | `handles.ts:priority` | servi | classement de risque | hiérarchisation nominative sans autorité | **0 / 107** | champ | ASSERTION |
| W16 | `category` (JSON, jamais peint) | nominatif ×107 | `handles.ts` | **émis sur le fil** | classification brute (`paid_undisclosed`, `pump_fun_cofounder`…) | contenu interne dans un objet par ailleurs admissible — **INVARIANT 2** | **0 / 107** | le champ, à la projection JSON | **STATE** |
| W17 | `source` (JSON, jamais peint) | nominatif ×107 | `handles.ts` | **émis sur le fil** | attribution à un tiers nommé (`zachxbt_leak` ×7, `zachxbt_context`) | attribution d'assertion à un tiers nommé | **0 / 107** | le champ | **STATE** |
| W18 | `notes` (JSON, jamais peint) | nominatif ×3 | `handles.ts:notes` | **émis sur le fil** | 3 notes internes verbatim : `« Wallet 8deJ9xe…XhU6 reported via public Solscan label »` (CookerFlips), `« alias of lynk0x »` (Regrets10x), `« TOES campaign — draft KolProfile, 7 OSINT captures 2026-06-20; low until reviewed »` (moonbag) | **note d'ingénierie/OSINT servie** — même classe que C1 | **0 / 3** | le champ | **STATE** |
| W19 | « N linked wallet(s) » / « N linked case(s) » (peints, l. 448-457) | nominatif | `KolProfile._count` — **absents de la liste de rédaction l. 231-243** | servi | « nous documentons N wallets de cette personne » | observation d'enquête sur personne non publiée | **non fondé pour 15 non publiés** (`blknoiz06` 5, `eddyxbt` 6, `shmoonft` 4, `Cheatcoiner` 3, `orangie` 2, `herrocrypto` 2, `0xsweep` 2, `CookerFlips` 2, +7 à 1) | le champ | OBSERVATION |
| W20 | `tier` / `evidenceDepth` / `completenessLevel` / `proceedsCoverage` / `verified` / `evidenceCount` / `linkedTokensCount` (JSON) | nominatif | `KolProfile`, **non rédigés** (l. 231-243 n'en couvre aucun) | **émis sur le fil** | notation interne — `tier` prend `CRITICAL`, `T1`, `T2`, `T3`, `1` | notation nominative non publiée, **INVARIANT 2** | **11 fondés / 53 non fondés.** 36 des 53 non publiés portent un `tier` non nul | la projection JSON | ASSERTION |

### 4.B — EXPLORER (`/en/explorer`, `/fr/explorer`, `…/explorer/[caseId]`) — 18 types

Surface servie : **14 dossiers** — 9 « launch », 4 « case », 1 « platform ».
Sur 114 groupes de tokens, 105 ne sont pas servis (0 acteur publié) : le
critère « servi » **mord**.

| # | unité de contenu | sujet | provenance (mesurée) | état actuel | assertion publiée (verbatim) | prohibition / exigence | fondation gouvernée | frontière la plus étroite | nature |
|---|---|---|---|---|---|---|---|---|---|
| E1 | `summary` d'un dossier « launch » = `KolTokenLink.note` ×2 joints | voir détail | `KolTokenLink.note` (`visibility='public'`), **unique lecteur du dépôt** | servi | **9 sur 9 portent du contenu interne — zéro propre.** Détail §5 | contenu interne, note d'ingénierie, instruction au développeur, identification relationnelle, personne nommée non gouvernée | **0 / 9** | le champ `note`, à la projection | mélange STATE + ASSERTION + OBSERVATION — §5 |
| E2 | `summary` d'un dossier « case » = `KolCase.evidence` ×2 joints | **nominatif + relationnel** | `KolCase.evidence`, aucun filtre de publication sur la ligne | servi | 4 sur 4. `GHOST` : « GHOST overlap with BK/SAM cluster. **Under investigation.** \| GHOST overlap — cross-ref **@lynk0x** ongoing. » ; `BOTIFY` : « Promotion alongside **@bkokoski** during BOTIFY active period. \| Co-promotion BOTIFY. Network overlap BK cluster. » ; `SERIAL-12RUGS` : « … Source: **mariaqueennft** Feb 2026. » ; `RAVE-DUMP-APR2026` : « … Master controller **qiwu.eth** … ZachXBT investigation APR 18 2026. » | état d'enquête publié (« Under investigation », « ongoing ») ; renvoi nominatif croisé ; attribution à un tiers nommé | **0 / 4** | le champ `evidence` | STATE + ASSERTION mêlés |
| E3 | `summary` d'un dossier « platform » | entité morale | `PlatformCaseFile.summary ?? title`, `publishStatus='published'` | **gouverné** | CBEX : « The $12M Ponzi That Never Stopped » | — | **fondé** ×1 | déjà posée | ASSERTION |
| E4 | « N linked actors documented » | dossier | `actors.length` **après** exclusion des non publiés | servi | un compte | **le compte est faux** : BULLISH affiche 2 pour 5 liens, SWIF 2 pour 6, TOES 2 pour 4 | **0 / 9** (3 comptes faux) | le compte | OBSERVATION |
| E5 | pastilles d'acteurs `@handle` | nominatif | `getPublishedHandles()` → `PUBLIC_KOL_FILTER` | **gouverné** | acteur lié | — | **fondé** | déjà posée | ASSERTION |
| E6 | badges `DOCUMENTED`/`PARTIAL` + `… EVIDENCE` | dossier | `strongestDepth(profils publiés)` puis `depth>=3 ? documented : partial` | servi | niveau de preuve | état interne publié, **dérivation tautologique** (cf. E15) | **0 / 14** | le badge | **STATE** |
| E7 | « N evidence on file » | dossier | `EvidenceSnapshot` `isPublic && reviewStatus='approved'` | **gouverné** | — | — | **fondé** | déjà posée | OBSERVATION |
| E8 | `strongestFlags` (« Repeated cashout », « Complex fund movement ») | **dossier**, hérité de **personnes** | `KolProfile.behaviorFlags` des acteurs publiés, agrégés en `Set` au niveau DOSSIER | servi | le dossier porte ce comportement | **propagation** : un drapeau décidé sur une personne devient une propriété du dossier — INVARIANT 2 exactement | **0 / 14** au niveau dossier (fondé au niveau personne) | l'agrégation | ASSERTION |
| E9 | `topCoordinationSignal` (« Coordinated promotion » / « Shared actor group ») | dossier | dérivé de E8 + `linkedActorsCount` | servi | coordination établie | interprétation gouvernée sans décision | **0 / 14** | la dérivation | ASSERTION |
| E10 | « Same actor group across N dossiers » | dossier | recouvrement ≥2 acteurs entre dossiers | servi | récurrence inter-dossiers | idem | **0** | la dérivation | ASSERTION |
| E11 | `proceedsText` (« Min. $X observed — partial coverage ») | dossier/nominatif | `redactProceeds` + `PUBLISHED_PROCEEDS_FILTER` | **gouverné** | — | — | **fondé** | déjà posée | OBSERVATION |
| E12 | bandeau de stats (5 compteurs) | agrégat | `getExplorerStats()` — filtres publiés partout | **gouverné** | — | — | **fondé** | déjà posée | OBSERVATION |
| E13 | « SCAM INTELLIGENCE EXPLORER » + « Documented scam cases, token launches, and connected patterns » | les 14 | littéral de page | servi | qualifie les 14 dossiers de « scam cases documentés » | qualification produit englobante sans adjudication par dossier | **0 / 1** (9 des 14 sont des lancements de token, sans adjudication) | bandeau | **VERDICT** |
| E14 | `KIND_BADGE` (`PLATFORM FRAUD` / `CASE CLUSTER` / `TOKEN LAUNCH`) | dossier | `d.kind` | servi | « fraude », « cluster » | qualification sans décision | **0 / 14** | le badge | ASSERTION |
| E15 | `CaseSnapshot` : verdict `CONFIRMED` + « Confirmed case — multi-source evidence » | dossier | `deriveSolidity()` : `documented && depth>=3` — or `documented` **est** `depth>=3` ⇒ **la condition est la même, deux fois** ; « multi-source » n'est jamais vérifié | servi (page détail) | « Affaire confirmée — preuves multi-sources » | projection produit soumise à ses propres règles ; ici règle vide | **0 / 4.** GHOST, BOTIFY, SERIAL-12RUGS = `CONFIRMED`. `RAVE-DUMP-APR2026` (ZachXBT, 17,8 M$ de pertes retail) = `SIGNAL — Early signal, partial evidence`, parce que son `evidenceDepth='deep'` est absent de `DEPTH_ORDER` et retombe à 0 | la dérivation | **VERDICT** |
| E16 | `deriveNextAction` (« OPEN FULL DOSSIER / Investigate N linked actors ») | lecteur | dérivé de E15 | servi (page détail) | conseil d'action | projection produit | **0 / 4** | la dérivation | **ADVICE** |
| E17 | snapshots de preuve : `title`, `caption`, `sourceLabel` | dossier | `isPublic && reviewStatus='approved'` | **gouverné** | — | — | **fondé** | déjà posée | OBSERVATION |
| E18 | bloc `IntelligenceOverview` (top-10 leaderboard, montant total) | nominatif | `/api/kol/leaderboard` → `PUBLIC_KOL_FILTER` | **gouverné** | — | — | **fondé** | déjà posée | OBSERVATION |

### 4.C — CANAL TELEGRAM `/kol` — 8 types

Entré au tableau principal par ruling GPT. Mêmes colonnes, **plus** la colonne
« audience », dé-factorisée parce que sa valeur n'a pas de nom ratifié.

**La population de ce canal n'est pas celle des surfaces web, et l'écart est le
résultat le plus lourd de ce lot :**

| | |
|---|---|
| lignes `KolProfile` | **412** |
| atteignables par `/kol` (`handle = lower(handle)`) | **272** |
| — dont **sans décision de publication** | **261** |
| — dont publiées | **11** |
| inatteignables (casse mixte) | **140** — dont **21 PUBLIÉES**, 119 non publiées |
| atteignables **hors Watchlist** | **248**, dont **243 non publiées** |
| recouvrement avec la Watchlist | **24** des 107 handles seulement |

**Les « 11 publiées » de ce canal ne sont PAS les « 11 publiées » de la
Watchlist.** Deux ensembles de cardinal 11, **intersection 6**. Le canal sert
`deployer_pool`, `dione-protocol`, `loud_token_victims`, `ravedao`,
`wulfcryptox` que la Watchlist ne nomme pas ; la Watchlist publie `Brommy`,
`DonWedge`, `EduRio`, `GordonGekko`, `OrbitApe` que le canal ne sait pas
atteindre. La coïncidence du compte a failli me faire écrire « les mêmes 11 ».

Le canal expose donc **2,5 fois** la population nominative de la surface phare,
et **91 %** de ce qu'il expose est invisible depuis le web. C'est en cela que
N ne sous-comptait pas d'une unité mais d'une **classe**.

**Les verbatim de la colonne « assertion publiée » sont RECONSTITUÉS** par
interpolation du gabarit `bot.ts:216-223` sur les lignes mesurées en base — ils
ne sont **pas** capturés dans un chat (§12.7).

| # | unité de contenu | sujet | provenance (mesurée) | état actuel | assertion publiée (verbatim reconstitué) | prohibition / exigence | fondation gouvernée | audience | frontière la plus étroite — **un point ou deux ?** | nature |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | en-tête `🕵️ *KOL PROFILE*` | la personne interrogée ×272 | littéral `bot.ts:218` | servi | « 🕵️ **KOL PROFILE** » — cadre la réponse en fiche d'enquête | qualification produit englobante, sans adjudication par sujet. Même classe que W2 et E13 | **0 / 272** | ABONNÉ ‡ | le gabarit entier | **VERDICT** |
| T2 | `Handle: @<handle>` | **coordonnée → personne** ×272 | `KolProfile.handle`, écho de l'entrée | servi | « Handle: `@moonbag` » | **l'appartenance au registre EST l'assertion** — exactement W5, transposé au canal. Répondre, c'est confirmer l'existence d'une ligne | **11 fondés / 261 non fondés** | ABONNÉ ‡ | la **réponse entière** (comme la LISTE en W5) — un containment intra-champ ne l'atteint pas | ASSERTION |
| T3 | `Name: <displayName ?? "—">` | **nominatif direct** | `KolProfile.displayName`, **aucun filtre de publication dans le `where`** | servi | 12 fois `« <prénom> (BOTIFY team) »` — Salman, Aun, ShahDev, Samad, Naveed, Qayoom, Dania, Moazzam, Mohamed, Atif, Paul, Armel ; `trade → « Patrick. »` ; `moonbag → « ray »` ; `jayxbt2012 → « JXBT »` ; `solaxy → « Solaxy ($SOLX) — Finixio Network »` ; `ktrades → « ktrades / NCScalls »` ; `solana_daily`, `captain_meme1` | nominatif non publié ; les 12 `(BOTIFY team)` sont un **rattachement nominatif d'une personne à une équipe** | **10 fondés / 242 non fondés** ; 20 réponses n'émettent **aucune** assertion (`—`) | ABONNÉ ‡ | le champ, à la projection | ASSERTION |
| T4 | `Tier: *<tier ?? "UNKNOWN">*` | nominatif ×272 | `KolProfile.tier` | servi | `Tier: *4*`, `Tier: *CRITICAL*`, `Tier: *T2*`, `Tier: *UNKNOWN*` | notation nominative interne non publiée — **INVARIANT 2**. Et le **vocabulaire lui-même est un oracle** (§6.3) : `1`–`5` et `T1/T2/T3` n'apparaissent jamais chez les publiés | **9 fondés / 202 non fondés** ; 61 rendent `UNKNOWN`. Non publiés : `4`×65, `3`×47, `5`×39, `2`×26, `1`×15, `CRITICAL`×3, `T1/T2/T3`×6, `HIGH`×1 | ABONNÉ ‡ | le champ, à la projection | ASSERTION |
| T5 | `Risk flag: <riskFlag>` | nominatif ×272 | `KolProfile.riskFlag` — colonne **non nullable** | servi | `Risk flag: high_risk_dev` (`trade`), `team_insider` (`jayxbt2012`), `amplifier_cluster` (`moonbag`), `official_project_account`, `high_risk`, `flagged`, `unverified` | qualification de risque nominative sans décision de publication. **Aucune ligne n'y échappe** : 272/272 en reçoivent un | **11 fondés / 261 non fondés — zéro exempt.** Non publiés : `unverified`×252, `flagged`×4, puis 5 valeurs uniques | ABONNÉ ‡ | le champ, à la projection | ASSERTION |
| T6 | ligne conditionnelle `⚠️ Rug count: *N*` | nominatif | `KolProfile.rugCount`, émise seulement si `> 0` (l. 213-215) | **gouverné** | `⚠️ Rug count: *12*` (`bkokoski`), *5* (`ghostwareos`), *2* (`planted`, `sxyz500`), *1* (`ravedao`) | — | **5 fondés / 0 non fondés.** Les 5 porteurs sont tous publiés | ABONNÉ ‡ | close **côté donnée**, ouverte **côté audience** : une décision de publication n'est pas une décision d'audience, et c'est ici que ça se voit (§6.3, sens A) | OBSERVATION |
| T7 | **le refus** — `No KOL profile found for @<handle>.` | les 140 en casse mixte + tout handle absent | `findUnique` sensible à la casse sur un argument mis en minuscules (l. 195) | servi | « No KOL profile found for `@GordonGekko`. » | **sur un canal, le refus EST une réponse** — et celle-ci est **FAUSSE pour 140 lignes existantes, dont 21 publiées**. C'est un défaut de VÉRITÉ, hors boundary (§9) | **0 / 1** | ABONNÉ ‡ | le refus lui-même — et c'est la pièce dont dépend l'uniformité (§6.3) | **STATE** |
| T8 | `/help` : « `/kol <handle>` — KOL risk profile » + l'exemple « `/kol zachxbt` » | **tiers nommé** | littéraux `HELP_TEXT` l. 51 et l. 56 | servi à **chaque `/start` et chaque `/help`** | « `/kol zachxbt` » sous le titre « KOL risk profile » | attribution : associe un tiers nommé au produit de notation. Même classe que W17. **Mesuré : aucune ligne `KolProfile` ne porte ce handle** (`LIKE '%zachxbt%'` → 0), donc l'exemple ne fuit aucun contenu de base — il **qualifie** | **0 / 1** | ABONNÉ ‡ — et c'est la **première** unité que reçoit tout nouvel abonné | le littéral | ASSERTION |

**Ce que la colonne « frontière » répond, en une phrase et pour les huit lignes :
le boundary commun peut porter la CHARGE, il ne peut pas porter l'ÉMISSION.**
Le détail mécanique est en §9.1, et c'est la réponse à « un boundary ou deux ».

---

## 5. LE DÉTAIL DES 9 `summary` DE DOSSIER « LAUNCH » (E1) — VERBATIM SERVI

Aucune troncature. C'est la totalité des 9. Le contenu est reproduit tel qu'il
part sur le fil, `notes.slice(0,2).join(' | ')`.

| dossier | acteurs servis | `summary` servi verbatim | qualification |
|---|---|---|---|
| **TOESCOIN** | GordonGekko | `Auto-draft from Watcher V2 bridge. Internal review pending — not public, not legal-reviewed.` | **C1 pur.** La ligne dit d'elle-même qu'elle n'est pas publique, et elle est publiée. `KolTokenLink.visibility='public'` sur une note écrite par `createDraftKolTokenLink.ts:36` pour des brouillons. **STATE** |
| **BOTIFY** | bkokoski, sxyz500, GordonGekko, planted, DonWedge | `Co-founder BOTIFY. Family wallets received pre-launch supply per leaked doc. \| CA résolue le 2026-06-29 depuis dossier attesté (audit), placeholder PENDING_OSINT_ du seed initial 4 avril remplacé. Evidence rattachée par codename. \| Co-developer BOTIFY. Dad wallet received full supply allocation and dumped. \| CA résolue le 2026-06-29 …` | **C2 + C1.** « Dad wallet » = **identification relationnelle** d'un parent d'une personne identifiée (`sxyz500`), avec assertion de conduite (« received full supply allocation and dumped »). Plus deux annotations d'ingénierie en français. **ASSERTION + STATE** |
| **SERIAL-12RUGS** | bkokoski | `12+ confirmed rug-linked promotions. Source: mariaqueennft Feb 2026. \| placeholder PENDING_OSINT_ → PENDING: uniformisé le 2026-06-29 ; aucune CA attestée en base, reste non résolu (ne pas deviner). Evidence rattachée par codename.` | **C1.** Contient l'**instruction au développeur** « (ne pas deviner) » et l'aveu « aucune CA attestée en base ». Plus une attribution à un tiers nommé. **STATE + ASSERTION** |
| **GHOST** | bkokoski, sxyz500, GordonGekko, planted | `Same dev cluster as BOTIFY confirmed by on-chain analysis. \| CA résolue le 2026-06-29 … \| Co-developer GHOST. Same cluster as bkokoski confirmed. \| CA résolue le 2026-06-29 …` | **C1.** Deux annotations d'ingénierie servies. **ASSERTION + STATE** |
| **OVPP** | dione-protocol ×2 | `OpenVPP on Ethereum. CEO = Parth Kapadia, concurrently Dione's Head of Energy. SPARK grant cohort recipient — conflict-of-interest flag. \| OpenVPP on Base. Same project as ETH OVPP. Frequently confused with 'Dione OVPP' promised in Q4 2024 roadmap.` | **C3.** Personne physique nommée en clair, hors registre KOL (aucun `KolProfile`), avec assertion produit (« conflict-of-interest flag »). Aucune décision de publication n'existe le concernant : `visibility='public'` porte sur le LIEN token, pas sur lui. **ASSERTION** |
| **DIONE** | dione-protocol ×2 | `DIONE V1 contract, deployed 14 Aug 2022 from 0xbb2a…7a2e. Deprecated after 30 Oct 2024 migration. \| Wrapped DIONE V2 contract. Migration vehicle — 1:1 swap, LP withdrawn from Ethereum 30 Oct 2024 11:00 UTC, re-seeded on Odyssey chain per project. Holder-visible Ethereum trading halted 30 Oct 07:00 UTC, resumed 5 Nov.` | Factuel, mais c'est une **note d'analyste**, pas un résumé rédigé pour publication. **OBSERVATION** |
| **BULLISH** | GordonGekko, DonWedge | `{"firstPromotionAt":"2026-02-11T00:00:00.000Z","lastPromotionAt":"2026-03-04T11:07:00.000Z","mentionCount":11,"seededFrom":"bullish_seed_2026-05-14"} \| {"firstPromotionAt":"2026-03-18T08:57:00.000Z",…,"seededFrom":"bullish_seed_2026-05-14"}` | **JSON de seed brut rendu comme prose de dossier**, nom de script de seed compris. **STATE** |
| **SWIF** | GordonGekko, DonWedge | `{"firstPromotionAt":"2025-08-12T00:00:00.000Z",…,"seededFrom":"swif_seed_2026-05-14"} \| {…,"seededFrom":"swif_seed_2026-05-14"}` | idem. **STATE** |
| **TOES** | GordonGekko, DonWedge | `TOES campaign — manual OSINT ingest 2026-06-26 \| TOES campaign — manual OSINT ingest 2026-06-26` | Note de workflow d'ingestion, dupliquée. **STATE** |

Contexte de population : `KolTokenLink` compte **292** lignes — 187 `public`,
104 `draft`, 1 `rejected`. **109** lignes portent un marqueur interne
(« Internal review pending », « legal-reviewed », « Dad », « deviner »), dont
**107 sont correctement retenues** par `visibility='public'` ou par l'absence
d'acteur publié. **3 seulement sont servies** (TOESCOIN, BOTIFY, SERIAL-12RUGS).
Le critère « servi » mord : il exclut 106 des 109.

Une quatrième ligne, `SOLANA___TRADER / THREE`, est `visibility='public'` avec
la même note « Internal review pending » : elle n'est pas servie **uniquement**
parce que `SOLANA___TRADER` n'a pas de profil publié. La retenue tient à un
accident de jointure, pas à une décision sur le contenu.

---

## 6. LE TEST D'ORACLE

**Question : le containment peut-il être UNIFORME sur cette surface ?**

### 6.1 Explorer — OUI

Les 14 dossiers servis portent **tous** un `summary` non nul (9 launch, 4 case,
1 platform). Remplacer les 13 `summary` non gouvernés par une chaîne identique —
comparée sur le **JSON sérialisé**, identique et non équivalente — ne crée
**aucun nouveau différentiel** : la présence de la clé, sa longueur et sa
position restent les mêmes pour les 14.

Le différentiel qui existe déjà, et que la remédiation ne crée pas :
`linkedActorsCount` **sous-compte silencieusement** (BULLISH 2/5, SWIF 2/6,
TOES 2/4). C'est une fuite dans l'autre sens — la page ment par défaut, elle ne
désigne personne. Elle reste à corriger (E4) mais elle ne bloque pas
l'uniformité.

### 6.2 Watchlist — NON

Retirer `whyLine` aux 96 non fondés et la laisser aux 11 fondés ferait de la
page un oracle. **Mais l'oracle est déjà là, et il ne vient pas de `whyLine`.**
La partition 11 / 96 est reconstructible aujourd'hui par **six** différentiels
indépendants, mesurés :

| # | différentiel | 11 publiés | 96 autres | sens |
|---|---|---|---|---|
| 1 | **W12** — le CTA | `<a href="/en/kol/<handle>">Open case file →</a>` | `<span>Case file under review</span>` | **le plus bon marché : la présence d'une balise `<a>`** |
| 2 | **W9** — bloc « Money taken » | 5 valeurs | `cashout` à zéro → `fmtUsd(0)=null` → état vide rendu | présence/absence |
| 3 | **W10** — prose des drapeaux | phrases | `behaviorFlags: []` | longueur |
| 4 | **W13** — « All tokens touched » | pastilles | « No on-chain history available » | présence |
| 5 | **W6** — `displayName` | présent (64 lignes ont un profil) | absent (43 lignes n'en ont aucun) | présence de clé |
| 6 | **W20** — `tier`, `riskFlag`, `rugCount` | non nuls | `riskFlag`/`rugCount` nullifiés | nullité |

Et dans l'autre sens — ce que la page laisse déduire par différence :
l'**appartenance à la liste est elle-même l'assertion** (W5). Aucun containment
intra-ligne ne peut la masquer.

**Conclusion : sur la Watchlist, l'unité de containment n'est pas la ligne,
c'est la LISTE.** Un containment uniforme exige que les 107 lignes soient
byte-identiques en forme, seul le `handle` variant — ce qui revient à retirer
aussi le contenu des 11 fondés de cette surface, ou à déplacer les 11 ailleurs
(leur dossier `/en/kol/<handle>` existe déjà et porte sa propre gouvernance).

Le refus identique déjà ratifié est le bon modèle : **identique, pas
équivalent**, comparé sur le JSON sérialisé.

### 6.3 Telegram `/kol` — OUI pour la charge, NON pour l'audience

Le test se dédouble ici, parce que sur un canal **le refus de répondre est une
réponse**. Je mesure les deux sens, comme sur la Watchlist.

#### Sens A — l'oracle que la remédiation CRÉERAIT

Si `/kol` répondait pour les 11 fondés et se taisait pour les 261 autres avec un
message **distinct** du « non trouvé », l'abonné apprendrait la partition exacte
en 272 requêtes.

**Mais ici, contrairement à la Watchlist, l'uniformité est atteignable.** La
raison est structurelle et elle se mesure : `/kol` est une **requête ponctuelle**.
Il n'y a pas de forme de collection à préserver — pas de 11 lignes riches contre
96 pauvres, pas de balise `<a>` présente ici et absente là. Il y a **une réponse,
une**. L'unité de containment peut donc être la réponse elle-même.

La condition est précise, et elle porte sur T7 : le refus doit être **identique**,
pas équivalent, au « non trouvé » — `No KOL profile found for @<handle>.` —
octet pour octet. L'écho du handle ne porte aucune information de retour :
c'est **l'entrée de l'abonné elle-même**. Sous cette condition, les 261 non
publiés se confondent avec les 140 inatteignables **et** avec l'ensemble non
borné des handles qui n'existent pas. Trois populations, une seule réponse.

**Ce qui reste, et que je ne comble pas :** un corps identique n'est pas une
réponse identique sur un canal où la **latence** est observable. Le chemin
« ligne trouvée puis refusée » interroge Postgres ; le chemin « handle
inexistant » aussi (`findUnique` est appelé dans les deux cas, l. 206) — donc
l'écart est petit, mais je ne l'ai pas mesuré et je ne l'affirme pas nul. C'est
une **borne déclarée**, pas un trou comblé.

**Et voici le vrai résultat du sens A, qui n'est pas un oracle :** même
parfaitement uniforme, `/kol` continue de remettre les 11 dossiers publiés à un
abonné qui **n'a franchi aucune porte**. Or ces 11 dossiers vivent sur
`/en/kol/<handle>`, que `proxy.ts` gate derrière un `investigator_session`
validé (§1.3). Le canal livre donc du gouverné à une audience que la surface web
n'admet pas. **Une décision de publication n'est pas une décision d'audience** —
et c'est exactement la troisième nature d'audience que GPT n'a pas tranchée. Le
containment de la charge ne la fait pas disparaître ; il la met à nu.

#### Sens B — l'oracle qui est DÉJÀ là, et il est presque total

La question symétrique de §6.2 : que l'abonné peut-il reconstruire de la
partition publié / non publié **avec la réponse d'aujourd'hui** ?

Sur la Watchlist, l'oracle vient de la **forme de la collection**. Ici il vient
du **vocabulaire des valeurs** — et c'est une différence décisive, parce qu'un
vocabulaire, ça se contient par unité ; une forme de collection, non.

Pouvoir discriminant de chaque champ **pris seul**, sur les 272 atteignables :

| champ observé | lignes tranchées avec certitude | mécanisme |
|---|---|---|
| `Tier:` | **203 / 272** | `1`–`5` (192) et `T1/T2/T3` (6) n'existent que chez les non publiés ; `RED`, `MEDIUM`, `ORANGE` (5) que chez les publiés |
| `Risk flag:` | **11 / 272** | `confirmed_scammer`×2, `confirmed`, `confirmed_rug`, `under_investigation`, `victim_pool`, `high` — jamais chez un non publié (7). `high_risk_dev`, `official_project_account`, `team_insider`, `amplifier_cluster` — jamais chez un publié (4) |
| ligne `⚠️ Rug count:` | **5 / 272** | présence ⇒ publié, sans exception. Absence : ambiguë |

Et la **signature jointe** `(tier, riskFlag, présence de la ligne rug)` — c'est-à-dire
exactement ce que le message rend visible :

| | |
|---|---|
| signatures distinctes | **26** |
| lignes tranchées **publié** | **10** |
| lignes tranchées **non publié** | **260** |
| lignes **ambiguës** | **2** |

**270 des 272 profils atteignables sont classés avec certitude par la réponse
actuelle.** Les 2 restants partagent la seule signature mixte du corpus —
`UNKNOWN` / `high_risk` / pas de ligne rug — portée par `deployer_pool` (publié)
et une ligne non publiée.

Donc : **l'oracle de publication existe déjà sur ce canal, à 99,3 %, sans qu'on
ait touché à quoi que ce soit.** Il n'est pas créé par la remédiation ; il est
supprimé par elle, puisque retirer les valeurs retire le vocabulaire qui le porte.

#### Sens B′ — l'oracle inversé de la casse, et il frappe du mauvais côté

L'annexe du tirage précédent appelait la sensibilité à la casse un « faux
négatif pour 140 profils ». En mesurant la **composition** de ces 140, le sens
de l'erreur n'est pas celui que j'avais écrit :

| | publiées | non publiées | total |
|---|---|---|---|
| atteignables par `/kol` | 11 | 261 | 272 |
| **inatteignables** | **21** | 119 | 140 |
| **part de la classe qui est inatteignable** | **66 %** (21/32) | **31 %** (119/380) | |

L'artefact de requête supprime **deux fois plus souvent du gouverné que du non
gouverné**. `GordonGekko`, `DonWedge`, `OrbitApe`, `HaydenDavis`, `JMilei`,
`HalieyWelch` — publiés, injoignables. `trade`, `moonbag`, `jayxbt2012`, les
douze `(BOTIFY team)` — non publiés, joignables. **Le canal tait ce qu'il a le
droit de dire et dit ce qu'il n'a pas le droit de dire.**

---

## 7. LA FRONTIÈRE QUE LA TEINTE NE TRAVERSE PAS

Sur ce lot, l'inventaire des franchissements a été **mesuré, pas supposé**.

| unité | franchissement | verdict mesuré |
|---|---|---|
| **E1** `KolTokenLink.note` | — | **Aucun.** `rg "note: true" src/` rend **une** occurrence, `explorerItems.ts:150`. La note ne quitte jamais P-E. Résultat positif déclaré. |
| **E2** `KolCase.evidence` | **MODÈLE DE LANGAGE — actif** | `buildCaseIntelligencePack.ts:314-325` sélectionne `evidence` sans filtre de publication, l. 528-530 le pose en `intelVaultRefs[].summary`, et `…/assistant/route.ts:27` injecte `JSON.stringify(pack, null, 2)` **entier** dans le system prompt. Jusqu'à 5 lignes `KolCase` par affaire. **Audience : membres du workspace investigateur + le modèle.** La preuve n'est pas de même nature : la teinte s'arrête au prompt, rien en aval n'est démontrable par liaison statique. |
| **E2** `KolCase.evidence` | **NAVIGATEUR SANS TÊTE — latent, pas actif** | `/api/pdf/kol/route.ts:27` charge `kolCases: true` (donc `evidence`) dans l'objet passé à `renderKolPdf`. Mesuré : `templateKol.ts:43` et `templateKolLegal.ts:89` lient `const cases = kol.kolCases ?? []` et **ne l'utilisent jamais ensuite** — aucune autre occurrence de `cases` dans les deux gabarits. La donnée entre dans l'objet, ne sort pas des octets. **C'est exactement la forme que l'INVARIANT 2 vise** : gouvernée à l'intérieur d'un objet par ailleurs admissible, non émise aujourd'hui par accident de gabarit. À déclarer, pas à combler. |
| **W1/W16/W17/W18** `handlesV2` | — | **Aucun.** Lecteurs mesurés : `api/watchlist/route.ts`, `api/cron/watcher-v2/route.ts`, 4 scripts CLI. Ni PDF, ni modèle. |
| **T2–T6** `KolProfile` sur P-T | **CANAL SORTANT VERS UN TIERS — actif** | La quatrième forme, et elle n'est ni le DOM, ni le JSON sur le fil, ni le prompt, ni les octets d'un PDF. `sendReply` (`bot.ts:294`) POST vers `api.telegram.org`. La donnée **quitte le périmètre** vers un service tiers qui la **remet et l'archive chez le destinataire**. Ni `RESTREINTE` ni `ATTESTEE` ne nomme la propriété qui manque ici : l'émission est **irrévocable et répliquée** — aucun type, aucune garde, aucun déploiement ne retire un message déjà remis dans un client Telegram. **Nommée, pas rangée.** |

**Trois sites d'appel `sendMessage` dans le dépôt, et la comparaison est
instructive :** `src/lib/ops/alerting.ts:19` et
`src/scripts/watchdog/watcher-health.mjs:323` visent un `chat_id` **posé en
variable d'environnement** (`TELEGRAM_OPS_CHAT_ID`) — destinataire **désigné par
l'application**, audience opérateur. `bot.ts:294` est le **seul** dont le
destinataire vient de la requête entrante. Ces deux-là ne sont ni inventoriés ni
instruits ici : ils servent de **contraste**, et le contraste est le résultat —
le dépôt sait déjà écrire un canal sortant dont le destinataire est gouverné.

Aucune unité de ce lot n'emprunte le navigateur sans tête **de façon active**.
Un boundary qui prétendrait couvrir E2 « par construction » mentirait sur le
chemin LLM : là, la garantie ne peut être que **ATTESTEE**, jamais
**RESTREINTE** — la distinction que `audienceProjection.ts` nomme déjà. Sur P-T,
la garantie est **ATTESTEE** pour la même raison (§9.1, axe 2), plus une
propriété que le module ne nomme pas encore.

---

## 8. LE COMPTE

| | types d'unité |
|---|---|
| **Total** | **46** (20 Watchlist + 18 Explorer + 8 Telegram) |
| **Fondées** (une décision de publication autorise l'assertion) | **12** — W8, W9, W10, W13, E3, E5, E7, E11, E12, E17, E18, **T6** |
| **Non fondées** | **25** — dont **T1, T7, T8** |
| **Mixtes** (fondées pour le sous-ensemble publié, non fondées pour le reste) | **9** — W5 (11/96), W6 (11/53), W11 (6/9), W19 (15 non fondés), W20 (11/53), **T2 (11/261)**, **T3 (10/242)**, **T4 (9/202)**, **T5 (11/261)** |
| **Indécidables** | **2**, inchangé (rattachés, voir §8.1) |

L'ajout du canal fait **+8 types**, et il déplace le centre de gravité : sur les
8, **une seule** est fondée (T6) et **quatre** sont mixtes avec un dénominateur
de non fondés à trois chiffres.

**N_INDECIDABLE reste à 2.** L'audience du canal n'est pas un indécidable : elle
est **mesurée et décrite** (§9.1), et c'est son **nom** qui attend un ruling.
Une valeur non ratifiée n'est pas une valeur non mesurée. Et I2 — la canonicité
de `handle` — **ne s'étend pas à P-T** : `findUnique` y est déterministe
(§3, P-T). La collision `0xsweep` / `0xSweep` existe bien (deux lignes, toutes
deux `draft`), mais sur ce canal la ligne servie est celle en minuscules, sans
ambiguïté ; la variante en casse mixte tombe dans les 140 inatteignables.

Au niveau **instance**, sur la population mesurée :

- Watchlist : **107 personnes nommées**, dont **11** avec dossier publié et
  **96 sans**. **53** des 107 reçoivent l'assertion par défaut, sans même un
  motif propre à leur catégorie.
- Explorer : **14 dossiers** servis ; **13 `summary` sur 14 non gouvernés**
  (seul le dossier « platform » l'est) ; **9 sur 9** des `summary` de type
  « launch » portent du contenu interne.
- Telegram : **272 personnes atteignables**, dont **261 sans décision de
  publication**. **272 sur 272** reçoivent une qualification de risque
  (`riskFlag` est non nullable) ; **202** des 261 non publiées reçoivent en plus
  un `tier`. **248** de ces 272 ne figurent sur **aucune** surface web de ce lot.

### 8.1 Les 2 indécidables, et ce qui manque pour trancher

| # | indécidable | rattaché à | ce qui manque |
|---|---|---|---|
| **I1** | `evidenceDepth='deep'` sur `ravedao` — valeur légitime (≈ `comprehensive`) ou saisie erronée ? La réponse change le verdict public du dossier le mieux documenté du corpus : `SIGNAL — Early signal, partial evidence` aujourd'hui, `CONFIRMED` si `deep` vaut `comprehensive`. | E6, E15 | **Une autorité pour l'énumération `evidenceDepth`.** `prisma/schema.prod.prisma:439` la déclare `String @default("none")`, sans `CHECK` ; aucune union TS n'existe dans `src/`. Distribution en base : `none` 396, `weak` 7, `strong` 4, `moderate` 3, `comprehensive` 1, **`deep` 1**. Il faut soit la contrainte, soit la fiche d'intake du dossier RAVE. |
| **I2** | Quelle ligne `KolProfile` est émise pour `0xSweep` ? Deux lignes distinctes existent (`0xsweep` et `0xSweep`) ; la requête `mode:'insensitive'` rend les deux, et `kolMap.set(kp.handle.toLowerCase(), kp)` (route l. 33) écrase — **la ligne gagnante dépend de l'ordre de retour de Postgres**, non spécifié. `displayName`, `tier`, `_count.kolWallets` (2 vs 1) diffèrent entre les deux. | W6, W19, W20 | **Une règle de canonicité sur `KolProfile.handle`** : soit un index unique insensible à la casse, soit un `orderBy` déterministe dans `buildKolCanonicalSnapshotBatch`. En l'état, la réponse servie n'est pas reproductible, donc le contenu émis pour cette personne n'est pas décidable. |

---

## 9. LE BOUNDARY COMMUN PROPOSÉ — UN SEUL, DEUX POINTS D'APPLICATION

**Avant tout : `audienceProjection.ts` n'a AUCUN appelant de production.**
Mesuré — `rg -l "audienceProjection" .` rend deux fichiers : ce rapport et
`__tests__/governance/s23-marque-portante.test.ts`. Le boundary est un
**chantier**, pas une garde en place. Discuter de sa couverture sans le dire
serait décrire une protection qui n'existe pas encore.

**Il n'en faut pas un deuxième.** `src/lib/governance/audienceProjection.ts`
(blob `2ef92d113c82`) reste le bon chantier. Il porte déjà **deux axes** :

1. `Admission<A>` — **qui** est admis, et par quelle porte.
2. `projeter()` / `Admissible<A,C>` — **ce que** cette audience reçoit, avec le
   niveau de garantie (`RESTREINTE` sur JSON, `ATTESTEE` sur octets).

La chaîne ratifiée par GPT en compte **trois** :

```
INTERNAL DATA → semantic assertion → ADMISSIBILITY DECISION
             → audience projection → emission
```

Le module couvre les maillons 4 et 5. **Le maillon manquant est le 3**, et il
est en amont de l'audience : une unité peut être inadmissible pour *toute*
audience, y compris `OPERATOR`.

### Ce que j'ajoute, et rien de plus

Un troisième axe dans le **même** module : un type-marque
`UniteGouvernee<Nature>` qu'on ne peut construire qu'en **présentant la décision
de publication** qui la fonde — sur le modèle exact du symbole unique déjà
utilisé pour `Admission`, inconstructible hors du module.

```
declare const GOUVERNEE: unique symbol

type Nature = "STATE" | "OBSERVATION" | "ASSERTION" | "VERDICT"

interface UniteGouvernee<N extends Nature, T> {
  readonly nature: N
  readonly valeur: T
  readonly fondee_par: DecisionDePublication   // jamais une valeur par défaut
  readonly [GOUVERNEE]: N
}
```

et la signature de `projeter()` resserrée pour que son `Out` ne puisse être
composé que d'`UniteGouvernee`. Une surface qui veut émettre un champ brut ne
compile plus ; elle doit soit produire la décision, soit appeler un refus.

**Trois propriétés non négociables, chacune tirée d'une mesure de ce lot :**

1. **La clé n'est pas la nature.** `UniteGouvernee` se construit à partir de
   (assertion sémantique × provenance), jamais du nom du champ. E1 le prouve :
   `note` porte tour à tour un STATE de workflow (TOESCOIN), une ASSERTION
   nominative (BOTIFY), une OBSERVATION factuelle (DIONE) et du JSON de seed
   (BULLISH). Un même nom, quatre natures.
2. **Le refus est IDENTIQUE, pas équivalent** — comparé sur le JSON sérialisé,
   comme le refus déjà ratifié. C'est ce qui rend §6.1 possible. **Sur un canal,
   la même règle se compare sur les OCTETS DU MESSAGE**, et elle y est plus
   exigeante : le refus doit être identique au « non trouvé » existant, faute de
   quoi le silence devient lui-même l'oracle (§6.3, sens A).
3. **La garantie reste déclarée et non uniforme.** Sur le chemin LLM de E2
   (§7), la garantie ne peut être qu'`ATTESTEE`. Le module nomme déjà cette
   distinction ; l'axe 3 ne doit pas la gommer.

### 9.1 UN BOUNDARY OU DEUX ? — la mesure, axe par axe

C'est la question que le ruling pose, et elle se tranche sur trois mesures
distinctes, pas sur une appréciation. **Réponse : UN boundary, DEUX points
d'application, et UNE valeur d'audience que je ne crée pas.**

#### Axe 1 — il ne couvre PAS l'abonné, et le forcer serait pire que l'omettre

`Audience = "ANONYMOUS" | "PARTNER" | "OPERATOR"` (l. 77). L'abonné Telegram
n'est aucun des trois : pas de clé partenaire, pas de porte opérateur.

Le ranger en `ANONYMOUS` serait **faux et dangereux**, et c'est le module
lui-même qui le dit, l. 180-190 : `admettreAnonyme(motif)` exige un motif écrit
*précisément* pour que « l'absence de porte ne prouve jamais une publication
intentionnelle ». Y ranger `/kol` convertirait une **garde absente** en
**publication déclarée** — l'exacte impossibilité que ce module existe pour
fermer. **Je décris, je ne range pas. ‡ non ratifié.**

Ce que je mesure de cette audience, sans la nommer :

| propriété | mesure |
|---|---|
| le destinataire | un `chat_id` entier **venu de la requête entrante**, jamais émis ni validé par l'application |
| le secret vérifié | `TELEGRAM_WEBHOOK_SECRET` authentifie **Telegram**, pas l'abonné |
| `msg.from` | **déclaré** l. 29, **jamais lu** — aucune liste d'admission |
| `msg.chat.type` | **déclaré** l. 27, **jamais lu** — le destinataire peut être un **groupe de N membres**, N inconnu et non borné |
| limite de débit applicative | **aucune** (`rg "rateLimit"` sur les deux chemins → 0) |

L'audience est **auto-désignée** : quiconque parle au bot se désigne lui-même, et
la réponse part vers un chat que l'application n'a jamais autorisé. C'est la
première des trois natures que GPT a laissées ouvertes (abonnement · URL choisie
par l'abonné · remise au sujet lui-même). **Elle est mesurée ici ; elle n'est pas
tranchée ici.**

#### Axe 2 — il couvre DÉJÀ la charge, sans rien ajouter

`Charge` porte une forme `texte` (l. 115). Le message Markdown y entre tel quel.
**Aucun axe nouveau n'est requis pour la charge d'un canal.**

Mais `GarantieDe<{forme:"texte"}>` vaut **`ATTESTEE`** (l. 152), et c'est
structurel, pas contingent : les cinq champs sont **interpolés dans une chaîne**
au gabarit l. 216-223. Après cette ligne, ce ne sont plus des champs. La
projection ne peut plus démontrer ce qu'elle a retenu — elle ne peut qu'attester
que le message a été **produit** sous une décision. Même faiblesse que le PDF,
même faiblesse que le prompt LLM, et pour la même raison.

#### Axe 3 — le maillon manquant est le même, et il est channel-agnostique

`UniteGouvernee<Nature>` (ci-dessus) se construit sur (assertion sémantique ×
provenance). Rien dans cette construction ne dépend du canal. T3, T4 et T5 sont
littéralement les mêmes unités que W6 et W20, lues sur la même table, par une
requête sans filtre de publication. **L'axe 3 les couvre sans modification.**

#### Le TERMINAL — et c'est là, et seulement là, que ça casse

`repondre()` (l. 304) construit une `Response`. **Le canal n'émet jamais par une
`Response`** : sa réponse HTTP vaut `{"ok":true}` (webhook l. 66) et ne
transporte rien. `repondre` n'a donc **aucune prise** ici.

| | surfaces web (P-W, P-E) | canal (P-T) |
|---|---|---|
| la charge sort par | la valeur de retour de la route | un **appel sortant**, `fetch` vers un tiers |
| le terminal du module | `repondre()` → `Response` | **n'existe pas** |
| ce qu'il faut | rien | `emettre(valeur: Admissible<A, {forme:"texte"}>, chatId)` |

Et la marque ne sera **portante** (l. 12-25 : « la marque doit être la chose qui
PRODUIT la charge émise, pas une chose posée à côté ») que si ce terminal devient
le **seul** chemin vers `sendMessage` : `sendReply` doit cesser d'accepter un
`TelegramReply` nu. Sinon on reproduit exactement le défaut que le module décrit
— un drapeau à côté d'une route qui émet ce qu'elle veut.

**Donc : un seul boundary, un seul module, les mêmes trois axes — et un second
terminal.** Ce qui manque n'est pas un deuxième boundary, c'est un deuxième
**point d'application** et une valeur d'audience.

#### Une voie fermée d'avance, mesurée en passant

`handleKolCommand` instancie son **propre** `PrismaClient` (l. 203-204) au lieu
d'importer `src/lib/prisma.ts`. Une application posée en extension du client
partagé ne couvrirait donc pas ce chemin. `src/lib/prisma.ts` (blob `1bee0b98d231`,
7 lignes) ne porte aujourd'hui ni `$extends` ni `$use` — rien n'est perdu, mais
la voie est barrée avant d'être ouverte, et il vaut mieux le savoir maintenant.

### Ce que ce boundary NE couvre PAS, et pourquoi

| non couvert | pourquoi |
|---|---|
| **L'oracle de la Watchlist (§6.2)** | Le boundary agit sur l'unité. L'oracle naît de la **forme de la collection** : 11 lignes riches contre 96 pauvres. Aucune décision par unité ne le ferme. Il exige une décision de **surface** — la liste est l'unité — et c'est un arbitrage produit, pas une garde. |
| **L'appartenance à la liste (W5)** | Être nommé sur une page intitulée « UNDER ACTIVE SURVEILLANCE » est l'assertion. Le boundary ne peut pas la contenir sans supprimer la ligne. |
| **La véracité (E4, E15, W2)** | Le compte faux de `linkedActorsCount`, la dérivation tautologique de `deriveSolidity`, la surveillance affirmée pour 107 alors que le cron en scanne 50 : ce sont des défauts de **vérité**, pas d'autorité. Une unité peut être parfaitement gouvernée et fausse. À instruire séparément. |
| **Le chemin latent du PDF (§7)** | `kolCases` entre dans l'objet du gabarit et n'en sort pas. Le boundary marquerait l'objet, pas les octets. Tant que le gabarit n'utilise pas `cases`, la couverture serait déclarative. **À déclarer, pas à combler par hypothèse.** |
| **Les 2 indécidables (§8.1)** | Ni l'énumération `evidenceDepth` ni la canonicité de `handle` ne sont des questions d'autorité de publication. |
| **L'audience du canal (T1–T8)** | L'axe 3 rend les unités gouvernables ; il ne dit pas **à qui**. Tant que l'axe 1 n'a pas de valeur pour l'abonné, un `/kol` parfaitement contenu remet quand même 11 dossiers publiés à une audience que `proxy.ts` n'admet pas sur le web (§6.3 sens A). **C'est un ruling, pas une garde.** |
| **Le faux négatif de casse (T7)** | 140 lignes injoignables, dont **21 publiées**. Défaut de VÉRITÉ, même famille que E4 et E15. Une unité peut être gouvernée et l'assertion fausse. |
| **L'irrévocabilité (§7)** | Un message remis est archivé chez le destinataire. Aucun type ne le retire. `RESTREINTE`/`ATTESTEE` ne nomment pas cette propriété ; je la nomme sans la ranger. |
| **La découverte du bot** | Qui connaît son `@nom` n'est **pas** dans le dépôt. Le code n'oppose aucune restriction ; l'exposition réelle est **non mesurée**, ce qui n'est pas « nulle ». |

---

## 10. COMMENT J'AI VÉRIFIÉ QUE CHAQUE CRITÈRE MORD

« Si un critère ne peut pas échouer, il ne mesure rien. »

| critère | il mord — preuve chiffrée |
|---|---|
| « servi » sur l'Explorer | **9** groupes de launch servis sur **114** ; **105** exclus faute d'acteur publié. |
| « servi » sur les notes internes | **109** lignes portent un marqueur interne ; **3** seulement sont servies. Le critère en exclut 106. |
| troncature `slice(0,2)` | BOTIFY a **5** notes, 2 servies, 3 non ; GHOST 4/2 ; le dossier case BOTIFY a 5 snippets dont la ligne « Dad wallet » est le **5ᵉ** et n'est donc **pas** servie par ce chemin — elle l'est par `KolTokenLink.note`. Le critère distingue les deux chemins. |
| « profil publié » | **32** publiés sur **412** lignes `KolProfile` ; **11** sur les 107 de la watchlist. |
| « `whyLine` a un motif propre » | **54** couverts / **53** au défaut. Le critère partage la population presque en deux. |
| « `displayName` divergent » | **7** sur 52 non publiés, **2** sur 11 publiés. Il échoue sur la grande majorité. |
| « pastilles de ticker » | **15** porteurs sur 107 ; **9** non publiés. |
| « `_count` non rédigé » | **15** non publiés portent `walletsCount>0`, **0** portent `casesCount>0`. Le critère distingue les deux compteurs. |
| « verdict `CONFIRMED` » | **3** dossiers sur 4 ; le 4ᵉ bascule en `SIGNAL` sur une valeur d'énumération inconnue. Le critère produit les deux issues. |
| « le repli `KolPromotionMention` fuit » | **0** aujourd'hui. **Le critère échoue, et c'est le résultat** : latence déclarée, pas fuite active. |
| « franchissement de frontière » | LLM : **1** actif (E2). Navigateur sans tête : **0** actif, **1** latent. Le critère rend trois issues distinctes, pas une. |
| « anonyme atteint la surface » | **non**, sur les 5 chemins sondés en navigateur réel. Le critère rend NON — il pouvait rendre OUI. |
| « atteignable par `/kol` » | **272** sur **412** lignes ; **140** exclues par la casse. Le critère écarte un tiers de la population. |
| « le canal est armé en production » | `configured:true`, corps applicatif de 58 o. Le critère pouvait rendre `false` — le code prévoit explicitement ce cas (`route.ts:35-38`). |
| « un champ tranche la publication, seul » | `tier` **203** lignes, `riskFlag` **11**, la ligne rug **5**. Trois pouvoirs distincts d'un facteur 40. |
| « la signature jointe tranche » | **270 / 272**, sur **26** signatures distinctes. Il reste **2** ambiguës : le critère pouvait rendre 272, il ne l'a pas fait. |
| « la ligne rug fuit du non gouverné » | **0 / 261**. **Le critère échoue, et c'est le résultat** : T6 est la seule unité entièrement fondée du canal. |
| « le faux négatif de casse frappe le non gouverné » | **non** : **21** des 140 inatteignables sont **publiées** — 66 % de la classe publiée contre 31 % de la non publiée. Le critère pouvait rendre l'inverse, et j'avais écrit l'inverse. |
| « l'abonné entre dans une des trois `Audience` » | **non**, aucune des trois. Le critère pouvait rendre OUI — `ANONYMOUS` était disponible et aurait « marché ». |
| « les 11 publiés du canal = les 11 publiés de la Watchlist » | **non** : intersection **6**. Deux cardinaux égaux, deux ensembles différents. |

---

## 11. CE QUI RESTE HORS SCOPE — ET POURQUOI CE N'EST PAS LA MÊME RAISON

L'annexe Telegram qui occupait cette section a été **dissoute** par le ruling :
`/kol` est au tableau principal (§4.C), au chemin d'émission (§3, P-T), au test
d'oracle (§6.3), à la frontière (§7), au compte (§8) et au boundary (§9.1).
Il n'y a plus d'annexe.

Restent deux canaux sortants, **non instruits, non inventoriés, non comptés dans
les 46** — et ils ne sont pas hors scope pour la même raison :

| canal | fichier | pourquoi il reste dehors |
|---|---|---|
| `accessCodeDelivery` — code d'accès en clair par e-mail | `src/lib/email/accessCodeDelivery.ts` | **En attente de ruling.** C'est un canal sortant de même forme que P-T, mais sa charge est un secret d'accès, pas du contenu nominatif publié. Autre classe d'unité, autre question. |
| `deliverAlerts` — handle vers une URL choisie par l'abonné | `src/app/api/cron/alerts/deliver/route.ts` | **En attente de ruling, et ce n'est pas une lacune de sonde.** C'est une **BORNE DE LA DÉFINITION du gouverné** : le destinataire n'est pas seulement auto-désigné comme sur P-T, il est une **URL arbitraire fournie par l'abonné**. La question n'est pas « ce contenu est-il gouverné ? » mais « jusqu'où la notion d'audience gouvernée a-t-elle un sens quand l'abonné choisit le point de remise ? ». Je maintiens la formulation ; GPT ne l'a pas tranchée. |

Les deux sont **nommés et localisés**, pas mesurés. Aucune ligne, aucun chiffre,
aucune colonne de ce rapport n'en dépend.

Et les trois pistes déjà déclarées au §12.6 — `KolWallet.label`, les pages
`/en/kol/<handle>`, `src/data/scamUniverse.json` — restent elles aussi dehors,
inchangées.

*(Note hors périmètre, relevée en passant : `CLAUDE.md` annonce « 215 profils
publiés ». Mesuré ce jour : 412 lignes `KolProfile`, **32** publiées — dont
**21 inatteignables** par `/kol`, §6.3 sens B′.)*

---

## 12. MES ERREURS DE MESURE, DÉCLARÉES

1. **J'ai commencé par `curl`, et j'ai failli conclure.** `/api/watchlist` a
   rendu 401 et `/en/watchlist` 403 ; les deux corps étaient des pages
   Cloudflare. J'allais écrire « gaté ». Un refus d'intermédiaire n'est pas une
   mesure de l'autorisation applicative. Rejoué depuis un navigateur réel : le
   401 applicatif est un autre objet (`NOMINATIVE_ACCESS_REQUIRED`), et le 403
   n'existe pas du tout — la page rend 200 en servant `/access`. Deux conclusions
   sur trois auraient été fausses.
2. **J'ai localisé « Dad wallet » dans le mauvais chemin.** Le grep m'a mené à
   `KolCase.evidence` (`seed-kol-kokoski.ts`), et j'ai cru tenir le chemin
   d'émission. En reconstituant `slice(0,2)` sur l'ordre réel de la base, la
   ligne « Dad wallet » est le **5ᵉ** snippet du dossier case BOTIFY et n'est
   **pas** servie par là. Elle est servie par `KolTokenLink.note` — un autre
   champ, une autre table, un autre chemin. **Un grep littéral n'est pas une
   provenance.** Sans la reconstitution, j'aurais désigné le mauvais champ à
   corriger, et le vrai serait resté.
3. **Mon premier compte de profils non publiés était 52, le second 53.** Les
   deux sont justes et mesurent des choses différentes : 52 *handles* de la
   watchlist, 53 *lignes* `KolProfile`. L'écart est `0xsweep` / `0xSweep`, deux
   lignes pour une personne. C'est la casse, encore — et cette fois elle n'a pas
   faussé une sonde, elle a révélé I2.
4. **Je n'ai pas mesuré `/en/watchlist` et `/en/explorer` authentifiés.** Le
   chemin P-W/P-E jusqu'au nœud texte du DOM est établi par **lecture de code
   ancrée sur les blobs**, pas par un GET authentifié. Je n'ai pas ouvert de
   session beta. Les colonnes « assertion publiée » sont donc démontrées jusqu'à
   la réponse JSON et par la lecture du composant, pas par l'octet peint.
   **Déclaré, non comblé.**
5. **`WATCHER_MAX_HANDLES` en production m'est inconnu.** J'affirme en W2 que
   63 des 107 ont un signal en 30 jours — cela, c'est mesuré. J'ajoute que le
   défaut du code est 50 sur 108 — cela aussi. Mais je ne peux pas affirmer que
   57 ne sont pas scannés : la variable Vercel peut valoir autre chose. La borne
   est déclarée comme borne.
6. **Je n'ai pas étendu le périmètre**, alors que trois pistes s'ouvraient :
   `KolWallet.label` (« Dad wallet — received insider supply, dumped »,
   `isPubliclyUsable`), les pages `/en/kol/<handle>`, et
   `src/data/scamUniverse.json` (« Insider supply to BK Mom/Dad/Carter… »).
   Elles relèvent probablement de la même classe. Elles ne sont **pas** dans le
   scope donné et ne sont **pas** inventoriées ici.

### Ajoutées au tirage du ruling Telegram

7. **Je n'ai envoyé aucun message au bot.** Le chemin P-T est établi par lecture
   de code ancrée sur deux blobs (`4b55698f207a`, `f528d7ef30df`, tous deux
   `= origin/main`) et par une sonde de santé anonyme (`configured:true`). Il
   n'est **pas** établi par un aller-retour réel. Je n'ai ni le `@nom` du bot ni
   le `TELEGRAM_WEBHOOK_SECRET`, et je n'ai demandé ni l'un ni l'autre. Les
   verbatim de la colonne « assertion publiée » en §4.C sont donc
   **reconstitués** par interpolation du gabarit l. 216-223 sur des lignes
   mesurées en base — la donnée est réelle, le message ne l'est pas.
   **Déclaré, non comblé**, exactement comme le §12.4 pour le DOM.
8. **« Exposition externe anonyme : ZÉRO » était une sur-généralisation.** Cette
   phrase ouvrait le rapport. Elle était juste pour les deux surfaces web, et je
   l'avais écrite avant le ruling, quand le canal était en annexe. Un canal dont
   le code n'oppose **aucune** restriction de destinataire n'a pas une exposition
   nulle : il a une exposition **non mesurée**. Corrigé en tête et en §1.3. Ce
   n'est pas une erreur de mesure, c'est une erreur de portée d'une mesure —
   la même famille que mon erreur n°1.
9. **Le sens du faux négatif de casse était faux.** L'annexe disait « oracle
   inversé, 140 profils qui existent ». En mesurant la **composition** des 140,
   **21 sont publiées** : 66 % de la classe publiée est injoignable contre 31 %
   de la non publiée. L'artefact ne rate pas au hasard — il supprime
   préférentiellement du **gouverné**. J'avais le bon phénomène et le mauvais
   sens.
10. **J'ai failli écrire « les mêmes 11 ».** Le canal atteint 11 profils publiés ;
    la Watchlist en publie 11. **L'intersection est 6.** Deux cardinaux égaux ne
    sont pas un ensemble. Vérifié par comparaison des deux listes, pas par le
    compte.
11. **L'annexe disait « onze prénoms (BOTIFY team) » et en listait douze.** Le
    compte mesuré est **12** — Salman, Aun, ShahDev, Samad, Naveed, Qayoom,
    Dania, Moazzam, Mohamed, Atif, Paul, Armel. Le total de 19 `displayName`
    divergents, lui, était juste (12 + 7). §4.C porte 12.
12. **Je n'ai pas mesuré la latence du canal.** §6.3 sens A affirme que
    l'uniformité du refus est atteignable *sur les octets du message*. Sur un
    canal, un corps identique n'est pas nécessairement une réponse identique :
    le temps de réponse est observable. Les deux chemins appellent `findUnique`
    (l. 206), donc l'écart devrait être petit — **devrait**. Je ne l'ai pas
    mesuré et je ne l'affirme pas nul. **Borne déclarée.**
13. **Je n'ai pas instruit `ops/alerting.ts` ni `watcher-health.mjs`**, alors
    qu'ils postent au même `sendMessage`. Je les cite pour un seul fait vérifié —
    leur `chat_id` vient de l'environnement, pas de la requête — et ce fait sert
    de **contraste** au §7. Aucune de leurs charges n'est inventoriée.

---

## 13. CE QUE JE N'AI PAS FAIT

Aucun code. Aucun fix. Aucun commit de remédiation. Aucune écriture en base,
aucun DDL, aucune suppression de ligne de preuve. Aucun fichier gelé touché.
Aucune lecture de la fenêtre T1. Aucun `ADMIN_TOKEN` demandé, copié ou passé en
query string.

Sur le canal, en plus : **aucun message envoyé au bot**, aucun `@nom` cherché,
aucun `TELEGRAM_WEBHOOK_SECRET` demandé, aucun `setWebhook` appelé, aucune
commande jouée. La seule requête sortante est un `GET` anonyme sur le point de
santé public (§1.4). `accessCodeDelivery` et `deliverAlerts` ne sont ni lus au
détail, ni mesurés, ni comptés.

Et **aucune valeur d'audience n'a été créée** : l'abonné est décrit, pas rangé.
Le `‡` du §4.C reste à trancher.

**Rien ne sera codé tant que ce tableau n'est pas arbitré.**
