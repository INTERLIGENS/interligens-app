# SÉPARATION DES AUTORITÉS DE SECRET — CC-OFFLINE-217

**Date** : 2026-09-15 · **Branche** : `feat/cc-offline-217-separation-autorites-secret`
**Remplace** : `docs/prep/ROTATION_INVENTORY_2026-09-15.md` §4.2 et §5 Étape 0 point 2, désormais marqués périmés.

Aucune rotation. Aucun provisionnement. Aucun sel généré ni posé. Aucune écriture en base, aucune DDL,
aucun déploiement. Aucun fichier d'environnement touché. Aucune valeur de secret affichée, journalisée
ou écrite. Aucune IP réelle : l'entrée des témoins est `192.0.2.1` (RFC 5737 TEST-NET-1) et l'user-agent
est une chaîne inventée.

---

## Invariant ratifié, inscrit là où il gouverne

> An authentication credential must not serve as a pseudonymization key. Where measured historical
> continuity cost is zero, secret rotation must eliminate the coupling rather than preserve a compromised
> derived secret.

Inscrit en trois endroits, du plus exécutable au plus narratif :

| Où | Forme |
|---|---|
| `__tests__/security/secret-authority-separation.test.ts` | **16 témoins exécutables** — la seule forme qui rougit |
| `src/lib/osint/retail/ipHash.ts` en-tête · `src/app/api/admin/intake/route.ts:9-30` | le motif, au site d'appel |
| `ROTATION_INVENTORY` §4.2 | bandeau ⛔ sur le geste contraire, qui était encore prescrit |

---

## Résumé pour décision

| # | Ce qui a été fait | Verdict |
|---|---|---|
| A | Nom de la variable intake : **`INTAKE_HASH_SALT`** | Retenu, motif §A |
| B | `IntakeRecord` séparé — sel dédié, **fail closed** | `route.ts:32` |
| C | Les **deux** replis vers `ADMIN_TOKEN` supprimés | 0 occurrence hors commentaires |
| D | Témoins causaux + mutant rejoué sur **les deux familles** | 16 verts / **8 rouges** sur mutant |
| E | Re-vérification du zéro | **0 ligne**, prémisse intacte |
| F | Procédure du fondateur | §F, à exécuter par lui seul |

Suite complète : **7 723 verts, 520 fichiers, 0 rouge**. `tsc --noEmit` : propre. `eslint` : propre.

---

## A — Le nom retenu, et pourquoi

**Conventions réellement en vigueur dans le dépôt** (relevées, pas supposées) :

| Nom existant | Domaine | Sujet |
|---|---|---|
| `VAULT_AUDIT_SALT` | vault | audit |
| `IP_HASH_SALT` | *(billing, implicite)* | hachage d'IP |
| `OSINT_RETAIL_IP_SALT` | osint retail | IP |

La forme est `<DOMAINE>_<SUJET>_SALT`.

**Aucun nom canonique n'existe pour la famille intake.** Vérifié : le préfixe `INTAKE_` n'apparaît dans tout
le dépôt que comme libellé d'audit — `INTAKE_CREATED`, `INTAKE_ROUTED`, `INTAKE_RERUN`,
`INTAKE_PUSH_TO_VAULT`, `INTAKE_WATCHER_TRIGGERED` — jamais comme variable d'environnement.

**Je retiens `INTAKE_HASH_SALT`**, et le sujet est `HASH`, pas `IP`, pour une raison de fond : la route hache
**deux colonnes**, `ipHash` **et** `userAgentHash`. La nommer `INTAKE_IP_SALT` mentirait sur sa portée et
inviterait, plus tard, à poser un second sel pour l'user-agent — c'est-à-dire à refragmenter ce qu'on vient
d'unifier. C'est aussi le nom proposé en repli dans la commande ; les conventions mesurées le confirment
plutôt qu'elles ne l'infirment.

---

## B — La séparation d'`IntakeRecord`

`src/app/api/admin/intake/route.ts:31-33`

```ts
function hmac(val: string): string {
  return createHmac("sha256", requireSalt("INTAKE_HASH_SALT")).update(val).digest("hex");
}
```

Consommé aux lignes `40-41` (`ipHash`, `uaHash`), persisté ligne `77`.

