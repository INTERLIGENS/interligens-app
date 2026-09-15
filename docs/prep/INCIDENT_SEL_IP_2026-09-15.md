# INCIDENT ROTATION — comportement du sel d'IP

**Date** : 2026-09-15 · **Fenêtre** : incident, LECTURE SEULE · **Branche** : `feat/cc-offline-216-temoin-sel-ip`

Aucune rotation. Aucun provisionnement. Aucune écriture en base, aucune DDL, aucun déploiement.
Aucun fichier d'environnement touché. Aucune valeur de secret affichée, journalisée ou écrite.
Aucune IP réelle : l'entrée des témoins est `192.0.2.1` (RFC 5737 TEST-NET-1, documentation).

---

## Résumé pour décision

| # | Ce qui a été établi | Verdict |
|---|---|---|
| 1 | Le sel d'IP retail effectif **est** `ADMIN_TOKEN`, par égalité HMAC exacte | Confirmé, témoin en place |
| 1b | Sel explicite posé ⇒ `ADMIN_TOKEN` **jamais lu** | Confirmé par piège de lecture |
| 2 | Population qu'une re-clé désynchroniserait **aujourd'hui** | **0 ligne** |
| 2b | Le geste de gel prévu (§4.2 de l'inventaire) est **incomplet** | `IntakeRecord` non couvert |
| 3 | Témoin de continuité rejouable par le fondateur | Construit, non armé, répété |
| 4 | Le repli est une dette — **et il touche à la correction de la rotation** | Question rouverte, §4 |

---

## 1 — Le sel effectif, prouvé

### 1.1 Le mécanisme

`src/lib/osint/retail/ipHash.ts:30-38`

```ts
function ipSalt(): string {
  const explicit = process.env.OSINT_RETAIL_IP_SALT;
  if (explicit && explicit.trim() !== "") return explicit;
  return requireSalt("ADMIN_TOKEN");
}
```

`hashIp` (`:56-58`) = `createHmac("sha256", ipSalt()).update(ip).digest("hex")` — 64 caractères hexadécimaux,
non tronqué.

`OSINT_RETAIL_IP_SALT` est absente de l'environnement. Le sel effectif est donc `ADMIN_TOKEN`.

### 1.2 Pourquoi les témoins existants ne suffisaient pas

`__tests__/security/requireSalt.test.ts:178-237` couvre déjà ce fichier. Mais ses assertions portent sur la
**forme** : `expect(hashIp("1.2.3.4")).toMatch(/^[0-9a-f]+$/)`. Un hachage de la bonne forme passe ce test
sous **n'importe quelle** clé.

Mesuré, pas supposé. J'ai muté `ipHash.ts` en clé composite —
`return explicit + (process.env.ADMIN_TOKEN ?? "")` — c'est-à-dire un code qui lit `ADMIN_TOKEN`
*même quand le sel explicite est posé*, donc exactement le comportement que la rotation rendrait dangereux :

| Suite | Sur le mutant |
|---|---|
| `requireSalt.test.ts` (19 tests, préexistants) | **19 verts** — le mutant passe inaperçu |
| `ip-salt-continuity.test.ts` (nouveau) | **3 rouges** — mutant attrapé |

Le fichier a été restauré à l'identique (`git diff` vide) avant la suite des travaux.

### 1.3 Les témoins posés

`__tests__/security/ip-salt-continuity.test.ts` — 8 témoins, dont :

- **Égalité exacte, repli** : `hashIp(ip) === HMAC-SHA256(clé = ADMIN_TOKEN, ip)`, recalculé indépendamment
  dans le test. Tombe si la construction change (préfixe, troncature, digest, seconde source dans la clé).
- **Le jeton EST la clé** : changer `ADMIN_TOKEN` change l'empreinte. C'est la re-clé silencieuse, rendue visible.
- **Non-lecture** : `process.env` est remplacé par un `Proxy` qui enregistre chaque lecture de nom. Sous sel
  explicite, `OSINT_RETAIL_IP_SALT` **est** dans le journal des lectures, `ADMIN_TOKEN` **ne l'est pas**.
  Un **canari** vérifie d'abord que le piège intercepte réellement — sans quoi « zéro lecture » voudrait
  seulement dire « le piège n'était pas posé ».
- **Non-influence** : sous sel explicite, `ADMIN_TOKEN` = A, puis B, puis absent → même empreinte trois fois.

C'est la mesure demandée par compartiment : pas une absence d'erreur, une **capacité constatée nulle**.

---

## 2 — La surface réelle de consommation

### 2.1 Cinq familles de hachage d'IP, deux seulement dépendent d'`ADMIN_TOKEN`

| Famille | Fichier | Sel | Rotation `ADMIN_TOKEN` |
|---|---|---|---|
| OSINT retail | `src/lib/osint/retail/ipHash.ts:37` | `OSINT_RETAIL_IP_SALT` **sinon** `ADMIN_TOKEN` | **Affectée** (par repli) |
| Admin intake | `src/app/api/admin/intake/route.ts:15-17` | `ADMIN_TOKEN` **en direct** | **Affectée** (sans indirection) |
| Community | `src/lib/community/ipHash.ts:9` | `VAULT_AUDIT_SALT` | Non |
| Billing | `src/lib/billing/request.ts:19` | `IP_HASH_SALT` | Non |
| Investigator | `src/lib/security/investigatorAuth.ts:36-38` | *aucun* — littéral `interligens:ip:` en dur | Non |

### 2.2 Le geste de gel prévu est incomplet

`docs/prep/ROTATION_INVENTORY_2026-09-15.md` §4.2 prescrit : poser `OSINT_RETAIL_IP_SALT` = valeur courante
d'`ADMIN_TOKEN`. Ce geste **ne couvre que la première ligne du tableau**.

`src/app/api/admin/intake/route.ts:15-17` hache `ipHash` **et** `userAgentHash` avec
`requireSalt("ADMIN_TOKEN")` — appel direct, aucune variable d'indirection, donc rien à geler. La rotation
re-clé ces deux colonnes quoi qu'il arrive.

Le mot `IntakeRecord` apparaît **0 fois** dans l'inventaire de rotation ; `userAgentHash`, **0 fois** ;
`intake`, **0 fois**. L'angle mort n'est pas une divergence d'appréciation, c'est une omission.

### 2.3 Chemins d'appel

| Consommateur | Site | Écrit vers |
|---|---|---|
| `POST /api/osint/submit` | `route.ts:92,97` → `:231` | `OsintSubmission.submitter` |
| idem, pont chaîne de preuve | `src/lib/osint/retail/evidenceChainBridge.ts:86` | `EvidenceItem.submittedBy` |
| lecture rate-limit 24 h | `src/lib/osint/retail/retailStore.ts:135-143` | — (comparaison d'égalité) |
| `POST /api/admin/intake` | `route.ts:24-25` → `:61` | `IntakeRecord.ipHash`, `.userAgentHash` |

**Point forensique** : `EvidenceItem.submittedBy` entre dans `manifestItems` → `core` →
`sha256Buffer(stableStringify(core))` = `manifestHash`, lui-même horodaté TSA
(`src/lib/evidence-chain/manifest.ts:129,144-148`). Un hachage d'IP calculé sous l'ancien sel serait donc
scellé, et irreproductible dès le jeton roté. C'est le seul endroit où la re-clé aurait une conséquence
véritablement irréversible.

### 2.4 Ce qu'une re-clé toucherait — chiffres mesurés

Base de production, endpoint Neon `ep-square-band-ag2lxpz8`, `current_database = neondb`. Lecture seule.
Colonnes vérifiées présentes dans `information_schema` : un `0` ci-dessous est une **table vide**, jamais une
colonne absente.

| Table · colonne | Sel | Lignes portant un hachage |
|---|---|---|
| `OsintSubmission.submitter` | retail → `ADMIN_TOKEN` | **0** (table : 0 ligne) |
| `EvidenceItem.submittedBy` | retail → `ADMIN_TOKEN` | **0** *(sur 1 107 pièces, toutes `NULL`)* |
| `IntakeRecord.ipHash` / `.userAgentHash` | `ADMIN_TOKEN` direct | **0** (table : 0 ligne) |
| `CommunitySubmission.ipHash` | `VAULT_AUDIT_SALT` | 0 |
| `InvestigatorSession.ipHash` | littéral en dur | 133 *(non affecté)* |
| `InvestigatorAuditLog.ipHash` | littéral en dur | 285 *(non affecté)* |
| `beta_audit_logs.ipHash` | **non résolu** | 4 |
| `beta_nda_acceptances.ipHash` | **non résolu** | 1 |

**Réponse à « une re-clé silencieuse toucherait quoi, exactement » : rien. Zéro ligne.**

Le balayage a porté sur **toutes** les colonnes du schéma `public` dont le nom évoque un hachage d'IP
(`%iphash%`, `%submitter%`, `%submittedby%`, `%useragenthash%`), pas sur une liste écrite d'avance.

Deux réserves, nommées et non comblées :

- **`beta_audit_logs` (4) et `beta_nda_acceptances` (1)** portent des hachages de 64 caractères hexadécimaux
  purs — la forme de la famille `ADMIN_TOKEN`. Ces tables n'ont **aucun écrivain dans le dépôt**, ni dans
  l'historique git (`git log -S` sur tout l'historique : seul un instantané de schéma). Leur sel d'origine
  est **CAUSE_UNRESOLVED**. Une rotation ne peut pas les re-cléer — rien ne les écrit — mais leur
  reproductibilité est, elle, indéterminée. Je n'invente pas de provenance.
- `InvestigatorAuditLog` mélange deux formes : 281 lignes à 16 caractères, 4 à 32. Hors périmètre rotation.

*Observation incidente, non poursuivie (périmètre de l'autre terminal)* : le `DATABASE_URL` de `.env.local`
résout vers l'hôte **direct**, sans `-pooler`, là où `CLAUDE.md` annonce « port 6543 pgbouncer ».

---

## 3 — Le témoin de continuité

`__tests__/security/ip-salt-continuity.test.ts`, dernier `describe`.

Il ne s'arme que si `ADMIN_TOKEN` **et** `OSINT_RETAIL_IP_SALT` sont toutes deux présentes dans
l'environnement d'exécution. Il ne provisionne rien : le provisionnement est un geste humain, hors dépôt.
Un huitième témoin garantit qu'une exécution **non armée** ne peut pas être confondue avec une exécution
armée et verte.

Il compare deux empreintes de `192.0.2.1` : celle produite sous le sel provisionné, celle produite sous le
repli `ADMIN_TOKEN`. Il n'affiche jamais un sel — en cas d'échec, Vitest ne montre que deux HMAC d'une entrée
publique sous une clé qui, elle, reste hors de portée.

**Répété avec des valeurs inertes, sans toucher au moindre fichier d'environnement :**

| Répétition | Résultat |
|---|---|
| Sel provisionné **identique** au jeton | **8 verts** |
| Sel provisionné **différent** du jeton | **1 rouge** (7 verts) — l'écart est détecté |
| Ni l'un ni l'autre posé | 7 verts, **1 sauté** — l'état actuel |

### Procédure pour le fondateur

Aucune valeur ne transite par moi, par un fichier de travail ou par un journal. Les deux commandes `read -s`
n'affichent rien à l'écran, n'écrivent rien sur disque, et ne laissent pas la valeur dans l'historique du
terminal.

Dans le Terminal, dans `~/dev/interligens-web`, une ligne à la fois :

```zsh
read -s "ADMIN_TOKEN?Colle la valeur ACTUELLE d'ADMIN_TOKEN puis Entrée : " && export ADMIN_TOKEN
```

```zsh
read -s "OSINT_RETAIL_IP_SALT?Colle la valeur que tu veux POSER comme sel puis Entrée : " && export OSINT_RETAIL_IP_SALT
```

```zsh
npx vitest run __tests__/security/ip-salt-continuity.test.ts
```

Puis, impérativement, pour ne pas laisser les valeurs dans le terminal :

```zsh
unset ADMIN_TOKEN OSINT_RETAIL_IP_SALT
```

**Lecture du résultat.** La dernière ligne annonce `Tests  8 passed (8)` ou `1 failed`.

- `8 passed` → les deux valeurs sont **identiques**. Le sel reproduit exactement les hachages en vigueur.
- `1 failed` → les deux valeurs **diffèrent**. Poser ce sel changerait les hachages produits ensuite.
- `1 skipped` → une des deux variables n'a pas été posée ; l'essai n'a rien mesuré, recommencer.

**Ce que ce résultat signifie dépend de l'option retenue au §4** — en continuité, le vert est le but ;
avec un sel neuf, le rouge est le but. Le témoin répond à une seule question, factuelle : *ce sel
reproduit-il les hachages d'aujourd'hui ?*

Ce que le témoin ne peut pas faire : vérifier ce qui est réellement stocké dans Vercel. Il compare les deux
valeurs fournies à ce terminal. Le report dans Vercel reste un geste manuel à faire avec soin
(`vercel env pull` supprime `ADMIN_TOKEN` — cf. `CLAUDE.md`).

---

## 4 — La dette, nommée — et la question rouverte

### 4.1 La dette

`OSINT_RETAIL_IP_SALT || ADMIN_TOKEN` (`ipHash.ts:33-37`) fait emprunter à un module de pseudonymisation le
secret d'une garde d'administration. Un sel absent doit échouer fermé, comme `requireSalt.ts` l'impose
partout ailleurs, et non basculer en silence sur un secret d'un autre domaine. **Non corrigé**, conformément
à la consigne. `src/app/api/admin/intake/route.ts:15-17` relève de la même dette sous une forme plus crue :
il n'y a même pas de variable dédiée à poser.

### 4.2 Pourquoi je pense que la question doit être rouverte

L'architecte a posé une condition unique : que la dette **empêche la rotation de se faire correctement**.
Je crois que c'est le cas, et l'argument tient en trois mesures déjà faites.

**a. Le motif de la continuité n'a pas de sujet.** La décision protège une propriété historique :
« ces hashes peuvent participer aux corrélations/enquêtes ». Mesuré : **0 ligne**. Aucune soumission retail,
aucun `submittedBy` sur les 1 107 pièces de la chaîne de preuve, aucun `IntakeRecord`. Il n'existe aujourd'hui
aucune corrélation à préserver, aucun manifeste scellé ne contient de hachage d'IP retail. La continuité,
ici, ne coûte rien à abandonner parce qu'elle ne porte sur rien.

**b. Le geste de continuité a, lui, un coût, et il est permanent.** Geler le sel signifie recopier la valeur
**compromise** d'`ADMIN_TOKEN` dans `OSINT_RETAIL_IP_SALT`, et l'y maintenir vivante indéfiniment.
L'inventaire de rotation établit que cette valeur est « Identique à la valeur courante. Vivant. » — donc
entre les mains de quiconque détient la fuite. Le sel d'un HMAC connu réduit la pseudonymisation à un
hachage nu : l'espace IPv4 fait 2³², une table complète se calcule en minutes. C'est mot pour mot l'attaque
que `requireSalt.ts` a été écrit pour empêcher, et que ce fichier-ci décrit dans son propre en-tête.
La rotation « réussirait » en laissant la valeur fuitée en service, sous un autre nom, comme clé de
pseudonymisation — pour **toutes les soumissions futures**, qui elles ne sont pas nulles.

**c. Le geste prescrit ne fait pas ce qu'il annonce.** Même exécuté, il laisse `IntakeRecord` se faire
re-cléer (§2.2). « Figer le sel » ne fige que la moitié du périmètre.

### 4.3 Ce que je recommande — la décision reste à l'architecte

Provisionner `OSINT_RETAIL_IP_SALT` avec une **valeur neuve, aléatoire, jamais égale à `ADMIN_TOKEN`**,
avant la rotation. On obtient le fail-closed voulu, on cesse d'emprunter un secret d'administration, et
surtout on ne promeut pas une valeur fuitée au rang de clé de pseudonymisation. Le coût — perdre la
continuité des hachages — est **exactement nul en lignes**, et c'est une mesure, pas une estimation.

Ce n'est pas le refactor que l'architecte a écarté : c'est le choix d'une valeur, au moment même où la
variable doit de toute façon être posée. Le refactor du repli (faire échouer fermé) reste, lui, hors de
cette fenêtre.

Si l'architecte maintient la continuité en connaissance de ces trois points, la procédure du §3 s'applique
telle quelle et le verdict attendu est le vert. Les deux options sont servies par le même témoin.

**Dans les deux cas, `IntakeRecord` reste à trancher séparément** : aucune variable ne le couvre aujourd'hui.

---

## Fichiers

| Chemin | Nature |
|---|---|
| `__tests__/security/ip-salt-continuity.test.ts` | 8 témoins — sel effectif, non-lecture, continuité |
| `docs/prep/INCIDENT_SEL_IP_2026-09-15.md` | ce rapport |

Aucun fichier de production modifié.
