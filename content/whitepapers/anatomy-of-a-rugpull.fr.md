---
title: "Anatomie d'un rugpull — Décomposition technique et comportementale"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs", "chercheurs", "journalistes", "investisseurs", "responsables-conformité", "étudiants"]
abstract: "Étude monographique du mécanisme du rugpull sur les marchés de cryptomonnaies. Le document retrace le cycle de vie d'un rugpull, depuis la préparation jusqu'à la post-mortem, en passant par la promotion, le pic et l'extraction, et couvre à la fois la couche technique (smart contracts, pools de liquidité, MEV) et la couche comportementale (récit fondateur, psychologie des victimes, dynamique communautaire). Il est conçu comme un complément du whitepaper Dark Patterns Crypto, focalisé sur un seul schéma d'attaque, traité dans le détail."
---

## 1. Préface

Le document compagnon de ce papier, *Dark Patterns in Crypto : une taxonomie des tactiques de manipulation*, recensait quinze schémas persuasifs observés sur la surface qui conduit un participant retail jusqu'à la signature de wallet. Ce travail était délibérément large : il décrivait la couche *amont* de la manipulation, laissant à d'autres documents le soin de traiter ce qui se passe *en aval* de la signature.

Le présent whitepaper adopte la posture inverse. Il sélectionne un seul résultat aval — le rugpull — et le suit de bout en bout, des conditions qui le rendent possible aux décombres qu'il laisse derrière lui. Il est monothématique par construction. Le rugpull a été retenu parce qu'il est structurellement simple (l'opérateur s'enfuit avec une valeur mise en commun), socialement complexe (il faut qu'une communauté finance d'abord la mise en commun), et exceptionnellement bien documenté à la fois dans la littérature académique et dans la trace publique on-chain.

La méthodologie est celle de l'agrégation descriptive. Aucun projet, aucune personne, aucune plateforme d'échange, aucun token, aucune enquête juridiquement située n'est nommé. Les schémas décrits ici sont reconstruits à partir du corpus académique sur la fraude crypto (Vasek & Moore, Foley et al., Xu & Livshits, Mazorra et al., Cernera et al.), des rapports annuels des principales sociétés d'analyse on-chain et des agences de poursuite, et du registre public on-chain des déploiements permissionless depuis 2017. Les cas fictifs utilisés ailleurs dans le présent corpus pédagogique ne sont pas réemployés ici ; ce document reste délibérément au niveau de la typologie.

Le lectorat visé est large : enquêteurs qui construisent un modèle mental de ce qu'ils reconstruisent après les faits ; chercheurs en quête d'un vocabulaire structuré ; journalistes rédigeant un papier explicatif ; investisseurs retail cherchant à comprendre comment les actifs qu'ils détiennent peuvent disparaître en une nuit ; responsables conformité évaluant un risque de contrepartie ; étudiants abordant le sujet pour la première fois.

Une dernière remarque a sa place dans la préface. Le document décrit, il n'enseigne pas. Les sections 4 (Préparation), 5 (Lancement et promotion) et 7 (Extraction) sont précédées d'un encadré de prudence et rédigées au passé descriptif afin de marquer la distance entre la description analytique et le tutoriel opérationnel. Un lecteur cherchant un mode d'emploi pour escroquer des investisseurs ne trouvera pas ici de recette utilisable ; un lecteur cherchant à reconnaître le prochain rugpull pendant qu'il se déploie pourra y trouver des points d'appui.

## 2. Définition et périmètre

Un *rugpull* est le retrait, brutal ou progressif, par les opérateurs d'un projet crypto, de la valeur déposée par des participants tiers dans un pool, sur la base d'un engagement implicite ou explicite que ces fonds seraient utilisés pour une activité continue. Le trait définissant est la *rupture de l'engagement* : l'opérateur cesse d'être opérateur et devient détenteur de la liquidité de sortie. Dans le jargon du métier, l'opérateur « tire le tapis » (*pull the rug*) sous les pieds des holders.

Ce n'est pas le seul usage colloquial du terme. Au quotidien, le mot s'applique vaguement à toute chute de prix, même sans composante frauduleuse. L'usage académique et l'usage d'enquête sont plus stricts : le projet doit avoir collecté de la valeur auprès de tiers, et les opérateurs doivent avoir extrait cette valeur d'une manière qui rompt le contrat implicite de continuité d'exploitation. Un projet honnête qui échoue n'est pas un rugpull ; c'est l'absence d'intention frauduleuse qui sépare l'abandon de l'extraction. La distinction est conceptuellement nette et opérationnellement floue — voir §11.

La taxonomie ci-dessous distingue quatre sous-types, choisis pour la clarté descriptive qu'ils offrent plutôt que pour une prétention à l'exhaustivité.

- **Hard rugpull.** La liquidité qui soutient le token est retirée du DEX en une transaction unique ou un bloc serré. L'échange devient impossible, le token cote à zéro contre l'actif de paire, et la valeur détenue par les participants retail s'évapore en quelques secondes. La signature mécanique est sans ambiguïté sur le registre public.

- **Soft rugpull.** Les opérateurs ne retirent pas la liquidité d'un coup ; à la place, les wallets de l'équipe écoulent leurs allocations sur le marché en quelques heures, jours ou semaines, faisant baisser progressivement le prix tout en niant l'intention. Le résultat final est le même — les opérateurs sont sortis, la communauté détient un actif inerte — mais la signature on-chain est diffuse sur de nombreuses transactions et plus difficile à attribuer comme acte coordonné.

- **Liquidity migration scam.** Les opérateurs annoncent une migration du projet vers un « nouveau contrat », une « nouvelle chaîne », ou un « token v2 », et invitent les holders à échanger ou *stake* leurs tokens via un contrat ou un front-end qui ne livre pas ce qu'il promet. Le contrat de migration est le véhicule d'extraction. Le schéma est structurellement proche d'une campagne de phishing lancée par les opérateurs contre leur propre communauté.

- **Slow rug.** Variante hybride dans laquelle le projet continue de fonctionner à un faible niveau d'activité, tandis que les opérateurs diluent l'offre (mints non annoncés, accélérations de releases vested, ventes du trésor) et sortent la valeur progressivement. La communauté est maintenue engagée par une fine couche d'activité jusqu'à ce que l'actif soit vidé. Les slow rugs sont les plus difficiles à dater et les plus contestés dans l'attribution.

