# Style Guide — INTERLIGENS Research

**Version** : 1.0
**Date** : 2026-05-24
**Owner** : David Douville
**Audience** : David Douville (auteur principal), Alexandra (co-éditrice), futurs contributeurs internes (rédacteurs, juristes, chercheurs), agents IA assistant à la rédaction (CC, GPT, autres LLM intégrés au workflow).

---

## 1. Objectif

Ce style guide existe pour quatre raisons qui sont à pondérer ensemble à chaque décision rédactionnelle :

1. **Qualité éditoriale.** Le corpus pédagogique INTERLIGENS s'adresse à des enquêteurs, des cabinets juridiques et des journalistes professionnels. Le standard de précision, de cohérence terminologique et de lisibilité doit refléter ce niveau d'audience.
2. **Anti-fuite.** Le corpus public est lu par des opérateurs adverses (KOL profilés, équipes de communication de projets ciblés, observateurs malveillants). Toute fuite méthodologique — seuil, pondération, mécanisme — réduit la valeur opérationnelle de la beta. Le corpus enseigne sans révéler le manuel d'opération.
3. **Exposition juridique.** Le corpus est, par construction, exposé à un risque diffamatoire et à un risque d'usage commercial non autorisé. Le wording, les exemples et les attributions doivent rester défendables en l'état devant un avocat de partie adverse.
4. **Crédibilité institutionnelle.** Le corpus est le premier vecteur public de l'identité éditoriale INTERLIGENS. Une approximation, une accusation directe, ou un emprunt non sourcé érode durablement la crédibilité de la marque.

---

## 2. Règle d'or

> **Précision sans méthodologie. Pédagogie sans manuel d'opération.**

Le lecteur doit comprendre la grammaire d'une fraude crypto sans pouvoir la reproduire pas-à-pas, et sans pouvoir reconstruire le moteur interne de la plateforme à partir du texte.

---

## 3. Wording interdits

Trois catégories de wording sont à proscrire systématiquement. Chaque catégorie a son propre mode de remplacement.

### 3.1 Catégorie A — Accusation directe

**Interdit** :

- « scammer » (et ses dérivés : scam artist, scammers' network, etc.)
- « fraudster »
- « stolen by [nom] »
- « X is a fraud / is fraudulent »
- « X a volé / a escroqué »
- toute formulation qui présente comme acquis un fait que seule une autorité compétente peut établir.

**Remplacement** :

- « risque critique documenté »
- « observed risk indicators » / « indicateurs de risque observés »
- « éléments factuels suggérant »
- « activity consistent with a [typologie] pattern » / « activité cohérente avec un schéma de [typologie] »
- Pour les personnes physiques nommées (KOL, opérateurs de projets) : utiliser le persona/handle, jamais une attribution de responsabilité non jugée.

**Justification** : la qualification de fraude relève d'une autorité judiciaire. Toute substitution par l'auteur expose à la poursuite pour diffamation. La formulation « risque critique documenté » documente un faisceau d'indicateurs sans présumer la culpabilité.

### 3.2 Catégorie B — Méthodologie technique

**Interdit** :

- Tout seuil chiffré de scoring (« si X > 0.7 »).
- Toute pondération explicite ou paramètre algorithmique (« weight = 0.45 », « confidence factor de Y »).
- Toute description architecturale (« la plateforme stocke dans [tech] », « le pipeline ingère via [provider] »).
- Toute mention d'un provider d'infrastructure spécifique (DB, hébergeur, CDN, stockage objet, RPC nodes).
- Tout script reproductible permettant l'agression d'une chaîne ou d'un signal.
- Toute mention de techniques d'anonymisation côté adversaire (mixers nommés, protocoles d'obfuscation par leur nom commercial).

**Remplacement** :

- Formulations génériques : « la plateforme agrège des signaux observés sur la chaîne et hors chaîne », « un score synthétique de risque est calculé en interne ».
- Référence fonctionnelle, pas architecturale : « signal on-chain », « signal off-chain », « signal d'écosystème ».
- Mention des techniques d'anonymisation côté adversaire : par catégorie générique (« outil d'obfuscation de flux ») et non par nom.

**Justification** : la valeur opérationnelle de la beta dépend de ce que les opérateurs adverses ne savent pas. Un seuil publié devient un seuil à éviter ; une architecture publiée devient une surface à attaquer ; un mixer nommé devient un appel à le promouvoir.

### 3.3 Catégorie C — Mentions à éviter

**Interdit** :

