# CRON_SECRET — INVALIDATION SERVIE SUR LE RUNTIME CANONIQUE

**2026-09-16 · CC-OFFLINE-226 · fenêtre close · déploiement gouverné exécuté**

Suite de `ROTATION_CRON_SECRET_2026-09-15.md` (CC-OFFLINE-222), qui avait établi que le runtime
canonique servi ne consomme pas la nouvelle configuration sans déploiement, et s'était fermée sur
`SERVED_INVALIDATION_PENDING` sans rien révoquer.

**État final :**

```
CRON_SECRET = CLOSED_ON_CANONICAL_SERVED_RUNTIME
              ALL HELD PRE-ROTATION CANDIDATES REFUSED
```

Pas « CLOSED ». Les 91 runtimes Production historiques restent hors périmètre et continuent
d'accepter ce qu'ils portent.

---

## 1. CE QUE CETTE FENÊTRE ÉTABLIT, ET CE QU'ELLE N'AFFIRME PAS

Elle n'identifie **pas** laquelle des anciennes valeurs détenues était la valeur historiquement
exposée. Elle n'en a pas besoin, et l'affirmer serait une assertion que rien n'appuie.

Elle établit une propriété plus simple et entièrement mesurée : **aucun des exemplaires détenus
avant rotation n'ouvre la porte sur le nouveau canonical.** Toutes refusées, la nouvelle acceptée.

---

## 2. QUATRE EXEMPLAIRES, QUATRE VALEURS DISTINCTES

Relevé par empreinte HMAC-SHA256 salée par un nonce de session (primitives de
`cartographie-vercel.mjs`, CC-OFFLINE-215). Aucune valeur n'a été lue, affichée ni écrite.

```
.env.local              #30c14c6a5bda
.env                    #7c72a16aa82e
Trousseau …-ancien      #7aced92dcf0b
Trousseau …-prod (new)  #771fe2ec136c
```

Quatre empreintes, quatre valeurs. `.env.local` et le Trousseau « ancien » : `NO_MATCH`.

### REPOSE_IS_NOT_RESTORATION

C'est le constat méthodologique de cette fenêtre, ratifié, **à consigner et à ne transformer en
aucun chantier.**

Le 15/09, la discrimination `--avant` avait désigné `.env.local` comme l'exemplaire **servi** — il
rendait 200 là où `.env` rendait 401. À 17:12 UTC, la « repose de l'ancienne valeur » a été faite
depuis le Trousseau « ancien ». Ce matin, `.env.local` est **refusé** et le Trousseau « ancien » est
**accepté**, alors que `.env.local` n'a pas bougé (mtime inchangé, 15:06 UTC le 15/09).

> **Reposer n'est pas restaurer.** Une repose rétablit *une* valeur, pas nécessairement *les octets*
> qui étaient configurés avant. Tant que la vérification porte sur le geste (« j'ai reposé
> l'ancienne ») et non sur le service (« le runtime accepte-t-il ce que j'ai reposé ? »), la
> différence est invisible. Ici elle n'a rien cassé — les crons ont passé toute la nuit — mais elle a
> silencieusement changé ce que « l'ancienne valeur » désignait.

Conséquence assumée par le ruling : on ne cherche pas laquelle était l'exposée, **on les refuse
toutes**.

---

## 3. LIGNE DE BASE — CINQ JAMBES, AVANT TOUTE ÉCRITURE

Contre `dpl_EUm7cRyEP6TpggzLadPG6veh3cvK`, le canonical alors servi.

| Jambe | Verdict |
|---|---|
| NO CREDENTIAL | REFUSED (401) |
| OLD `.env.local` | REFUSED (401) |
| OLD `.env` | REFUSED (401) |
| **OLD Trousseau** | **ACCEPTED (200)** · `created=0 alreadyPresent=7` |
| NEW | REFUSED (401) |