**Fail closed, assumé.** `requireSalt` lève si la variable est absente, vide, ou blancs seuls. La requête
échoue plutôt que de hacher sous une clé d'emprunt. Motif : nous sommes dans la fenêtre où les autorités sont
séparées *avant* que l'ancien credential soit tué. Un secret absent refuse, il n'emprunte pas.

Témoin que rien n'est écrit sous une clé dégradée : *« aucune ligne n'est écrite quand le sel manque »* —
le hachage précède `intakeRecord.create`, donc l'échec est antérieur à toute persistance.

---

## C — Les deux replis supprimés, prouvés absents

### Ce qui disparaît

| Fichier | Avant | Après |
|---|---|---|
| `src/lib/osint/retail/ipHash.ts:61` | `OSINT_RETAIL_IP_SALT` **\|\|** `requireSalt("ADMIN_TOKEN")` | `requireSalt("OSINT_RETAIL_IP_SALT")` |
| `src/app/api/admin/intake/route.ts:32` | `requireSalt("ADMIN_TOKEN")` *(en direct)* | `requireSalt("INTAKE_HASH_SALT")` |

### La preuve d'absence

Compté **après retrait des commentaires** — l'invariant se raconte en prose dans les deux en-têtes, il ne
doit pas s'exécuter :

```
src/lib/osint/retail/ipHash.ts      : 0 occurrence de ADMIN_TOKEN hors commentaires
src/app/api/admin/intake/route.ts   : 0 occurrence de ADMIN_TOKEN hors commentaires
```

Verrouillé par trois témoins de source qui appliquent la même dé-commentarisation, plus un témoin qui
interdit la réapparition du **motif** `OSINT_RETAIL_IP_SALT ||`, `?? `, etc. — y compris sous une forme
inerte aujourd'hui qu'un refactor réveillerait demain.

**Et surtout** : l'absence est prouvée *causalement*, pas seulement textuellement — voir §D, témoins de
non-lecture.

### Ce qui n'a pas été touché, nommé et non corrigé

- `VAULT_AUDIT_SALT` (community, vault) — hors périmètre.
- `IP_HASH_SALT` (billing) — hors périmètre.
- `src/lib/security/investigatorAuth.ts:36-38` — hache l'IP avec le **littéral non salé** `interligens:ip:`.
  C'est la dette la plus crue des cinq familles, elle ne dépend pas d'`ADMIN_TOKEN`, la rotation ne la touche
  pas. **Nommée ici, pas corrigée.**
- `requireSalt.ts` lui-même : inchangé. La séparation n'exigeait rien de plus que deux sites d'appel.

---

## D — Les témoins causaux, et le mutant

`__tests__/security/secret-authority-separation.test.ts` — **16 témoins**, les deux familles.

### Pourquoi causaux et non de forme

`expect(hash).toMatch(/^[0-9a-f]+$/)` passe sous **n'importe quelle** clé — y compris une clé composite
`sel + ADMIN_TOKEN`. Trois mesures qu'une forme ne peut pas simuler :

1. **Égalité exacte** avec un HMAC recalculé indépendamment dans le test. Tombe si la construction change
   (préfixe, suffixe, troncature, digest, seconde source dans la clé).
2. **Non-influence** : `ADMIN_TOKEN` = A, puis B, puis **absent** → hachages identiques les trois fois.
3. **Non-lecture** : `process.env` remplacé par un `Proxy` qui journalise chaque lecture de nom. Le nom du
   sel dédié **est** dans le journal ; `ADMIN_TOKEN` **ne l'est pas**. Précédé d'un **CANARI** qui vérifie
   que le piège intercepte réellement — sans quoi « zéro lecture » ne voudrait dire que « le piège n'était
   pas posé ».

Le témoin intake exécute le **vrai handler `POST`**, pas une fonction extraite pour l'occasion : seules la
persistance, l'extraction, le routage et la garde admin sont doublés, et les hachages sont prélevés tels
qu'ils partent vers la base. La garde est doublée volontairement — elle est fail-closed sur `ADMIN_TOKEN`,
donc sans doublure aucun témoin ne pourrait s'exécuter « `ADMIN_TOKEN` absent ».

### Le mutant, rejoué

Mutant posé simultanément sur les **deux** fichiers — clé composite, c'est-à-dire un code qui lit
`ADMIN_TOKEN` *même sous sel explicite*, exactement le comportement que la rotation rendrait dangereux :