- **Outils d'obfuscation par leur nom commercial** : pas de mention nominative d'outils ou cryptomonnaies dont la fonction est principalement la confidentialité renforcée ou l'obfuscation de flux. Ces mentions valent en pratique publicité et sortent du cadre pédagogique.
- **Plateformes commerciales adverses** : éviter de nommer des plateformes commerciales (exchanges, launchpads, agrégateurs) sauf citation académique encadrée ou citation contextuelle d'un casefile publié dans la presse.
- **Adresses wallets** : aucune adresse on-chain en clair dans le corpus public, sauf si l'adresse figure déjà dans un casefile publié ou dans une décision de justice publique.
- **Noms de personnes physiques** : aucun nom propre de personne physique sauf décision de justice publique (jugement, condamnation, sanction OFAC ou équivalent juridictionnel). Les KOL sont désignés par leur persona/handle.

**Justification** : ces mentions augmentent l'exposition juridique sans valeur pédagogique compensatoire. Le lecteur comprend mieux le mécanisme générique qu'un cas nominatif qu'il ne peut pas vérifier indépendamment.

---

## 4. Structure obligatoire

Chaque document public du corpus doit comporter, dans l'ordre :

### 4.1 YAML frontmatter

```yaml
---
title: "..."
authors: ["INTERLIGENS Research"]
version: "X.Y"
date: "YYYY-MM-DD"
status: "public-draft" | "public-final" | "internal-draft" | "internal-light"
classification: "PUBLIC — CC BY-NC 4.0" | "INTERNE — NDA REQUIS" | "CONFIDENTIEL — NDA REQUIS"
license: "CC BY-NC 4.0" | "PROPRIÉTAIRE — DIFFUSION INTERDITE"
audience: [...]
abstract: "..."
---
```

### 4.2 Disclaimer en tête

Un disclaimer court (3-6 lignes) précise :

- Le caractère pédagogique (non une consultation juridique ou financière).
- La nature anonymisée et/ou composite des cas évoqués (le cas échéant).
- La licence applicable.
- Le cadre de mise à jour (versionné, prochaine révision attendue).

### 4.3 Licence

La licence est rappelée en pied de document, avec un lien vers le texte complet (CC BY-NC 4.0 pour les publics) ou la mention « PROPRIÉTAIRE — DIFFUSION INTERDITE » pour les internes.

---

## 5. Encadrés de sécurité

### 5.1 Règle de fusion (pas d'empilement)

Un encadré de sécurité par section au maximum. **Pas d'empilement** de multiples encadrés ⚠️ dans une même section ou un même paragraphe. Si plusieurs avertissements s'imposent, ils sont fusionnés dans un encadré unique qui couvre toutes les intentions.

### 5.2 Format standard

```markdown
> ⚠️ **[Intention principale].** [Description précise, factuelle, sans dramatisation].
```

Exemples :

```markdown
> ⚠️ **Document pédagogique.** Ce texte ne constitue ni une consultation juridique ni un conseil financier ; il décrit des mécanismes observés à des fins d'apprentissage.

> ⚠️ **Cas studies composites.** Les cas présentés sont délibérément composites et fictionnalisés ; toute ressemblance avec un projet ou un opérateur réel serait fortuite.
```

### 5.3 Couleurs / icônes

Le rendu Markdown standard est respecté (⚠️ et `>` pour blockquote). Aucun composant custom React ou HTML inline. Le corpus doit rester portable hors plateforme.

---

## 6. Citation et plagiat

### 6.1 Verbatim

- **Longueur maximale** : 30 mots par citation verbatim.
- **Attribution** : nom de l'auteur (ou du média), titre du document, date, URL si disponible — en pied de section ou en note de bas de page.
- **Cadrage** : la citation doit servir un point pédagogique, non remplir un manque.

### 6.2 Paraphrase

- **Critère minimal** : au moins **50 % des mots changés** par rapport à la source.
- **Reformulation structurelle** : la structure de phrase doit être substantiellement différente (pas seulement les synonymes).
- **Attribution** : même règle que pour le verbatim, dès lors que l'idée est tracée.

### 6.3 Source non identifiable

