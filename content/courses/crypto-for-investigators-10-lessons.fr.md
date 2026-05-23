---
title: "Crypto pour enquêteurs — Un cours en 10 leçons"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs-débutants", "étudiants", "journalistes", "stagiaires-conformité", "chercheurs-autodidactes"]
duration: "Environ 10 heures d'étude, plus la pratique"
prerequisites: "Familiarité de base avec internet et lecture de l'anglais (utile pour les outils). Aucune connaissance crypto préalable requise."
abstract: "Un cours structuré en 10 leçons conçu pour mener un débutant de zéro connaissance crypto à la capacité de lire une enquête on-chain de base. Chaque leçon est autonome, s'appuie sur la précédente, et renvoie systématiquement au corpus INTERLIGENS Research (Dark Patterns Whitepaper, Investigation Checklist, OSINT-Crypto Glossary, Anonymized Case Studies, Anatomy of a Rugpull). Le cours est descriptif et méthodologique, jamais opérationnel à fin offensive."
---

## Préface

Ce cours s'adresse à des lectrices et lecteurs qui n'ont jamais ouvert de wallet, jamais lu un block explorer, et qui s'attendent néanmoins à rencontrer un dossier crypto dans le cadre de leur activité professionnelle ou académique. Les publics visés sont les enquêteurs débutants en cellules d'investigation financière ou en collectifs d'enquête civile ; les étudiants de journalisme, de droit ou de criminologie ; les stagiaires conformité en entité régulée ; et les chercheurs autodidactes qui souhaitent un cadre ordonné plutôt qu'un patchwork de définitions.

Après dix leçons et les exercices proposés, vous devriez être en mesure de lire une transaction sur un block explorer générique et de décrire ce qu'elle fait, de reconnaître les schémas structurels typiques de la fraude crypto retail, de construire un dossier d'enquête de base qu'un journaliste ou un conseil pourrait reprendre, et d'énoncer les limites légales et déontologiques dans lesquelles l'enquête civile opère.

Le cours n'enseigne pas la technique offensive. Chaque exercice vous demande ce que vous chercheriez à *observer* et comment vous *raisonneriez*, jamais comment vous *agiriez* contre une cible. Là où une leçon aborde une zone sensible — manipulation de seed phrase, interaction avec un block explorer, frontières de l'OSINT — les contraintes de sécurité pertinentes sont énoncées dans le corps de texte, répétées dans un encadré marqué, et reprises dans les exercices.

Les leçons sont conçues pour être lues dans l'ordre, chacune mobilisant un vocabulaire posé par la précédente. Une cadence raisonnable est d'une leçon par session d'étude d'environ une heure, en traitant les exercices conceptuels par écrit avant de consulter l'Annexe D.

Le cours est le septième document d'un corpus pédagogique coordonné. La matière taxonomique vit dans le whitepaper *Dark Patterns in Crypto*, la séquence opérationnelle dans le playbook *Investigation Checklist*, le vocabulaire de référence dans le *OSINT, Crypto and Investigation Glossary*, des exemples travaillés dans les *Anonymized Case Studies*, un approfondissement monothématique dans *Anatomy of a Rugpull*. Un manuel procédural interne existe séparément pour les beta-testeurs INTERLIGENS et n'est pas couvert ici.

Deux engagements méthodologiques traversent l'ouvrage. Premièrement, l'attribution est probabiliste ; un enquêteur n'affirme pas ce qu'il ne peut démontrer. Deuxièmement, l'enveloppe légale de l'OSINT et de la prise de parole publique est plus étroite que son enveloppe technique ; ce qu'un lecteur *peut* faire n'est pas ce qu'il *a le droit* de faire.

Ce document est pédagogique. Il ne constitue pas un avis juridique, n'autorise aucune action qui serait illégale, et s'appuie exclusivement sur des sources publiques.

## Comment ce cours est structuré

Chaque leçon suit la même structure interne. Les **Objectifs pédagogiques** énoncent trois à cinq résultats attendus. Les **Pré-requis** listent les leçons antérieures supposées acquises. La section **Contenu** est le corps de la leçon, entre sept cents et treize cents mots. Un encadré **Concepts-clés** liste cinq à huit termes avec renvoi au *OSINT-Crypto Glossary*. Les **Exemples descriptifs** illustrent la leçon sans nommer aucun projet, aucune adresse ni aucune personne réelle ; on utilise des marqueurs génériques tels que *Token X*. Les **Exercices conceptuels** posent trois à cinq questions méthodologiques, dont les réponses figurent en Annexe D. **Pour aller plus loin** renvoie au corpus ; aucun produit commercial n'est nommé, par principe. Un court **Récap** clôt la leçon.

Quatre annexes suivent : un plan de lecture en six semaines (A), des lectures complémentaires (B), un glossaire-éclair (C), et les réponses aux exercices (D).

---

## Leçon 1 — Qu'est-ce qu'une blockchain ?

### Objectifs pédagogiques

- Définir une blockchain en termes qu'un non-spécialiste peut répéter.
- Distinguer une blockchain d'une base de données classique selon trois critères précis.
- Nommer les principales familles de blockchains qu'un enquêteur est susceptible de rencontrer.
- Énoncer la conséquence des registres publics, pseudonymes et immuables pour l'enquête.

### Pré-requis

Aucun.

### Contenu

Une blockchain est un registre distribué et en ajout-seul, maintenu par un réseau d'ordinateurs qui s'accordent sur son contenu via une procédure de consensus définie. Les données sont regroupées en *blocs* ; chaque bloc porte une référence cryptographique au précédent, et modifier un ancien bloc invaliderait tous les blocs suivants. La plupart des blockchains pertinentes pour les dossiers de fraude retail sont *publiques* et *sans permission* : quiconque peut lire le registre, quiconque peut soumettre une transaction sous réserve de payer le frais de réseau.

Le contraste avec une base de données classique est instructif. Une base classique a un propriétaire qui peut éditer ou restaurer ses lignes ; une blockchain publique n'en a pas. Une base classique n'est interrogée que par des parties autorisées ; une blockchain publique peut être lue par quiconque. Une base classique fait confiance à l'opérateur ; une blockchain publique remplace cette confiance par vérification cryptographique et incitations économiques appliquées à de nombreux participants indépendants. C'est pour ces raisons que l'historique on-chain est difficile à falsifier une fois enregistré.

Quelques concepts fondamentaux sous-tendent le tableau. Une *transaction* est une instruction émise par une adresse — transférer de la valeur, appeler une fonction d'un contrat, déployer du code. Un *bloc* est un paquet de transactions accepté comme prochaine entrée du registre. Le *consensus* est la procédure par laquelle des blocs candidats concurrents sont réconciliés en une chaîne canonique unique. Un *nœud* est tout ordinateur exécutant le logiciel de la chaîne.

Trois familles dominent les enquêtes retail. Bitcoin utilise un modèle comptable *UTXO* (unspent-transaction-output). Ethereum et la famille des chaînes *compatibles EVM* — y compris la plupart des L2 — utilisent un modèle de *compte* et supportent un calcul arbitraire via les smart contracts. Solana utilise également un modèle de compte, avec un profil de performance et un outillage distincts. Pour ce cours, la différence entre la famille EVM et Solana importe davantage que n'importe quelle troisième option.

La conséquence pour l'enquêteur est directe. Tout sur une blockchain publique est public : chaque transfert, chaque déploiement, chaque approbation, chaque swap est lisible par quiconque. En même temps, le registre est *pseudonyme* : les adresses ne sont pas des identités. Lier une adresse à une personne, une équipe ou une société requiert une preuve off-chain et reste généralement probabiliste. Actions publiques, acteurs pseudonymes — cette combinaison définit à la fois l'opportunité et la limite de l'enquête on-chain.

Les blockchains sont durables, mais les *interprétations* posées sur leur contenu ne le sont pas. Une étiquette « scam » sur un explorer peut refléter un consensus communautaire solide, une erreur, ou une donnée obsolète. La chaîne enregistre ce qui s'est produit ; ce que l'action *signifiait* est une question sur laquelle l'enquêteur doit raisonner.

### Concepts-clés

