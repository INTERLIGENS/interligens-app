---
title: "Glossaire OSINT, Crypto et Investigation"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-22"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs", "chercheurs", "journalistes", "étudiants", "responsables-conformité"]
abstract: "Un glossaire de référence de 70 termes issus de trois domaines qui se recoupent : le renseignement de sources ouvertes (OSINT), les mécanismes des cryptomonnaies et des blockchains, et la méthodologie d'enquête. Les définitions sont brèves, neutres, et conscientes de leurs sources. Le glossaire est conçu pour être employé conjointement au whitepaper Dark Patterns et à la Investigation Checklist."
---

## Préface

Ce glossaire rassemble soixante-dix termes issus de trois champs qui se recoupent : le renseignement de sources ouvertes (OSINT) tel qu'il est pratiqué dans le journalisme d'investigation et dans l'appui aux services d'enquête, les mécanismes des cryptomonnaies et des blockchains tels qu'ils se présentent dans les affaires de fraude retail, et la méthodologie d'enquête qui articule les deux. Il est conçu pour être employé conjointement au whitepaper *Les Dark Patterns dans le Crypto* et au playbook *Checklist d'enquête — Affaires de fraude crypto* produits dans la même série, qu'il référence en transversal.

Le critère de sélection est opérationnel : un terme est retenu si un lecteur sans expertise spécifique est susceptible de le rencontrer en triant ou en lisant un dossier de fraude crypto, dans la presse technique relative à un incident de token, ou dans des échanges avec un conseil ou les autorités. Le vocabulaire spécialisé qui ne franchit pas ce filtre a été omis ; celui qui le franchit est glosé plutôt que développé.

Les définitions sont brèves par construction. Chaque entrée énonce la définition de travail, le domaine (OSINT, Crypto, Schéma de fraude, Analyse on-chain, ou Écosystème), les entrées connexes au sein du glossaire, et le cas échéant un renvoi à la section du whitepaper ou du playbook dans laquelle le terme est employé en contexte. Lorsqu'un terme est colloquial ou contesté, l'entrée l'indique explicitement ; lorsqu'un terme désigne une technique d'attaque, l'entrée décrit la catégorie sans devenir un manuel. L'instruction opérationnelle relève du playbook, non du dictionnaire.

Un index alphabétique complet suit les catégories. Les références, à destination du lecteur qui souhaite consulter les sources primaires, figurent après l'index. L'avertissement de clôture s'applique à l'ensemble du document.

Le glossaire est descriptif et pédagogique. Il ne fournit pas de conseil juridique, n'autorise aucune action qui serait elle-même illicite, et ne nomme aucune entité, projet, ou personne spécifiques.

---

## Catégorie A — OSINT et investigation numérique

### 1. OSINT (Open-Source Intelligence)