**Exactement une valeur servie** — pas de contradiction, et l'instrument démontre qu'il sait
**réussir** autant qu'**échouer** sur ces entrées. Sans cela, `OLD → REFUSED` après déploiement ne
prouverait rien : une entrée mal résolue rend exactement le même verdict.

Le premier essai de ligne de base a d'ailleurs **échoué** — `OLD .env.local → REFUSED` — et c'est ce
qui a fait remonter `REPOSE_IS_NOT_RESTORATION`. La cause « cible non gardée » a été écartée deux
fois : `NO CREDENTIAL` rend 401, et **13 passages horaires consécutifs à 200** figuraient au plan de
contrôle, de 19:00:35 UTC le 15/09 à 07:00:35 UTC le 16/09. Le garde tournait et s'ouvrait ; c'est
l'entrée qui était mal résolue. Seule l'**entrée** a été corrigée, jamais l'instrument.

---

## 4. LA CIBLE, ET SON AUTORITÉ

```
https://app.interligens.com/api/cron/shill-feed
```

**Il n'existe aucun chemin sans effet de bord pour ce garde, et c'est structurel.** Contrairement à
`/api/admin`, gardé par un **préfixe** dans `src/proxy.ts` — ce qui permettait de viser un chemin sans
gestionnaire —, l'authentification CRON est une copie locale de `verifyCronSecret` **à l'intérieur de
chaque handler**. Un `/api/cron/<inexistant>` rendrait 404 avec ou sans credential : aucune
discrimination. Mesurer ce garde impose d'invoquer un handler.

`shill-feed` est le moins coûteux et le seul déjà mesuré : Helius-free, **idempotent par la base** —
watermark dérivé jamais stocké, recouvrement de 30 minutes assumé, `@@unique(kolHandle, tweetId,
tokenMint)` + `skipDuplicates`. Les huit exécutions de cette fenêtre l'ont **constaté** plutôt que
supposé : `created=0` à chaque fois. Aucune ligne n'a été écrite par ces mesures.

Autorité, et non grep : la route n'a pas changé depuis `f1d9a30`, bien avant la mesure de référence ;
la jambe `NO CREDENTIAL` exige un 401 sous peine de sonde nulle ; et le cron de `07:00:35 UTC` a
rendu 200 sur ce chemin onze minutes avant la ligne de base.

### Règles d'interprétation, ratifiées

401 est le **seul** refus d'authentification admissible. 3xx et 5xx sont **inconclusifs** — sur cette
route un 500 vient de l'invariant snowflake ou de la base, jamais d'un secret absent, qui rend 401.
Un **403 est une ACCEPTATION** : `prodWriteGuardResponse` s'exécute *après* `verifyCronSecret`.

---

## 5. L'ÉCRITURE ET LE DÉPLOIEMENT — UNE OPÉRATION INDIVISIBLE

La séquence `CONFIGURED = NEW / SERVED = OLD` ne devait traverser aucune pause : les 18 crons y
seraient exposés à un 401 continu. Le repli n'aurait pas été une commande mais **un second
déploiement**.

L'écriture a été faite par le fondateur en **une seule commande**,
`vercel env add --force --no-sensitive --yes`, valeur lue du Trousseau sur stdin — jamais par argv,
jamais à l'écran. `--force` remplace l'enregistrement **en place** : `rm` puis `add` aurait laissé une
fenêtre où `CRON_SECRET` est **absent** de la configuration, c'est-à-dire exactement l'instant de
risque que la fenêtre existe pour éviter. `--no-sensitive` préserve le type `Config` — une bascule
vers `Secret` aurait été « un autre changement ».

```
✓ Overrode CRON_SECRET · Project interligens-app · Environments Production · Type Config
```

### Le déploiement

| | |
|---|---|
| `deploymentId` | `dpl_EbExMWr9aU2jYJyNhPjky9RFNhZG` |
| `commit` | `2f5d9b059ea506a80b819332d10813f85bfebcce` (`main`) |
| `source` | **`cli`** |
| `readyState` | `READY` · `target: production` |

