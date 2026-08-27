# FIX — l'alerte Veille LLM reflète le modèle, plus le backlog

**Branche** `hotfix/llm-veille-fresh-2026-08-27` · rien mergé · aucun chemin gelé
touché · aucune écriture DB · aucune migration.

## Le défaut

La sonde livrée dans #164 déclenchait le critique sur un **compteur d'items
plantés**. Une heure après la remise en service, 30 items venaient d'être
résumés et le digest affichait encore :

```
🔴 MODÈLE LLM INDISPONIBLE — 217 item(s) de veille en échec MODEL_NOT_FOUND
```

C'est la faute que ce chantier combattait, refaite par le garde-fou lui-même :
affirmer au présent une propriété établie sur des traces passées. Le résidu met
~22 runs à se vider — un run par jour. Pendant trois semaines, un voyant rouge
allumé sur une panne réparée, et la panne SUIVANTE noyée dedans.

## Pourquoi pas « l'état du dernier run »

Cherché avant de choisir. **Il n'existe pas** :

| Piste | Verdict |
|---|---|
| Colonne de mise à jour sur `FounderIntelItem` | Aucune. `publishedAt` / `fetchedAt` datent l'article. |
| Horodatage dans `lastSummaryError` | Absent — le champ ne porte que le motif. |
| Table `JobRunLog` | Existe, mais `intel-summarize` n'y écrit rien : seuls `watcher_bridge_promote` et `watcher_v2_scan` y figurent. |
| Tête de file du cron | `starRating desc, publishedAt desc` : le résidu OCCUPE la tête, exactement là où sont les items du dernier run. Indiscernables. |

Faire écrire le cron dans `JobRunLog` réglerait la question — mais c'est un
chemin gelé (`^src/app/api/`) et de nouvelles écritures. Ça demande ton
arbitrage, pas le mien.

## Ce qui est fait

On mesure la propriété qu'on affirme : **un appel de contrôle au modèle
épinglé**, `max_tokens: 1`, aucun contenu d'article, ~0,00002 $ par run.
L'identifiant est lu à la source (`ANTHROPIC_MODEL` exporté de
`llm.service.ts`) et non recopié — une copie dériverait au premier changement
de modèle et certifierait un modèle que la prod n'utilise plus.

Le verdict de panne est **avare** : seul un refus explicite l'ouvre.

| Réponse | Verdict | Effet |
|---|---|---|
| 2xx | `ok` | pas de critique |
| 404, ou 400 nommant le modèle | `model_off` | **🔴 crit** |
| 401 / 403 (clé) | `unmeasured` | ⚠️ warn |
| 429 (quota), 5xx, coupure réseau | `unmeasured` | ⚠️ warn |
| clé absente, `WATCHDOG_NO_LLM_PROBE=1` | `unmeasured` | ⚠️ warn |

`unmeasured` n'est pas un demi-vert : c'est l'aveu qu'on ne sait pas, et il sort
sur le digest. Une clé expirée affichée comme « modèle indisponible » enverrait
corriger le mauvais fichier.

Le compteur de backlog **reste affiché** et ne déclenche plus rien de critique.

## Preuve — appel réel, résidu identique dans les deux cas

```
── claude-sonnet-4-5            API HTTP 200   verdict ok         etat partial  🔴 non
── claude-sonnet-4-20250514     API HTTP 404   verdict model_off  etat FAILED   🔴 OUI
```

Compteurs figés à `217 modelOff` de part et d'autre : seul l'état réel du
modèle décide. Digest en dry-run contre la prod :

```
⚠️ Veille LLM — le modèle répond, mais 217 item(s) portent encore l'échec
   MODEL_NOT_FOUND de l'incident du 2026-08-27. Résidu à drainer, pas une
   panne : ~22 run(s) de cron.
• Veille LLM : partial — modèle OK (claude-sonnet-4-5) · 6371 en attente,
  590 résumés, 218 en erreur (217 MODEL_NOT_FOUND résiduels), 86 abandonné(s)
```

## Validation

`tsc` 0 erreur · **320 fichiers / 3679 tests verts** · eslint 0 erreur ·
guard ✅ (aucun chemin interdit).

31 tests sur la sonde (19 avant). Mutation vérifiée : rebrancher le critique sur
`modelOff > 0` fait tomber **3 tests**.

## Reste ouvert

Le backlog n'est pas drainable — 6371 en attente, `BATCH = 10`, `30 7 * * *`,
soit 637 jours. Sans rapport avec ce correctif ; l'incident le masquait.