```ts
// retail
return requireSalt("OSINT_RETAIL_IP_SALT") + (process.env.ADMIN_TOKEN ?? "");
// intake
createHmac("sha256", requireSalt("INTAKE_HASH_SALT") + (process.env.ADMIN_TOKEN ?? ""))
```

| Suite | Sur le mutant |
|---|---|
| `requireSalt.test.ts` (19 témoins, de forme) | **19 VERTS** — le mutant passe inaperçu, même angle mort qu'en 216 |
| `secret-authority-separation.test.ts` (16 témoins) | **8 ROUGES** / 8 verts — attrapé |

Les 8 rouges se répartissent **symétriquement sur les deux familles**, ce qui était la demande :

```
× intake  — ipHash ET userAgentHash == HMAC-SHA256(clé = INTAKE_HASH_SALT, valeur)
× intake  — ADMIN_TOKEN A, puis B, puis ABSENT ⇒ hachages IDENTIQUES les trois fois
× retail  — hashIp(ip) == HMAC-SHA256(clé = OSINT_RETAIL_IP_SALT, ip)
× retail  — ADMIN_TOKEN A, puis B, puis ABSENT ⇒ empreintes IDENTIQUES les trois fois
× retail  — ADMIN_TOKEN n'est JAMAIS lu pendant le hachage
× intake  — ADMIN_TOKEN n'est JAMAIS lu pendant le traitement de la requête
× source  — retail/ipHash.ts : ADMIN_TOKEN absent du CODE
× source  — admin/intake/route.ts : ADMIN_TOKEN absent du CODE
```

Les deux fichiers ont été restaurés et l'identité vérifiée octet à octet (`diff` vide) avant la suite des
travaux ; les 16 témoins sont repassés verts après restauration.

### Un piège de configuration, mesuré au passage

`vitest.config.ts` pose ses sels dans `test.env`. **Ce bloc écrase la valeur exportée par le shell** —
vérifié en exportant `VAULT_AUDIT_SALT="valeur-venue-du-shell"` : le test a vu la valeur du fichier.

Conséquence : `OSINT_RETAIL_IP_SALT` et `INTAKE_HASH_SALT` **ne doivent pas** y être posés, sinon le témoin
de continuité rejoué par le fondateur comparerait deux constantes de test et rendrait un verdict qui ne
porte sur rien. La raison est inscrite en tête de `ip-salt-continuity.test.ts` — le fichier qu'elle protège —
et non dans `vitest.config.ts`, qui est **gelé par le guard** : y écrire un commentaire aurait élargi d'un
chemin la lease à faire autoriser, pour un gain purement narratif.

---

## E — Re-vérification du zéro

Prémisse de toute la décision, re-mesurée **après** les travaux, en lecture seule, sur `neondb`
(production). Les quatre colonnes ont d'abord été confirmées présentes dans `information_schema` : un `0`
ci-dessous est une table vide, **jamais une colonne absente**.

| Table · colonne | Lignes portant un hachage |
|---|---|
| `OsintSubmission.submitter` | **0** *(table : 0 ligne)* |
| `EvidenceItem.submittedBy` | **0** *(sur 1 107 pièces, toutes NULL)* |
| `IntakeRecord.ipHash` | **0** *(table : 0 ligne)* |
| `IntakeRecord.userAgentHash` | **0** |

```sql
-- lecture seule, reproductible
select count(*) from "OsintSubmission" where "submitter"     is not null and "submitter"     <> '';
select count(*) from "EvidenceItem"    where "submittedBy"   is not null and "submittedBy"   <> '';
select count(*) from "IntakeRecord"    where "ipHash"        is not null and "ipHash"        <> '';
select count(*) from "IntakeRecord"    where "userAgentHash" is not null and "userAgentHash" <> '';
```

**`ZERO_HISTORICAL_ROWS_AT_ROTATION` : toujours vraie.** Identique à la mesure de CC-OFFLINE-216.
La rupture de continuité est donc autorisée, et **ce n'est pas une migration** — il n'y a rien à migrer.
Aucune DDL, aucune écriture, aucun backfill n'est prévu ni nécessaire.