Si une idée ou un mécanisme est trop répandu dans la littérature pour avoir une source unique (par exemple, la définition générique d'un rugpull), la mention de source n'est pas requise. En cas de doute, on cite.

---

## 7. Définitions minimalistes (règle GPT v2 mai 2026)

Lorsqu'une définition technique risque d'exposer un détail architectural ou méthodologique sensible, la règle est : **remplacer par une version minimaliste non-architecturale**, plutôt que de supprimer entièrement la définition.

**Exemple** :

- **Trop révélateur** : « Evidence Snapshot : capture horodatée stockée sur [provider X] dans un bucket immuable avec hash SHA-256 et tag temporel ISO 8601. »
- **Acceptable** : « Evidence Snapshot : capture interne, horodatée et identifiée, d'un état d'observation. »

Le lecteur comprend la fonction (capture horodatée identifiée) sans accéder à la mécanique (stockage, hashing, format).

Cette règle s'applique à : Evidence Snapshot, TigerScore, IOC Export, KOL profile aggregation, et tout autre élément dont la fonction publique se distingue de la mécanique interne.

---

## 8. Cas studies fictifs / composites

### 8.1 Phrase d'avertissement explicite

Tout case study fictif ou composite doit porter dans son **premier paragraphe** une phrase explicite du type :

> Ce cas est délibérément composite et fictionnalisé. Toute ressemblance avec un projet, un opérateur ou une victime réels serait fortuite.

Cette phrase est non-négociable. Elle protège juridiquement et clarifie l'intention pédagogique pour le lecteur.

### 8.2 Vérification réseau obligatoire avant publication

Avant de publier un case study fictif, l'auteur vérifie qu'aucun élément distinctif (nom de projet inventé, ticker, slogan, KOL fictif, dates précises) ne correspond accidentellement à une entité réelle.

**Procédure de vérification** :

1. **X (ex-Twitter)** : recherche du nom de projet et du ticker.
2. **Google** : recherche du nom de projet entre guillemets, recherche du ticker entre guillemets.
3. **CoinGecko** : recherche du ticker.
4. **CoinMarketCap** : recherche du ticker.

Si **une seule** de ces recherches retourne un résultat correspondant, le nom ou le ticker est changé avant publication. La vérification est documentée dans une note privée associée au case study.

### 8.3 Personae fictifs

Les KOL fictifs dans les case studies portent des handles inventés (par exemple `@trader_atlas_x`) suffisamment génériques pour ne pas correspondre à un compte réel. La vérification §8.2 s'applique aussi aux handles.

---

## 9. Versioning

### 9.1 Numérotation

- **v1.0** : production-ready, première publication.
- **v1.X** (1.1, 1.2…) : patches mineurs (corrections, ajouts mineurs, mises à jour terminologiques).
- **v2.0** : refonte significative (nouveau périmètre, réorganisation structurelle, changement de format).

### 9.2 Historique

Chaque document maintient en annexe un **historique de version** indiquant la date et la nature du changement de chaque version. Ne pas supprimer les anciennes entrées : l'historique reflète l'évolution.

### 9.3 Date de version

La date du frontmatter et la date de l'historique de version doivent toujours coïncider. À chaque modification substantielle, la date est mise à jour et une nouvelle entrée d'historique est ajoutée.

---

## 10. Workflow de validation

Tout document du corpus suit, avant publication, le pipeline suivant :

1. **Rédaction** par l'auteur (David Douville, Alexandra, ou contributeur invité).
2. **Audit GPT** (revue éditoriale automatisée par un LLM senior, focus wording, structure, anti-fuite, plagiat).
3. **Review David Douville** (revue humaine, focus exposition juridique, alignement marque, cohérence corpus).
4. **Vérification réseau si fictif** (procédure §8.2).
5. **Tests verts** : `npm run test` (2247/2247) sans régression.
6. **Guard offline vert** : `bash scripts/guard-offline.sh` sans violation de chemin interdit.
7. **TypeScript clean** : `npm run typecheck` 0 erreur.
8. **PR Draft** sur GitHub avec la checklist OFFLINE MODE complète (voir `CLAUDE.offline.md`).
9. **Merge** par David Douville uniquement, sur main, via squash merge.

Aucune étape n'est sautable. La régularité du pipeline est la garantie de la qualité.

---

## 11. Contact

- **Owner** : David Douville
- **Contact éditorial** : `research@interligens.com`
- **Questions sur ce style guide** : `research@interligens.com` (objet : « Style Guide INTERLIGENS Research »).

---

## 12. Historique de version

- **V1.0** — 24 mai 2026. Première version du style guide. Couvre les wording interdits, la structure obligatoire, les encadrés de sécurité, la citation, les définitions minimalistes, les case studies fictifs, le versioning et le workflow de validation. À mettre à jour à la prochaine évolution significative des règles éditoriales du corpus.