Le document ne couvre pas : les exit scams centralisés où une plateforme d'échange ou un service de garde s'évanouit avec les dépôts (catégorie voisine mais distincte, traitée ailleurs dans la littérature, voir Glossaire #37) ; l'extraction MEV pure (sandwich attacks, arbitrage, voir Glossaire #41 et #42) ; les attaques de gouvernance sur des organisations autonomes décentralisées ; ni les exploits de smart contract où un attaquant externe vide un protocole qui opérait de bonne foi. Chacun de ces sujets possède sa propre grammaire et mérite son propre document.

Pour le vocabulaire interne, le lecteur est renvoyé aux entrées du Glossaire #36 (rugpull), #37 (exit scam), #38 (honeypot) et #39 (pump and dump), qui délimitent ensemble le voisinage conceptuel.

## 3. Préconditions économiques et culturelles

Un rugpull ne surgit pas du vide. Il requiert un ensemble de conditions de marché, techniques et sociologiques, dont aucune n'est suffisante isolément mais dont la combinaison compose le terreau dans lequel ce schéma pousse fiablement.

**Conditions de marché.** Les rugpulls s'agrègent dans les phases de bull market local. Le mécanisme est direct : l'entonnoir des capitaux retail entrants s'élargit, la durée médiane de détention raccourcit, la disposition à allouer à des tokens non audités augmente, et le coût social de la due diligence baisse parce que toute prudence excessive ressemble rétrospectivement à une opportunité ratée. Le taux de base de lancements frauduleux suit le taux de base de tous les lancements avec un certain décalage : quand le marché chauffe, la proportion de lancements de mauvaise foi dans le flux total ne diminue pas, et peut augmenter. Vasek & Moore (2015) ont observé la même dynamique dans l'écosystème naissant des scams Bitcoin ; les rapports annuels Crypto Crime de Chainalysis documentent la même cyclicité sur les cycles plus récents de tokens.

**Conditions techniques.** L'infrastructure de déploiement permissionless des blockchains contemporaines est la seconde précondition. Le coût en capital pour émettre un token sur une chain à smart contracts généraliste se mesure en fractions d'une unité de l'actif natif. Le coût en compétences est analogue : des contrats template sont largement disponibles, le déploiement par copier-coller est une pratique documentée, et des launchpads dédiés abstraient l'essentiel de la friction résiduelle. Sur les chains optimisées pour la vitesse et le faible gas, le plancher technique tend vers zéro. Un opérateur de mauvaise foi n'a pas à franchir de barrière infrastructurelle ; les mêmes rails qui abaissent le coût de l'expérimentation légitime abaissent le coût de l'imitation frauduleuse.

**Conditions sociologiques.** La troisième précondition est l'économie de l'attention qui entoure cette infrastructure technique. Les *key opinion leaders* (Glossaire #61) et les influenceurs (#66) opèrent dans un marché de la réputation où être tôt est récompensé et où se tromper est pardonné sur un cycle court. Leur incitation est de faire émerger la nouveauté, et le coût de faire émerger un projet frauduleux est supporté principalement par leur audience, non par eux-mêmes. La littérature comportementale documente les biais sous-jacents : peur de manquer (FOMO), preuve sociale, négligence du taux de base, aversion à la perte appliquée asymétriquement aux gains, effet de disposition (Kahneman & Tversky, résultats classiques). Le whitepaper compagnon *Dark Patterns* (§A sur l'urgence fabriquée, §B sur la pression sociale, §D sur la falsification financière) décrit la façon dont ces biais sont opérationnalisés par le design d'interface et le design discursif.

Un cadre utile emprunté à Foley, Karlsen & Putniņš (2019), qui étudiaient l'activité illicite sur Bitcoin : la taille de la cohorte illicite n'est pas déterminée par l'offre de mauvais acteurs (essentiellement illimitée) mais par la porosité du système environnant. Une grappe de rugpulls est une mesure de porosité, pas de malveillance.

## 4. Phase 1 — Préparation

> **⚠ Note sur cette section.** Ce qui suit est une reconstruction descriptive de la phase de préparation telle qu'elle a été documentée dans le registre public. Le texte est rédigé au passé descriptif pour marquer la distance avec toute lecture opérationnelle. Aucune séquence, aucun paramètre, aucun artefact ci-dessous n'est fourni avec la spécificité requise pour reproduire le schéma ; les lecteurs cherchant un tutoriel n'en trouveront pas.

La phase de préparation, c'est l'*avant* : tout ce qui a été mis en place au moment où le premier participant tiers voit le projet. Dans un hard rugpull, cette phase a souvent consommé plus de temps que la campagne active qui a suivi.

**Choix de la chain.** Les opérateurs ont historiquement sélectionné la chain de déploiement selon trois critères : le coût marginal de déploiement et de transaction (favorisant les chains à faible gas natif), la taille et la composition du public retail déjà présent sur la chain (favorisant les chains à canaux sociaux actifs et launchpads accessibles), et l'effort perçu nécessaire pour l'attribution forensique (favorisant les chains dont l'écosystème d'outils d'analyse on-chain est plus jeune ou dont la surface de bridging accroît le coût d'une reconstruction cross-chain). Le choix n'est pas une décision technique ; c'est une décision de *market-fit*.

**Choix du DEX et de la paire de trading.** Sur la chain retenue, les opérateurs ont typiquement déployé sur le DEX permissionless dominant (Glossaire #29), en appairant le nouveau token contre l'actif natif, un stablecoin majeur, ou un équivalent wrappé. Le choix de la paire détermine ce qui sera extrait à la fin : une paire USDC extrait de l'USDC ; une paire en actif natif extrait l'actif natif et expose les opérateurs à la volatilité propre de cet actif pendant la campagne.

**Contrat token.** L'artefact on-chain a typiquement été un contrat de token fongible standard (ERC-20 sur les chains EVM, SPL sur Solana, équivalents ailleurs). Les points de décision historiquement observés dans le registre public concernent des fonctionnalités qui affectent matériellement le comportement du contrat après déploiement : si l'offre est *mintable* au-delà de l'émission initiale, si des adresses peuvent être *blacklistées* du transfert, si des fees de transfert sont prélevés et peuvent être modifiés, et si le contract owner conserve la capacité d'altérer des paramètres ou y a renoncé. Chacune de ces fonctionnalités a des usages légitimes ; chacune est aussi structurellement présente dans les variantes frauduleuses documentées par la littérature académique (Mazorra et al. 2022 ; Cernera et al. 2023). L'absence d'audit, ou la présence d'un audit non vérifiable contre une méthodologie publiée et un auditeur nommé, a été un compagnon récurrent.

**Architecture de wallets.** La topologie de wallets pré-lancement a typiquement comporté au moins : une adresse de déploiement à partir de laquelle le contrat de token est créé, une ou plusieurs adresses d'équipe recevant une allocation initiale, une adresse marketing servant à financer la promotion, et l'adresse fournisseuse de liquidité qui amorcera le pool au lancement et qui, dans la variante hard, sera l'adresse qui le videra. Les relations entre ces adresses sont souvent obscurcies par un routage intermédiaire, l'usage de mixers ou de bridges, et le recyclage d'adresses à travers des projets antérieurs sans lien apparent.

**Artefacts narratifs.** Un whitepaper, un site web, des présences sur les canaux sociaux (typiquement X, Telegram, Discord), et parfois un dépôt GitHub à allure de projet de développement, ont été préparés à l'avance. L'âge visible de ces artefacts est l'un des rares signaux ex ante faiblement informatifs : dans les cas documentés au registre public, les artefacts narratifs ont souvent été fraîchement créés, le site web a été bâti à partir d'un template, et le dépôt de développement, lorsqu'il était présent, a montré un historique de commits mince et concentré sur une courte fenêtre.

**Échafaudage réputationnel.** La phase de préparation a aussi inclus la fabrication ou l'achat de signaux sociaux. Les pratiques documentées incluent l'acquisition de followers sur les plateformes sociales, l'orchestration de mentions précoces par des influenceurs payés ou payés en sous-main, la mise en scène de mentions sur des projets adjacents, et la publication de pages « audit » renvoyant à des PDF dont la provenance ne peut être confirmée. Le whitepaper compagnon *Dark Patterns* (§B.1 sur l'astroturfing et les sockpuppets, §E.1 sur l'empilement d'impersonation) décrit cette famille de techniques en détail.

Le produit de la phase de préparation est un projet qui, de l'extérieur, affiche les marqueurs de surface d'un lancement légitime : un contrat on-chain, un pool amorcé sur une plateforme connue, un site web, des canaux sociaux, une page d'audit, et un petit nombre de voix discutant déjà du projet. Le lancement peut commencer.

## 5. Phase 2 — Lancement et promotion

> **⚠ Note sur cette section.** Comme au §4, cette section reconstruit la phase de lancement et de promotion à partir du registre public. La description porte sur des marqueurs de surface observables et ne fournit pas de détails de configuration.

Le lancement est le moment où la structure préparée commence à interagir avec un capital externe. Du point de vue forensique, c'est la phase qui génère l'essentiel des artefacts hors-chaîne (posts, captures, journaux de chat) qu'un enquêteur devra reconstituer ensuite.

**Amorçage de liquidité.** Le pool a typiquement été amorcé par la propre adresse fournisseuse de liquidité de l'opérateur, avec une quantité de l'actif natif ou du stablecoin libellée dans la paire, contre une allocation initiale du nouveau token. Le rapport entre ces deux côtés définit le prix implicite initial. Dans les schémas documentés par la littérature académique sur les *token spammers* (Cernera et al. 2023), le montant d'amorçage a souvent été faible par rapport à l'offre, avec l'intention explicite de produire une réponse en prix abrupte à une entrée retail même modérée.

**Premiers acheteurs.** Les premières entrées ont fréquemment été le fait d'adresses soit directement contrôlées par l'équipe opérateur, soit coordonnées avec elle : sniper bots (Glossaire #65) calibrés pour détecter le bloc de création du pool et exécuter un achat dans la première fenêtre de transaction disponible, et adresses préfinancées ayant placé des ordres avant l'annonce publique. L'effet, visible de l'extérieur comme une chandelle d'ouverture verticale, a été d'inscrire l'impression que le projet avait été « manqué » par quiconque n'était pas positionné à l'avance. Le whitepaper compagnon *Dark Patterns* §A.1 (fake countdown) et §A.2 (théâtre de la rareté) décrit les tactiques d'interface amont qui préparent le retail à réagir à ce type d'ouverture.

**Première vague de promotion.** Dans les minutes qui suivent l'ouverture, des posts coordonnés sur les plateformes sociales ont typiquement débuté : messages synchronisés sur X portant les mêmes hashtags et les mêmes templates visuels, raids sur des chats Telegram sans rapport avec le projet, et démarchage d'influenceurs *mid-tier* offrant une allocation en échange de posts. Le whitepaper compagnon *Dark Patterns* §B.1 (astroturfing) décrit la structure de fond ; la différence au moment du lancement est l'intensité plutôt que la nature.

**Construction du récit.** En parallèle de l'action sur le prix, un récit a été mis en place : une roadmap déclarant des jalons à trois, six et douze mois ; un airdrop esquissé sans être exécuté ; des partenariats annoncés avec des noms qui, à l'inspection, se révèlent souvent être soit des références unilatérales (le partenaire n'a pas confirmé) soit réels mais mineurs. Le récit sert deux fonctions : il fournit une raison de détenir plutôt que de vendre, et il fournit une raison de recruter d'autres holders.

**Mécaniques d'engagement.** Des dispositifs de staking, des drops compagnons en NFT, des distributions par loterie et des programmes de parrainage ont été routinièrement déployés dès les premiers jours. Chacun de ces dispositifs accroît la surface sociale du projet et, mécaniquement, immobilise une partie de l'offre qui circulerait autrement. La double fonction est engagement et réduction du flottant ; la seconde est la plus importante pour la suite.

**Détection au moment du lancement.** L'honnêteté impose de reconnaître la difficulté de la détection à ce stade. Pour un participant sans outillage forensique, la surface d'un lancement frauduleux est souvent indissociable de celle d'un lancement légitime mais optimiste. Les signaux qui séparent les deux sont statistiques (clustering de wallets, statut du lock LP, statut de l'ownership du contrat), pas perceptuels. Les schémas énumérés au §10 décrivent ce qui peut être inspecté ex ante ; les schémas énumérés au §4 décrivent ce que l'opérateur a mis en place pour mettre en échec cette inspection.

Pour la méthodologie de reconstruction a posteriori de cette phase, le lecteur est renvoyé à la *Checklist d'investigation* §5 (collecte d'identifiants hors-chaîne) pour la forensique des plateformes sociales, et §6 (schémas comportementaux) pour l'attribution post-pattern.

## 6. Phase 3 — Pic et euphorie

La troisième phase est l'apogée de la courbe de prix. Elle est plus courte que les deux phases qui l'ont précédée — typiquement de quelques heures à quelques jours — et c'est la phase où l'écart entre le récit social et la posture interne de l'opérateur s'élargit à son maximum.

Les marqueurs visibles au pic sont bien documentés. Le prix a atteint son plus haut historique par rapport à l'actif de paire. Le volume on-chain est à son maximum de session ; les réserves du pool sur la plateforme d'échange sont d'une taille telle que même l'équipe opérateur subirait du slippage si elle tentait de sortir en une seule transaction. L'histoire a franchi la frontière des canaux propres du projet pour entrer dans les médias crypto secondaires : flux agrégateurs, comptes de capture d'écran, influenceurs *tier-2* qui n'étaient pas dans la vague de coordination initiale mais qui ressentent désormais la pression de commenter ce qui est manifestement *trending*. Le flux retail est à son maximum ; les entrants tardifs paient les prix les plus élevés, avec l'horizon de détention attendu le plus court et l'information la plus faible sur ce qu'ils détiennent.

À l'intérieur de l'équipe opérateur, la posture a commencé à s'inverser. La communication publique qui était hyperactive au §5 commence à s'amincir. Des jalons de roadmap promis pour le troisième mois sont silencieusement repoussés sous couvert de « difficultés techniques ». Certains canaux — typiquement les canaux où les holders posent les questions opérationnellement les plus précises — deviennent silencieux ou sont modérés avec une latence croissante. Les adresses des wallets de l'équipe, lorsqu'elles sont visibles, commencent à montrer une activité préparatoire : consolidation de petits soldes, transactions de test, financement d'adresses intermédiaires fraîches sans historique préalable.

Les signaux faibles du pic sont réels mais rarement détectés en temps utile. La raison est asymétrique : l'opérateur a une information parfaite sur l'extraction à venir et zéro incitation à la faire émerger ; la communauté a une information imparfaite sur sa propre exposition et une forte disposition à ne pas faire émerger ce qui ferait s'effondrer le prix. La littérature sur l'effet de disposition, sur le comportement grégaire des investisseurs crypto (Xu & Livshits 2019 sur la dynamique des pump-and-dump), et sur le coût social de l'expression baissière publique pendant une phase haussière communautaire explique cette sous-détection. Les signaux qui *permettraient* une prévision — activité des wallets opérateurs, amincissement du récit, latence anormale sur les canaux — exigent à la fois un outillage forensique et la disposition à agir contre la direction dominante de la communauté, ni l'une ni l'autre n'étant l'état par défaut d'un participant retail à ce stade du cycle.

Rétrospectivement, le pic est le moment le plus dense en information de tout le cycle de vie. Quasiment chacun des signaux qu'un enquêteur utilisera pour reconstruire l'opération post hoc était déjà observable ici. La difficulté n'est pas que l'information ait été cachée ; la difficulté est que le cadrage à travers lequel l'information était présentée rendait socialement coûteux d'agir sur elle.

## 7. Phase 4 — Extraction

> **⚠ Note sur cette section.** L'extraction est le moment du rugpull proprement dit. Les mécanismes ci-dessous sont décrits au niveau de la typologie, non de l'implémentation. Aucune combinaison de paramètres, d'adresses, de signatures de contrat ou de détails de séquençage qui pourrait être transposée par un lecteur de mauvaise foi en plan opérationnel n'est fournie. Les indicateurs forensiques utiles à la reconstruction a posteriori sont listés ; les instructions opérationnelles ne le sont pas.

La phase d'extraction convertit la valeur mise en commun par la communauté en valeur liquide détenue par l'opérateur. La mécanique se distribue selon deux axes : le mécanisme technique par lequel la valeur se déplace, et la posture communicative que les opérateurs adoptent pendant qu'elle se déplace.

### 7.1 Variantes techniques

> ⚠️ **Usage forensic uniquement.** Cette section décrit des indicateurs forensic observables après déploiement ou lors d'une revue post-incident. Ce n'est ni un guide de déploiement, ni un guide de paramétrage, ni une liste d'implémentation. Aucun code, valeur, signature ou séquence opérationnelle n'est fourni.

Les variantes techniques observées dans le corpus académique et d'enquête se regroupent dans les quatre familles introduites au §2 et détaillées ici.

**Retrait brutal de liquidité.** Le mécanisme le plus direct est le retrait de la position de fournisseur de liquidité du DEX par l'adresse opératrice qui l'avait initialement déposée. Le pool s'effondre, la cote du token contre l'actif de paire tombe à zéro en un seul bloc, et le trading devient mécaniquement impossible. La signature on-chain est une transaction unique (ou un groupe serré) impliquant le contrat fournisseur de liquidité, l'adresse de l'opérateur, et le retrait des réserves du côté de la paire vers un chemin de routage typiquement pré-établi. La transaction est visible immédiatement sur n'importe quel block explorer (Glossaire #51).

**Vente progressive par l'équipe.** Variante plus douce dans laquelle les allocations de l'équipe, souvent réparties sur plusieurs adresses, sont écoulées sur le marché par portions calibrées sur une période allant de quelques jours à plusieurs semaines. Chaque vente individuelle est suffisamment petite pour être absorbée sans faire s'effondrer le prix ; l'effet cumulatif est un transfert régulier de valeur des acheteurs entrants vers les adresses sortantes de l'équipe. La signature on-chain est diffuse : un flux de transactions de taille modérée, émanant d'adresses dont la propriété commune peut parfois être inférée par des heuristiques de clustering (Glossaire #53, #54), mais qui est rarement indéniable à partir d'une seule observation.

**Extraction par véhicule de migration.** Variante communicative dans laquelle les opérateurs annoncent une migration vers un « token v2 », un « nouveau contrat » ou une « nouvelle chaîne » et invitent les holders à interagir avec un contrat de migration ou un front-end. La migration *est* le véhicule d'extraction : elle absorbe les tokens v1, l'actif côté paire, ou l'approbation du wallet du holder, et route la valeur vers l'opérateur. Le schéma est structurellement proche d'une campagne de phishing exécutée par les opérateurs contre leur propre communauté.

**Activation du honeypot.** Variante dans laquelle le contrat de token, déployé au §4 avec les capacités nécessaires, voit ses paramètres altérés ou ses restrictions dormantes activées de sorte que les transferts depuis des adresses non opératrices sont bloqués ou redirigés vers l'opérateur. Les holders se retrouvent dans l'impossibilité de vendre. Combiné à un retrait brutal de liquidité ou à une vente progressive du côté opérateur, le holder est doublement piégé : le prix s'effondre, et la seule adresse autorisée à disposer de la liquidité résiduelle est l'opérateur. Le schéma est documenté chez Mazorra et al. (2022) comme l'un des discriminateurs qu'un classifieur d'apprentissage automatique peut utiliser pour étiqueter un contrat ex ante.

Une variante voisine mais distincte est le *blacklisting sélectif*, dans lequel des adresses spécifiques (typiquement celles identifiées par l'opérateur comme bien financées ou particulièrement actives en vente) sont ajoutées à une *blacklist* au niveau du contrat qui les empêche de transférer le token, tandis que le reste du pool peut continuer à trader pendant la durée de l'extraction.

### 7.2 Variantes communicatives

L'extraction technique est rarement accompagnée d'une communication franche. Les postures communicatives dominantes observées à travers les cas documentés incluent :

- **Le silence.** La posture la plus fréquente. L'équipe opérateur cesse simplement de répondre sur tous les canaux. La communauté est laissée à inférer le rugpull à partir de l'état on-chain.
- **Déni puis disparition.** L'équipe opérateur attribue d'abord l'effondrement du prix à une « manipulation de marché », à une « attaque coordonnée d'un concurrent » ou à un « bug technique à corriger sous peu ». Le déni achète une fenêtre d'entrée additionnelle (incluant parfois la même communauté tentant de « défendre le prix ») avant que l'opérateur ne disparaisse complètement.
- **Annonce explicite.** Rare. Dans un petit nombre de cas documentés, l'opérateur a reconnu publiquement l'extraction, souvent cadrée comme un fait accompli sans canal de contact pour restitution.
- **Inversion du cadre.** Sous-ensemble de cas dans lequel l'opérateur revient sur les canaux après l'extraction pour requalifier l'événement en échec de la communauté (pression d'achat insuffisante, défaut de conviction, trahison de membres nommés). La fonction discursive est de déplacer la responsabilité et de semer assez de confusion pour fragmenter les efforts de recouvrement.

### 7.3 Indicateurs on-chain

Pour la reconstruction a posteriori, les indicateurs les plus couramment utilisés par les enquêteurs incluent : l'horodatage du drain et le bloc dans lequel la transaction d'extraction a été finalisée ; le chemin emprunté par la valeur extraite à travers les adresses suivantes (impliquant fréquemment une *peeling chain*, Glossaire #55, conçue pour fragmenter la trace) ; l'usage de bridges cross-chain (Glossaire #30) pour déplacer la valeur extraite vers une chaîne dont l'outillage forensique est moins mature ; et la présence ou l'absence de patterns en mempool indiquant que l'extraction avait été anticipée par des MEV bots externes (Glossaire #25) qui auraient détecté les transactions préparatoires de l'opérateur et les auraient *front-runnées* ou *back-runnées*.

La méthodologie de collecte et de structuration de ces indicateurs fait l'objet de la *Checklist d'investigation* §4 (collecte d'identifiants on-chain). Pour le vocabulaire de l'attribution post hoc, voir Glossaire #57 (taint analysis), #58 (attribution heuristique vs déterministe), et #43 (drainer) pour la famille d'outils automatisés qui ont professionnalisé certaines étapes de l'extraction au cours des années récentes.

### 7.4 Enveloppe temporelle

La phase d'extraction est courte. Dans la variante hard, elle dure quelques secondes. Dans la variante migration, elle peut s'étendre sur les jours pendant lesquels les holders migrent. Dans la variante slow rug, l'extraction se brouille en une activité soutenue difficile à dater précisément. L'enveloppe temporelle est l'un des éléments qui alimentent la discussion du §11 sur la nature probabiliste de l'attribution.

## 8. Phase 5 — Post-mortem et répliques

Les conséquences d'un rugpull se déploient dans deux temporalités superposées : la réponse émotionnelle immédiate de la communauté dans les heures suivant l'extraction, et le processus plus long d'enquête, d'attribution et (rarement) de recouvrement qui peut courir sur des mois ou des années.

**L'arc communautaire.** Dans les heures suivant l'extraction, les canaux de chat qui survivent à la modération passent par une séquence reconnaissable : une première vague d'incrédulité et de demandes de confirmation (« le contrat est en pause ? c'est un bug du block explorer ? ») ; une vague de colère dirigée contre les opérateurs, contre les influenceurs qui ont promu le projet, et contre les holders bruyants qui sont accusés, souvent à tort, d'avoir été complices ; une vague de marchandage dans laquelle émergent des propositions pour « racheter » le projet, monter une action de groupe, ou négocier directement avec l'équipe opératrice par n'importe quel canal qui resterait actif ; et enfin une vague de retrait dans laquelle la majeure partie de la communauté cesse simplement de s'engager. L'arc comprime les étapes de Kübler-Ross dans une plage de quelques jours. Il n'est pas propre à la crypto, mais la vitesse et la totalité de la perte le compriment plus que dans la plupart des autres environnements financiers.

> **⚠ Note sur les scams secondaires.** La fenêtre post-rugpull est elle-même un environnement de ciblage. Dans les heures qui suivent, un écosystème parallèle de « services de recouvrement », « avocats en récupération d'actifs » et « consultants en forensique blockchain » contacte routinièrement les victimes via les mêmes canaux où elles viennent d'exprimer leurs pertes. L'écrasante majorité de ces démarchages, telle que documentée à travers de multiples communications publiques de forces de l'ordre et alertes consuméristes, sont eux-mêmes frauduleux — conçus pour extraire une seconde tranche de valeur auprès d'une population préconditionnée par la première perte à agir sous pression émotionnelle. Le lecteur est renvoyé au whitepaper *Dark Patterns* §E.1 (empilement d'impersonation) pour la grammaire générale de la fraude par ciblage secondaire.

**Enquêtes communautaires.** Une sous-partie de la communauté affectée tente typiquement une enquête : agréger des captures d'écran des posts de l'équipe opératrice, reconstruire la topologie des wallets à partir de requêtes publiques sur un block explorer, comparer les artefacts narratifs du projet à des artefacts antérieurs pour détecter une réutilisation de template entre rugpulls, et publier les résultats. La qualité des enquêtes communautaires varie largement ; dans les cas les mieux documentés elle a produit des reconstructions atteignant un standard journalistique, dans les pires elle a produit des erreurs d'attribution qui ont causé un préjudice secondaire à des tiers innocents. La *Checklist d'investigation* §3 (préservation des preuves) et §8 (limites méthodologiques et signaux d'alerte) couvrent le minimum procédural pour que ce travail soit utile plutôt que nocif.

**Attention journalistique et académique.** La couverture par les médias spécialisés et généralistes dépend de la magnitude de la perte, de la notoriété du projet, et de la présence de victimes secondaires identifiables. La littérature académique sur la longue traîne des rugpulls (Cernera et al. 2023, sur la population des token spammers) suggère que la grande majorité des cas ne reçoit aucune couverture et n'est enregistrée que sur le registre on-chain et dans les statistiques agrégées des sociétés d'analyse on-chain.

**Suite judiciaire.** Les suites légales d'un rugpull sont structurellement difficiles. Les opérateurs sont fréquemment pseudonymes, la valeur a fréquemment transité par une infrastructure transfrontière, l'ancrage juridictionnel d'une transaction DEX est contesté, et la qualification pénale de l'acte varie selon les systèmes (escroquerie, abus de confiance, manipulation de marché, violation d'un devoir fiduciaire, ou absence de qualification, selon que le token a été caractérisé comme valeur mobilière, commodity ou instrument de paiement dans le cadre local). Les *Updated Guidance for VASPs* (FATF, 2021) et les rapports IOCTA annuels d'Europol documentent l'état du champ. Des poursuites abouties existent ; elles forment une minorité de cas et impliquent typiquement soit une erreur opérationnelle des auteurs (défaillance d'OPSEC, retrait depuis un exchange centralisé sous identité vérifiée), soit une coopération multi-juridictionnelle prolongée.

Le résumé honnête est que la phase post-mortem produit de l'information bien plus souvent qu'elle ne produit de la restitution. L'information a sa propre valeur — c'est le substrat du présent document — mais elle ne doit pas être confondue avec un recouvrement.

## 9. Vue technique consolidée

Cette section synthétise le cycle de vie décrit ci-dessus sous la forme d'une chronologie et d'un ensemble d'observables clés indexés par phase. Elle vise le lecteur qui veut une page de référence unique ; elle n'ajoute aucun contenu nouveau et est délibérément comprimée.

**Chronologie (enveloppe approximative, jours par rapport au lancement T) :**

- T − 30 à T − 7 : préparation. Développement du contrat, mise en place des wallets, artefacts narratifs, échafaudage des signaux réputationnels.
- T − 7 à T − 1 : promotion pré-lancement. Inscriptions whitelist, contenus teaser, coordination des participants du jour de lancement.
- T 0 : lancement. Pool amorcé, contrat ouvert au trading public, première vague de promotion.
- T 0 à T + 7 : montée. Promotion coordonnée, reprise par les médias secondaires, activation des mécaniques d'engagement.
- T + 3 à T + 30 (variable) : pic. Prix maximum, volume maximum, début de l'amincissement narratif.
- T + N : extraction. En variante hard, un bloc unique ; en variante soft, une période étalée recouvrant la phase précédente.
- T + N à T + 90 : post-mortem. Arc communautaire, ciblage par scams secondaires, enquêtes communautaires, couverture journalistique occasionnelle, suite judiciaire rare.

**Observables on-chain par phase :**

- Préparation : déploiement de contrat depuis une adresse fraîche ; inventaire des fonctionnalités du contrat (mint, blacklist, modification de fees, statut de l'ownership) ; amorçage de la position fournisseur de liquidité ; pré-financement des adresses d'équipe.
- Lancement : achats au premier bloc depuis des adresses portant des marqueurs de coordination préalable ; croissance rapide des réserves du pool ; flux net entrant soutenu.
- Montée : réserves de pool stables ou en croissance ; nombre de holders en hausse ; concentration des avoirs sur des adresses liées à l'opérateur si le clustering peut être appliqué.
- Pic : réserves de pool maximales ; les adresses liées à l'équipe commencent des transactions préparatoires ; usage de bridges cross-chain apparaît.
- Extraction : transaction de retrait de la position fournisseur de liquidité (hard) ; flux de ventes depuis les adresses de l'équipe (soft) ; interactions avec un contrat de migration (variante migration) ; altération des paramètres du contrat ou déclenchement de blacklist (variante honeypot) ; pattern de peeling chain côté réception.
- Post-mortem : dispersion vers des adresses additionnelles ; transit par mixer ou bridge cross-chain ; consolidation vers des adresses interagissant avec des exchanges centralisés ou des rampes de sortie fiat.

**Observables hors-chaîne par phase :**

- Préparation : dates de création récentes des canaux sociaux, du site web, du dépôt de nom de domaine ; marqueurs de réutilisation de template sur le site.
- Lancement : timings de posts synchronisés à travers des comptes nominalement indépendants ; ratios engagement / followers hors des distributions normales ; partenariats nommés sans confirmation réciproque.
- Montée : endorsements de KOLs apparaissant par vagues ; adoption par des influenceurs *mid-tier* ; couverture par des médias secondaires avec due diligence superficielle.
- Pic : présence opérateur s'amincissant sur les canaux opérationnellement précis ; latence en hausse sur les questions des holders ; reports cadrés en « technique ».
- Extraction : black-out de communication ; ou déni-puis-disparition ; ou rare annonce explicite.
- Post-mortem : émergence de démarchages « recovery » ; efforts de reconstruction sur des forums indépendants ; risque de mésattribution sur des tiers.

**Cinq questions pour une évaluation du risque résiduel d'un projet encore actif :**

1. La position fournisseur de liquidité est-elle verrouillée, et vérifiablement, pour une durée cohérente avec la roadmap annoncée ?
2. L'ownership du contrat de token a-t-il été renoncé, et sinon, quelles capacités spécifiques (mint, blacklist, modification de fees, pause) l'owner conserve-t-il ?
3. Quelle est la distribution des avoirs entre adresses, et quelle proportion de l'offre est concentrée sur des adresses ayant des relations de clustering avec le déployeur ?
4. Quel est l'historique vérifiable de l'équipe — projets antérieurs, identités auditées ou attestées, empreintes opérationnelles antérieures à ce projet spécifique d'un intervalle non trivial ?
5. La présence sociale autour du projet est-elle structurellement saine (distribution d'engagement organique, commentaire technique indépendant, critiques traitées sur le fond) ou structurellement astroturfée (promotion synchronisée, hostilité aux questions critiques, modération opaque) ?

Les cinq questions sont descriptives, non exhaustives. Une évaluation de risque résiduel est un exercice probabiliste ; voir §11.

## 10. Indicateurs de risque ex ante

> **⚠ Note sur cette section.** Les indicateurs ci-dessous sont des marqueurs descriptifs visibles par un enquêteur ou un participant techniquement averti. Ils ne constituent pas une check-list « comment ne pas se faire rugpuller » : aucune check-list de ce type n'est complète, parce que les opérateurs adaptent leurs méthodes à mesure que les indicateurs publics se diffusent. Les indicateurs sont un vocabulaire structuré, pas une défense.

Les indicateurs ex ante sont organisés selon la couche à laquelle ils sont observables.

**Niveau code.** Le contrat de token, lorsqu'il est publié et vérifiable contre une sortie de compilateur connue, peut être inspecté pour la présence de fonctionnalités dont la combinaison a historiquement corrélé avec un comportement de rugpull : fonction *mint* appelable par une adresse autre qu'une adresse vérifiablement brûlée ; fonction *blacklist* ; *fees* de transfert dont le taux est modifiable par une adresse opératrice ; *ownership* conservé plutôt que renoncé ; absence de *time-locks* sur les changements de paramètres ; absence d'exigence multisignature sur les fonctions à privilège opérateur. La présence d'une seule fonctionnalité n'est pas accablante ; la combinaison de plusieurs fonctionnalités non protégées est informative. La littérature sur la détection ML de rugpulls ex ante (Mazorra et al. 2022 ; Cernera et al. 2023) utilise précisément cet espace de features.

**Niveau capital.** La position fournisseur de liquidité est l'artefact unique le plus conséquent. Sa taille par rapport à la capitalisation du token, la durée d'un éventuel verrouillage, la vérifiabilité du verrouillage contre un contrat de lock réputé, et l'identité de l'adresse qui la détient sont tous observables. Au-delà de la LP, la distribution des avoirs en token entre adresses peut être inspectée : un coefficient de Gini élevé, un petit nombre d'adresses contrôlant une grande fraction de l'offre, et des relations de clustering entre les top holders et le déployeur élèvent tous la probabilité qu'une sortie par un petit ensemble d'adresses fasse bouger le prix de façon catastrophique. Les arrangements de pre-sale ou d'allocation privée, lorsqu'ils existent, peuvent être inspectés pour leur opacité : une pre-sale dont les participants ne sont pas divulgués, dont les termes ne sont pas publiés, et dont le calendrier de vesting ne peut être vérifié on-chain, est structurellement différente d'une pre-sale dont les termes sont publics et on-chain.

**Niveau équipe.** L'identité, l'historique et la surface d'accountability de l'équipe opératrice est l'indicateur le plus souvent discuté dans la conversation grand public et le plus souvent mal compris. Un « doxx » (Glossaire #50, dans son sens inverse — identité vérifiable plutôt que divulgation involontaire) n'est pas une garantie contre la fraude ; c'est une contrainte sur les options de sortie de l'opérateur. Identité vérifiable, projets antérieurs vérifiables, calendriers de vesting publics, et trace d'une présence opérationnelle antérieure au projet sont informatifs. L'absence de l'un d'eux n'est pas la preuve d'une mauvaise foi ; l'absence simultanée de tous est un signal structurel.

**Niveau social.** La communauté autour d'un projet peut être inspectée pour des marqueurs de surface d'un engagement organique versus manufacturé : la distribution de l'engagement entre comptes (une distribution saine a une longue traîne ; une astroturfée est concentrée sur un petit ensemble de comptes à fort volume) ; le ratio engagement / nombre d'abonnés pour les canaux principaux du projet (des ratios anormalement élevés ou bas sont informatifs) ; la présence de réseaux de sockpuppets identifiables (grappes de comptes créés dans la même fenêtre, suivant des ensembles qui se recoupent, postant à des horaires corrélés) ; et la réponse du projet aux questions critiques de fond (engagement substantiel versus modération, bannissement ou détournement de fil). Le whitepaper *Dark Patterns* §B.1 (astroturfing et sockpuppets) et §E.1 (empilement d'impersonation) en fournit la grammaire sous-jacente.

Les quatre couches se composent. Aucun indicateur n'est suffisant à lui seul ; la conjonction d'indicateurs à travers plusieurs couches élève la probabilité d'un résultat défavorable à un niveau auquel un participant averse au risque, selon ses propres standards internes, déclinerait de participer. La même conjonction ne constitue pas la preuve d'une intention ; nombre de projets aux marqueurs de surface médiocres se révèlent honnêtes-mais-amateurs, et certains projets aux marqueurs de surface excellents se révèlent être des fraudes sophistiquées. La discussion de pourquoi cette incertitude irréductible importe revient au §11.

Pour les renvois croisés les plus directement pertinents à cette section, voir Glossaire #36 (rugpull), #50 (impersonation), #61 (KOL) et #66 (influenceur / shill).

## 11. Limites du présent document

L'honnêteté d'un document de typologie se mesure à ce qu'il reconnaît ne pas couvrir. Cinq limites ont leur place au compte rendu.

**Typologie versus réalité.** Les quatre sous-types du §2 (hard, soft, migration, slow) sont présentés comme des catégories discrètes. La réalité est un continuum. La plupart des cas documentés présentent des traits de plus d'un sous-type — un projet qui commence en slow rug peut se terminer par un retrait hard ; un scam à véhicule de migration suit souvent une période de vente soft. Les catégories sont utiles comme prises analytiques ; elles ne doivent pas être réifiées en cases diagnostiques nettes.

**Indistinguabilité de l'échec et de l'extraction en temps réel.** Une partie des rugpulls est opérationnellement indistinguable en temps réel d'un projet honnête en train d'échouer pour des raisons non frauduleuses. Tous deux produisent une communauté qui n'est plus servie, une roadmap qui n'est plus exécutée, un token dont le prix s'effondre. L'élément distinctif est l'*intention* de l'opérateur, qui n'est pas observable. La distinction peut parfois être reconstruite a posteriori, souvent en combinant une preuve on-chain à des aveux hors-chaîne, mais sur l'instant les deux trajectoires ne sont pas fiablement séparables. C'est une difficulté pour le participant et une contrainte pour l'enquêteur.

**Attribution probabiliste.** L'attribution ex post d'un rugpull à des personnes physiques spécifiques est rarement déterministe. Elle est bâtie sur une chaîne d'inférences — clustering de wallets, corrélation d'identifiants hors-chaîne, défaillances d'OPSEC de l'opérateur, empreintes comportementales dans la communication. Chaque maillon de la chaîne porte une probabilité d'erreur. L'agrégat est une assertion probabiliste, pas une certitude forensique, même dans les cas qui ont conduit à une poursuite aboutie. L'enquêteur qui traite une sortie d'analyse on-chain comme une identification déterministe attribuera, tôt ou tard, à tort. La *Checklist d'investigation* §8 (limites méthodologiques et signaux d'alerte) discute les implications opérationnelles.

**Frontière entre rugpull intentionnel et abandon par incompétence.** Légalement et éthiquement, la distinction entre un opérateur qui a extrait avec une intention préalable et un opérateur qui a abandonné un projet sous pression personnelle et a converti le trésor résiduel à son usage propre porte un poids significatif. On-chain, les deux peuvent se ressembler. La qualification légale varie selon les juridictions et dépend fortement d'artefacts (communications internes, engagements préalables, allégations marketing) qui peuvent ou non être disponibles pour un enquêteur public. Des documents comme celui-ci ne peuvent pas résoudre la distinction ; ils peuvent seulement signaler qu'elle existe.

**Taxonomie évolutive.** Les quatre sous-types présentés ici capturent les schémas dominants de la période 2018-2025 dans le registre public. De nouvelles variantes ont été documentées dans la littérature plus récente : pre-launch rugpulls dans lesquels l'extraction se produit pendant une pre-sale ou une phase de whitelist avant tout trading public ; governance rugpulls dans lesquels l'extraction est exécutée par un vote de gouvernance apparemment décentralisé dont les participants sont contrôlés par l'opérateur ; rugpulls cross-protocoles dans lesquels l'extraction transite par plusieurs smart contracts déployés à cette fin. La taxonomie devra être révisée. Le présent document est un instantané, pas un cadre figé.

Les cinq limites ne sont pas des raisons de relativiser la typologie ; ce sont des raisons de l'utiliser avec la calibration qu'elle mérite.

## 12. Glossaire interne

Liste courte des termes les plus employés dans le présent document. Pour le vocabulaire plus large, le lecteur est renvoyé au *Glossaire OSINT et crypto* public publié aux côtés du présent papier, dans lequel chacun des termes ci-dessous est référencé par numéro.

- **Rugpull.** Retrait brutal ou progressif de valeur par les opérateurs depuis un pool financé par des participants tiers, sur la base de l'engagement implicite d'une exploitation continue. Voir Glossaire #36.
- **Hard rug.** Variante de rugpull caractérisée par le retrait de la position fournisseur de liquidité en une transaction unique ou un bloc serré.
- **Soft rug.** Variante de rugpull caractérisée par la vente progressive des allocations de l'équipe sur le marché sur une période allant de quelques jours à plusieurs semaines.
- **Honeypot.** Contrat de token dont la logique de transfert empêche les holders autres que l'opérateur de vendre. Voir Glossaire #38.
- **Drainer.** Outillage automatisé qui exécute l'étape d'extraction d'une campagne dès que les conditions d'activation sont remplies. Voir Glossaire #43.
- **Peeling chain.** Schéma dans lequel la valeur extraite est déplacée à travers une séquence d'adresses, chaque étape retirant une fraction, conçu pour fragmenter la trace. Voir Glossaire #55.
- **LP (Liquidity Provider position).** Dépôt d'actifs appariés dans un pool de DEX permettant le trading et générant des fees. Voir Glossaire #26.
- **Locked LP.** Position fournisseur de liquidité détenue dans un contrat de lock empêchant le retrait jusqu'à une date publiée.
- **Vesting.** Calendrier libérant les allocations de tokens à un bénéficiaire dans la durée plutôt qu'en une fois.
- **Doxx.** Divulgation vérifiable (volontaire ou involontaire) de l'identité derrière un acteur pseudonyme. Voir Glossaire #7, #50.
- **Sockpuppet.** Compte secondaire opéré par un acteur qui dispose déjà d'une identité, employé pour fabriquer l'apparence de voix indépendantes. Voir Glossaire #5.
- **Sniper bot.** Agent automatisé surveillant la production de blocs pour la création d'un nouveau pool de liquidité, et exécutant un achat dans la première fenêtre de transaction disponible. Voir Glossaire #65.
- **MEV (Maximal Extractable Value).** Valeur extractible par réordonnancement, insertion ou censure de transactions dans un bloc. Voir Glossaire #25.
- **Mint function.** Fonction de contrat qui crée de nouveaux tokens, augmentant l'offre.
- **Blacklist.** Mécanisme au niveau du contrat par lequel des adresses spécifiques peuvent être empêchées de transférer le token.

## 13. Références

Les références ci-dessous se limitent aux travaux que les auteurs ont lus et peuvent attester. Les items pour lesquels une incertitude résiduelle subsiste ont été omis ; une liste plus courte de références confirmées est préférable à une liste plus longue comportant des erreurs.

- Vasek, M. & Moore, T. (2015). *There's No Free Lunch, Even Using Bitcoin: Tracking the Popularity and Profits of Virtual Currency Scams.* Proceedings of Financial Cryptography and Data Security.
- Foley, S., Karlsen, J. R. & Putniņš, T. J. (2019). *Sex, Drugs, and Bitcoin: How Much Illegal Activity Is Financed Through Cryptocurrencies?* Review of Financial Studies, 32(5).
- Xu, J. & Livshits, B. (2019). *The Anatomy of a Cryptocurrency Pump-and-Dump Scheme.* USENIX Security Symposium.
- Mazorra, B., Adan, V. & Daza, V. (2022). *Do Not Rug on Me: Leveraging Machine Learning Techniques for Automated Scam Detection.* Mathematics, 10(6).
- Cernera, F., La Morgia, M., Mei, A. & Sassi, F. (2023). *Token Spammers, Rug Pulls, and Sniper Bots: An Analysis of the Ecosystem of Tokens in Ethereum and the Binance Smart Chain.* USENIX Security Symposium.
- Chainalysis. *Crypto Crime Report.* Éditions annuelles (2023, 2024).
- Europol. *Internet Organised Crime Threat Assessment (IOCTA).* Éditions annuelles.
- Groupe d'action financière (FATF). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers.* Octobre 2021.
- Brignull, H. (2010). *Dark Patterns: dark side of design.* darkpatterns.org et écrits ultérieurs.
- Mathur, A. et al. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites.* Proceedings of the ACM on Human-Computer Interaction, 3(CSCW).
- Mathur, A., Kshirsagar, M. & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods.* CHI Conference on Human Factors in Computing Systems.

Pour la littérature dark patterns en général, les références réglementaires citées dans le whitepaper compagnon *Dark Patterns in Crypto* (article 25 du DSA, rapport FTC *Bringing Dark Patterns to Light*, document de travail OCDE) restent applicables.

## 14. Disclaimer

Le présent document est publié à des fins éducatives et de recherche, sous licence Creative Commons Attribution-NonCommercial 4.0 International. Il est descriptif, non prescriptif. Il ne constitue ni un avis juridique, ni un conseil financier, ni un guide opérationnel. Il n'autorise, n'encourage ni ne facilite la conduite qu'il décrit ; les choix descriptifs au fil du texte ont été faits spécifiquement pour empêcher tout réemploi opérationnel. Les auteurs ont agrégé des schémas issus du registre public et de la littérature académique ; aucun projet, aucune personne, aucune plateforme d'échange, aucune enquête juridiquement située ne sont nommés, et aucune inférence à propos d'une entité réelle particulière ne doit être tirée des descriptions typologiques fournies.

Le lecteur est responsable de l'usage qu'il fait de ce matériel. Les décisions d'investissement, de participation ou de sélection de contrepartie sur les marchés crypto demeurent celles du lecteur, prises sous sa propre diligence, et les auteurs déclinent toute responsabilité pour les pertes ou préjudices résultant d'une confiance accordée au contenu du présent document.