### Les cinq lignes 64-hex — backlog, `CAUSE_UNRESOLVED`

`beta_audit_logs.ipHash` (4) et `beta_nda_acceptances.ipHash` (1) portent des hachages de 64 caractères
hexadécimaux. Ces tables n'ont **aucun écrivain dans le dépôt**, ni dans l'historique git. Leur sel d'origine
est indéterminé.

**Non investiguées, non modifiées, non re-hachées** — conformément à l'arbitrage : les investiguer
retarderait la révocation d'un credential dont la compromission et la validité sont établies, à cause de
cinq lignes dont le lien avec ce credential ne l'est pas. Elles sont documentées, c'est tout. Une rotation
ne peut pas les re-cléer — rien ne les écrit.

---

## F — PROCÉDURE DU FONDATEUR

**À exécuter par toi seul, après le merge.** Aucune valeur ne doit m'être montrée, ni collée dans une
conversation, ni écrite dans un fichier de travail. Je n'ai généré aucun sel : c'est ta manipulation.

### Ce que tu vas faire, en une phrase

Créer **deux** secrets aléatoires tout neufs, les poser à **deux** endroits chacun (ton Mac et Vercel),
puis lancer une vérification. Tu ne verras jamais les valeurs à l'écran — c'est voulu.

### ⚠️ Lis ceci AVANT de lancer la vérification

**Le résultat attendu est un ÉCHEC : `2 failed`.** Ce n'est pas une panne.

Le test pose une question factuelle : *« ce nouveau sel produit-il les mêmes empreintes que l'ancien
jeton ? »*. La bonne réponse est **non**. C'est tout l'objet de l'opération : le nouveau sel ne doit **pas**
être le jeton compromis. Les deux lignes qui échouent portent d'ailleurs l'étiquette `ROUGE ATTENDU`.

Un `4 passed` ici serait la mauvaise nouvelle.

---

### Étape 1 — Générer et poser le premier sel

Ouvre le Terminal, va dans le dossier du projet, puis **une ligne à la fois** :

```zsh
cd ~/dev/interligens-web
```

```zsh
openssl rand -hex 32 | tr -d '\n' | pbcopy
```

Rien ne s'affiche : c'est normal. Le secret est maintenant dans ton presse-papiers, et **nulle part
ailleurs**. Il n'est ni à l'écran, ni dans l'historique du Terminal, ni dans un fichier.

Écris-le dans ton fichier d'environnement local :

```zsh
{ printf '\nOSINT_RETAIL_IP_SALT='; pbpaste; printf '\n'; } >> .env.local
```

**Sans fermer le Terminal, va tout de suite dans Vercel** — le presse-papiers contient encore la valeur :

1. Vercel → projet **`interligens-app`** → Settings → Environment Variables
2. **Add New** · Key : `OSINT_RETAIL_IP_SALT` · Value : **Cmd-V** (colle)
3. Coche **Production**, **Preview** et **Development** · **Save**

> Pourquoi les deux endroits : ton Mac fait tourner les tests, Vercel fait tourner le site. Si la variable
> manque d'un côté, ce côté-là **refusera de fonctionner** — c'est le comportement voulu (« fail closed »),
> mais autant ne pas le découvrir en production.

### Étape 2 — Le second sel, exactement pareil

```zsh
openssl rand -hex 32 | tr -d '\n' | pbcopy
```

```zsh
{ printf 'INTAKE_HASH_SALT='; pbpaste; printf '\n'; } >> .env.local
```

Puis dans Vercel, **Add New** · Key : `INTAKE_HASH_SALT` · Value : **Cmd-V** · Production + Preview +
Development · **Save**.

> Deux commandes `openssl` séparées = deux valeurs différentes. C'est exigé : un sel unique partagé entre
> les deux recréerait, entre eux, le couplage qu'on vient de retirer. Un test le vérifie.

Vide le presse-papiers, pour ne pas laisser un secret traîner dedans :

```zsh
printf '' | pbcopy
```

### Étape 3 — La vérification

Trois lignes, **une à la fois**. Les deux premières lisent les sels depuis ton fichier sans les afficher ;
la troisième te demande le jeton actuel, et **ne l'affiche pas non plus** pendant que tu le colles.