- Blockchain (Glossary #16)
- Block height (Glossary #34)
- txhash (Glossary #35)
- Block explorer (Glossary #51)
- Smart contract (Glossary #18)
- EOA (Glossary #17)

### Exemples descriptifs

Une équipe lance un token sur une chaîne compatible EVM. La transaction de déploiement est une entrée unique sur le registre public, récupérable plus tard par son txhash. Des mois après, lorsque les détenteurs retail constatent le silence du projet, la même transaction est toujours sur le registre, à l'identique.

Une autre équipe préfère une chaîne dont l'explorer met moins en avant les transactions internes. L'action est la même ; la surface qu'un observateur retail voit est façonnée par l'explorer, pas par le contenu de la chaîne.

### Exercices conceptuels

1. En une phrase, expliquez à un collègue non-technique la différence pratique entre une blockchain publique et la base de données que sa banque maintient.
2. Un enquêteur déclare : « la chaîne prouve que le fondateur a volé les fonds ». Identifiez ce que la chaîne peut prouver et ce qu'elle ne peut pas.
3. Étant donné que les données on-chain sont permanentes, qu'est-ce que cela signifie pour un dossier d'enquête d'être « périmé » ?

### Pour aller plus loin

- *OSINT-Crypto Glossary* §B (entrées #16 à #20).
- *Investigation Checklist* §4 (On-Chain Identifier Collection), comme orientation.
- *Dark Patterns in Crypto*, Préface — pour comprendre pourquoi les chaînes publiques attirent les schémas que ce cours catalogue.

### Récap

Une blockchain est un registre public en ajout-seul maintenu par des ordinateurs indépendants. Son contenu est durable et lisible par quiconque, mais les acteurs sont pseudonymes. L'enquêteur hérite d'un registre public sans précédent et d'un problème d'attribution durable dans le même mouvement.

---

## Leçon 2 — Wallets, adresses et clés

### Objectifs pédagogiques

- Distinguer une externally owned account (EOA) d'une adresse de smart contract.
- Distinguer wallets custodial, non-custodial, hot et cold en termes fonctionnels.
- Expliquer la relation entre clé privée, seed phrase et adresse.
- Énoncer, sans ambiguïté, la règle qui interdit de demander ou de stocker les secrets d'une victime.

### Pré-requis

Leçon 1.

### Contenu

Un *wallet* est la combinaison d'une application avec laquelle l'utilisateur interagit et des clés cryptographiques qu'elle gère. L'usage courant brouille trois objets distincts : l'*application*, les *clés*, et l'*adresse*. L'enquêteur doit les tenir séparés.

Une *clé privée* est un grand nombre aléatoire dont la possession autorise les transactions depuis une adresse donnée. Une *seed phrase* est un encodage humainement lisible d'une ou plusieurs clés privées, typiquement douze ou vingt-quatre mots tirés d'une liste standardisée. La possession de la seed phrase équivaut fonctionnellement à la possession de chaque clé privée qu'elle encode. Une *clé publique* dérive de la clé privée par une opération à sens unique ; l'*adresse* dérive à son tour de la clé publique. Le flux est asymétrique : facile de la clé privée vers l'adresse, infaisable en sens inverse. Cette asymétrie est le fondement du système.

Les adresses se déclinent en deux types. Une *externally owned account* (EOA) est contrôlée par une clé privée détenue hors de la chaîne ; elle n'agit que lorsque son détenteur signe. Une *adresse de smart contract* est régie par du code déployé ; le contrat agit selon les conditions inscrites en son code. La distinction importe parce que les enquêteurs rencontrent parfois la formule « l'adresse a déplacé les fonds ». Si l'adresse est une EOA, *quelqu'un détenant la clé privée* les a déplacés ; si c'est un contrat, *les règles du contrat* les ont déplacés, éventuellement sans intervention humaine au moment du mouvement. Confondre les deux affaiblit l'attribution.

Les wallets se décrivent selon deux axes. L'axe *custodial* distingue les wallets où un tiers — typiquement une plateforme centralisée — détient les clés, des wallets *non-custodial* où l'utilisateur les détient. L'axe *température* distingue les wallets *chauds*, sur des appareils connectés à internet, des wallets *froids*, hors-ligne. Les utilisateurs réels combinent les variantes.

Ce qu'un enquêteur peut observer diffère selon les combinaisons. Pour un wallet custodial sur plateforme régulée, l'information d'identité repose chez la plateforme et n'est accessible que par les canaux appropriés. Pour un wallet non-custodial, aucun tiers ne détient d'information d'identité ; l'enquête procède par analyse on-chain et OSINT off-chain contre toute surface publique exposée.

> **⚠ Encadré sécurité.** Un enquêteur ne demande jamais à une victime, à un témoin ou à un tiers sa seed phrase, sa clé privée ou tout secret équivalent. Aucune finalité analytique légitime ne requiert un tel matériel ; toute demande est, au mieux, une faute professionnelle, et dans la plupart des juridictions un acte pénal. Un « service de récupération » exigeant ces éléments est le prochain attaquant, pas l'aide. Cette règle ne souffre aucune exception. Le matériel du dossier ne doit pas contenir de seed phrase ni de clé privée, même si une victime en propose volontairement.

La pseudonymie d'une blockchain publique est asymétrique dans le temps. Au moment de l'action, une adresse est anonyme ; au fil du temps, elle peut signer d'autres transactions, interagir avec des services qui détiennent de l'information d'identité, ou se publier elle-même sur les réseaux — chaque interaction est une occasion d'attribution. Les enquêteurs ne brisent pas la pseudonymie par la force ; ils accumulent des observations jusqu'à ce que la pseudonymie cesse de tenir.

### Concepts-clés

- EOA (Glossary #17)
- Smart contract (Glossary #18)
- Wallet (Glossary #21)
- Private key / seed phrase (Glossary #22)
- Pivot (Glossary #4)
- Attribution (Glossary #9)

### Exemples descriptifs

Une victime retail rapporte que « son wallet a été drainé ». À l'examen, l'adresse source est une EOA ; quelqu'un a donc signé la transaction. La question n'est plus *comment la chaîne a déplacé les fonds* mais *comment la signature a été produite*.

Un autre rapport décrit le même résultat mais l'adresse source est un contrat détenant les dépôts de la victime. La chaîne a bien déplacé les fonds, selon les conditions du contrat. L'enquête porte sur le code du contrat, sur qui contrôle ses paramètres, et sur la conformité des conditions exécutées à celles annoncées.

### Exercices conceptuels

1. Une note de dossier indique : « le wallet du fondateur a vidé la trésorerie ». Identifiez l'information manquante qui empêche cette affirmation d'être complète.
2. Listez trois signaux observables qui distinguent un wallet custodial d'un wallet non-custodial du point de vue de l'enquête.
3. Un aidant prétendu propose de « récupérer les fonds perdus » si la victime partage sa seed phrase. Énoncez la réponse correcte en une phrase et expliquez pourquoi.

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #17, #18, #21, #22.
- *Investigation Checklist* §2.2 (Not to do) — la même règle contre la collecte de secrets.
- *Investigation Checklist* §4.1 (Wallet addresses) — le traitement opérationnel.

### Récap

Un wallet est une application plus des clés plus des adresses. Les clés privées et seed phrases sont des secrets dont la possession équivaut au contrôle ; les enquêteurs ne les collectent jamais. Les EOA sont signées par des humains, les contrats s'exécutent par code ; confondre les deux affaiblit l'attribution. La pseudonymie s'érode par observation au fil du temps.

---

## Leçon 3 — Tokens : ERC-20, SPL et NFT

### Objectifs pédagogiques

- Distinguer un actif natif d'un token.
- Reconnaître les principaux standards de tokens rencontrés en enquête retail.
- Identifier, de manière descriptive, les caractéristiques de contrat qui élèvent le risque de fraude.
- Énoncer pourquoi la majorité des fraudes retail passent par des contrats de tokens et non par des actifs natifs.

### Pré-requis

Leçons 1 et 2.

### Contenu

Un *actif natif* est l'unité de valeur que la chaîne sous-jacente comptabilise au niveau du protocole : ETH sur Ethereum, BTC sur Bitcoin, SOL sur Solana. Un *token* est une unité de valeur suivie par un contrat déployé sur la chaîne. Les tokens permettent à une même chaîne d'héberger des milliers d'actifs indépendants — stablecoins, tokens de gouvernance, tokens de projet, collectibles — chacun avec son propre contrat, son offre et son comportement.

Deux familles de standardisation dominent. Sur les chaînes EVM, *ERC-20* définit une interface minimale pour les tokens fongibles : un solde par adresse, une fonction de transfert, et un mécanisme d'*approbation* par lequel un détenteur autorise un tiers à dépenser jusqu'à un montant déclaré. *ERC-721* et *ERC-1155* définissent les interfaces pour NFT et collections mixtes. L'analogue Solana est *SPL*. Les standards sont des échafaudages d'interopérabilité, non des certifications de fiabilité.

Un contrat de token est un smart contract. Comme tout contrat, il exécute le code que son déployeur a écrit. Trois catégories de caractéristiques retiennent l'attention de l'enquêteur.

Premièrement, la *capacité de mint*. Un contrat qui conserve une fonction de mint illimitée, appelable par une adresse propriétaire, peut diluer les détenteurs à tout moment ; une émission importante immédiatement vendue fonctionne comme une sortie aux dépens des détenteurs. Les enquêteurs vérifient si la fonction de mint est renoncée ou restreinte, et si la clé propriétaire est encore active ou transférée vers un wallet multisignature.

Deuxièmement, les *restrictions de transfert*. Listes noires, listes blanches, taxes de transfert variables, fenêtres de cooldown. Chacun est une primitive légitime dans certains contextes et un vecteur de fraude dans d'autres. Les questions pertinentes sont : ces restrictions sont-elles divulguées dans les supports publics ? Étaient-elles présentes au déploiement ou ajoutées plus tard ? S'appliquent-elles de manière asymétrique — les détenteurs peuvent acheter mais ne peuvent vendre ?

Troisièmement, la *propriété et l'upgradability*. Un contrat upgradable dont la clé propriétaire reste active peut être réécrit à tout moment. L'enquêteur vérifie si le contrat utilise un proxy d'upgrade, qui contrôle la clé d'upgrade, et si cette clé a été déplacée vers un multisig ou renoncée.

Ces caractéristiques se projettent sur des archétypes de fraude catalogués ailleurs dans le corpus. Un *honeypot* est un token dont le contrat fait échouer ou taxe punitivement les transactions de vente. Un *approval exploit* abuse d'une approbation que l'utilisateur avait précédemment accordée à un contrat ultérieurement malveillant. Un *token d'imitation* duplique le nom ou la marque d'un projet légitime. Chacun est une caractéristique de contrat, lisible à l'avance.

Dans la fraude crypto retail, le contrat de token est généralement le véhicule proche. Les actifs natifs apparaissent à la frontière, mais l'actif que la victime a acheté, et dont le contrat porte les dispositions malveillantes, est typiquement un token de projet. Un lecteur capable d'identifier trois ou quatre caractéristiques de risque dans un contrat de token dispose du vocabulaire de travail nécessaire pour lire la plupart des dossiers de fraude retail.

Le cours n'enseigne pas, par construction, à *déployer* un tel contrat. Les caractéristiques de risque sont décrites comme des objets que l'enquêteur lit.

### Concepts-clés

- Token / Token contract (Glossary #19)
- ERC-20 / SPL (Glossary #20)
- Honeypot (Glossary #38)
- Approval exploit (Glossary #49)
- Impersonation (Glossary #50)
- Smart contract (Glossary #18)

### Exemples descriptifs

Un contrat de token est déployé avec une transaction publique de *renonciation de propriété* dans les premières heures après le lancement. L'enquêteur peut vérifier sur la chaîne que l'adresse propriétaire a été fixée à l'adresse zéro ; les fonctions privilégiées sont désactivées.

Un autre contrat de token affirme la renonciation sur son site marketing, mais la chaîne montre que l'adresse propriétaire pointe vers un wallet actif. La divergence est elle-même un constat.

### Exercices conceptuels

1. Listez trois caractéristiques de contrat dont la présence élève la probabilité a priori de préjudice pour les détenteurs retail, et pour chacune, l'observation publique qui tranche la question.
2. Un projet annonce que « la propriété a été renoncée ». Identifiez ce qu'un enquêteur vérifierait avant de tenir cette affirmation pour établie.
3. Expliquez en deux phrases pourquoi les flux d'actifs natifs racontent rarement toute l'histoire d'un dossier de fraude retail.

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #19, #20, #38, #49, #50.
- *Anatomy of a Rugpull* §4 (Phase 1 — Preparation), où le contrat de token est l'artefact central.
- *Investigation Checklist* §4.2 (Token contracts).

### Récap

Un token est une entrée dans l'état d'un contrat. Les caractéristiques du contrat — mint, restrictions de transfert, upgradability — sont lisibles, et leur interaction avec les annonces du projet est l'endroit où la plupart des signaux de fraude retail apparaissent en premier. Les actifs natifs sont en périphérie ; le contrat de token est au centre.

---

## Leçon 4 — DEX, AMM et liquidité

### Objectifs pédagogiques

- Distinguer une plateforme centralisée (CEX) d'une plateforme décentralisée (DEX) en termes fonctionnels.
- Décrire l'intuition d'un automated market maker (AMM) sans détail algébrique.
- Définir une liquidity pool, un LP token, et l'acte de « verrouiller » la liquidité.
- Relier chacun de ces éléments à la mécanique d'une fraude par extraction de liquidité.

### Pré-requis

Leçons 1 à 3.

### Contenu

L'échange en crypto se fait sur deux types de plateformes architecturalement distincts. Une *plateforme centralisée* (CEX) est un service opéré par une société qui détient les actifs des clients et apparie les transactions sur un carnet d'ordres interne. Une *plateforme décentralisée* (DEX) est un système de smart contracts ; l'utilisateur interagit directement avec ces contrats depuis son propre wallet. Les deux ont des profils de risque, des pistes probatoires et des points de contact différents pour un enquêteur.

La majorité de l'activité DEX est gérée par des *automated market makers* (AMM). Un AMM remplace le carnet d'ordres par une *liquidity pool* — un contrat détenant une paire d'actifs, par exemple le token de projet et un stablecoin. Le contrat tarifie un swap algorithmiquement contre les réserves de la pool : la formule du *produit constant* maintient le produit des deux réserves approximativement constant à travers une transaction. L'enquêteur doit en saisir la conséquence : une transaction contre une petite pool déplace le prix davantage que la même transaction contre une grande pool, et plus la transaction est grande en fraction de la pool, plus l'utilisateur paie en *slippage*.

Un *fournisseur de liquidité* dépose les deux actifs et reçoit des *LP tokens* représentant une créance proportionnelle. Pour retirer, le détenteur brûle les LP tokens et reçoit en retour les actifs sous-jacents. Ce retrait est ce qu'un observateur retail perçoit comme « le retrait de la liquidité ».

Deux concepts opérationnels closent le tableau. La *tolérance de slippage* est un paramètre que l'utilisateur fixe lors du swap : l'écart maximal acceptable au prix annoncé. Le whitepaper *Dark Patterns* traite le slippage par défaut élevé comme une manipulation d'interface. La *liquidité verrouillée* consiste à envoyer les LP tokens à un contrat qui empêche le retrait pendant une période déclarée ; le verrou est publiquement vérifiable. Des LP tokens non verrouillés détenus par l'équipe de lancement peuvent être rachetés à tout moment.

La conséquence pour l'enquête est directe. Un *rugpull* est, mécaniquement, le rachat des LP tokens détenus par l'équipe de lancement. L'équipe retire les actifs que les acheteurs retail ont versés, le prix s'effondre contre la pool désormais vide. La chaîne enregistre chaque étape dans l'ordre ; ce qui est opaque est l'identité du racheteur. La tâche de l'enquêteur est rarement « cela s'est-il produit » et presque toujours « qui contrôlait les LP tokens ».

Le même vocabulaire éclaire les cas hors rugpull. Le *liquidity sniping* repose sur un bot observant l'ajout de liquidité dans un bloc et soumettant un achat dans le même bloc ou le suivant ; le sniper est parfois opéré par l'équipe de lancement elle-même. Une *attaque sandwich* requiert une transparence du mempool suffisante pour observer le swap d'une victime et l'encadrer du buy-then-sell de l'attaquant.

Une note méthodologique : l'enquêteur lit les liquidity pools, n'interagit pas avec elles pendant l'enquête. Lire est gratuit ; trader crée de nouvelles preuves que l'enquêteur devra démêler.

### Concepts-clés

- DEX (Glossary #29)
- CEX (Glossary #28)
- AMM (Glossary #27)
- Liquidity Pool (Glossary #26)
- Slippage (Glossary #24)
- Liquidity sniping (Glossary #60)
- Rugpull (Glossary #36)

### Exemples descriptifs

Une équipe ajoute de la liquidité à une pool de son token de projet et d'un stablecoin ; les LP tokens sont émis à l'adresse de l'équipe. Trois semaines plus tard, l'adresse de l'équipe brûle les LP tokens et le stablecoin sort. Les deux transactions sont la signature on-chain d'un retrait de liquidité ; que l'acte constitue une fraude dépend de ce que l'équipe avait promis publiquement.

Dans un autre cas, les LP tokens ont été envoyés à un contrat de verrou vérifiable avec une date d'expiration déclarée. Le verrou modifie matériellement le profil de risque ; il ne garantit pas les résultats.

### Exercices conceptuels

1. Un rapport retail indique : « l'équipe nous a rug ». Traduisez cela en une affirmation on-chain qu'un block explorer peut confirmer ou infirmer.
2. Listez trois faits observables sur une liquidity pool qui pèsent sur la probabilité a priori d'une sortie par retrait de liquidité.
3. Expliquez pourquoi la taille d'un swap relativement aux réserves de la pool importe davantage que la taille absolue du swap.

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #24, #26, #27, #28, #29, #36, #60.
- *Anatomy of a Rugpull* §4 à §7 (préparation, lancement, pic, extraction).
- *Investigation Checklist* §4.4 (Liquidity-pool inspection).

### Récap

Une DEX est un contrat ; une CEX est une société. Un AMM tarifie les swaps contre les réserves de la pool. Les LP tokens représentent des créances sur la pool, et leur garde décide qui peut retirer la liquidité. Un rugpull est, mécaniquement, le rachat de LP tokens par l'équipe. Les enquêteurs lisent ces objets ; ils ne tradent pas sur un dossier actif.

---

## Leçon 5 — Le mempool, le gas et le MEV

### Objectifs pédagogiques

- Définir le mempool et son rôle d'antichambre des transactions.
- Expliquer le gas comme prix de l'inclusion dans un bloc.
- Décrire le MEV comme valeur extractible par réordonnancement des transactions.
- Reconnaître front-running, sandwich et sniping comme instances concrètes de MEV.

### Pré-requis

Leçons 1 à 4.

### Contenu

Lorsqu'un utilisateur signe une transaction, celle-ci est diffusée au réseau et rejoint le *mempool* — l'ensemble des transactions en attente d'inclusion dans un bloc. Sur la plupart des chaînes publiques, le mempool est largement *visible* : des tiers exploitant leurs propres nœuds peuvent observer les transactions en attente avant la finalisation. Cette visibilité est la surface sur laquelle plusieurs schémas exploitant le mempool opèrent.

Le *gas* est l'unité de coût de calcul sur Ethereum et la plupart des chaînes EVM ; le *frais de gas* est le prix payé pour le gas consommé par la transaction. Une enchère plus élevée conduit à une inclusion plus rapide ; c'est le levier par lequel un acteur peut acheter la priorité. Les autres chaînes ont des modèles de frais différents, le principe reste similaire.

Le *MEV* — maximal extractable value — nomme la valeur qu'un acteur peut extraire en réordonnant, incluant ou excluant des transactions au sein d'un bloc, au-delà du frais standard. Le MEV repose sur un pouvoir de séquencement privilégié, soit directement (un validateur), soit indirectement (un *searcher* qui paie un validateur pour un séquencement garanti).

Trois schémas sont particulièrement visibles. Le *front-running* : observer une transaction en attente et soumettre une transaction qui bénéficie de son exécution anticipée. Le cas classique est un swap suffisamment grand pour déplacer le prix ; un front-runner achète avant la victime et vend après. Les *attaques sandwich* sont une implémentation spécifique où le même acteur place le buy en amont et le sell en aval ; les tolérances de slippage par défaut élevées rendent l'attaque plus rentable. Le *liquidity sniping* utilise des bots pour détecter la liquidité fraîchement ajoutée et exécuter un achat dans le même bloc ; lorsque l'équipe de lancement opère le sniper, les acheteurs retail deviennent les contreparties systématiques d'une opération interne.

L'enquêteur n'intervient pas, par défaut, contre le MEV ; la discipline est observationnelle. Deux rôles plus étroits émergent. Premièrement, certaines conceptions dark-pattern *exploitent* la visibilité du mempool pour extraire de la valeur (notamment les interfaces à slippage par défaut élevé) ; reconnaître la signature on-chain est un constat. Deuxièmement, certaines activités d'enquête — une transaction test de valeur élevée — peuvent être observées et front-run ; d'où les wallets jetables et la minimisation d'une activité prévisible depuis un wallet d'enquête identifiable.

L'intuition que le mempool serait « secret » et la chaîne « publique » est à l'envers. La chaîne enregistre ce qui s'est déjà passé ; le mempool expose ce qui est sur le point d'arriver. Le dossier cite l'état finalisé, non les snapshots de mempool, sauf si le snapshot a été préservé indépendamment avec discipline de chaîne de garde.

### Concepts-clés

- Gas / gas fee (Glossary #23)
- MEV (Glossary #25)
- Front-running (Glossary #41)
- Sandwich attack (Glossary #42)
- Slippage (Glossary #24)
- Liquidity sniping (Glossary #60)

### Exemples descriptifs

Un utilisateur retail soumet un swap important contre une pool peu profonde avec slippage par défaut. Un searcher observe la transaction en attente, soumet un achat en amont, laisse le swap de la victime s'exécuter à un prix moins favorable, puis soumet une vente en aval. Les transactions sont visibles après inclusion ; la relation adversarielle se déduit du séquencement et des relations entre adresses, non d'une étiquette.

Une équipe de lancement opère un sniper interne. Dans le même bloc que l'ajout de liquidité, l'achat du sniper apparaît ; les acheteurs retail arrivent à des prix déjà élevés. Le schéma est compatible avec un sniping interne mais pas, seul, déterminant ; l'enquêteur cherche des relations de financement entre le wallet de l'équipe et celui du sniper.

### Exercices conceptuels

1. Une note de dossier indique : « l'impact prix du swap de la victime a été extrait par un sandwich ». Identifiez les preuves qui étaieraient cette affirmation à partir des données on-chain.
2. Expliquez pourquoi le MEV est parfois qualifié de « taxe sur la visibilité » de l'intention.
3. Pourquoi un enquêteur utiliserait-il un wallet récent, à solde faible, pour interagir avec un dossier actif plutôt qu'un wallet ancien de sa main ?

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #23, #24, #25, #41, #42, #60.
- *Dark Patterns in Crypto*, catégorie C (manipulation d'interface technique).
- *Investigation Checklist* §8.3 (Price reconstruction).

### Récap

Le mempool expose les transactions en attente ; le gas achète la priorité ; le MEV est la valeur extractible par séquencement. Front-running, sandwich, sniping en sont les instances concrètes. Les enquêteurs lisent ces signatures ; ils ne les ingénient pas. L'activité prévisible d'un wallet d'enquête connu est en elle-même une exposition.

---

## Leçon 6 — Lire un block explorer

### Objectifs pédagogiques

- Reconnaître les sections standard de la page d'une adresse sur un block explorer générique.
- Décrire le contenu d'une page de transaction et la signification de chaque champ.
- Identifier les limites des étiquettes et enrichissements fournis par les explorers.
- Appliquer une séquence fixe de vérifications à l'arrivée sur une adresse inconnue.

### Pré-requis

Leçons 1 à 5.

### Contenu

Un *block explorer* est un site ou une application qui expose le contenu d'une blockchain sous forme humainement lisible. Cette leçon décrit la structure générique pour la famille EVM ; la structure conceptuelle se transpose à Solana et aux chaînes UTXO avec quelques adaptations.

La page d'une adresse ouvre généralement sur un panneau récapitulatif : l'adresse, le solde en actif natif, une éventuelle étiquette humainement lisible, la date de première activité, le nombre de transactions. En dessous, plusieurs onglets organisent l'historique. L'onglet *transactions* liste les transactions sortantes signées par l'adresse. L'onglet *internal transactions* liste les mouvements de valeur déclenchés par des appels de contrat ; il est crucial car les contrats EVM peuvent déplacer la valeur en effet de bord d'un appel parent, et un lecteur qui ne consulte que l'onglet de premier niveau peut manquer le flux réel. L'onglet *token transfers* liste les transferts ERC-20 ; l'onglet *NFT transfers* les mouvements ERC-721 et ERC-1155. L'onglet *contract*, présent lorsque l'adresse est elle-même un contrat, expose le bytecode et — si le déployeur l'a publié — le code source vérifié.

La page d'une transaction ouvre sur le *txhash*, le bloc, l'horodatage, les adresses *from* et *to*, la valeur en actif natif transférée, et le gas consommé. Le champ *input data* porte la calldata ; les explorers la décodent lorsque le contrat est vérifié. La section *logs* liste les événements émis ; les transferts de tokens standard émettent un événement `Transfer`, et une séquence de `Transfer` est le moyen canonique de reconstituer un mouvement effectif de valeur. Le champ *status* indique si la transaction a réussi ou a été annulée (revert).

Deux limites des données d'explorer importent. Premièrement, *les étiquettes ne sont pas auditées* : une étiquette « scam » peut refléter un consensus solide, une allégation contestée ou une donnée obsolète ; une étiquette « exchange » peut être inexacte ou à la mauvaise granularité. Le dossier cite les *faits* — adresses, transactions, soldes, code — et traite les étiquettes comme des pistes. Deuxièmement, *les enrichissements sont commerciaux*. Les diagrammes « money flow » et scores de risque produits par des plateformes tierces sont utiles en première lecture, mais leurs méthodologies sont souvent opaques, et le dossier doit enregistrer le fait on-chain sous-jacent.

Une checklist générique pour la *première lecture* d'une adresse inconnue : quand elle apparaît pour la première fois et quel a été son premier financement entrant ; s'il s'agit d'un contrat ou d'une EOA ; le volume et la composition d'actifs des transferts ; les contreparties les plus fréquentes (adresses de dépôt CEX, bridges, mixers) ; et toute étiquette interprétative, traitée comme une piste. La première lecture produit des hypothèses, pas des conclusions.

> **⚠ Encadré sécurité.** Un block explorer est une surface de *lecture*. Certains explorers exposent un onglet « write » sur les contrats vérifiés, permettant à un visiteur d'appeler des fonctions d'état via un wallet connecté. L'enquêteur ne connecte jamais un wallet d'enquête à un contrat sous investigation via cet onglet — un mauvais clic peut dépenser un solde, signer une approbation, ou créer une empreinte on-chain non désirée. L'enquête est en lecture seule. Si un comportement de contrat doit être vérifié, il l'est dans un environnement sandbox avec une adresse jetable.

La leçon ne présente pas de capture d'écran. Les interfaces évoluent ; le but est de développer un vocabulaire suffisamment général pour que tout explorer ultérieurement ouvert soit compréhensible par analogie.

### Concepts-clés

- Block explorer (Glossary #51)
- Chain analysis (Glossary #52)
- Address label / tag (Glossary #59)
- txhash (Glossary #35)
- Internal transaction (Glossary #51, contexte)
- Heuristic vs deterministic attribution (Glossary #58)

### Exemples descriptifs

Un enquêteur ouvre la page d'adresse du déployeur d'un token. Le panneau récapitulatif montre trois transactions et un petit solde natif ; l'onglet contracts liste un contrat de token déployé. L'onglet *Holders* du contrat est dominé par une adresse détenant la majeure partie de l'offre, et ses entrées les plus anciennes sont le déploiement et le financement initial de la liquidity pool. Aucune n'est encore une conclusion ; ensemble, elles forment une image de départ plausible d'un lancement de petite échelle.

Deuxième exemple. Une adresse porte une étiquette contributive de communauté la signalant comme liée à une campagne de phishing connue. L'enquêteur enregistre l'étiquette, sa source et sa date, mais cite les transactions sous-jacentes — non l'étiquette — pour décrire le comportement de l'adresse. Les étiquettes migrent ; les transactions non.

### Exercices conceptuels

1. Sur la page d'une adresse inconnue, quelles cinq observations enregistreriez-vous avant de proposer toute hypothèse sur sa fonction ?
2. La même page d'adresse porte un onglet « contrat vérifié » et une étiquette « scam ». Identifiez laquelle de ces affirmations peut être tenue pour un fait, et laquelle requiert une attribution supplémentaire.
3. Un dossier cite un enrichissement « money flow » d'un explorer. Listez deux questions que vous poseriez à l'auteur avant d'accepter l'enrichissement comme preuve.
4. Pourquoi l'onglet *internal transactions* compte-t-il autant que l'onglet *transactions* standard pour reconstituer un flux médié par contrat ?
5. Énoncez, en une phrase, la règle pour connecter un wallet à l'interface write d'un explorer pendant une enquête.

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #35, #51, #52, #58, #59.
- *Investigation Checklist* §4 (On-Chain Identifier Collection), §4.5 (Tooling, generically).
- *Anatomy of a Rugpull* §9 (Consolidated technical view).

### Récap

Un block explorer est une surface de lecture structurée. Pages d'adresse, pages de transaction, transactions internes, journaux d'événements sont les objets standard ; étiquettes et enrichissements sont des pistes, pas des faits. L'enquêteur lit, ne tradent pas, et cite l'état de la chaîne plutôt que l'interprétation de l'explorer.

---

## Leçon 7 — Reconnaître les schémas de fraude

### Objectifs pédagogiques

- Reconnaître cinq archétypes majeurs de fraude retail sur leurs surfaces off-chain et on-chain.
- Articuler les caractéristiques structurelles qui distinguent chaque archétype des autres.
- Identifier les signaux typiques qu'un même dossier puisse combiner plusieurs archétypes.
- Éviter l'erreur pédagogique courante consistant à confondre un schéma avec un diagnostic.

### Pré-requis

Leçons 1 à 6.

### Contenu

La fraude crypto retail est exceptionnellement répétitive. La combinaison de transactions irréversibles, de déploiement sans permission et d'un écosystème social optimisé pour l'attention rapide a produit un nombre fini d'archétypes récurrents. Cette leçon en catalogue cinq, chacun avec des signaux off-chain et on-chain.

Le premier archétype est le **rugpull**. Le whitepaper *Anatomy of a Rugpull* traite le cas en profondeur. Off-chain, un rugpull accumule du signal social et se termine abruptement par l'abandon des canaux de communication. On-chain, il se termine par le rachat des LP tokens détenus par l'équipe de lancement, laissant le token de projet échangeable contre une pool vide. Une fois l'opération dispersée, la récupération devient structurellement plus difficile.

Le deuxième archétype est l'**exit scam** : les opérateurs d'un service collectent des fonds et disparaissent. Le service peut être un produit de rendement sans token, une plateforme hébergée ou toute structure détenant des actifs d'utilisateurs. Off-chain, il se reconnaît à une séquence — promesse, croissance des dépôts, friction sur les retraits, silence. On-chain, la signature est la consolidation des flux côté dépôt vers un petit nombre d'adresses de cash-out, souvent via bridges ou mixers.

Le troisième archétype est le **pump and dump** : un effort coordonné pour gonfler le prix d'un actif par activité promotionnelle puis vendre dans la demande gonflée. Off-chain, il est signalé par une augmentation soudaine de commentaires coordonnés sur plusieurs plateformes. On-chain, la signature combine accumulation par un petit nombre d'adresses initiées avant l'activité visible, volume d'échange anormalement élevé pendant la fenêtre, et distribution rapide vers des adresses plus petites dès que l'attention retail arrive. Le wash trading accompagne fréquemment un pump and dump.

Le quatrième archétype est le **drainer** : un smart contract ou script malveillant qui, une fois autorisé par la signature d'une victime, transfère la valeur hors du wallet de la victime. La victime arrive typiquement via un site de phishing imitant un protocole familier, une publicité malveillante ou un front-end compromis. Off-chain, la surface est l'interface trompeuse. On-chain, la signature est une transaction balayant le wallet de la victime immédiatement après signature, vers une adresse fraîchement financée qui consolide de nombreuses victimes.

Le cinquième archétype est le **phishing**, au sens étroit de l'investisseur retail : sites, messages ou usurpations d'identité trompeurs induisant l'utilisateur à révéler une seed phrase ou à signer une transaction malveillante. Les drainers sont l'implémentation technique d'une classe de phishing ; la catégorie inclut aussi les tentatives d'ingénierie sociale pures (« vérifiez » votre wallet en saisissant la seed phrase, ou transférez les fonds à une « adresse sûre »).

Deux mises en garde pédagogiques closent la leçon. Premièrement, *les schémas ne sont pas des diagnostics*. Un dossier qui dit « c'est un rugpull » formule une attribution ; elle doit être étayée par les signaux listés pour cet archétype et étiquetée avec la force de l'étaiement. Deuxièmement, *les dossiers combinent des archétypes*. Un cas réel peut commencer comme un pump-and-dump à pression sociale, mûrir en rugpull, et finir par faire passer le produit du vol par bridges et mixers. Le dossier décrit ce qui a été observé, dans l'ordre, plutôt que de choisir un archétype et de forcer les preuves à s'y conformer. Les *Anonymized Case Studies* illustrent ce feuilletage.

Les cinq archétypes maximisent chacun l'écart entre *signature* et *compréhension*. La discipline de l'enquêteur est l'inverse.

### Concepts-clés

- Rugpull (Glossary #36)
- Exit scam (Glossary #37)
- Pump and dump (Glossary #39)
- Drainer (Glossary #43)
- Phishing (Glossary #44)
- Wash trading (Glossary #40)
- Honeypot (Glossary #38)

### Exemples descriptifs

Un token est lancé avec un signal social fort et une promesse de liquidité verrouillée. En quarante-huit heures, les canaux sont silencieux, le front-end est hors-ligne, et la chaîne montre que les LP tokens — jamais effectivement transférés au contrat de verrou — ont été rachetés par le wallet de l'équipe. Le cas combine un dark pattern de pression sociale et un rugpull.

Autre cas : un token de petite capitalisation sans signe de retrait de liquidité mais avec trois jours de commentaires coordonnés sur plusieurs plateformes, suivis d'un pic de prix, suivis d'une distribution rapide d'un cluster d'adresses préfinancées vers une longue traîne de destinataires. La structure est compatible avec un pump-and-dump.

### Exercices conceptuels

1. Un rapport retail qualifie un cas de « rugpull évident ». Identifiez les observations on-chain et off-chain nécessaires avant d'adopter cette description dans un dossier.
2. Un pump-and-dump et un rugpull peuvent coexister. Décrivez la manière dont vous enregistreriez la chronologie pour qu'un lecteur puisse les distinguer.
3. Listez deux signaux off-chain et deux signaux on-chain qui déplaceraient votre a priori vers un diagnostic de drainer plutôt que de rugpull.
4. Pourquoi la distinction entre « le schéma est présent » et « le schéma est le bon diagnostic » est-elle particulièrement importante dans les premiers brouillons de dossier ?

### Pour aller plus loin

- *Anatomy of a Rugpull*, document entier.
- *Dark Patterns in Crypto*, document entier, attention particulière aux catégories C (technique) et D (misrepresentation financière).
- *Anonymized Case Studies*, les quatre cas, pour des exemples feuilletés.
- *OSINT-Crypto Glossary* entrées #36, #37, #38, #39, #40, #43, #44.

### Récap

Cinq archétypes — rugpull, exit scam, pump and dump, drainer, phishing — couvrent la majeure partie de la fraude crypto retail. Chacun a des signatures off-chain et on-chain. Les schémas sont des points de départ ; les dossiers les combinent ; les enquêteurs décrivent les observations et étiquettent les attributions avec la force de leur étaiement.

---

## Leçon 8 — OSINT pour l'enquêteur crypto

### Objectifs pédagogiques

- Identifier les principales sources publiques pour l'enquête off-chain en crypto.
- Appliquer un outillage OSINT générique et non commercial pour vérifier, archiver et pivoter.
- Énoncer les limites légales et déontologiques de l'OSINT et les actions qu'elles excluent.
- Croiser preuves on-chain et off-chain en un récit défendable.

### Pré-requis

Leçons 1 à 7.

### Contenu

L'OSINT — open-source intelligence — est la collecte et l'analyse structurées d'informations issues de sources publiquement accessibles. Dans une enquête crypto, l'OSINT fournit la preuve off-chain que le registre on-chain ne peut fournir seul : l'identité, l'intention et l'histoire des personnes derrière les adresses.

Les principales surfaces publiques sont conventionnelles. Les *réseaux sociaux publics* sont la source primaire du discours autour d'un projet. Les *communautés de messagerie publiques* — canaux ouverts sur Telegram, serveurs publics sur Discord — sont la couche suivante, là où l'interaction retail se joue. Les *sites de code-hosting* fournissent l'histoire technique, les identités des contributeurs et les artefacts parfois committés par inadvertance. Les *archives web* préservent un matériel que le projet peut ultérieurement retirer. Les *registres publics* — WHOIS, registres des sociétés, archives judiciaires, dépôts réglementaires — fournissent la couche institutionnelle.

Un outillage générique et non commercial suffisant pour une passe d'introduction inclut les archives web, un moteur de recherche d'image inversée, des moteurs de recherche généraux utilisés avec des requêtes restreintes à un site, et les visionneuses de métadonnées intégrées aux systèmes d'exploitation modernes. Les communautés OSINT spécialisées maintiennent des catalogues d'outils librement accessibles ; mieux vaut en garder un en signet plutôt que de tenter de mémoriser les outils. Ce cours ne nomme aucun produit commercial, par principe.

Le cœur méthodologique d'une passe OSINT est le *pivot* : passer d'un identifiant à un autre par un lien public — d'un nom d'utilisateur à un profil, à un domaine, à une empreinte de registrant, à un compte de code-hosting, et de là à une adresse on-chain mentionnée dans un message de commit. Une enquête réussie est une séquence de pivots, chacun documenté.

> **⚠ Encadré sécurité.** L'OSINT s'appuie sur des sources *publiques*. Pretexting (assumer une identité fabriquée pour soutirer de l'information à un tiers), ingénierie sociale, intrusion dans des comptes privés, techniques de SIM-swap, accès à des messages ou comptes qui ne sont pas les vôtres, et fabrication de preuves pour provoquer une réponse sont *hors enveloppe* et ne relèvent pas de l'OSINT — et, dans la plupart des juridictions, constituent des actes pénaux. Un dossier contenant du matériel obtenu par l'une de ces techniques est contaminé et expose son auteur.

Le croisement des preuves on-chain et off-chain est la synthèse pratique. Séquence typique : une adresse on-chain se comporte conformément à un wallet d'équipe de lancement ; l'OSINT identifie un compte social public dans lequel l'équipe a posté cette adresse ; ce compte est lié à un compte personnel via un post archivé ; le compte personnel a un historique de commentaires sur un site de code-hosting référençant une autre adresse qui apparaît, on-chain, comme la destination d'un transfert de trésorerie. La chaîne fournit les faits ; l'OSINT fournit l'attribution. Ensemble, ils étayent une attribution *probabiliste*.

Le dossier enregistre, pour chaque constat off-chain : la source, la date de capture, un hash de l'artefact capturé et toute rédaction. La chaîne de garde s'applique aux artefacts numériques comme aux physiques.

L'empreinte de l'enquêteur dans une passe OSINT est elle-même observable. Un pic soudain de vues de profil, de captures archivées ou de requêtes WHOIS peut alerter un projet et accélérer sa dispersion. L'OPSEC OSINT — infrastructure jetable, rythme délibéré, séparation des identifiants d'enquête et personnels — relève de la discipline, non d'un savoir-faire à part.

### Concepts-clés

- OSINT (Glossary #1)
- SOCMINT (Glossary #2)
- GEOINT (Glossary #3)
- Pivot (Glossary #4)
- Sockpuppet (Glossary #5)
- Pretexting (Glossary #14)
- OPSEC (Glossary #15)
- Chain of custody (Glossary #10)

### Exemples descriptifs

Un enquêteur veut vérifier une apparition revendiquée d'un fondateur de projet à une conférence. Une recherche d'image inversée sur la photo de l'annonce ressort un événement sans rapport, d'il y a deux ans. La misrepresentation est elle-même un constat ; savoir si elle s'élève à un signal de fraude dépend de ce que le projet a prétendu et de l'importance de cette prétention pour les décisions retail.

Deuxième exemple. Une adresse on-chain est apparue comme destination d'une série de transferts entrants de trésorerie. Une archive web de la première landing page du projet montre la même adresse listée comme « multisig équipe » ; la page actuelle a retiré cette référence. La capture archivée donne au dossier une attribution probabiliste plus forte que chacune des sources prise isolément.

### Exercices conceptuels

1. Listez les quatre métadonnées que vous enregistreriez pour chaque artefact off-chain ajouté à un dossier, et expliquez ce que chacune prévient.
2. Décrivez une séquence de trois pivots à partir d'un handle de réseau social public qui aiderait à trianguler un wallet d'équipe on-chain.
3. Énoncez, en un paragraphe, la ligne rouge OSINT — ce qui en fait partie et ce qui n'en fait pas partie — et une raison pour laquelle franchir cette ligne nuirait au dossier même si la technique « fonctionnait ».
4. Un dossier repose entièrement sur l'état actuel de la landing page d'un projet. Identifiez la faiblesse méthodologique et le remède OSINT.

### Pour aller plus loin

- *OSINT-Crypto Glossary* entrées #1, #2, #3, #4, #5, #10, #14, #15.
- *Investigation Checklist* §5 (Off-Chain Identifier Collection), avec attention particulière à §5.2 (The OSINT red line).
- *Anonymized Case Studies*, pour des récits croisés on-chain × off-chain.

### Récap

L'OSINT fournit la preuve off-chain que les données on-chain ne peuvent fournir. Les pivots se font le long de liens publics ; la chaîne de garde enregistre chaque étape. L'enveloppe OSINT, ce sont les sources publiques uniquement ; pretexting, ingénierie sociale, intrusion et SIM-swap sont hors enveloppe et hors discipline. On-chain et off-chain se synthétisent en attribution probabiliste, non en certitude.

---

## Leçon 9 — Construire un dossier d'enquête

### Objectifs pédagogiques

- Appliquer un modèle de dossier standard en huit composantes (C1 à C8).
- Distinguer chronologie et causalité dans un récit de dossier.
- Énoncer les exigences de base de chaîne de garde et de hash pour les artefacts numériques.
- Reconnaître les erreurs méthodologiques courantes des premiers brouillons.

### Pré-requis

Leçons 1 à 8.

### Contenu

Le produit d'une enquête est un *dossier* — un enregistrement structuré destiné à être relu, audité, transféré, et remis aux autorités ou aux conseils. L'*Investigation Checklist* propose un modèle en huit composantes, C1 à C8.

**C1 — Identification.** Identifiant du dossier, date d'ouverture, analyste, source du rapport initial, et un paragraphe de résumé du dossier suspecté. Le résumé est descriptif, non évaluatif.

**C2 — Chronologie.** Une séquence horodatée de chaque événement pertinent. Chaque entrée comporte date et heure (avec fuseau horaire), l'événement et une référence à la preuve sous-jacente (un txhash, une URL archivée, un fichier de capture d'écran avec son hash SHA-256). La chronologie est l'épine dorsale du dossier.

**C3 — Acteurs.** Liste des personnes, entités et pseudonymes apparaissant dans le dossier, avec la preuve étayant chaque identification. La force de chaque attribution est indiquée (faible, modérée, forte) et les observations étayant celle-ci sont citées.

**C4 — Flux on-chain.** Les principales adresses, les contrats impliqués, les transactions pertinentes, et une description des mouvements de valeur. Lorsque les flux passent par bridges, mixers ou adresses de dépôt CEX, la frontière est notée ; les flux qui disparaissent dans une adresse de dépôt CEX ne sont pas « perdus », ils sont *redirigés vers un canal d'enquête non public*.

**C5 — Flux off-chain.** Le récit off-chain correspondant : canaux sociaux, sites, communautés de messagerie, couverture presse. Pour chaque élément, la source, la date de capture et le hash de l'artefact sont enregistrés. C5 fait le lien avec C4.

**C6 — Schémas détectés.** Les archétypes de fraude (Leçon 7) et les dark patterns observés, chacun avec les observations étayantes issues de C4 et C5. C6 est descriptif des schémas observés, non une qualification juridique — qui relève du conseil.

**C7 — Estimation des pertes.** La valeur estimée perdue, exprimée au moment des événements et au moment de la rédaction du dossier, avec une méthodologie explicite (quels prix, quelles adresses attribuées, quelles hypothèses). La méthodologie doit être énoncée assez ouvertement pour qu'un relecteur puisse répliquer le calcul.

**C8 — Recommandations.** Les actions recommandées par le dossier — généralement l'autorité de signalement, l'enquête complémentaire qui renforcerait l'attribution, les mesures de protection spécifiques pour une victime. C8 est la seule section normative.

Deux erreurs méthodologiques reviennent. *Le langage causal sous couvert de chronologie* : un dossier qui dit « l'équipe a alors drainé la LP » formule une revendication causale. L'événement est « les LP tokens ont été brûlés et les actifs ont été retirés » ; l'attribution à « l'équipe » relève de C3 avec ses preuves. *L'étiquette comme preuve* : citer une étiquette « scam » d'explorer comme un constat hérite de l'incertitude de l'étiquette ; les transactions sous-jacentes, non l'étiquette, sont la preuve.

La chaîne de garde s'applique à chaque artefact. Chaque fichier off-chain porte un hash SHA-256 enregistré à la capture ; chaque référence on-chain cite un txhash et la hauteur de bloc.

> **⚠ Encadré sécurité.** Une enquête publique peut nuire à un innocent. Un dossier qui nomme une personne attache à ce nom des conséquences réputationnelles qui survivront à toute correction ultérieure. L'enquêteur applique des étiquettes de force d'attribution, refuse de publier hors dossier les attributions faibles, et révise le dossier dès qu'une preuve nouvelle infirme une conclusion antérieure. La rigueur est une obligation déontologique ; « rigoureux » est ce qu'une personne innocente blessée par une publication trop tôt vous demande rétrospectivement.

Un dossier n'est terminé que lorsqu'un autre analyste pourrait le rouvrir des mois plus tard, retrouver chaque artefact à l'endroit cité, recalculer chaque hash et retracer chaque conclusion à sa preuve étayante.

### Concepts-clés

- Casefile structure C1–C8 (Investigation Checklist §7)
- Chain of custody (Glossary #10)
- Attribution (Glossary #9)
- Heuristic vs deterministic attribution (Glossary #58)
- Confirmation bias (Investigation Checklist §8.1)
- IOC (Glossary #13)

### Exemples descriptifs

Un brouillon de dossier en C3 attribue un wallet « au fondateur » sur la base d'une seule capture d'écran archivée. Le relecteur demande une seconde observation indépendante ; l'auteur trouve un handle de code-hosting correspondant qui a posté la même adresse dans un message de commit. L'attribution passe de faible à modérée.

Deuxième exemple. Un dossier en C7 rapporte un chiffre de perte dérivé d'un seul enrichissement d'explorer. L'auteur re-dérive le chiffre à partir des volumes on-chain bruts et de snapshots de prix publics, en citant chaque entrée. Le chiffre varie de quelques points ; la méthodologie est désormais lisible.

### Exercices conceptuels

1. Une affirmation de dossier indique : « l'équipe de lancement a rug le 5 mai ». Réécrivez cette affirmation en une entrée de chronologie en C2 plus une revendication d'attribution en C3, chacune avec ses preuves étayantes.
2. Un relecteur conteste l'estimation des pertes d'un dossier comme « trop ronde ». Identifiez les éléments méthodologiques que vous documenteriez pour la défendre ou, le cas échéant, pour la réviser.
3. Décrivez la différence entre un *constat* et une *piste* dans le contexte d'une étiquette d'explorer signalée sur une adresse en C4.
4. Pourquoi C8 est-il la seule section normative du dossier, et qu'est-ce qui ne tiendrait pas dans un dossier qui introduirait du langage normatif en C6 ?

### Pour aller plus loin

- *Investigation Checklist* §7 (Casefile Structure), §8 (Methodological Limits and Red Flags).
- *OSINT-Crypto Glossary* entrées #9, #10, #13, #58.
- *Anonymized Case Studies*, les quatre cas, pour des exemples de modèle rempli.

### Récap

Le modèle C1–C8 organise un dossier pour audit. La chronologie est descriptive ; l'attribution est étiquetée avec sa force ; la chaîne de garde s'applique à chaque artefact. Langage causal et étiquette-comme-preuve sont les erreurs typiques des débuts. La rigueur est une obligation déontologique parce que la publication blesse.

---

## Leçon 10 — Signalement, déontologie et limites légales

### Objectifs pédagogiques

- Identifier les principales catégories d'autorités auxquelles un dossier de fraude crypto peut être référé.
- Énoncer les limites déontologiques de l'enquête civile par rapport à l'autorité judiciaire.
- Reconnaître le profil de risque personnel de l'enquête publique en crypto et les mesures protectrices de base.
- Articuler, dans vos propres mots, le principe qui clôt le cours.

### Pré-requis

Leçons 1 à 9.

### Contenu

Un dossier est un document de travail. Sa destination est rarement la publication ; plus souvent, c'est une remise à une personne ou une institution dotée de la qualité et de l'autorité légale pour agir. Cette dernière leçon décrit les destinations, l'enveloppe déontologique, les risques encourus par l'enquêteur, et le principe qui clôt le cours.

Les catégories d'autorité varient selon les juridictions ; consultez l'*Investigation Checklist* §9 pour le traitement développé. La *police judiciaire* — forces de police, unités spécialisées en cybercriminalité, enquêteurs financiers — traite la qualification pénale. Les *autorités de marchés financiers* et de *protection des consommateurs* gèrent les angles de conduite de marché, de divulgation et de préjudice consommateur. Les *autorités fiscales* ont parfois compétence sur le produit des infractions là où les autorités de marché ne l'ont pas. Les *autorités de protection des données* peuvent être l'interlocuteur pertinent lorsque le dossier implique un mésusage de données personnelles. Un *conseil spécialisé* accompagne les victimes sur la récupération civile. Les *rédactions* aux pratiques journalistiques établies peuvent être appropriées pour des dossiers à forte dimension d'intérêt public ; la relation est éditoriale, non d'enquête.

L'enveloppe déontologique est plus étroite que l'enveloppe technique. L'enquêteur ne se substitue pas à un tribunal, n'affirme pas une responsabilité pénale, ne prononce pas de verdict. L'enquêteur décrit des schémas, attribue des observations en étiquetant leur force, remet le matériel à ceux qui ont qualité pour agir. Accuser publiquement une personne nommée avant qu'aucune autorité n'ait examiné le dossier a des coûts bien connus pour les personnes innocentes et pour la réputation de l'enquêteur. La distinction entre *publiquement enquêté* et *publiquement accusé* n'est pas stylistique.

Le profil de risque de l'enquêteur comporte trois composantes. L'*exposition à la diffamation* est le risque juridique de la publication, variable selon la juridiction ; une publication qui surdétermine ou omet un contexte matériel peut exposer le publieur à une action civile. L'*exposition au harcèlement* est le risque pratique de devenir une cible des suiveurs ou opérateurs du projet. Le *doxxing inversé* — divulgation publique de l'identité de l'enquêteur ou de ses informations personnelles — est la composante la plus sévère opérationnellement, et est documenté à travers le champ. Les mesures protectrices s'alignent sur l'OPSEC général : séparation des identifiants d'enquête et personnels, infrastructure jetable pour les recherches sensibles, retenue délibérée dans les commentaires publics sur les dossiers en cours. Le principe général est universel — l'enquêteur plus difficile à cibler est plus difficile à faire taire.

Le principe qui clôt le cours est celui que la préface a énoncé et auquel chaque leçon est revenue. *Le cours vous apprend à comprendre, à lire, à enregistrer et à signaler ; il ne vous apprend pas à attaquer, à drainer, à frauder ou à punir.* Les cinq archétypes de fraude ont été catalogués pour que vous puissiez les reconnaître, non pour que vous les répliquiez. L'enveloppe OSINT a été décrite pour être respectée. Le modèle de dossier est offert comme une discipline de rigueur, non comme un outil de dénonciation. L'autorité de l'enquêteur est celle de la description patiente et honnête ; elle n'excède pas ce mandat.

Le corpus auquel ce cours appartient est suffisamment dense pour qu'une passe ne soit que le commencement d'un apprentissage, et non la fin d'un syllabus. Les prochaines étapes sont la pratique sur les cas travaillés des *Anonymized Case Studies* et sur la séquence opérationnelle de l'*Investigation Checklist*.

> **⚠ Encadré sécurité.** Deux derniers rappels. Premièrement, un dossier n'est pas un verdict ; les enquêteurs civils décrivent et signalent, ils ne tranchent pas. Deuxièmement, la discipline protectrice de l'enquêteur — OPSEC, retenue dans la prise de parole publique, attention à sa propre empreinte numérique — n'est pas facultative ; elle est la condition à laquelle le travail reste tenable.

### Concepts-clés

- OPSEC (Glossary #15)
- Doxxing (Glossary #7)
- Attribution (Glossary #9)
- Heuristic vs deterministic attribution (Glossary #58)
- Threat model (Glossary #12)
- Self-regulatory organization (Glossary #70)

### Exemples descriptifs

Un dossier se conclut sur des preuves on-chain fortes et une attribution off-chain modérée. L'enquêteur rédige un résumé public ; en relecture, un collègue note que le résumé nomme une personne dont l'attribution est modérée, non forte. Le résumé est réécrit pour décrire les schémas et les faits on-chain, en gardant le nom de côté en attendant des preuves supplémentaires.

Deuxième exemple. Un enquêteur publie des constats sur une plateforme publique et, dans les soixante-douze heures, fait face à une campagne de harcèlement coordonnée. Le modèle de menace anticipait ce scénario ; les identifiants d'enquête et personnels sont séparés, le dossier est préservé avec chaîne de garde, et le dossier a été transmis à l'autorité appropriée avant toute discussion publique. La marche à suivre survit au harcèlement parce que l'enquêteur ne dépendait pas de la publication pour que le dossier soit entendu.

### Exercices conceptuels

1. Une victime vous demande de « publier le nom du fondateur » d'un projet sur lequel vous avez enquêté. Énoncez votre réponse en deux phrases, en distinguant ce que vous avez établi de ce que vous pouvez publier de manière responsable.
2. Identifiez trois mesures protectrices qu'un enquêteur peut appliquer avant de publier un constat sur une plateforme publique, et expliquez ce que chacune prévient.
3. Distinguez, dans vos propres mots, la différence entre un dossier envoyé à la police judiciaire et une publication publique du même matériel.
4. Énoncez le principe de clôture du cours en une phrase, et identifiez une décision que vous prendriez différemment si vous l'oubliiez.

### Pour aller plus loin

- *Investigation Checklist* §9 (Reporting to Authorities), §10 (Victim Orientation), §11 (Casefile Closure and Reopening).
- *Operating Manual for INTERLIGENS Beta Investigators*, §2 (Cadre légal et déontologique) — pour l'enveloppe procédurale des beta-testeurs.
- *OSINT-Crypto Glossary* entrées #7, #9, #12, #15, #58, #70.

### Récap

Un dossier est remis aux autorités, non au public par défaut. Les enquêteurs civils décrivent et signalent ; ils ne tranchent pas. Diffamation, harcèlement et doxxing inversé sont des risques réels ; l'OPSEC fait partie de la discipline. Le cours apprend à lire et à raisonner, non à attaquer.

---

## Annexe A — Plan de lecture suggéré en six semaines

| Semaine | Leçons | Temps approximatif | Objectif |
|---------|--------|---------------------|----------|
| 1 | 1–2 | 2 heures | Fondamentaux blockchain et wallets |
| 2 | 3–4 | 2 heures | Tokens et plateformes décentralisées |
| 3 | 5–6 | 2 heures | Mempool et lecture de block explorer |
| 4 | 7 | 1 heure | Reconnaissance des schémas de fraude |
| 5 | 8 | 1 heure | Discipline OSINT |
| 6 | 9–10 | 2 heures | Construction de dossier et déontologie |

Sur un rythme plus lent, étalez chaque paire sur une semaine, en consacrant la seconde session aux exercices et au corpus croisé. Sur un rythme plus rapide, le plan tient en deux week-ends intensifs.

## Annexe B — Lectures complémentaires

Cinq documents compagnons du corpus INTERLIGENS Research :

- *Dark Patterns in Crypto: A Taxonomy of Manipulation Tactics* — quinze schémas persuasifs à la surface de la crypto retail.
- *Investigation Checklist — Crypto Fraud Cases (Operational Playbook)* — la séquence opérationnelle d'un dossier.
- *OSINT, Crypto and Investigation Glossary* — soixante-dix définitions.
- *Crypto Fraud Cases — Anonymized and Fictionalized Studies* — quatre exemples travaillés.
- *Anatomy of a Rugpull* — un approfondissement monothématique.

Références publiques externes appropriées pour un débutant lisant au-delà du corpus. La liste est institutionnelle plutôt que personnelle, et exclut tous cours, bootcamps, plateformes payantes et outils propriétaires commerciaux.

- Groupe d'action financière (GAFI). *Guidance actualisée sur une approche fondée sur les risques pour les actifs virtuels et les prestataires de services sur actifs virtuels* (2021).
- Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, éditions annuelles.
- Agence de l'Union européenne pour la cybersécurité (ENISA). Rapports *Threat Landscape*, éditions annuelles.
- U.S. Federal Trade Commission. *Bringing Dark Patterns to Light* (septembre 2022), rapport.
- OCDE. *Dark commercial patterns* (2022), document de travail.
- Meiklejohn, S., et al. (2013). *A Fistful of Bitcoins: Characterizing Payments Among Men with No Names*. ACM IMC. (Fondateur sur l'heuristique du common input.)
- Möser, M., Böhme, R., & Breuker, D. (2013). *An Inquiry into Money Laundering Tools in the Bitcoin Ecosystem*. eCrime Researchers Summit. (Fondateur sur l'analyse de mixage.)

Les URL sont instables ; les références se localisent par émetteur et titre.

## Annexe C — Glossaire-éclair

Les quinze termes les plus utiles comme ancres pour le cours. Chacun renvoie à l'entrée correspondante du *OSINT-Crypto Glossary*.

- OSINT — Glossary #1
- Pivot — Glossary #4
- Attribution — Glossary #9
- Chain of custody — Glossary #10
- OPSEC — Glossary #15
- Blockchain — Glossary #16
- EOA — Glossary #17
- Smart contract — Glossary #18
- Wallet — Glossary #21
- Private key / seed phrase — Glossary #22
- AMM — Glossary #27
- Liquidity Pool — Glossary #26
- Rugpull — Glossary #36
- Block explorer — Glossary #51
- Heuristic vs deterministic attribution — Glossary #58

## Annexe D — Éléments de réponse aux exercices conceptuels

Les réponses ci-dessous sont méthodologiques. Elles décrivent ce qu'il faut chercher, comment raisonner, ce qu'il faut enregistrer ; elles ne décrivent pas comment agir, attaquer ou extraire de la valeur.

### Leçon 1

1. La base de données de la banque peut être éditée par la banque ; une blockchain publique ne peut être éditée après finalisation d'une transaction, et son contenu est lisible par quiconque.
2. La chaîne peut prouver qu'une adresse donnée a signé des transactions précises et que des fonds ont circulé entre adresses. Elle ne peut prouver l'identité de la personne physique contrôlant l'adresse, ni l'intention.
3. Un dossier est « périmé » lorsque ses *interprétations* ne reflètent plus les preuves disponibles, alors même que les faits on-chain sous-jacents restent inchangés.

### Leçon 2

1. La note confond l'adresse et son contrôleur. L'affirmation complète nomme l'adresse qui a agi, identifie celle-ci comme EOA ou contrat, et (en C3) attribue le contrôle de la clé privée avec une étiquette de force.
2. Le pattern de financement de l'adresse (clusters de dépôt style CEX vs financement isolé), de gros flux entrants en provenance de nombreuses EOA typiques de dépôts clients, et l'interaction avec une infrastructure custodial connue.
3. Refuser et avertir la victime que toute partie demandant une seed phrase ou une clé privée est le prochain attaquant. La possession d'une seed phrase équivaut au contrôle du wallet ; un analyste légitime n'en a jamais besoin.

### Leçon 3

1. Une fonction mint active appelable par une adresse propriétaire (vérifiable depuis le code source et l'état du propriétaire) ; un proxy d'upgradability avec un admin actif (vérifiable depuis le slot d'admin du proxy) ; une fonction blacklist ou taxe de transfert active (vérifiable depuis le code source). L'observation tranche la présence ; l'usage adversariel est une question distincte.
2. Vérifier on-chain que l'adresse propriétaire est l'adresse zéro ou un contrat sans chemin de transfert de propriété ; qu'aucun proxy d'upgrade ne peut restaurer la propriété ; que l'annonce du projet et l'état on-chain s'accordent.
3. Les flux d'actifs natifs sont nécessaires mais non suffisants. La fraude retail passe typiquement par un token de projet dont le contrat porte les dispositions malveillantes ; les actifs natifs sont en périphérie.

### Leçon 4

1. Les LP tokens correspondant à la pool du projet ont été rachetés par une adresse attribuée à l'équipe, et les actifs sous-jacents sont sortis, laissant la pool vide ou quasi-vide.
2. La proportion de LP tokens détenus par des adresses attribuées à l'équipe ; si les LP tokens sont détenus par un contrat de verrou vérifiable avec expiration déclarée ; la taille de la pool relativement au volume attendu.
3. L'AMM tarifie le swap en fonction des *réserves de la pool*. L'impact prix, le slippage et la vulnérabilité aux sandwichs varient avec le ratio taille du trade / taille de la pool, non avec la taille absolue.

### Leçon 5

1. La transaction de la victime et les deux transactions adjacentes, avec leur ordre d'inclusion ; les réserves de la pool avant, entre et après ; et une relation (financement ou comportementale) entre les adresses encadrantes, étayant l'inférence d'un opérateur commun.
2. Parce que le MEV extrait de la valeur depuis la visibilité de l'intention en attente — la visibilité est elle-même le levier.
3. Un wallet ancien est une empreinte appariable d'un dossier à l'autre, peut fuiter l'identité de l'analyste et peut être front-run sur son activité routinière. Un wallet frais, financé étroitement, limite l'empreinte.

### Leçon 6

1. La date de première activité ; si l'adresse est une EOA ou un contrat ; le volume et la composition d'actifs de ses flux principaux ; les principales contreparties (dépôts CEX, bridges en particulier) ; toute étiquette interprétative, traitée comme une piste.
2. Le statut « contrat vérifié » est un fait. L'étiquette « scam » est une piste : elle requiert une attribution à une source, une date et une raison ; même une étiquette solide peut être obsolète.
3. Quelles entrées on-chain l'enrichissement a utilisées (quelles adresses, quelle fenêtre temporelle) et quelles heuristiques il a appliquées (règles de clustering, méthodologie de taint). Un dossier qui ne sait répondre à aucune devrait citer les transactions sous-jacentes.
4. Les contrats EVM déplacent la valeur en effets de bord d'appels. L'onglet *transactions* ne montre que l'appel de premier niveau, tandis qu'*internal transactions* montre les mouvements effectifs.
5. L'enquêteur ne connecte jamais un wallet d'enquête à un contrat sous investigation via l'interface write de l'explorer ; l'enquête est en lecture seule.

### Leçon 7

1. Le rachat des LP tokens par des adresses attribuées à l'équipe ; l'abandon des canaux off-chain ; la chronologie des deux par rapport aux communications publiques de l'équipe sur la liquidité.
2. Enregistrer chaque événement avec son horodatage, la preuve sous-jacente et une description de *l'action*, non de son interprétation. Un lecteur devrait inférer le schéma feuilleté à partir de la séquence.
3. Off-chain plutôt drainer : un domaine sosie imitant un protocole familier, un canal de distribution de phishing. On-chain plutôt drainer : une transaction unique balayant le wallet de la victime peu après signature, vers une adresse fraîchement financée qui consolide de nombreuses transactions similaires.
4. Un diagnostic précoce devient le prisme par lequel les preuves suivantes sont lues ; le biais de confirmation s'accélère si le diagnostic est verrouillé avant les preuves.

### Leçon 8

1. Source, date de capture, hash, rédactions. La source prévient l'ancrage à un artefact manquant ; la date prévient la supposition implicite de fraîcheur ; le hash prévient les contestations de manipulation ; les rédactions préviennent les omissions invisibles.
2. À partir d'un handle, retrouver les posts archivés et actuels citant une adresse ; vérifier l'adresse on-chain pour les relations attendues d'un wallet d'équipe ; pivoter depuis tout domaine ou compte de code-hosting associé ; corréler avec les flux de trésorerie on-chain.
3. L'enveloppe OSINT, ce sont les *sources publiques uniquement*. Pretexting, ingénierie sociale, intrusion et SIM-swap sont hors discipline et hors loi ; tout matériel obtenu hors enveloppe contamine le dossier.
4. La faiblesse est de supposer que la page actuelle reflète l'histoire publique complète ; le remède est de consulter les archives web pour des captures antérieures et de comparer la trajectoire de la page dans le temps.

### Leçon 9

1. C2 : « [date, heure, fuseau] — LP tokens rachetés ; actifs sous-jacents transférés vers l'adresse [X] ; réserves de la pool observées comme [...]. Preuve : txhash [...]. » C3 : « Adresse [X] attribuée à l'équipe — force : modérée. Observations étayantes : post d'équipe archivé citant [X] comme multisig ; message de commit référençant [X]. »
2. Quels prix ont été utilisés, avec leur source et leur horodatage ; quelles adresses ont été attribuées à quels acteurs ; les hypothèses sur le double comptage entre chiffres de volume ; si le volume ajusté pour wash trading a été utilisé.
3. Un constat est établi par les preuves propres au dossier ; une piste est un indice tiers qui doit lui-même être étayé. Une étiquette « scam » est une piste tant que le dossier ne produit pas ses propres constats corroborants.
4. Le rôle du dossier est de *décrire* ; les revendications normatives appartiennent à C8. Mélanger du langage normatif dans C6 incline inconsciemment le matériel descriptif vers la recommandation, affaiblissant la discipline.

### Leçon 10

1. « J'ai établi les faits on-chain et une attribution modérée ; je ne suis pas en position de publier le nom de manière responsable, et je vais référer le dossier à l'autorité appropriée pour la qualification d'intention. »
2. Séparation des identifiants d'enquête et personnels (prévient le doxxing inversé) ; relecture par un lecteur indépendant (prévient la surdétermination) ; transmission préalable du dossier à l'autorité pertinente (prévient la perte du dossier si la réplique publique perturbe l'analyste).
3. Une remise transmet le dossier, avec ses preuves et ses attributions étiquetées, à un organe ayant qualité et ressources pour agir. Une publication publique expose les affirmations à un public bien plus large, avec des garanties procédurales plus faibles pour les cibles et une exposition significative pour le publieur.
4. Principe de clôture : « le cours vous apprend à comprendre, à lire, à enregistrer et à signaler ; il ne vous apprend pas à attaquer, à drainer, à frauder ou à punir. » Une décision que vous changeriez si vous l'oubliiez : la quantité de publication sur une plateforme publique avant que le dossier n'ait été remis à l'autorité appropriée.

---

## Disclaimer

Ce document est pédagogique. Il ne constitue pas un avis juridique, n'autorise aucune action qui serait illégale dans la juridiction du lecteur, s'appuie exclusivement sur des sources publiques, et ne formule aucune recommandation opérationnelle dont l'application constituerait elle-même une infraction.

Le cours décrit une méthodologie d'enquête. Plusieurs sections font référence à des techniques associées à des conduites criminelles (phishing, drainers, ingénierie sociale, manipulation de marché, usurpation d'identité). Ces références sont descriptives des techniques en tant qu'objets d'enquête, non opérationnelles pour leur emploi.

Aucune personne, projet, adresse, transaction ou événement réel n'est nommé dans ce document. Lorsque le cours fait référence au corpus INTERLIGENS Research au sens large, c'est parce que le cours est lui-même un document de ce corpus ; aucun autre produit, service, personne ou institution n'est endossé par mention.

INTERLIGENS Research, 2026. Sous licence Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).