Commande : **`pnpm deploy:prod`**, le chemin gouverné — preflight en quatre portes, puis exécution du
**binaire que le preflight vient de certifier**, par chemin absolu et sans re-résolution de nom.
Mesuré avant de partir, en appelant `resolveDeployCommand()` : `51.7.0`, installation globale,
`…/vercel/dist/vc.js`, qui se déclare *Vercel CLI 51.7.0*.

### Le contrat d'upload

```
racine certifiée ≡ racine réelle : ce9d0fc81e50c7c6…   VRAI
delta ⊆ { public/.well-known/source-set.json }         VRAI
fichiers .env* téléversés                              AUCUN
```

Le marqueur est régénéré à chaque déploiement, son sha1 change par construction ; il est exclu de la
racine (`excludesSelf`). `meta.gitDirty = 1` porte sur les 63 fichiers **non suivis** du répertoire —
ce n'est pas un fait d'upload-set, la porte 4 ayant établi `upload-set ≡ HEAD filtré`. Relevé, pas un
arrêt.

La racine diffère de celle du canonical précédent (`a88fc71d…`) : `sonde-admin-basic.mjs` est entrée
légitimement dans le bundle la veille. La comparaison porte sur **certifié ↔ upload réel**, pas sur
l'identité au déploiement précédent.

---

## 6. LA PREUVE — CINQ JAMBES, MÊME INSTRUMENT, MÊMES ENTRÉES, MÊME CIBLE

Contre `dpl_EbExMWr9aU2jYJyNhPjky9RFNhZG`, à `07:23 UTC`.

| Jambe | Ligne de base | Preuve |
|---|---|---|
| NO CREDENTIAL | REFUSED (401) | REFUSED (401) |
| OLD `.env.local` | REFUSED (401) | REFUSED (401) |
| OLD `.env` | REFUSED (401) | REFUSED (401) |
| **OLD Trousseau** | **ACCEPTED (200)** | **REFUSED (401)** |
| **NEW** | **REFUSED (401)** | **ACCEPTED (200)** · `created=0 alreadyPresent=7` |

**L'autorité est la comparaison, pas la seconde mesure isolée.** Les deux jambes qui devaient
s'inverser s'inversent ; les trois qui devaient rester refusées le restent.

---

## 7. NON-RÉGRESSION — LE CRON DE RÉFÉRENCE

Vocabulaire de preuve : la **ligne de requête**, jamais la ligne de journal applicative —
`shill-feed` n'émet aucun `console.*` et une capture de flux y est structurellement aveugle.

Passage de `08:00:35 UTC`, premier après le déploiement : **VERIFIED_HEALTHY**.

```
08:00:35.29  interligens-89d4rdxeu-…vercel.app   GET /api/cron/shill-feed   200
```

L'hôte est l'**URL générée du nouveau canonical** — l'ordonnanceur a suivi la promotion, et le
runtime qui refuse désormais les trois anciennes valeurs accepte celle que l'ordonnanceur présente.
Les 18 crons empruntent le même mécanisme, le même hôte et la même forme d'authentification : ce
passage vaut pour eux, sans que chacun ait été mesuré.

Cette observation n'apporte **rien** sur `CRON_SCHEDULER_SECRET_SOURCE` : configuration courante et
instantané figé portent désormais la même valeur, et les deux hypothèses prédisent le même 200.

Le « avant » est solide : 13 passages horaires consécutifs à 200 la nuit précédente, plus les huit
relevés le 15/09.

---

## 8. CE QUE CETTE MESURE N'ÉTABLIT PAS

1. **Rien sur les 91 runtimes Production historiques.** Hors périmètre, et ils ne sont la cible
   d'aucun cron. `KNOWN P0 RESIDUAL / OPEN / DOCUMENTED`.