```zsh
export OSINT_RETAIL_IP_SALT="$(grep '^OSINT_RETAIL_IP_SALT=' .env.local | tail -1 | cut -d= -f2-)"
```

```zsh
export INTAKE_HASH_SALT="$(grep '^INTAKE_HASH_SALT=' .env.local | tail -1 | cut -d= -f2-)"
```

```zsh
read -s "ADMIN_TOKEN?Colle la valeur ACTUELLE d'ADMIN_TOKEN puis Entree : " && export ADMIN_TOKEN
```

```zsh
npx vitest run __tests__/security/ip-salt-continuity.test.ts
```

### Étape 4 — Lire le résultat

Regarde la dernière ligne, `Tests  …`, et les lignes marquées `×`.

| Ce que tu vois | Ce que ça veut dire | Quoi faire |
|---|---|---|
| **`2 failed \| 2 passed (4)`** et les deux `×` disent **`ROUGE ATTENDU`** | ✅ **C'est le but.** Les deux sels sont neufs, distincts entre eux et distincts du jeton. | Continuer |
| `4 passed (4)` | ❌ Un sel recopie le jeton compromis | Refaire l'étape 1 ou 2 avec un nouveau `openssl` |
| Un `×` dit **`VERT ATTENDU — les deux sels dédiés ne sont pas la même valeur`** | ❌ Tu as posé **deux fois la même valeur** | Regénérer le second sel |
| `3 failed` | ❌ Les deux problèmes à la fois | Regénérer les deux |
| Un ou plusieurs **`skipped`** | ⚠️ Une variable n'a pas été posée — **rien n'a été mesuré** | Reprendre l'étape 3 |

*(Les trois situations d'erreur ci-dessus ont été répétées à blanc avec des valeurs factices : le tableau
décrit ce que le test fait réellement, pas ce qu'il devrait faire.)*

### Étape 5 — Refermer

**Impératif**, pour ne pas laisser les valeurs vivre dans le Terminal :

```zsh
unset ADMIN_TOKEN OSINT_RETAIL_IP_SALT INTAKE_HASH_SALT
```

### Deux mises en garde

- **`vercel env pull` efface `ADMIN_TOKEN`** de `.env.local` (cf. `CLAUDE.md`) et peut faire de même avec ces
  deux sels. Si tu lances un `pull` un jour, **revérifie que les trois lignes sont toujours là**.
- Ce test compare les valeurs présentes **dans ce Terminal**. Il ne peut pas voir ce qui est réellement
  stocké dans Vercel : le report dans l'interface reste un geste manuel, à faire avec soin.

---

## L'ordre ratifié pour la suite — je m'arrête avant la rotation

1. ✅ *(fait)* Séparation en code, témoins, re-vérification du zéro — **ce document**
2. ⬜ **Provisionnement des deux sels** — §F, geste du fondateur
3. ⬜ Témoins causaux rejoués — `npx vitest run __tests__/security/`
4. ⬜ Vérification que **0 ligne** est toujours vrai — requêtes du §E
5. ⬜ **SEULEMENT ALORS** : rotation d'`ADMIN_TOKEN`
6. ⬜ Smoke `auth` / `admin`

**NO PROD DEPLOY jusqu'à fermeture de la rotation.** La frontière est absolue : ces deux sites sont
désormais *fail closed*, un déploiement gouverné avant le provisionnement Vercel ferait échouer
`POST /api/osint/submit` et `POST /api/admin/intake`.

---

## Fichiers

| Chemin | Nature |
|---|---|
| `src/lib/osint/retail/ipHash.ts` | repli vers `ADMIN_TOKEN` supprimé, fail closed |
| `src/app/api/admin/intake/route.ts` | sel dédié `INTAKE_HASH_SALT`, fail closed |
| `__tests__/security/secret-authority-separation.test.ts` | **nouveau** — 16 témoins causaux, deux familles |
| `__tests__/security/ip-salt-continuity.test.ts` | réécrit — témoin du fondateur, verdict renversé |
| `__tests__/security/requireSalt.test.ts` | témoins du repli remplacés par des témoins de fail-closed |
| `docs/prep/ROTATION_INVENTORY_2026-09-15.md` | §4.2 et Étape 0 point 2 marqués ⛔ périmés |
| `docs/prep/SEPARATION_AUTORITES_SECRET_2026-09-15.md` | ce document |