**Domaine** : OSINT
**Connexes** : #2, #3, #11, #15
**Voir aussi** : Investigation Checklist §5 (Collecte d'identifiants off-chain)

L'OSINT désigne la collecte et l'analyse structurées d'informations issues de sources publiquement accessibles, incluant sites web, réseaux sociaux, registres publics, archives, et jeux de données ouverts. Le terme est issu de la littérature militaire et du renseignement et a été largement adopté dans la pratique civile d'investigation.

L'OSINT se définit par le caractère public de ses sources, non par la légalité d'une méthode particulière ; toute technique publique n'est pas pour autant licite dans toutes les juridictions.

### 2. SOCMINT (Social Media Intelligence)

**Domaine** : OSINT
**Connexes** : #1, #5, #6, #14
**Voir aussi** : Investigation Checklist §5.1

Le SOCMINT est le sous-ensemble de l'OSINT centré sur les plateformes de réseaux sociaux et leur contenu public. Il inclut l'analyse des comptes, des publications, des réseaux d'interaction, et des métadonnées propres à chaque plateforme.

La frontière entre SOCMINT et pratique intrusive dépend de la plateforme : un contenu techniquement accessible peut néanmoins être protégé par les conditions d'utilisation ou par le droit de la protection des données dans la juridiction de l'analyste.

### 3. GEOINT (Geospatial Intelligence)

**Domaine** : OSINT
**Connexes** : #1, #2
**Voir aussi** : Investigation Checklist §3 (Préservation des preuves)

Le GEOINT couvre la collecte et l'analyse de l'information géographique : imagerie satellitaire, données cartographiques, contenus géotaggés, et métadonnées de localisation intégrées aux photographies ou aux publications. En enquête crypto, il intervient principalement pour vérifier des localisations revendiquées d'équipes, d'événements, ou d'infrastructures.

### 4. Pivot

**Domaine** : OSINT
**Connexes** : #1, #9, #53
**Voir aussi** : Investigation Checklist §4.3 (Relations entre adresses)

Le pivot est l'utilisation d'un identifiant déjà découvert pour en trouver d'autres connexes. Pivots typiques : passer d'un pseudonyme à une adresse e-mail, d'une adresse e-mail à un domaine, d'une adresse de wallet à une contrepartie de transaction. Une enquête réussie est en général une séquence de pivots, chacun consigné au dossier.

### 5. Sockpuppet

**Domaine** : OSINT
**Connexes** : #6, #50, #66
**Voir aussi** : Whitepaper Dark Patterns §B.1 / Investigation Checklist §5.4

Un sockpuppet est un compte en ligne opéré par un acteur distinct de l'identité que le compte présente. Les sockpuppets sont employés pour manufacturer un soutien apparent, pour harceler sous une identité fictive, ou pour diffuser des informations dont l'opérateur souhaite obscurcir la source véritable.

Le terme est d'origine informelle mais largement employé dans la littérature académique sur la manipulation des plateformes.

### 6. Astroturfing

**Domaine** : OSINT
**Connexes** : #5, #66
**Voir aussi** : Whitepaper Dark Patterns §B.1 / Investigation Checklist §6.4

L'astroturfing est l'activité coordonnée de multiples comptes — souvent des sockpuppets — conçue pour manufacturer l'apparence d'un soutien populaire spontané à une idée, un produit, ou un projet. La tromperie est structurelle : l'audience infère un consensus populaire à partir de ce qui est, en réalité, un acteur unique ou un petit groupe coordonné.

### 7. Doxxing / Doxx

**Domaine** : OSINT
**Connexes** : #1, #15
**Voir aussi** : Whitepaper Dark Patterns §E.2 / Investigation Checklist §5.2

Le doxxing est la divulgation d'informations personnelles identifiantes sur une personne dont l'identité était auparavant privée ou pseudonyme. Le terme est le plus souvent employé pour décrire une divulgation à des fins de représailles ou de harcèlement.

Dans un contexte d'enquête, consigner une identité dans un dossier en vue d'une remise légitime aux autorités est opérationnellement distinct du doxxing au sens courant ; les deux ne doivent pas être confondus.

### 8. Plain sight / Caché à la vue de tous

**Domaine** : OSINT
**Connexes** : #1, #4
**Voir aussi** : Investigation Checklist §3.1

L'expression *plain sight* (vue publique) désigne les preuves accessibles sans intrusion — publications publiques, chaînes publiques, registres publics — mais qui exigent néanmoins une collecte délibérée pour devenir utiles. L'expression compagnon *hidden in plain sight* (« caché à la vue de tous ») désigne un matériau dont la valeur probatoire est négligée parce qu'il paraît banal.

### 9. Attribution

**Domaine** : OSINT
**Connexes** : #4, #53, #58
**Voir aussi** : Investigation Checklist §8.2

L'attribution est le rattachement raisonné d'une action, d'un artefact, ou d'une adresse à un acteur déterminé. En pratique, l'attribution est toujours probabiliste : elle va de faible (un signal observable unique) à forte (plusieurs signaux indépendants, chacun vérifiable). Le dossier doit étiqueter ses attributions sur cette échelle plutôt qu'affirmer une certitude qu'il n'a pas méritée.

### 10. Chain of custody (chaîne de garde)

**Domaine** : OSINT
**Connexes** : #11, #13
**Voir aussi** : Investigation Checklist §3.2

La chaîne de garde est la séquence documentée des personnes ayant possédé un élément de preuve, à quel moment et selon quelle modalité, suffisante pour démontrer que l'élément n'a pas été altéré entre la collecte et la présentation. Le concept est emprunté à la pratique criminalistique et s'applique aux artefacts numériques ; un hash SHA-256 consigné à la collecte en constitue l'ancrage habituel.

### 11. Red team

**Domaine** : OSINT
**Connexes** : #9, #12
**Voir aussi** : Investigation Checklist §8.1 (Biais de confirmation)

La red team est une perspective dans laquelle un analyste cherche délibérément à invalider une hypothèse de travail. La discipline est l'antidote pratique au biais de confirmation et produit un dossier plus solide qu'une défense partisane de la théorie initiale.

### 12. Threat model (modèle de menace)

**Domaine** : OSINT
**Connexes** : #11, #15
**Voir aussi** : Investigation Checklist §5.2 (Ligne rouge OSINT)

Un modèle de menace est une description explicite des acteurs contre lesquels un enquêteur (ou une victime) doit se prémunir, des actions probables de ces acteurs, et du coût que l'enquêteur est prêt à supporter pour s'en prémunir. En enquête crypto, le modèle de menace guide l'arbitrage entre sécurité opérationnelle et profondeur analytique.

### 13. Indicator of Compromise (IOC)

**Domaine** : OSINT
**Connexes** : #9, #10, #43, #44
**Voir aussi** : Investigation Checklist §3.3

Un IOC est un artefact observable associé à une activité malicieuse : une adresse, un domaine, un hash de fichier, une URL, un indicateur réseau. Les IOC sont partageables entre enquêteurs lorsqu'ils sont dépouillés du contexte sensible et sont au cœur de la pratique des centres opérationnels de sécurité (SOC).

### 14. Pretexting

**Domaine** : OSINT
**Connexes** : #44, #45
**Voir aussi** : Investigation Checklist §5.2 (Ligne rouge OSINT)

Le pretexting est une catégorie d'ingénierie sociale dans laquelle un attaquant assume une identité ou un scénario fabriqués afin d'extraire de l'information d'une cible. Le terme est inclus ici en tant que catégorie rencontrée dans l'analyse d'adversaires ; il est nommé *pour être reconnu et évité*, jamais comme une méthode recommandée aux enquêteurs. Le pretexting contre un tiers constitue, dans la plupart des juridictions, une infraction.

### 15. Operational Security (OPSEC)

**Domaine** : OSINT
**Connexes** : #12, #14
**Voir aussi** : Investigation Checklist §5.2

L'OPSEC est la pratique consistant à protéger l'information non publique relative à sa propre opération contre l'inférence par des adversaires. Pour les enquêteurs, l'OPSEC inclut la séparation des wallets d'enquête et des wallets personnels, l'usage d'infrastructure jetable pour les requêtes à haut risque, et l'absence de commentaire public sur les affaires en cours.

---

## Catégorie B — Crypto et blockchain

### 16. Blockchain

**Domaine** : Crypto
**Connexes** : #18, #34, #51
**Voir aussi** : Investigation Checklist §4 (Collecte d'identifiants on-chain)

Une blockchain est un registre distribué, en mode ajout seul, maintenu par un réseau de nœuds qui s'accordent sur son état via un mécanisme de consensus. Les données sont organisées en blocs liés par des hashes cryptographiques ; une fois finalisé, le contenu du registre est durable et publiquement lisible sur la plupart des réseaux pertinents.

### 17. EOA (Externally Owned Account)

**Domaine** : Crypto
**Connexes** : #18, #22, #34
**Voir aussi** : Investigation Checklist §4.1

Un EOA est une adresse blockchain contrôlée par une clé privée détenue en dehors de la chaîne elle-même, par opposition à une adresse de smart contract dont le comportement est régi par le code déployé. La distinction est essentielle à l'analyse on-chain : un EOA n'agit que lorsque son détenteur signe, tandis qu'un contrat agit selon les conditions inscrites dans son code.

### 18. Smart contract

**Domaine** : Crypto
**Connexes** : #16, #17, #19, #67
**Voir aussi** : Investigation Checklist §4.1

Un smart contract est du code déployé sur une blockchain qui s'exécute de manière déterministe lorsqu'il est invoqué par une transaction. Les contrats peuvent détenir des soldes, appeler d'autres contrats, et imposer des conditions arbitraires aux transferts, sous réserve du coût en gas de la computation.

### 19. Token / Contrat de token

**Domaine** : Crypto
**Connexes** : #18, #20, #33
**Voir aussi** : Investigation Checklist §4.2

Un token est une unité de valeur suivie par un contrat de token, distincte de la devise native de la chaîne sous-jacente. Un contrat de token est un smart contract qui maintient les soldes de nombreuses adresses et expose des fonctions de transfert ; les soldes sont des entrées dans l'état du contrat, non des objets de registre séparés.

### 20. ERC-20 / SPL / équivalents

**Domaine** : Crypto
**Connexes** : #19, #33
**Voir aussi** : Investigation Checklist §4.2

L'ERC-20 est un standard d'interface pour contrats de tokens sur Ethereum et sur la plupart des chaînes compatibles EVM, définissant un ensemble minimal de fonctions (transfer, approve, requêtes de solde). Le SPL en est l'équivalent sur Solana. D'autres écosystèmes définissent leurs propres conventions ; les standards sont un échafaudage d'interopérabilité, non une garantie de confiance.

### 21. Wallet

**Domaine** : Crypto
**Connexes** : #17, #22
**Voir aussi** : Investigation Checklist §4.1

Un wallet, dans l'usage courant, est la combinaison d'une application utilisateur et des clés qu'elle gère. Les wallets *custodial* sont opérés par un service qui détient les clés ; les wallets *non-custodial* placent les clés entre les mains de l'utilisateur. Les wallets *hot* sont connectés au réseau pendant l'usage ordinaire ; les wallets *cold* restent hors ligne sauf au moment de signer. Le choix conditionne à la fois l'exposition de l'utilisateur et les possibilités de récupération pour l'enquêteur.

### 22. Clé privée / phrase de récupération

**Domaine** : Crypto
**Connexes** : #17, #21, #43
**Voir aussi** : Investigation Checklist §2.2 (À ne pas faire)

Une clé privée est le secret cryptographique qui autorise les transactions depuis une adresse donnée. Une phrase de récupération (*seed phrase*), généralement une suite de mots, est un encodage humainement lisible d'une ou plusieurs clés privées. La possession de l'une ou de l'autre confère le contrôle complet du wallet correspondant.

Les phrases de récupération ne doivent jamais être collectées auprès des victimes au-delà du strict minimum nécessaire et ne doivent jamais être conservées dans le matériau du dossier.

### 23. Gas / frais de gas

**Domaine** : Crypto
**Connexes** : #16, #18
**Voir aussi** : Investigation Checklist §4.1

Le gas est l'unité de coût computationnel sur Ethereum et sur la plupart des chaînes EVM ; les *frais de gas* sont le prix payé pour le gas consommé par une transaction. D'autres chaînes ont des modèles de frais différents, mais le principe est similaire : les transactions paient pour la computation et le stockage qu'elles imposent au réseau.

### 24. Slippage

**Domaine** : Crypto
**Connexes** : #26, #27, #41, #42
**Voir aussi** : Whitepaper Dark Patterns §C.2

Le slippage est l'écart entre le prix annoncé pour un swap et le prix auquel il est effectivement exécuté. La *tolérance de slippage* fixée par l'utilisateur est l'écart maximal qu'il autorise ; c'est une permission accordée au contrat de routage. Un slippage par défaut élevé constitue un vecteur documenté d'extraction de valeur.

### 25. MEV (Maximal Extractable Value)

**Domaine** : Crypto
**Connexes** : #41, #42
**Voir aussi** : Investigation Checklist §8.3

La MEV est la valeur qui peut être extraite en réordonnant, en incluant, ou en excluant des transactions à l'intérieur d'un bloc, au-delà des frais standards. Elle capture l'effet économique du fait que les proposeurs de blocs (et les chercheurs qui les alimentent) disposent d'un pouvoir privilégié sur le séquencement des transactions.

### 26. Liquidity Pool (LP) — pool de liquidité

**Domaine** : Crypto
**Connexes** : #19, #27, #29, #36
**Voir aussi** : Investigation Checklist §4.4

Un pool de liquidité est un smart contract qui détient une paire (ou un ensemble) d'actifs et qui prix les swaps contre ses réserves. Les fournisseurs de liquidité y déposent des actifs et reçoivent des *LP tokens* représentant une créance proportionnelle sur le pool, y compris sur les frais de transaction qu'il accumule.

### 27. AMM (Automated Market Maker)

**Domaine** : Crypto
**Connexes** : #26, #29
**Voir aussi** : Investigation Checklist §4.4

Un AMM est une conception de teneur de marché qui prix les échanges de manière algorithmique contre un pool de liquidité, plutôt qu'en appariant des contreparties sur un carnet d'ordres. La formule de produit constant en est la variante la plus simple ; de nombreuses extensions existent pour la liquidité concentrée et d'autres spécialisations.

### 28. CEX (Centralized Exchange)

**Domaine** : Crypto
**Connexes** : #29
**Voir aussi** : Investigation Checklist §4.3

Un CEX est une plateforme centralisée qui détient les actifs de ses clients et apparie les ordres sur un carnet géré sous son contrôle opérationnel. Les adresses de dépôt des CEX sont des points charnières en enquête on-chain, car elles se situent à la frontière entre la chaîne publique et les informations clients non publiques.

### 29. DEX (Decentralized Exchange)

**Domaine** : Crypto
**Connexes** : #26, #27, #28
**Voir aussi** : Whitepaper Dark Patterns §C

Un DEX est un exchange dont les échanges sont exécutés par des smart contracts sur une blockchain publique, typiquement contre des pools AMM, sans opérateur centralisé détenant les actifs des clients. L'utilisateur interagit directement avec le protocole depuis son propre wallet.

### 30. Bridge (passerelle inter-chaînes)

**Domaine** : Crypto
**Connexes** : #33
**Voir aussi** : Investigation Checklist §4.3

Un bridge est un protocole qui permet à des actifs ou à des messages de circuler entre blockchains. Les bridges verrouillent ou brûlent typiquement des actifs sur la chaîne source puis les frappent ou les libèrent sur la chaîne de destination ; leur sécurité dépend de l'intégrité du protocole de pontage et des parties qui l'opèrent.

### 31. Mixer / Tumbler

**Domaine** : Crypto
**Connexes** : #30, #56, #57
**Voir aussi** : Investigation Checklist §4.3

Un mixer (parfois appelé tumbler) est un protocole qui mutualise les dépôts de nombreux utilisateurs et redistribue les fonds à des adresses fraîches, dans l'intention de briser le lien public entre source et destination. Plusieurs mixers ont fait l'objet de mesures réglementaires dans des juridictions majeures ; le statut juridique de leur usage ou de leur opération varie.

### 32. Stablecoin

**Domaine** : Crypto
**Connexes** : #19, #33
**Voir aussi** : Investigation Checklist §4.4

Un stablecoin est un token dont la valeur est conçue pour suivre un actif de référence, le plus souvent le dollar américain. Les mécanismes varient : adossement fiat (détenu par un émetteur), adossement crypto (sur-collatéralisé en un autre actif), et algorithmique (maintenu par des interventions au niveau du protocole, de fiabilité variable).

### 33. Wrapped token (token enveloppé)

**Domaine** : Crypto
**Connexes** : #19, #30
**Voir aussi** : Investigation Checklist §4.2

Un wrapped token est un token sur une chaîne qui représente un actif natif d'une autre chaîne (ou d'un autre standard sur la même chaîne). L'opération wrap-unwrap est en général réalisée par un bridge ou par un dépositaire désigné.

### 34. Block height / numéro de bloc

**Domaine** : Crypto
**Connexes** : #16, #51
**Voir aussi** : Investigation Checklist §3.3

Le block height est le numéro séquentiel d'un bloc à l'intérieur de sa chaîne, employé comme identifiant stable et ordonné de l'état de la chaîne à un instant donné. Sur les chaînes qui produisent des blocs à intervalles irréguliers (notamment Solana), l'analogue est le *slot* ou un identifiant équivalent.

### 35. txhash (hash de transaction)

**Domaine** : Crypto
**Connexes** : #10, #16, #51
**Voir aussi** : Investigation Checklist §3.3

Le txhash est l'identifiant unique d'une transaction confirmée sur une blockchain, dérivé du hash cryptographique du contenu sérialisé de la transaction. Dans un dossier, le txhash est la citation minimale nécessaire pour qu'un tiers puisse récupérer et re-vérifier la transaction sous-jacente.

---

## Catégorie C — Schémas de fraude crypto

### 36. Rugpull

**Domaine** : Schéma de fraude
**Connexes** : #37, #26, #50
**Voir aussi** : Whitepaper Dark Patterns §D / Investigation Checklist §7.6 (C6 — Motifs détectés)

Un rugpull est un schéma de fraude dans lequel les fondateurs ou opérateurs d'un projet crypto retirent toute la liquidité ou vendent leurs réserves de token peu après en avoir fait la promotion, laissant les détenteurs avec des actifs sans valeur ou non négociables. Les rugpulls combinent typiquement un retrait de liquidité on-chain et un abandon off-chain des communications et de l'infrastructure.

Le terme est colloquial ; la qualification juridique varie selon la juridiction (fraude, manquement à une obligation fiduciaire, manipulation de marché, ou autre).

### 37. Exit scam

**Domaine** : Schéma de fraude
**Connexes** : #36, #50
**Voir aussi** : Whitepaper Dark Patterns §D.1

Un exit scam est la catégorie plus large de fraudes dans lesquelles les opérateurs d'un service lèvent des fonds (via une vente de tokens, un produit de rendement, ou un exchange hébergé) puis disparaissent avec les actifs déposés. Les rugpulls en sont un sous-ensemble ; le terme s'applique également aux services crypto non tokenisés.

### 38. Honeypot (token piège)

**Domaine** : Schéma de fraude
**Connexes** : #19, #43
**Voir aussi** : Whitepaper Dark Patterns §C.4

Un token honeypot admet les entrées mais bloque ou taxe punitivement les sorties. Le blocage peut être implémenté comme un revert au niveau du contrat sur le chemin de vente, comme une taxe de vente à 100 %, ou comme un cooldown caché ; l'utilisateur observe un achat réussi et suppose à tort une liquidité de sortie symétrique.

*Note : en cybersécurité classique, "honeypot" désigne également un système-leurre défensif conçu pour attirer et étudier des attaquants. Le présent glossaire utilise le sens crypto-token uniquement.*

### 39. Pump and dump

**Domaine** : Schéma de fraude
**Connexes** : #40, #50, #61
**Voir aussi** : Whitepaper Dark Patterns §A, §B

Un pump-and-dump est un effort coordonné visant à gonfler le prix d'un actif par une activité promotionnelle, puis à vendre dans la demande artificielle créée. Le mécanisme précède le crypto ; sur des chaînes sans permission, il est accéléré par l'absence de contrôle à la cotation et par la vitesse de propagation des narratifs coordonnés sur les réseaux sociaux.

### 40. Wash trading

**Domaine** : Schéma de fraude
**Connexes** : #39, #58
**Voir aussi** : Investigation Checklist §8.3

Le wash trading est la pratique consistant à échanger entre comptes contrôlés par le même acteur afin de manufacturer un volume ou un prix apparent. La détection on-chain repose sur le clustering heuristique et sur des motifs incompatibles avec des échanges à distance ; les chiffres de volume on-chain qui incluent du wash trading surestiment systématiquement l'activité économique réelle. Également pertinent pour l'analyse on-chain, lorsqu'il est mesuré par les motifs de graphe transactionnel et les heuristiques temporelles.

### 41. Front-running

**Domaine** : Schéma de fraude
**Connexes** : #25, #42
**Voir aussi** : Whitepaper Dark Patterns §C.2

Le front-running est la pratique consistant à observer une transaction en attente (typiquement dans une mempool publique) et à soumettre une transaction qui tire parti de l'exécution anticipée de la transaction observée. Sur les réseaux sans permission, le front-running est l'un des principaux canaux d'extraction de MEV.

### 42. Attaque sandwich

**Domaine** : Schéma de fraude
**Connexes** : #24, #25, #41
**Voir aussi** : Whitepaper Dark Patterns §C.2

Une attaque sandwich est une technique spécifique de MEV dans laquelle un attaquant place un ordre d'achat immédiatement avant, et un ordre de vente immédiatement après, le swap d'une victime, profitant de l'impact prix créé par le swap de cette dernière. Une tolérance de slippage par défaut élevée est un facteur contributif.

### 43. Drainer

**Domaine** : Schéma de fraude
**Connexes** : #22, #49
**Voir aussi** : Whitepaper Dark Patterns §C.1

Un drainer est une catégorie de smart contract ou de script malveillant qui, une fois autorisé par une signature de la victime, transfère la valeur hors du wallet de celle-ci. Les drainers sont le plus souvent diffusés via des sites de phishing imitant des front-ends légitimes ; l'utilisateur signe une approbation ou un transfert en croyant interagir avec un protocole familier.

### 44. Phishing (spécifique au crypto)

**Domaine** : Schéma de fraude
**Connexes** : #13, #43, #50
**Voir aussi** : Whitepaper Dark Patterns §E.1

Le phishing crypto est l'usage de sites trompeurs, de messages, ou d'usurpation d'identité pour amener un utilisateur à signer une transaction malveillante ou à divulguer une phrase de récupération. Le médium du préjudice — une transaction blockchain irréversible — rend les conséquences plus graves que dans le phishing consumer ordinaire.

### 45. SIM swap

**Domaine** : Schéma de fraude
**Connexes** : #14, #44
**Voir aussi** : Investigation Checklist §5.2

Un SIM swap est une attaque dans laquelle un acteur amène un opérateur de réseau mobile à transférer le numéro de téléphone d'une victime vers une SIM qu'il contrôle, défaisant toute authentification à deux facteurs reposant sur le SMS. Le terme est inclus ici à des fins de reconnaissance ; ce glossaire ne documente aucune méthode opérationnelle. Les enquêteurs ne déploient pas de techniques de SIM swap.

### 46. Sybil attack

**Domaine** : Schéma de fraude
**Connexes** : #5, #6
**Voir aussi** : Investigation Checklist §6.4

Une Sybil attack est une attaque sur un système dans lequel un acteur unique contrôle de nombreuses identités distinctes pour gagner une influence disproportionnée — sur un vote, sur l'allocation d'un airdrop, sur une métrique de réputation, ou sur la perception au sein d'un réseau social. Le terme est issu de la recherche en systèmes distribués et est largement employé dans les contextes crypto.

### 47. Dusting attack

**Domaine** : Schéma de fraude
**Connexes** : #53, #55
**Voir aussi** : Investigation Checklist §4.3

Une dusting attack est l'envoi d'un montant trivial de token à de nombreuses adresses, typiquement dans l'intention de suivre les mouvements ultérieurs en vue de désanonymiser les destinataires, ou d'amorcer une tentative de phishing à leur encontre. Les destinataires de dust doivent éviter d'interagir avec les tokens reçus.

### 48. Address poisoning (empoisonnement d'adresse)

**Domaine** : Schéma de fraude
**Connexes** : #35, #44
**Voir aussi** : Investigation Checklist §3.3

L'address poisoning est l'usage d'une adresse visuellement proche de celle d'une contrepartie récente de la cible, envoyée dans une transaction de faible valeur, dans l'espoir que la cible copiera ensuite l'adresse empoisonnée depuis son historique de transactions et enverra des fonds à l'attaquant. La défense repose sur la comparaison d'adresses complètes plutôt que sur les affichages tronqués.

### 49. Approval exploit

**Domaine** : Schéma de fraude
**Connexes** : #20, #43
**Voir aussi** : Whitepaper Dark Patterns §C.1

Un approval exploit est l'abus d'une approbation ERC-20 (ou analogue) qu'un utilisateur a précédemment accordée à un contrat, lorsque ce contrat se révèle ensuite malveillant ou est compromis. Les approbations illimitées en sont la variante la plus préjudiciable ; une approbation unique accordée peut être épuisée à tout moment tant qu'elle n'a pas été révoquée.

### 50. Usurpation (token / marque)

**Domaine** : Schéma de fraude
**Connexes** : #5, #36, #44
**Voir aussi** : Whitepaper Dark Patterns §E.1

L'usurpation, dans le contexte crypto, recouvre les tokens qui imitent le nom ou l'image d'un projet légitime, les front-ends qui imitent un site légitime, et les comptes qui imitent une équipe légitime. L'utilisateur est conduit à confondre l'usurpateur et l'original ; les conséquences vont des tokens sans valeur au vol direct via phishing.

---

## Catégorie D — Analyse on-chain

### 51. Block explorer

**Domaine** : Analyse on-chain
**Connexes** : #16, #34, #35
**Voir aussi** : Investigation Checklist §4.5

Un block explorer est un site ou une application qui expose le contenu d'une blockchain sous une forme humainement lisible : transactions, adresses, contrats, blocs. Les block explorers sont des outils primaires pour les recherches individuelles ; leurs labels ne sont pas audités et doivent être employés avec prudence en pratique d'enquête. Les enquêteurs renvoient à des *block explorers* de manière générique plutôt qu'à un produit commercial spécifique.

### 52. Chain analysis (analyse de chaîne)

**Domaine** : Analyse on-chain
**Connexes** : #53, #57, #58
**Voir aussi** : Investigation Checklist §4.5

L'analyse de chaîne est l'étude structurée des graphes de transactions blockchain, incluant le regroupement d'adresses en entités et le suivi des flux. La discipline combine des requêtes déterministes (ce qui figure on-chain) et des heuristiques (ce qui est probablement vrai des entités), ces dernières exigeant un étiquetage soigneux.

### 53. Clustering (heuristique)

**Domaine** : Analyse on-chain
**Connexes** : #52, #54, #58
**Voir aussi** : Investigation Checklist §4.3

Le clustering est le regroupement d'adresses présumées contrôlées par la même entité, sur la base d'un comportement observable. Heuristiques courantes : l'heuristique d'entrée commune (voir #54), le partage d'adresses de change, et le financement coordonné. Les clusters heuristiques sont des hypothèses de travail, non des faits.

### 54. Heuristique d'entrée commune (common-input)

**Domaine** : Analyse on-chain
**Connexes** : #53
**Voir aussi** : Investigation Checklist §4.3

L'heuristique d'entrée commune, formulée à l'origine pour les chaînes à modèle UTXO, postule que si plusieurs adresses sont utilisées comme entrées dans la même transaction, elles sont vraisemblablement contrôlées par le même acteur. L'heuristique est approximative ; CoinJoin et les protocoles de mixage analogues en sont des contre-exemples délibérés.

### 55. Peeling chain (chaîne d'épluchage)

**Domaine** : Analyse on-chain
**Connexes** : #31, #56
**Voir aussi** : Investigation Checklist §4.3

Une chaîne d'épluchage est un motif de transferts successifs dans lequel une adresse envoie l'essentiel de son solde à une adresse fraîche et un reliquat à une autre adresse, motif répété. Le pattern est associé à l'obfuscation de flux importants et à la consolidation de produits ; les petits « épluchés » peuvent finir par atteindre un point de cashout.

### 56. Mixing / unmixing

**Domaine** : Analyse on-chain
**Connexes** : #31, #55, #57
**Voir aussi** : Investigation Checklist §4.3

Le mixing est l'usage d'un mixer ou d'un protocole analogue pour brouiller la relation source-destination. L'*unmixing* désigne l'effort analytique pour défaire le mixing par analyse temporelle, appariement de montants, et empreinte comportementale. L'unmixing est rarement déterministe ; les conclusions doivent être formulées avec l'incertitude qui convient.

### 57. Taint analysis (analyse de contamination)

**Domaine** : Analyse on-chain
**Connexes** : #52, #56
**Voir aussi** : Investigation Checklist §4.3

L'analyse de contamination est la propagation d'un label (par ex. « volé ») à travers le graphe de transactions depuis une source connue. Les méthodologies varient : la contamination « poison » marque tout ce qui est atteignable, tandis que les approches dites *haircut* ou FIFO distribuent la contamination de manière proportionnelle. Le choix de méthodologie affecte matériellement les conclusions et doit être divulgué.

### 58. Attribution heuristique vs déterministe

**Domaine** : Analyse on-chain
**Connexes** : #9, #52, #53
**Voir aussi** : Investigation Checklist §8.2

Une attribution *déterministe* repose sur des faits directement dérivables des données on-chain (par ex. cette adresse a signé cette transaction). Une attribution *heuristique* repose sur une inférence probabiliste (par ex. cette adresse appartient à un cluster détenu par l'entité X). Confondre les deux figure parmi les erreurs méthodologiques les plus fréquentes dans l'analyse de chaîne tournée vers le retail.

### 59. Label / tag d'adresse

**Domaine** : Analyse on-chain
**Connexes** : #51, #52
**Voir aussi** : Investigation Checklist §4.1

Un label (ou tag) d'adresse est une métadonnée humainement lisible associée à une adresse : par exemple le nom d'un exchange, ou un marquage de scammer connu. Les labels sont produits par des block explorers, par des plateformes commerciales d'analyse de chaîne, et par des listes communautaires. Ils sont utiles comme pistes et dangereux comme conclusions ; la source et la date d'un label doivent toujours être consignées.

### 60. Liquidity sniping

**Domaine** : Analyse on-chain
**Connexes** : #26, #41, #65
**Voir aussi** : Whitepaper Dark Patterns §C.1

Le liquidity sniping est l'usage de bots automatisés pour détecter l'ajout de liquidité fraîchement créée pour un token et exécuter un achat dans le même bloc (ou aussitôt que possible après), profitant de la découverte de prix typique au lancement. Les snipers peuvent être opérés par l'équipe qui lance le token elle-même, ce qui transforme la pratique en une forme de front-running pré-arrangé des acheteurs retail.

---

## Catégorie E — Acteurs et écosystème

### 61. KOL (Key Opinion Leader)

**Domaine** : Écosystème
**Connexes** : #6, #39, #66
**Voir aussi** : Whitepaper Dark Patterns §B.2

Un KOL est un compte à forte portée dont les approbations influencent les abonnés. Dans l'univers crypto, l'économie des KOLs inclut placements rémunérés, allocations en token, et participation directe au capital des projets promus ; les obligations de divulgation varient selon la juridiction et sont inégalement respectées en pratique.

### 62. Investisseur retail

**Domaine** : Écosystème
**Connexes** : #63, #64
**Voir aussi** : Whitepaper Dark Patterns §2.2

Un investisseur retail, dans ce contexte, est un participant individuel non professionnel des marchés crypto, par opposition aux participants institutionnels. La population retail est la cible de la plupart des cadres de protection des consommateurs et de la plupart des motifs de manipulation documentés dans le whitepaper.

### 63. Whale (baleine)

**Domaine** : Écosystème
**Connexes** : #62, #64
**Voir aussi** : Investigation Checklist §4.1

Une whale est le détenteur d'une position importante sur un token ou une chaîne donnée, suffisante pour faire bouger le prix ou pour dominer les votes de gouvernance par ses actions. Le terme est colloquial et dépendant de seuils : « important » varie selon l'actif.

### 64. Teneur de marché (légitime vs adversarial)

**Domaine** : Écosystème
**Connexes** : #27, #40, #65
**Voir aussi** : Whitepaper Dark Patterns §C

Un teneur de marché est un participant qui fournit une liquidité à l'achat et à la vente sur un marché, en tirant profit du spread et de stratégies de gestion des positions. Le teneur de marché légitime fait l'objet de contrats et de divulgations ; le teneur adversarial, en contexte retail, peut inclure du wash trading coordonné ou un soutien de prix pré-arrangé visant à attirer des victimes.

### 65. Bot / sniper bot

**Domaine** : Écosystème
**Connexes** : #60, #41
**Voir aussi** : Whitepaper Dark Patterns §C.1

Un bot est tout script automatisé qui exécute des actions on-chain ou off-chain sans intervention humaine par action. Un *sniper bot* est le cas particulier d'un bot conçu pour agir à la première occasion d'un événement cible — par exemple, acheter un token dans le même bloc que son premier ajout de liquidité.

### 66. Influenceur / shill

**Domaine** : Écosystème
**Connexes** : #6, #39, #61
**Voir aussi** : Whitepaper Dark Patterns §B.2

Un influenceur est, au sens large, tout compte dont les approbations déplacent de l'attention. *Shill* est un sous-ensemble péjoratif désignant un compte rémunéré ou autrement compensé pour promouvoir un projet sans divulgation ; le terme est colloquial mais largement employé dans le champ.

### 67. Auditeur (audit de smart contract)

**Domaine** : Écosystème
**Connexes** : #18, #68
**Voir aussi** : Whitepaper Dark Patterns §D.3

Un auditeur de smart contract est une entité (typiquement un cabinet) mandatée pour examiner le code d'un contrat déployé ou en passe de l'être, à la recherche de vulnérabilités et de problèmes de conception. Les rapports d'audit ne sont pas des assurances ; leur périmètre est borné, leurs conclusions sont versionnées sur un bytecode donné, et les modifications post-audit sont fréquentes.

### 68. Bug bounty

**Domaine** : Écosystème
**Connexes** : #67, #69
**Voir aussi** : Investigation Checklist §9.1

Un bug bounty est un programme par lequel un projet récompense les chercheurs externes qui divulguent de manière responsable des vulnérabilités. Les plateformes de bug bounty structurent la relation entre le chercheur et le projet, incluant le périmètre, la rémunération, et la confidentialité.

### 69. White hat / grey hat / black hat

**Domaine** : Écosystème
**Connexes** : #11, #68
**Voir aussi** : Investigation Checklist §5.2

Ces termes désignent un spectre d'éthiques pour le praticien en sécurité : un *white hat* divulgue les vulnérabilités via les canaux légitimes ; un *black hat* les exploite pour son propre profit ; un *grey hat* opère entre les deux, divulguant parfois, mais agissant parfois unilatéralement sur ses découvertes. Les labels sont informels et contestés.

### 70. Self-regulatory organization (SRO) — organisme d'autorégulation

**Domaine** : Écosystème
**Connexes** : #62, #67
**Voir aussi** : Investigation Checklist §9.1

Une SRO est un organisme professionnel qui édicte des standards engageant ses membres, en complément ou à la place d'une régulation publique. Dans les contextes crypto, les SROs sont émergentes et leur autorité est contestée ; leur mention apparaît là où elles constituent un interlocuteur adressable, non lorsqu'elles se substituent à l'autorité légale.

---

## Index alphabétique

- Address poisoning (empoisonnement d'adresse) — #48
- AMM (Automated Market Maker) — #27
- Approval exploit — #49
- Astroturfing — #6
- Attaque sandwich — #42
- Attribution — #9
- Attribution heuristique vs déterministe — #58
- Auditeur (audit de smart contract) — #67
- Block explorer — #51
- Block height / numéro de bloc — #34
- Blockchain — #16
- Bot / sniper bot — #65
- Bridge (passerelle inter-chaînes) — #30
- Bug bounty — #68
- CEX (Centralized Exchange) — #28
- Chain analysis (analyse de chaîne) — #52
- Chain of custody (chaîne de garde) — #10
- Clé privée / phrase de récupération — #22
- Clustering (heuristique) — #53
- DEX (Decentralized Exchange) — #29
- Doxxing / Doxx — #7
- Drainer — #43
- Dusting attack — #47
- EOA (Externally Owned Account) — #17
- ERC-20 / SPL / équivalents — #20
- Exit scam — #37
- Front-running — #41
- Gas / frais de gas — #23
- GEOINT (Geospatial Intelligence) — #3
- Heuristique d'entrée commune (common-input) — #54
- Honeypot (token piège) — #38
- Indicator of Compromise (IOC) — #13
- Influenceur / shill — #66
- Investisseur retail — #62
- KOL (Key Opinion Leader) — #61
- Label / tag d'adresse — #59
- Liquidity Pool (LP) — pool de liquidité — #26
- Liquidity sniping — #60
- MEV (Maximal Extractable Value) — #25
- Mixer / Tumbler — #31
- Mixing / unmixing — #56
- OPSEC (Operational Security) — #15
- OSINT (Open-Source Intelligence) — #1
- Peeling chain (chaîne d'épluchage) — #55
- Phishing (spécifique au crypto) — #44
- Pivot — #4
- Plain sight / Caché à la vue de tous — #8
- Pretexting — #14
- Pump and dump — #39
- Red team — #11
- Rugpull — #36
- Self-regulatory organization (SRO) — #70
- SIM swap — #45
- Slippage — #24
- Smart contract — #18
- SOCMINT (Social Media Intelligence) — #2
- Sockpuppet — #5
- Stablecoin — #32
- Sybil attack — #46
- Taint analysis (analyse de contamination) — #57
- Teneur de marché — #64
- Threat model (modèle de menace) — #12
- Token / Contrat de token — #19
- txhash (hash de transaction) — #35
- Usurpation (token / marque) — #50
- Wallet — #21
- Wash trading — #40
- Whale (baleine) — #63
- White hat / grey hat / black hat — #69
- Wrapped token (token enveloppé) — #33

---

## Références

Les sources suivantes ont nourri plusieurs des définitions ci-dessus. Le lecteur est encouragé à consulter directement les supports primaires ; les publications institutionnelles sont localisées par leur émetteur plutôt que par leur URL, les URL étant instables.

1. Agence de l'Union européenne pour la cybersécurité (ENISA). *Threat Landscape*, éditions annuelles. ENISA.
2. Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, éditions annuelles. Publications d'Europol.
3. Groupe d'action financière (GAFI). (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. FATF.
4. National Institute of Standards and Technology. (Dates diverses). *Glossary of Key Information Security Terms* (NIST IR 7298). NIST.
5. Organisation internationale de normalisation. *ISO/IEC 27000* (édition en vigueur). Définitions des termes de sécurité de l'information utilisés ici pour les entrées OPSEC, IOC, et chaîne de garde.
6. Möser, M., Böhme, R., & Breuker, D. (2013). *An Inquiry into Money Laundering Tools in the Bitcoin Ecosystem*. eCrime Researchers Summit. Référence fondatrice sur le mixing et l'unmixing.
7. Meiklejohn, S., Pomarole, M., Jordan, G., Levchenko, K., McCoy, D., Voelker, G. M., & Savage, S. (2013). *A Fistful of Bitcoins: Characterizing Payments Among Men with No Names*. ACM Internet Measurement Conference. Référence fondatrice sur l'heuristique d'entrée commune.

---

## Avertissement

Ce document est éducatif. Il décrit un vocabulaire et ne nomme aucune entité, projet, personne, ou affaire spécifiques. Il ne constitue pas un conseil juridique, n'autorise aucune action qui serait illicite dans la juridiction du lecteur, et ne se substitue pas aux procédures institutionnelles d'une autorité.

Plusieurs entrées renvoient à des techniques associées à des conduites infractionnelles (notamment les entrées sur le phishing, les drainers, le SIM swap, le pretexting, et l'usurpation). Ces entrées sont descriptives de la catégorie, non des instructions opérationnelles à son sujet ; les enquêteurs ne déploient pas ces techniques, et la lecture de ce glossaire ne confère aucune autorisation à le faire.

La qualification juridique des motifs nommés en catégorie C varie selon la juridiction. Les renvois à la fraude, à la manipulation de marché, et aux catégories connexes sont synthétiques par nature et ne se substituent pas à un avis émis par un conseil qualifié dans la juridiction concernée.

INTERLIGENS Research, 2026. Sous licence Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Autorisé à être redistribué et adapté à des fins non commerciales avec attribution.