2. **Rien sur l'identité de la valeur historiquement exposée.** Voir §1 — la fermeture repose sur le
   refus de **tous** les candidats détenus, pas sur l'identification de l'un d'eux.
3. **Rien sur `CRON_SCHEDULER_SECRET_SOURCE`**, qui reste **UNKNOWN / NOT REQUIRED**. L'observation
   du passage de 18:00:35 le 15/09 — cron à 200 sur un runtime dont l'instantané différait de la
   configuration courante — est **cohérente** avec un environnement figé, mais 48 minutes séparaient
   la pose du passage et un cache d'ordonnanceur non rafraîchi produirait la même observation. Elle
   est conservée comme observation, **pas comme preuve**, et n'a pas été investiguée.
4. **Rien sur le passé.** Elle ne dit pas si une ancienne valeur a été utilisée entre l'exposition et
   maintenant. Cela se lit dans des journaux d'accès, pas dans un code HTTP.
5. **Rien sur l'avenir.** Le verdict est daté.

---

## 9. CLASSÉS — consignés, non instruits

- **`VERCEL_CLI_VERSION_DIVERGENCE`** — `npx` a résolu `59.19.0` pour l'écriture de configuration de
  ce matin : **troisième** version distincte après `59.17.0` la veille, le cache en portant déjà
  trois (`51.7.0`, `59.9.1`, `59.17.0`). La divergence reste **confinée aux invocations `npx` ad
  hoc** : le chemin gouverné exécute le binaire certifié `51.7.0` — mesuré, non supposé — et refuse
  de partir sur toute autre version. Elle s'aggrave à chaque appel. **BACKLOG P1.**
- `REPOSE_IS_NOT_RESTORATION` (§2) — constat méthodologique. **Consigné, aucun chantier.**
- `SONDE_ADMIN_BASIC_NO_BASELINE_MODE`, `DEPLOY_COMMAND_DOCUMENTATION_DRIFT`,
  `ENV_VARIABLE_TYPE_POSTURE`, `DB_CREDENTIAL_FAMILY_WIDER_THAN_TWO` — périmètre inchangé.

---

## 10. L'INSTRUMENT

`scripts/rotation/sonde-cron-bearer.mjs`, **fichier neuf**. La sonde qui avait produit la mesure de
référence du 15/09 n'avait jamais été commitée, et ses entrées étaient codées en dur ; la muter
aurait détruit la correspondance avec cette mesure. Son raisonnement est repris, son fichier reste
intact — la règle qui avait préservé `sonde-basic-auth.mjs`.

Entrées par **chemins de fichiers** ou par **service du Trousseau**, jamais par valeurs. La variante
Trousseau est **préférée** : elle lit en mémoire et évite de matérialiser un secret en clair sur le
disque. Elle modifie le **transport** de l'entrée, pas l'**autorité** de la sonde.

En-tête construit en mémoire — jamais d'argv, donc jamais de table de processus. Corps lu uniquement
sur 2xx, et seuls `created` et `alreadyPresent` en sortent. Nonce distinct par requête. Crible
anti-fuite sur la sortie complète. Garde d'heure refusant de partir entre HH:59 et HH:01 UTC, pour ne
pas mêler une sonde au passage du cron.

**Fail-closed, sept chemins exercés sur des valeurs factices** : variables absentes · `SONDE_ATTENDU`
invalide · cible hors chemin planifié · deux sources OLD · deux sources NEW · fichier vide · ancienne
≡ nouvelle. Les sept refusent de partir.

Limite connue, consignée : la phrase de verdict agrège un design à **candidat unique**. Sur le
protocole à cinq jambes de cette fenêtre, ce sont les **lignes par jambe** qui font autorité, jamais
l'agrégat — une jambe `OLD .env → REFUSED` en ligne de base y apparaît sous un « ⛔ » qui est ici le
résultat **attendu**. L'instrument n'a pas été modifié pour autant : la règle est de ne rien changer
entre ligne de base et preuve.
